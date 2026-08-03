/**
 * assemble-report.mjs — Link-then-Inline 组装器 v1.0
 *
 * 将 LLM 生成的骨架 HTML（含 <script src="..."> / <link href="...">）组装为纯内联单文件 HTML。
 * 所有资源路径相对于本 SKILL 包根目录解析。
 *
 * 用法: node agent-tools/scripts/assemble-report.mjs <skeleton.html> <output.html>
 * Exit 0 = 组装成功，非 0 = 失败
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const skeletonPath = process.argv[2];
const outputPath = process.argv[3];

if (!skeletonPath || !outputPath) {
  console.error('用法: node agent-tools/scripts/assemble-report.mjs <skeleton.html> <output.html>');
  process.exit(2);
}

// 路径规范化：检测并警告绝对路径传入
const isAbsolutePath = (p) => isAbsolute(p);
if (isAbsolutePath(skeletonPath)) {
  console.warn(`[WARN] skeletonPath 是绝对路径: ${skeletonPath}`);
  console.warn('  已忽略 SKILL_ROOT 拼接，直接使用该路径。建议阶段 7 传入相对路径（如 work_dir/report-skeleton.html）');
}
const fullSkeletonPath = isAbsolutePath(skeletonPath)
  ? skeletonPath
  : resolve(SKILL_ROOT, skeletonPath);
if (!existsSync(fullSkeletonPath)) {
  console.error(`骨架文件不存在: ${skeletonPath}`);
  console.error(`  解析路径: ${fullSkeletonPath}`);
  console.error(`  SKILL_ROOT: ${SKILL_ROOT}`);
  process.exit(1);
}

let html = readFileSync(fullSkeletonPath, 'utf-8');
let inlineCount = 0;

// ============================================
//  1. 内联 CSS：<link rel="stylesheet" href="..."> → <style>全文</style>
//  禁止：CDN 链接 / http(s) 链接 → 立即报错
// ============================================
html = html.replace(
  /<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?\s*>/gi,
  (match, href) => {
    if (/^https?:\/\//i.test(href)) {
      console.error(`[ERROR] 禁止 CDN 样式引用: ${href}`);
      console.error('  所有资源必须来自 SKILL 包内。请使用包内相对路径（如 themes/theme-dark.css）');
      process.exit(1);
    }
    const fullPath = resolve(SKILL_ROOT, href);
    if (!existsSync(fullPath)) {
      console.error(`[ERROR] 主题 CSS 文件不存在: ${href}`);
      console.error(`  尝试路径: ${fullPath}`);
      process.exit(1);
    }
    const css = readFileSync(fullPath, 'utf-8');
    inlineCount++;
    console.log(`  [INLINE] ${href} → <style> (${css.length.toLocaleString()} 字节)`);
    return `<style>${css}</style>`;
  }
);

// ============================================
//  2. 内联 JS：<script src="...">...</script> → <script>全文 + 内联内容</script>
//  禁止：CDN 链接 → 立即报错
//  支持：<script src="..."></script> (空体) 和 <script src="...">内联代码</script> (混合)
// ============================================
html = html.replace(
  /<script\s+src=["']([^"']+)["']\s*>(.*?)<\/script>/gis,
  (match, src, innerContent) => {
    if (/^https?:\/\//i.test(src)) {
      console.error(`[ERROR] 禁止 CDN 脚本引用: ${src}`);
      console.error('  所有 JavaScript 库必须来自 SKILL 包内 references/vendor/ 目录');
      process.exit(1);
    }
    const fullPath = resolve(SKILL_ROOT, src);
    if (!existsSync(fullPath)) {
      console.error(`[ERROR] Vendor JS 文件不存在: ${src}`);
      console.error(`  尝试路径: ${fullPath}`);
      process.exit(1);
    }
    const js = readFileSync(fullPath, 'utf-8');
    inlineCount++;
    const inner = innerContent.trim() ? `\n${innerContent}` : '';
    console.log(`  [INLINE] ${src} → <script> (${js.length.toLocaleString()} 字节)`);
    return `<script>${js}${inner}</script>`;
  }
);

// 处理 self-closing 形式 <script src="..." />
html = html.replace(
  /<script\s+src=["']([^"']+)["']\s*\/>/gi,
  (match, src) => {
    if (/^https?:\/\//i.test(src)) {
      console.error(`[ERROR] 禁止 CDN 脚本引用: ${src}`);
      process.exit(1);
    }
    const fullPath = resolve(SKILL_ROOT, src);
    if (!existsSync(fullPath)) {
      console.error(`[ERROR] Vendor JS 文件不存在: ${src}`);
      process.exit(1);
    }
    const js = readFileSync(fullPath, 'utf-8');
    inlineCount++;
    console.log(`  [INLINE] ${src} → <script> (${js.length.toLocaleString()} 字节)`);
    return `<script>${js}</script>`;
  }
);

// ============================================
//  3. 残留引用检测
// ============================================
const remainingSrc = html.match(/<script\s[^>]*src=["']/gi);
const remainingHref = html.match(/<link\s[^>]*href=["']http/gi);

if (remainingSrc || remainingHref) {
  if (remainingSrc) {
    console.error(`[ERROR] ${remainingSrc.length} 个 script src 引用未解析:`);
    remainingSrc.forEach(ref => console.error(`  ${ref}`));
  }
  if (remainingHref) {
    console.error(`[ERROR] ${remainingHref.length} 个外部 link href 引用未解析:`);
    remainingHref.forEach(ref => console.error(`  ${ref}`));
  }
  console.error('\n  这些引用将在 verify-report.mjs 中被拦截。请检查骨架 HTML。');
  process.exit(1);
}

console.log(`  [OK] 零残留引用`);

const fullOutputPath = resolve(SKILL_ROOT, outputPath);
const outputDir = dirname(fullOutputPath);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`  [MKDIR] 创建输出目录: ${outputDir}`);
}
writeFileSync(fullOutputPath, html, 'utf-8');

const outputSize = Buffer.byteLength(html, 'utf-8');
const sizeMB = (outputSize / (1024 * 1024)).toFixed(2);

console.log(`\n[ASSEMBLED] ${outputPath}`);
console.log(`  输出路径: ${fullOutputPath}`);
console.log(`  内联资源: ${inlineCount} 个`);
console.log(`  文件大小: ${sizeMB} MB`);
if (parseFloat(sizeMB) > 3) {
  console.warn(`  [WARN] 文件大小超过 3MB 上限（当前 ${sizeMB} MB）`);
}

process.exit(0);
