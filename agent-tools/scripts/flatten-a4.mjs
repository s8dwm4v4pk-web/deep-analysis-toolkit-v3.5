/**
 * flatten-a4.mjs — A4 分页版 → A4 连续流版
 * 
 * 用途: 接受已生成的 A4 分页版 report.html，插入覆盖 CSS 生成连续流版本
 *       不改动 HTML 结构，仅追加样式
 * 
 * 用法: node agent-tools/scripts/flatten-a4.mjs <report.html> [output.html]
 *       默认输出: report-a4-continuous.html (同目录)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('用法: node agent-tools/scripts/flatten-a4.mjs <report.html> [output.html]');
  process.exit(1);
}

const outputPath = process.argv[3] || join(
  dirname(inputPath),
  basename(inputPath, extname(inputPath)) + '-a4-continuous' + extname(inputPath)
);

// 1. 读取原始文件
let html = readFileSync(inputPath, 'utf-8');

// 2. 连续流覆盖样式（插入到 </head> 之前）
const overrideCSS = `
<style id="flatten-override">
/* ============================================================
   flatten-a4.mjs 连续流覆盖
   自动生成于: ${new Date().toISOString()}
   效果: A4宽度连续滚动 + 封面保留 → 无分页/无页码/无空白浪费
   ============================================================ */

/* 封面保持不变（已有 .page.cover 专属规则） */

/* 内容页：取消分页、压缩间距、加章节分割线 */
.page:not(.cover) {
  break-after: auto !important;     /* 不强制分页 */
  min-height: auto !important;      /* 取消 297mm 最小高度 */
  margin: 0 auto !important;        /* 消除页间距（24px → 0） */
  padding-bottom: 8mm !important;   /* 缩小下内边距（22mm → 18mm top, 8mm bottom） */
  box-shadow: none !important;      /* 去掉页阴影 */
  border-bottom: 1px dashed #d0d0d0; /* 章节间轻分割线 */
}

/* 隐藏页码 */
.page-num {
  display: none !important;
}

/* 打印时同样取消强制分页 */
@media print {
  .page:not(.cover) {
    break-after: auto !important;
  }
}
</style>
`;

// 在 </head> 前插入
html = html.replace('</head>', overrideCSS + '\n</head>');

// 3. 写入
writeFileSync(outputPath, html, 'utf-8');

console.log(`✅ 连续流版本已生成`);
console.log(`   输入: ${inputPath}`);
console.log(`   输出: ${outputPath}`);
console.log(`   方式: CSS 覆盖注入（零 HTML 结构改动）`);
