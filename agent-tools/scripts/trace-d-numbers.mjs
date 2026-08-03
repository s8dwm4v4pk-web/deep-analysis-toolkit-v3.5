#!/usr/bin/env node
/**
 * trace-d-numbers.mjs — D 编号全链路追溯
 *
 * 用途：从 analysis-state.md 提取所有已定义的 D-xxx 编号，
 *       扫描全流程文件（analysis-state.md、blueprint.md），
 *       标记任何被引用但未定义的 D 编号（越界引用）。
 *
 * 这防止常见的 LLM 幻觉：引用了 D-025，但阶段 1 只生成了 D-001~D-020。
 *
 * 用法: node agent-tools/scripts/trace-d-numbers.mjs <analysis-state.md路径> [blueprint.md路径] [--json] [--verbose]
 *
 * Exit 0 = 全部合法, 1 = 存在越界引用
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
  console.error('用法: node agent-tools/scripts/trace-d-numbers.mjs <analysis-state.md> [blueprint.md] [其他.md...] [--json] [--verbose]');
  process.exit(2);
}

// ── 阶段 1：从 analysis-state.md 提取已定义 D 编号 ──
const stateFile = resolve(SKILL_ROOT, files[0]);
if (!existsSync(stateFile)) {
  if (jsonOutput) console.log(JSON.stringify({ ok: false, error: `analysis-state.md 不存在: ${stateFile}` }));
  else console.error(`[trace-d-numbers] ❌ analysis-state.md 不存在: ${stateFile}`);
  process.exit(1);
}

const stateContent = readFileSync(stateFile, 'utf-8');

// 提取 D 编号定义
// 匹配模式: D-xxx, D0, D1..Dk, D_FOUNDATION, D_DATASET, [D0.r{C}c{M}]
const definedPatterns = [
  /(?<!\w)D-(\d+)\b/gi,           // D-001, D-025
  /(?<!\w)D(\d+)\b/gi,             // D0, D1  
  /D_FOUNDATION/gi,
  /D_DATASET/gi,
  /D_MORPH/gi,
  /D_QUALITY/gi,
];

// 在数据基座章节内提取定义的 D 编号
const foundationSection = stateContent.match(/## 数据基座\s*\n([\s\S]*?)(?=\n## |$)/);
const foundationContent = foundationSection ? foundationSection[0] : stateContent;

const definedNumbers = new Set();
const definedFull = new Set();

// D 编号体系部分
const dSystemSection = foundationContent.match(/### D 编号体系\s*\n([\s\S]*?)(?=\n###|$)/);
const dSection = dSystemSection ? dSystemSection[0] : foundationContent;

for (const pattern of definedPatterns) {
  let m;
  const regex = new RegExp(pattern.source, pattern.flags);
  while ((m = regex.exec(dSection)) !== null) {
    const full = m[0];
    definedFull.add(full);
    const num = full.match(/\d+/);
    if (num) definedNumbers.add(parseInt(num[0]));
  }
}

// 也收集在状态文件其他章节中定义的（如信号章节中的引用）
for (const pattern of definedPatterns) {
  let m;
  const regex = new RegExp(pattern.source, pattern.flags);
  while ((m = regex.exec(stateContent)) !== null) {
    definedFull.add(m[0]);
    const num = m[0].match(/\d+/);
    if (num) definedNumbers.add(parseInt(num[0]));
  }
}

// ── 阶段 2：扫描后续文件，收集所有引用 ──
const filesToScan = files.slice(1).map(f => resolve(SKILL_ROOT, f));
// 默认也扫描 analysis-state.md 自身（检查其他章节是否引用了未定义的）
filesToScan.unshift(stateFile);

const allReferences = new Map(); // D编号 → [{file, line, context}]
const undefinedRefs = [];

for (const filePath of filesToScan) {
  if (!existsSync(filePath)) {
    if (verbose) console.warn(`  ⚠️ 文件不存在，跳过: ${filePath}`);
    continue;
  }

  const fileContent = readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  // 扫描所有 D-xxx / Dxxx 引用
  const refPattern = /(?<!\w)(D-?\d+)\b/gi;
  let m;
  while ((m = refPattern.exec(fileContent)) !== null) {
    const ref = m[0];
    const refNum = parseInt(ref.match(/\d+/)?.[0] || '-1');

    // 计算行号
    const pos = m.index;
    let lineNum = 1;
    let charCount = 0;
    for (const line of lines) {
      if (charCount + line.length + 1 > pos) break;
      charCount += line.length + 1;
      lineNum++;
    }

    const context = lines[Math.min(lineNum - 1, lines.length - 1)]?.trim()?.slice(0, 80);
    const entry = { file: filePath.replace(SKILL_ROOT, '.'), line: lineNum, context, ref };

    if (!allReferences.has(ref)) {
      allReferences.set(ref, []);
    }
    allReferences.get(ref).push(entry);

    // 检查是否已定义
    const isDefined = definedFull.has(ref) || 
                      (ref.startsWith('D-') && definedNumbers.has(refNum));

    if (!isDefined) {
      undefinedRefs.push(entry);
    }
  }
}

// ── 去重 undefinedRefs ──
const uniqueUndefined = new Map();
for (const ref of undefinedRefs) {
  const key = `${ref.ref}@${ref.file}:${ref.line}`;
  if (!uniqueUndefined.has(key)) {
    uniqueUndefined.set(key, ref);
  }
}

const undefinedList = [...uniqueUndefined.values()];

// ── 汇总 ──
const definedCount = definedFull.size;
const refCount = allReferences.size;
const undefinedCount = undefinedList.length;
const maxDefined = definedNumbers.size > 0 ? Math.max(...definedNumbers) : 0;

const result = {
  ok: undefinedCount === 0,
  defined: {
    total: definedCount,
    max_id: maxDefined,
    ids: [...definedFull].sort(),
  },
  references: {
    total_unique: refCount,
    total_occurrences: [...allReferences.values()].reduce((sum, arr) => sum + arr.length, 0),
  },
  undefined: {
    count: undefinedCount,
    refs: undefinedList.map(r => ({ ref: r.ref, file: r.file, line: r.line, context: r.context })),
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[trace-d-numbers] 🔗 D 编号全链路追溯`);
  console.log(`  已定义 D 编号: ${definedCount} 个（最大 D-${maxDefined}）`);
  if (verbose) {
    console.log(`    已定义: ${[...definedFull].sort().join(', ')}`);
  }
  console.log(`  全文件引用: ${refCount} 个唯一编号，${result.references.total_occurrences} 次引用`);
  
  if (undefinedCount > 0) {
    console.log(`\n  ❌ 越界引用 (${undefinedCount} 处):`);
    // 按编号分组
    const grouped = new Map();
    for (const ref of undefinedList) {
      if (!grouped.has(ref.ref)) grouped.set(ref.ref, []);
      grouped.get(ref.ref).push(ref);
    }
    for (const [dnum, refs] of grouped) {
      console.log(`    ${dnum} — ${refs.length} 次引用（未在阶段 1 中定义）`);
      for (const r of refs) {
        console.log(`      ▸ ${r.file}:${r.line}  ${r.context || ''}`);
      }
    }
    console.log(`\n  ⚠️  以上 D 编号未被阶段 1 定义，疑似 LLM 幻觉或数据串染`);
  } else {
    console.log(`\n  🎯 全部 D 编号引用合法 — 无越界引用`);
  }
}

process.exit(undefinedCount === 0 ? 0 : 1);
