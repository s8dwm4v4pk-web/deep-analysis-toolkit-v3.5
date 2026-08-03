#!/usr/bin/env node
/**
 * fix-chart-varname.mjs — 图表 IIFE 变量名一致性自动修复脚本
 *
 * 用途：扫描 HTML 中所有 ECharts / ApexCharts 图表 IIFE，
 *       检测声明行（const XXX = document.getElementById(...)）与
 *       后续引用（guard check / echarts.init / new ApexCharts）之间的变量名不一致，
 *       自动修复使其一致。
 *
 * 此脚本解决 LLM 在生成图表时常见的"部分重命名"幻觉：
 *   声明 const chartDom = ...  但 guard 写 if (!dom) return;
 *   声明 const dom = ...       但 guard 写 if (!chartDom) return;
 *
 * 调用方式：
 *   node agent-tools/scripts/fix-chart-varname.mjs <report.html> [--dry-run]
 *
 * --dry-run  仅检测不修改，输出诊断报告
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve(process.argv[2] || '');
const dryRun = process.argv.includes('--dry-run');

if (!filePath) {
  console.error('[fix-chart-varname] ❌ 缺少参数：请提供 HTML 文件路径');
  console.error('  用法: node fix-chart-varname.mjs <report.html> [--dry-run]');
  process.exit(1);
}

let html;
try {
  html = readFileSync(filePath, 'utf-8');
} catch (e) {
  console.error(`[fix-chart-varname] ❌ 无法读取文件: ${filePath}`);
  console.error(`  ${e.message}`);
  process.exit(1);
}

// ============================================================
// 核心逻辑
// ============================================================

const diagnostics = [];

/**
 * 在给定的 script 文本中修复 chartDom/dom 变量名不一致
 *
 * 模式识别：
 *   1. ECharts:  const X = document.getElementById(...)
 *               if (!Y) return;
 *               const myChart = echarts.init(X);    // init 使用声明变量
 *   2. ApexCharts: const X = document.getElementById(...)
 *                  if (!Y) return;
 *                  const options = {...};
 *                  const chart = new ApexCharts(X, options); // constructor 使用声明变量
 */
function fixIIFE(scriptText, scriptIndex) {
  let changed = false;
  let result = scriptText;
  const d = [];

  // ---------- Step 1: 提取声明的 DOM 变量名 ----------
  // 匹配: const chartDom = document.getElementById('chart-XX');
  //       const dom = document.getElementById('chart-XX');
  const declMatch = result.match(/\b(const|let|var)\s+(\w+)\s*=\s*document\.getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  
  if (!declMatch) {
    return { result, changed: false, diags: [] };
  }

  const declaredVar = declMatch[2];   // 例如 "chartDom" 或 "dom"
  const chartId = declMatch[3];      // 例如 "chart-1"

  // ---------- Step 2: 检查 guard check 中的变量名 ----------
  // 匹配: if (!dom) return;  或 if (!chartDom) return;
  const guardPattern = /\bif\s*\(\s*!\s*(\w+)\s*\)\s*return\s*;/;
  const guardMatch = result.match(guardPattern);
  
  if (guardMatch) {
    const guardVar = guardMatch[1];
    if (guardVar !== declaredVar) {
      // 不一致！修复 guard check
      const oldGuard = guardMatch[0];
      const newGuard = guardMatch[0].replace(
        new RegExp(`\\b${guardVar}\\b`),
        declaredVar
      );
      result = result.replace(oldGuard, newGuard);
      changed = true;
      d.push(`[${chartId}] guard: ${guardVar} → ${declaredVar}`);
    }
  }

  // ---------- Step 3: 检查 echarts.init() 中的变量名 ----------
  const initPattern = /echarts\.init\s*\(\s*(\w+)\s*\)/;
  const initMatch = result.match(initPattern);
  
  if (initMatch) {
    const initVar = initMatch[1];
    if (initVar !== declaredVar) {
      const oldInit = initMatch[0];
      const newInit = initMatch[0].replace(
        new RegExp(`\\b${initVar}\\b`),
        declaredVar
      );
      result = result.replace(oldInit, newInit);
      changed = true;
      d.push(`[${chartId}] echarts.init: ${initVar} → ${declaredVar}`);
    }
  }

  // ---------- Step 4: 检查 new ApexCharts() 中的变量名 ----------
  const apexPattern = /new\s+ApexCharts\s*\(\s*(\w+)\s*,/;
  const apexMatch = result.match(apexPattern);
  
  if (apexMatch) {
    const apexVar = apexMatch[1];
    if (apexVar !== declaredVar) {
      const oldApex = apexMatch[0];
      const newApex = apexMatch[0].replace(
        new RegExp(`\\b${apexVar}\\b`),
        declaredVar
      );
      result = result.replace(oldApex, newApex);
      changed = true;
      d.push(`[${chartId}] new ApexCharts: ${apexVar} → ${declaredVar}`);
    }
  }

  // ---------- Step 5: 反向检查 — decl 使用"dom"但 guard 使用"chartDom" ----------
  // 如果 declare 的是 dom，但存在对 chartDom 的引用（且 chartId 匹配时修复）
  // 这在上面的 step 2-4 已经覆盖了

  // ---------- Step 6: 检查是否有声明了但不存在的变量（额外安全检查）----------
  // 查找 \bdom\b 或 \bchartDom\b 的所有位置
  // 确保 IIFE 内所有引用的 DOM 变量都与声明一致

  return { result, changed, diags: d };
}

/**
 * 分割 HTML 中的 <script> 块，逐个修复
 */
function fixAllChartIIFEs(htmlText) {
  // 匹配所有 <script>...</script> 块（跳过内联库脚本）
  const scriptRegex = /(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi;
  
  let newHtml = htmlText;
  let totalFixed = 0;
  const allDiags = [];

  // 我们需要用 exec 逐段处理，因为 replace 会同时替换
  let scriptIndex = 0;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = scriptRegex.exec(htmlText)) !== null) {
    const fullMatch = match[0];
    const openTag = match[1];
    const scriptBody = match[2];
    const closeTag = match[3];
    const startIdx = match.index;
    const endIdx = match.index + fullMatch.length;

    // 只处理包含 echarts.init 或 new ApexCharts 的图表脚本
    if (/echarts\.init|new\s+ApexCharts/.test(scriptBody)) {
      const { result, changed, diags } = fixIIFE(fullMatch, scriptIndex);
      if (changed) {
        segments.push({
          start: startIdx,
          end: endIdx,
          original: fullMatch,
          fixed: result,
        });
        allDiags.push(...diags);
        totalFixed++;
      }
    }
    scriptIndex++;
  }

  // 从后往前替换，保持索引正确
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    newHtml = newHtml.substring(0, seg.start) + seg.fixed + newHtml.substring(seg.end);
  }

  return { html: newHtml, fixed: totalFixed, diags: allDiags };
}

// ============================================================
// 主流程
// ============================================================

console.log(`[fix-chart-varname] 🔍 扫描: ${filePath}`);
const { html: newHtml, fixed, diags } = fixAllChartIIFEs(html);

if (fixed === 0) {
  console.log('[fix-chart-varname] ✅ 所有图表 IIFE 变量名一致，无需修复');
  process.exit(0);
}

// 打印诊断
console.log(`[fix-chart-varname] ⚠️  发现 ${fixed} 处变量名不一致:\n`);
for (const d of diags) {
  console.log(`  ${d}`);
}

if (dryRun) {
  console.log('\n[fix-chart-varname] 🔵 --dry-run 模式，未写入文件');
  process.exit(1);
}

// 写入修复后的文件
writeFileSync(filePath, newHtml, 'utf-8');
console.log(`\n[fix-chart-varname] ✅ 已修复 ${fixed} 处变量名不一致 → ${filePath}`);
