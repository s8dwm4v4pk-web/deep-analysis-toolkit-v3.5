#!/usr/bin/env node
/**
 * fix-a4-chart-height.mjs — A4 主题图表容器高度修复
 *
 * 用途：A4 模式下图表容器默认高度（如 280px）只有网页模式（440px）的 64%，
 *       导致 ECharts Canvas 渲染区域太小，图表模糊或文字被裁切。
 *       本脚本适度提升 A4 主题的图表容器高度。
 *
 * 原理：
 *   - 检测 HTML 是否为 A4 模式（有 @page A4 或 .page.cover）
 *   - 针对 .chart-box 类容器，将高度从默认值提升到合理范围
 *   - 保持 class 级别的高度变体（tall/short/mini）比例关系
 *
 * 用法: node agent-tools/scripts/fix-a4-chart-height.mjs <input.html> [output.html] [--aggressive]
 *       --aggressive  激进模式（+80px），默认温和模式（+40px）
 *
 * Exit 0 = 成功, 1 = 文件错误
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const aggressive = argv.includes('--aggressive');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/fix-a4-chart-height.mjs <input.html> [output.html] [--aggressive]');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  console.error(`[fix-a4-chart-height] ❌ 输入文件不存在: ${inputPath}`);
  process.exit(1);
}

const outputArg = argv.filter(a => !a.startsWith('--'))[1];
const outputPath = outputArg ? resolve(SKILL_ROOT, outputArg) : inputPath;

let html = readFileSync(inputPath, 'utf-8');
const originalSize = html.length;

// ── 检测是否为 A4 主题 ──
const isA4 = /@page\s*\{[^}]*size\s*:\s*A4/i.test(html) 
  || /\.page\.cover/i.test(html)
  || /--page-w\s*:\s*210mm/i.test(html);

if (!isA4) {
  console.log(`[fix-a4-chart-height] ⏭️  非 A4 主题，跳过处理`);
  process.exit(0);
}

const delta = aggressive ? 80 : 40;
let fixCount = 0;
const fixes = [];

// ── 1. 修复内联 style 中的 chart-box 高度 ──
// 匹配 style="height: Npx" 在 chart-box 类所在标签内
// 使用前瞻断言，不依赖 class 和 style 属性的顺序，能匹配任意属性排列
const inlineHeightPattern = /(<(?:div|section)(?=[^>]*\bclass="[^"]*\bchart-box\b[^"]*")[^>]*style="[^"]*height:\s*)(\d+)px/gi;
html = html.replace(inlineHeightPattern, (match, prefix, numStr) => {
  const n = parseInt(numStr, 10);
  // 只修复 "太小" 的高度（< 400px 且在 A4 常见范围内）
  if (n >= 150 && n < 400) {
    const newHeight = n + delta;
    fixCount++;
    fixes.push(`内联 height: ${n}px → ${newHeight}px`);
    return `${prefix}${newHeight}px`;
  }
  return match;
});

// ── 2. 修复 ECharts 容器 div 中单独设定的高度 ──
// 匹配 class="chart-box" 且在后续某个位置设了固定高度
const chartBoxStylePattern = /class="[^"]*chart-box[^"]*"\s+style="([^"]*height:\s*)(\d+)px([^"]*)"/gi;
html = html.replace(chartBoxStylePattern, (match, prefix, numStr, suffix) => {
  const n = parseInt(numStr, 10);
  if (n >= 150 && n < 400) {
    const newHeight = n + delta;
    fixCount++;
    fixes.push(`chart-box style height: ${n}px → ${newHeight}px`);
    return match.replace(new RegExp(`(height:\\s*)${numStr}px`), `$1${newHeight}px`);
  }
  return match;
});

// ── 3. 修复 A4 主题 CSS 中 .chart-box 默认高度定义 ──
// 匹配 <style> 块或内联 CSS 中 .chart-box { ... height: Npx ... }
const cssChartBoxPattern = /(\.chart-box\s*\{[^}]*?height\s*:\s*)(\d+)px/gi;
html = html.replace(cssChartBoxPattern, (match, prefix, numStr) => {
  const n = parseInt(numStr, 10);
  if (n >= 150 && n < 400) {
    const newHeight = n + delta;
    fixCount++;
    fixes.push(`CSS .chart-box height: ${n}px → ${newHeight}px`);
    return `${prefix}${newHeight}px`;
  }
  return match;
});

// ── 4. 修复 chart-box 高度变体 (tall/short/mini) ──
const variantPatterns = [
  { pattern: /(\.chart-box\.tall\s*\{[^}]*?height\s*:\s*)(\d+)px/gi, label: 'tall' },
  { pattern: /(\.chart-box\.short\s*\{[^}]*?height\s*:\s*)(\d+)px/gi, label: 'short' },
  { pattern: /(\.chart-box\.mini\s*\{[^}]*?height\s*:\s*)(\d+)px/gi, label: 'mini' },
];

for (const { pattern, label } of variantPatterns) {
  html = html.replace(pattern, (match, prefix, numStr) => {
    const n = parseInt(numStr, 10);
    if (n >= 100 && n < 500) {
      const newHeight = n + Math.round(delta * 0.7); // 变体比例缩放
      fixCount++;
      fixes.push(`CSS .chart-box.${label} height: ${n}px → ${newHeight}px`);
      return `${prefix}${newHeight}px`;
    }
    return match;
  });
}

// ── 输出 ──
if (fixCount > 0) {
  writeFileSync(outputPath, html, 'utf-8');
}

console.log(`[fix-a4-chart-height] 📏 A4 图表容器高度修复 (${aggressive ? '激进' : '温和'}模式, +${delta}px)`);
console.log(`  A4 主题: ✅ 已检测`);
console.log(`  输入: ${inputPath}`);
console.log(`  输出: ${outputPath}`);
console.log(`  修复: ${fixCount} 处`);
if (fixes.length > 0) {
  fixes.forEach(f => console.log(`    ↳ ${f}`));
}
console.log(`  文件大小: ${originalSize.toLocaleString()} → ${html.length.toLocaleString()} 字节`);

process.exit(0);
