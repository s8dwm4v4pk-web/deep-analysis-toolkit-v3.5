/**
 * lift-grid-top.mjs — 提升 ECharts grid.top 治理脚本
 *
 * 根因: ECharts grid.top 百分比太小（6%~10%），y轴名称紧贴 canvas 顶边被裁切。
 *       CSS 改动容器高度/padding 无法解决 — 裁切发生在 ECharts Canvas 内部。
 *
 * 方案: 直接在 HTML JS 中搜索所有 grid.top 百分比，统一 +6~10pp。
 *       top: 6% → 14%,  8% → 16%,  10% → 18%
 *
 * 用法: node agent-tools/scripts/lift-grid-top.mjs <input.html> [output.html]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('用法: node agent-tools/scripts/lift-grid-top.mjs <input.html> [output.html]');
  process.exit(1);
}

const outputPath = process.argv[3] || join(
  dirname(inputPath),
  basename(inputPath, extname(inputPath)) + '-grid-lifted' + extname(inputPath)
);

let html = readFileSync(inputPath, 'utf-8');
let count = 0;

// 匹配 grid 对象中的 top: 'N%'
// 统一提升到安全值: <14→14, <16→16, <18→18, 其他+6(上限 22)
html = html.replace(
  /(top:\s*)'(\d+)%'/g,
  (match, prefix, num) => {
    const n = parseInt(num, 10);
    let newTop;
    if (n <= 6)  newTop = 14;
    else if (n <= 8)  newTop = 16;
    else if (n <= 10) newTop = 18;
    else if (n <= 14) newTop = 20;
    else              newTop = Math.min(n + 6, 22);
    count++;
    return `${prefix}'${newTop}%'`;
  }
);

// 检查是否需要 flatten
const isFlattened = html.includes('id="flatten-override"');
if (!isFlattened) {
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
  html = html.replace('</head>', flattenCSS + '\n</head>');
}

writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ grid.top 提升完成`);
console.log(`   输入: ${inputPath}`);
console.log(`   输出: ${outputPath}`);
console.log(`   修改了 ${count} 处 grid.top（6%→14%, 8%→16%, 10%→18%...）`);
if (!isFlattened) console.log(`   注: 自动执行了 flatten 步骤`);
