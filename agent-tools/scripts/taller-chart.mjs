/**
 * taller-chart.mjs — 图表加高治理临时脚本
 *
 * 问题: .chart-box 默认 280px 太矮，ECharts grid.top 按百分比计算后，
 *       y轴名称紧贴容器顶边被裁切。
 * 
 * 方案: 所有 chart-box 变体统一增高，撑开 ECharts canvas，
 *       让 grid 百分比对应的绝对像素数变大。
 * 
 * 用法: node agent-tools/scripts/taller-chart.mjs <input.html> [output.html]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('用法: node agent-tools/scripts/taller-chart.mjs <input.html> [output.html]');
  process.exit(1);
}

const outputPath = process.argv[3] || join(
  dirname(inputPath),
  basename(inputPath, extname(inputPath)) + '-chart-taller' + extname(inputPath)
);

let html = readFileSync(inputPath, 'utf-8');
const isFlattened = html.includes('id="flatten-override"');

const tallerCSS = `
<style id="chart-taller-override">
/* ====== 图表加高治理 ====== */
/* 统一将 chart-box 增高，让 ECharts canvas 获得更多绝对像素，
   从而 grid.top 的百分比对应更多空间，y轴名称不再紧贴边缘。
   增幅: +24px / +30px / +20px / +18px */

.chart-box {
  overflow: hidden !important;
  height: 304px !important;
}
.chart-box.tall {
  height: 370px !important;
}
.chart-box.short {
  height: 240px !important;
}
.chart-box.xs {
  height: 218px !important;
}
</style>
`;

if (isFlattened) {
  const pos = html.indexOf('</style>', html.indexOf('id="flatten-override"'));
  html = html.slice(0, pos) + tallerCSS.trim() + '\n' + html.slice(pos);
} else {
  const dateStr = new Date().toISOString();
  const flattenCSS = `
<style id="flatten-override">
/* ============================================================
   flatten-a4.mjs 连续流覆盖 — ${dateStr}
   ============================================================ */
.page:not(.cover) {
  break-after: auto !important;
  min-height: auto !important;
  margin: 0 auto !important;
  padding-bottom: 8mm !important;
  box-shadow: none !important;
  border-bottom: 1px dashed #d0d0d0;
}
.page-num { display: none !important; }
@media print {
  .page:not(.cover) { break-after: auto !important; }
}
</style>
`;
  html = html.replace('</head>', flattenCSS + '\n' + tallerCSS.trim() + '\n</head>');
}

writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ 图表加高治理完成`);
console.log(`   输入: ${inputPath}`);
console.log(`   输出: ${outputPath}`);
console.log(`   新高度: 304 / 370 / 240 / 218 (原: 280 / 340 / 220 / 200)`);
if (!isFlattened) console.log(`   注: 自动执行了 flatten → taller 两步`);
