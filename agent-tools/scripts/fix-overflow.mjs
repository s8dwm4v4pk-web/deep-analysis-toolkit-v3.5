/**
 * fix-overflow.mjs — 跨页溢出治理补丁
 * 
 * 问题: .chart-box 原始 overflow:visible + .page 无裁剪
 *       → 图表底部内容溢出侵入下一页顶部，遮挡文字
 * 
 * 修复: 在 #flatten-override 块中追加两个规则
 *       ① .page:not(.cover) { overflow: hidden }
 *          → 每页独立隔离，内容不可跨页入侵
 *       ② .chart-box { overflow: hidden }
 *          → 图表自身裁剪溢出，不侵犯相邻元素
 * 
 * 用法: node agent-tools/scripts/fix-overflow.mjs <input.html> [output.html]
 *       默认输出: <input>-overflow-fixed.html (同目录)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('用法: node agent-tools/scripts/fix-overflow.mjs <input.html> [output.html]');
  process.exit(1);
}

const outputPath = process.argv[3] || join(
  dirname(inputPath),
  basename(inputPath, extname(inputPath)) + '-overflow-fixed' + extname(inputPath)
);

// 1. 读取
let html = readFileSync(inputPath, 'utf-8');

// 2. 定位 #flatten-override 块
const overrideStart = html.indexOf('<style id="flatten-override">');
if (overrideStart === -1) {
  console.error('❌ 未找到 <style id="flatten-override"> 块，请确认输入是 a4-continuous 版本');
  process.exit(1);
}

const overrideEnd = html.indexOf('</style>', overrideStart);
if (overrideEnd === -1) {
  console.error('❌ flatten-override 块未闭合');
  process.exit(1);
}

// 3. 在 </style> 之前插入溢出治理规则
const patchCSS = `
/* ====== 跨页溢出治理 (fix-overflow.mjs) ====== */
/* ① 页面隔离：每页裁剪溢出，防止图表/内容跨页入侵 */
.page:not(.cover) {
  overflow: hidden !important;
}

/* ② 图表容器裁剪：防止 ECharts 绘制溢出覆盖相邻文字标注 */
.chart-box {
  overflow: hidden !important;
}</style>`;

const before = html.slice(0, overrideEnd);
const after = html.slice(overrideEnd + '</style>'.length);

html = before + patchCSS + after;

// 4. 写入
writeFileSync(outputPath, html, 'utf-8');

console.log(`✅ 跨页溢出修复完成`);
console.log(`   输入: ${inputPath}`);
console.log(`   输出: ${outputPath}`);
console.log(`   规则: .page:not(.cover) overflow:hidden + .chart-box overflow:hidden`);
