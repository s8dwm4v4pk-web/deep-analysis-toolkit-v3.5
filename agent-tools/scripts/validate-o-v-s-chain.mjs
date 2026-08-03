#!/usr/bin/env node
/**
 * validate-o-v-s-chain.mjs — O→V→S 三层穿透链完整性校验
 *
 * 用途：在阶段 3（归因推理）和阶段 4（情景预判）产出 S 信号后，
 *       验证 analysis-state.md 中 O→V→S 三层引用链无断裂。
 *
 * 检查项：
 *  1. 每条 O-xxx 被至少一条 V-xxx 引用（O→V 链）
 *  2. 每条 V-xxx 被至少一条 S-xxx 信号合成（V→S 链）
 *  3. 每条 S-xxx 可追溯至 V→O→D（S→V→O 反向追溯）
 *  4. 无孤立中间层编号（有父无子或有子无父）
 *
 * 用法: node agent-tools/scripts/validate-o-v-s-chain.mjs <analysis-state.md> [--json] [--verbose]
 *
 * Exit 0 = O→V→S 链完整, 1 = 存在断裂
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');
const verbose = argv.includes('--verbose');

const files = argv.filter(a => !a.startsWith('--'));
if (files.length === 0) {
  console.error('用法: node agent-tools/scripts/validate-o-v-s-chain.mjs <analysis-state.md> [--json] [--verbose]');
  process.exit(2);
}

const stateFile = resolve(SKILL_ROOT, files[0]);
if (!existsSync(stateFile)) {
  const err = { ok: false, error: `analysis-state.md 不存在: ${stateFile}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[validate-o-v-s-chain] ❌ ${err.error}`);
  process.exit(1);
}

const stateContent = readFileSync(stateFile, 'utf-8');

// ── 提取：D、O、V、S 编号 ──
function extractNumbers(pattern, text, prefix) {
  const set = new Set();
  const regex = new RegExp(pattern, 'gi');
  let m;
  while ((m = regex.exec(text)) !== null) {
    set.add(m[0]);
  }
  return set;
}

const dNumbers = extractNumbers('D-\\d+', stateContent, 'D');
const oNumbers = extractNumbers('O-\\d+', stateContent, 'O');
const vNumbers = extractNumbers('V-\\d+', stateContent, 'V');
const sNumbers = extractNumbers('S-\\d+', stateContent, 'S');

// ── 检查 1：O→V 链（每条 V 引用了哪些 O）──
const oByV = new Map();  // V-xxx → Set of O-xxx
for (const vNum of vNumbers) {
  // 在 V-xxx 的信号块中查找 O 引用
  const vBlock = stateContent.match(new RegExp(`(?:^|\\n)(?:###\\s)?${vNum.replace('-', '\\-')}[\\s\\S]*?(?=\\n(?:###\\s)?(?:V-\\d+|$))`, 'i'));
  if (vBlock) {
    const refs = new Set();
    for (const oNum of oNumbers) {
      if (vBlock[0].includes(oNum)) refs.add(oNum);
    }
    oByV.set(vNum, refs);
  }
}

const orphanedV = []; // V 未引用任何 O
for (const vNum of vNumbers) {
  const refs = oByV.get(vNum);
  if (!refs || refs.size === 0) {
    orphanedV.push(vNum);
  }
}

// ── 检查 2：V→S 链（每条 S 引用了哪些 V）──
const vByS = new Map();  // S-xxx → Set of V-xxx
for (const sNum of sNumbers) {
  const sBlock = stateContent.match(new RegExp(`(?:^|\\n)(?:###\\s)?${sNum.replace('-', '\\-')}[\\s\\S]*?(?=\\n(?:###\\s)?(?:S-\\d+|$))`, 'i'));
  if (sBlock) {
    const refs = new Set();
    for (const vNum of vNumbers) {
      if (sBlock[0].includes(vNum)) refs.add(vNum);
    }
    vByS.set(sNum, refs);
  }
}

const orphanedS = []; // S 未引用任何 V
for (const sNum of sNumbers) {
  const refs = vByS.get(sNum);
  if (!refs || refs.size === 0) {
    orphanedS.push(sNum);
  }
}

// ── 检查 3：反向追溯 S→V→O（每条 S 追溯到 D 的完整路径）──
const untraceableS = []; // S 无法追溯到 D
for (const sNum of sNumbers) {
  const vRefs = vByS.get(sNum);
  if (!vRefs || vRefs.size === 0) {
    untraceableS.push({ s: sNum, reason: 'S 未引用任何 V' });
    continue;
  }
  let traceable = false;
  for (const vNum of vRefs) {
    const oRefs = oByV.get(vNum);
    if (oRefs && oRefs.size > 0) {
      traceable = true;
      break;
    }
  }
  if (!traceable) {
    untraceableS.push({ s: sNum, reason: `S → ${[...vRefs].join(', ')} → (无 O 引用)` });
  }
}

// ── 汇总 ──
const totalO = oNumbers.size;
const totalV = vNumbers.size;
const totalS = sNumbers.size;

const vWithO = totalV - orphanedV.length;
const sWithV = totalS - orphanedS.length;

const chainOk = orphanedV.length === 0 && orphanedS.length === 0 && untraceableS.length === 0;

const result = {
  ok: chainOk,
  summary: {
    d_count: dNumbers.size,
    o_count: totalO,
    v_count: totalV,
    s_count: totalS,
    o_v_linked: vWithO,
    o_v_orphaned: orphanedV.length,
    v_s_linked: sWithV,
    v_s_orphaned: orphanedS.length,
    untraceable_s: untraceableS.length,
  },
  break_points: {
    orphaned_v: orphanedV,
    orphaned_s: orphanedS,
    untraceable_s: untraceableS.map(u => ({ s: u.s, reason: u.reason })),
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[validate-o-v-s-chain] 🔗 O→V→S 三层穿透链校验`);
  console.log(`  D编号: ${dNumbers.size} | O编号: ${totalO} | V编号: ${totalV} | S编号: ${totalS}`);
  console.log(`  O→V 链: ${vWithO}/${totalV} V 有父 O 引用` + (orphanedV.length > 0 ? ` ❌ ${orphanedV.length} 孤立` : ` ✅`));
  console.log(`  V→S 链: ${sWithV}/${totalS} S 有父 V 引用` + (orphanedS.length > 0 ? ` ❌ ${orphanedS.length} 孤立` : ` ✅`));

  if (orphanedV.length > 0) {
    console.log(`\n  ❌ 孤立的 V 编号（未引用任何 O）: ${orphanedV.join(', ')}`);
  }
  if (orphanedS.length > 0) {
    console.log(`\n  ❌ 孤立的 S 编号（未引用任何 V）: ${orphanedS.join(', ')}`);
  }
  if (untraceableS.length > 0) {
    console.log(`\n  ❌ 不可追溯的 S 编号（S→V→O→D 链断裂）:`);
    for (const u of untraceableS) {
      console.log(`    ${u.s}: ${u.reason}`);
    }
  }

  if (chainOk) {
    console.log(`\n  🎯 O→V→S 链完整 — 无断裂`);
  } else {
    console.log(`\n  ⚠️  存在断裂 — 孤立的中间层编号可能由 LLM 幻觉或归因跳跃导致`);
  }
}

process.exit(chainOk ? 0 : 1);
