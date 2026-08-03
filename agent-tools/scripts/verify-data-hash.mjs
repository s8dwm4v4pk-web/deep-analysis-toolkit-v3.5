#!/usr/bin/env node
/**
 * verify-data-hash.mjs — data_hash 一致性校验
 *
 * 用途：在阶段 2-7 每次读取 analysis-state.md 后，比对 data_hash 是否与
 *       阶段 1 写入的值一致。防止中间某轮错误覆盖了 state 文件导致数据版本串染。
 *
 * 校验流程：
 *   1. 从 analysis-state.md 读取 data_hash
 *   2. 从 .analysis-session 读取 work_dir
 *   3. 对数据文件重新计算 SHA-256 前 8 位
 *   4. 比对三者的哈希值
 *
 * 用法: node agent-tools/scripts/verify-data-hash.mjs [--json] [--data-file=<path>]
 *       --data-file  显式指定数据文件路径（否则从 analysis-state.md 读取）
 *
 * Exit 0 = 一致, 1 = 不一致, 2 = 参数错误
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

// ── 步骤 1：定位 analysis-state.md ──
const anchorFile = resolve(SKILL_ROOT, '.analysis-session');
if (!existsSync(anchorFile)) {
  const err = { ok: false, error: '锚点文件缺失 — 阶段 1 未完成' };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

const anchorContent = readFileSync(anchorFile, 'utf-8').trim();
const workDirMatch = anchorContent.match(/^work_dir=(.+)$/m);
if (!workDirMatch) {
  const err = { ok: false, error: '锚点文件格式错误' };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

const workDir = workDirMatch[1].trim();
const stateFile = resolve(workDir, 'analysis-state.md');

if (!existsSync(stateFile)) {
  const err = { ok: false, error: `analysis-state.md 不存在: ${stateFile}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

const stateContent = readFileSync(stateFile, 'utf-8');

// ── 步骤 2：从 state 中读取 data_hash ──
const stateHashMatch = stateContent.match(/data_hash\s*[：:]\s*([A-Fa-f0-9]+)/);
const stateHash = stateHashMatch ? stateHashMatch[1].trim() : null;

if (!stateHash) {
  const err = { ok: false, error: 'analysis-state.md 中缺少 data_hash 字段' };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

// ── 步骤 3：定位数据文件 ──
const explicitDataFile = argv.find(a => a.startsWith('--data-file='));
let dataFilePath;

if (explicitDataFile) {
  dataFilePath = resolve(SKILL_ROOT, explicitDataFile.split('=')[1]);
} else {
  // 从 state 中读取数据文件路径
  const dataFileMatch = stateContent.match(/数据文件\s*[：:]\s*(\S+)/);
  if (dataFileMatch) {
    dataFilePath = resolve(workDir, dataFileMatch[1].trim());
  } else {
    // 尝试从 work_dir 找常见数据文件
    // 不适用，直接报错
    const err = { ok: false, error: '无法从 analysis-state.md 定位数据文件路径，请使用 --data-file= 指定' };
    if (jsonOutput) console.log(JSON.stringify(err));
    else console.error(`[verify-data-hash] ❌ ${err.error}`);
    process.exit(2);
  }
}

if (!existsSync(dataFilePath)) {
  const err = { ok: false, error: `数据文件不存在: ${dataFilePath}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

// ── 步骤 4：重新计算哈希 ──
let computedHash;
try {
  const dataContent = readFileSync(dataFilePath);
  const hash = createHash('sha256').update(dataContent).digest('hex');
  computedHash = hash.substring(0, 8);
} catch (e) {
  const err = { ok: false, error: `无法读取/哈希数据文件: ${e.message}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[verify-data-hash] ❌ ${err.error}`);
  process.exit(1);
}

// ── 步骤 5：比对 ──
const match = stateHash.toLowerCase() === computedHash.toLowerCase();

const result = {
  ok: match,
  state_hash: stateHash,
  computed_hash: computedHash,
  data_file: dataFilePath.replace(SKILL_ROOT, '.'),
  state_file: stateFile.replace(SKILL_ROOT, '.'),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[verify-data-hash] 🔐 data_hash 一致性校验`);
  console.log(`  analysis-state.md 记录: ${stateHash}`);
  console.log(`  当前数据文件计算: ${computedHash}`);
  console.log(`  数据文件: ${result.data_file}`);

  if (match) {
    console.log(`\n  🎯 哈希一致 — 全流程引用同一份数据`);
  } else {
    console.log(`\n  ❌ 哈希不一致！`);
    console.log(`  可能原因:`);
    console.log(`    1. 数据文件被手动修改或替换`);
    console.log(`    2. analysis-state.md 来自另一个分析任务（数据串染）`);
    console.log(`    3. 阶段 1 的 data_hash 写入错误`);
    console.log(`  解决: 删除 .analysis-session，重新从阶段 1 开始`);
  }
}

process.exit(match ? 0 : 1);
