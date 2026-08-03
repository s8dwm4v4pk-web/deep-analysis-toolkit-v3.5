#!/usr/bin/env node
/**
 * safeguard-echarts-grid.mjs — ECharts grid.top 安全预检与修复
 *
 * 用途：扫描 HTML 中所有 ECharts grid.top 配置，若百分比 < 安全阈值则提升，
 *       防止 y 轴名称（如"事故起数"）被 Canvas 裁切。
 *
 * 与 lift-grid-top.mjs 的区别：
 *   - lift-grid-top.mjs 是事后修复（已生成 HTML → 批量抬升 grid.top）
 *   - 本脚本是预检加固（在 HTML 中直接注入 safer-grid 逻辑，更细粒度）
 *
 * 用法: node agent-tools/scripts/safeguard-echarts-grid.mjs <input.html> [output.html]
 *       不指定 output 则原地覆写（支持 --in-place）
 *
 * Exit 0 = 成功, 1 = 文件错误, 2 = 用法错误
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
  console.error('用法: node agent-tools/scripts/safeguard-echarts-grid.mjs <input.html> [output.html] [--in-place]');
  console.error('  --in-place  原地覆写输入文件');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  console.error(`[safeguard-echarts-grid] ❌ 输入文件不存在: ${inputPath}`);
  process.exit(1);
}

const outputArg = argv.filter(a => !a.startsWith('--'))[1];
const outputPath = outputArg ? resolve(SKILL_ROOT, outputArg) : (inPlace ? inputPath : null);

if (!outputPath) {
  console.error('[safeguard-echarts-grid] ❌ 必须指定输出文件或使用 --in-place');
  process.exit(2);
}

let html = readFileSync(inputPath, 'utf-8');
const originalSize = html.length;

let fixCount = 0;
const fixes = [];

// ── 1. 检测并修复 ECharts 单图表 grid.top ──
const singleGridPattern = /(grid\s*:\s*\{[^}]*(?:top)\s*:\s*)['"](\d+)%['"]/gi;
html = html.replace(singleGridPattern, (match, prefix, numStr) => {
  const n = parseInt(numStr, 10);
  if (n < 15) {
    const newVal = Math.max(16, n <= 6 ? 16 : n <= 8 ? 16 : n <= 10 ? 17 : 18);
    fixCount++;
    fixes.push(`grid.top: ${n}% → ${newVal}% (单图表)`);
    return `${prefix}'${newVal}%'`;
  }
  return match;
});

// ── 2. 检测多 grid 配置中的 top（如 grid: [{top:...},{top:...}]） ──
const multiGridPattern = /\btop\s*:\s*['"](\d+)%['"]/gi;
html = html.replace(multiGridPattern, (match, numStr) => {
  const n = parseInt(numStr, 10);
  if (n < 15) {
    const newVal = Math.max(16, n <= 6 ? 16 : n <= 8 ? 16 : n <= 10 ? 17 : 18);
    fixCount++;
    fixes.push(`grid.top: ${n}% → ${newVal}% (多图表 grid)`);
    return `top: '${newVal}%'`;
  }
  return match;
});

// ── 3. 检测缺少 grid.top 但使用了 yAxis.name 的情况（潜在裁切风险） ──
const potentialCropPattern = /yAxis\s*:\s*\{[^}]*name\s*:\s*['"]\s*\S[\s\S]{0,200}?(?:grid\s*:\s*\{[^}]*\})/gi;
// 这个检测比较复杂，简化：找到所有有 yAxis.name 但没有显式 grid.top 的图表
const chartBlocks = html.match(/echarts\.init[\s\S]{0,3000}?setOption\s*\([\s\S]*?\);/gi) || [];
for (const block of chartBlocks) {
  if (/name\s*:\s*['"]\S/.test(block) && !/grid\s*:\s*\{[^}]*top/.test(block) && /grid\s*:/.test(block)) {
    // 有 name 有 grid 但没有 grid.top → 风险
    // 替换 grid: { → grid: { top: '18%',
    const before = html;
    html = html.replace(block, (full) => {
      return full.replace(/(grid\s*:\s*\{)/, "$1\n    top: '18%',");
    });
    if (html !== before) {
      fixCount++;
      fixes.push('grid 缺 top → 注入 top: 18%');
    }
  }
}

// ── 输出 ──
if (fixCount > 0) {
  writeFileSync(outputPath, html, 'utf-8');
}

console.log(`[safeguard-echarts-grid] 📐 ECharts grid.top 安全预检`);
console.log(`  输入: ${inputPath}`);
console.log(`  输出: ${outputPath}`);
console.log(`  修复: ${fixCount} 处 grid.top 提升`);
if (fixes.length > 0) {
  fixes.forEach(f => console.log(`    ↳ ${f}`));
}
console.log(`  文件大小: ${originalSize.toLocaleString()} → ${html.length.toLocaleString()} 字节`);

process.exit(0);
