#!/usr/bin/env node
/**
 * ensure-contain-label.mjs — ECharts containLabel 自动注入
 *
 * 用途：扫描 HTML 中所有 ECharts grid 配置，若缺少 containLabel 则自动注入，
 *       防止坐标轴标签/标题溢出容器边界。
 *
 * containLabel: true 的作用：
 *   - grid 区域自动为坐标轴标签和标题预留空间
 *   - 避免标签被容器裁剪（如"2025年1月"只显示"2025年1..."）
 *
 * 用法: node agent-tools/scripts/ensure-contain-label.mjs <input.html> [output.html] [--in-place]
 *
 * Exit 0 = 成功, 1 = 文件错误
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const inPlace = argv.includes('--in-place');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/ensure-contain-label.mjs <input.html> [output.html] [--in-place]');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  console.error(`[ensure-contain-label] ❌ 输入文件不存在: ${inputPath}`);
  process.exit(1);
}

const outputArg = argv.filter(a => !a.startsWith('--'))[1];
const outputPath = outputArg ? resolve(SKILL_ROOT, outputArg) : (inPlace ? inputPath : null);

if (!outputPath) {
  console.error('[ensure-contain-label] ❌ 必须指定输出文件或使用 --in-place');
  process.exit(2);
}

let html = readFileSync(inputPath, 'utf-8');
const originalSize = html.length;

let injectCount = 0;
let alreadyPresent = 0;

// ── 策略：找到每个 ECharts option 中的 grid 块 ──
// 匹配 grid: { ... } 块（支持嵌套括号）
const findGridBlocks = (text) => {
  const results = [];
  const gridStartRegex = /\bgrid\s*:\s*\{/g;
  let match;
  while ((match = gridStartRegex.exec(text)) !== null) {
    const start = match.index;
    const braceStart = match.index + match[0].indexOf('{');
    let depth = 1;
    let i = braceStart + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    if (depth === 0) {
      results.push({
        start: braceStart,
        end: i,
        full: text.slice(match.index, i),
        content: text.slice(braceStart + 1, i - 1)
      });
    }
  }
  return results;
};

const gridBlocks = findGridBlocks(html);
const fixes = [];

for (const block of gridBlocks) {
  const content = block.content;
  if (!/containLabel/.test(content)) {
    // 使用 block.full 精确替换，在 { 后注入 containLabel: true
    const originalGridBlock = block.full;
    const injectedGridBlock = block.full.replace('{', '{\n    containLabel: true,');
    html = html.replace(originalGridBlock, injectedGridBlock);
    injectCount++;
    fixes.push(`grid 块 (${content.length} 字节) → 注入 containLabel: true`);
  } else {
    alreadyPresent++;
  }
}

// ── 也处理数组形式的 grid: [{...}, {...}] ──
// 多 grid 数组
const findGridArrayBlocks = (text) => {
  const results = [];
  const gridArrayRegex = /\bgrid\s*:\s*\[/g;
  let match;
  while ((match = gridArrayRegex.exec(text)) !== null) {
    const start = match.index;
    const braceStart = match.index + match[0].indexOf('[');
    let depth = 1;
    let i = braceStart + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') depth--;
      i++;
    }
    if (depth === 0) {
      results.push({
        start: start,
        end: i,
        full: text.slice(start, i),
        content: text.slice(braceStart + 1, i - 1)
      });
    }
  }
  return results;
};

const gridArrayBlocks = findGridArrayBlocks(html);
for (const block of gridArrayBlocks) {
  const innerObjects = [];
  let depth = 0;
  let objStart = -1;
  for (let i = 0; i < block.content.length; i++) {
    if (block.content[i] === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (block.content[i] === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        innerObjects.push(block.content.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }

  for (const obj of innerObjects) {
    if (!/containLabel/.test(obj)) {
      const injected = '{' + `\n      containLabel: true,` + obj.slice(1);
      html = html.replace(obj, injected);
      injectCount++;
      fixes.push(`grid[] 数组元素 → 注入 containLabel: true`);
    }
  }
}

// ── 输出 ──
if (injectCount > 0) {
  writeFileSync(outputPath, html, 'utf-8');
}

console.log(`[ensure-contain-label] 📏 ECharts containLabel 完整性检查`);
console.log(`  输入: ${inputPath}`);
console.log(`  输出: ${outputPath}`);
console.log(`  注入: ${injectCount} 处 containLabel: true`);
console.log(`  已有: ${alreadyPresent} 处已包含（无需处理）`);
if (fixes.length > 0) {
  fixes.forEach(f => console.log(`    ↳ ${f}`));
}
console.log(`  文件大小: ${originalSize.toLocaleString()} → ${html.length.toLocaleString()} 字节`);

process.exit(0);
