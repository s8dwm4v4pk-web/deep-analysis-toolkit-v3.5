/**
 * center-chart.mjs — 图表垂直居中治理临时脚本
 *
 * 问题: .chart-box 内 ECharts grid.top 仅 8%（280px×8%=22px），
 *       y轴名称紧贴顶部被裁切，但下方 grid.bottom 富余大量空白。
 * 
 * 方案: 不增加总高度，用 padding-top 把 canvas 向下推，
 *       将下方冗余空间重新分配到上方，实现视觉居中。
 *       
 *       280px 容器: padding-top:16px → content 264px
 *         有效顶部空间 = 16 + 8%×264 = 37px（原来仅 22px）
 * 
 * 用法: node agent-tools/scripts/center-chart.mjs <input.html> [output.html]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('用法: node agent-tools/scripts/center-chart.mjs <input.html> [output.html]');
  process.exit(1);
}

const outputPath = process.argv[3] || join(
  dirname(inputPath),
  basename(inputPath, extname(inputPath)) + '-chart-centered' + extname(inputPath)
);

let html = readFileSync(inputPath, 'utf-8');

// 检查是否已 flatten
const isFlattened = html.includes('id="flatten-override"');

// ---------- 居中 CSS ----------
const centerCSS = `
<style id="chart-center-override">
/* ====== 图表垂直居中治理 ====== */
/* 原则：不增加总高度，用 padding-top 将 canvas 下推，
   将下方冗余空间重新分配到上方，y轴名称不再被裁切。
   增幅: 280→16px / 340→20px / 220→14px / 200→12px */

.chart-box {
  overflow: hidden !important;
  padding-top: 16px !important;
}
.chart-box.tall {
  padding-top: 20px !important;
}
.chart-box.short {
  padding-top: 14px !important;
}
.chart-box.xs {
  padding-top: 12px !important;
}
</style>
`;

let insertTarget;
if (isFlattened) {
  // 已有 flatten-override，在 </style> 前插入
  const pos = html.indexOf('</style>', html.indexOf('id="flatten-override"'));
  html = html.slice(0, pos) + centerCSS.trim() + '\n' + html.slice(pos);
} else {
  // 原始分页版，需要先 flatten 再居中
  // --- flatten 逻辑（复用 flatten-a4.mjs 核心） ---
  const dateStr = new Date().toISOString();
  const flattenCSS = `
<style id="flatten-override">
/* ============================================================
   flatten-a4.mjs 连续流覆盖
   自动生成于: ${dateStr}
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
  html = html.replace('</head>', flattenCSS + '\n' + centerCSS.trim() + '\n</head>');
}

writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ 图表垂直居中治理完成`);
console.log(`   输入: ${inputPath}`);
console.log(`   输出: ${outputPath}`);
console.log(`   策略: padding-top 下推 canvas，将下方冗余重分配到上方`);
if (!isFlattened) console.log(`   注: 输入为分页版，已自动执行 flatten → center 两步`);
