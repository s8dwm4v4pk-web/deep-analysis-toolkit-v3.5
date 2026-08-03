#!/usr/bin/env node
/**
 * validate-chart-dom.mjs — 图表 DOM 容器完整性校验
 *
 * 用途：扫描 HTML，确保每处 echarts.init(document.getElementById("xxx")) 
 *       都有对应的 <div id="xxx"> 容器元素。缺失则报错并尝试自动修复。
 *
 * 图表 div 高度完整性检查 —— 检测 [id^="chart-"] 容器是否缺少
 *       height 样式（导致 canvas 0×0 不可见），缺失时 --fix 自动注入 height:100%
 *
 * 这是 verify-report.mjs 的专项增强版——在 HTML 生成后立即运行，
 * 不等质量闸门阶段才发现。
 *
 * 用法: node agent-tools/scripts/validate-chart-dom.mjs <input.html> [output.html] [--fix]
 *       --fix  尝试自动注入缺失的容器 div + 修复缺失的高度样式
 *       --json 输出 JSON 格式结果
 *
 * Exit 0 = 全部通过, 1 = 有缺失且未修复, 2 = 用法错误
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const shouldFix = argv.includes('--fix');
const jsonOutput = argv.includes('--json');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/validate-chart-dom.mjs <input.html> [output.html] [--fix] [--json]');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, error: `文件不存在: ${inputPath}` }));
  } else {
    console.error(`[validate-chart-dom] ❌ 输入文件不存在: ${inputPath}`);
  }
  process.exit(1);
}

const outputArg = argv.filter(a => !a.startsWith('--'))[1];
const outputPath = outputArg ? resolve(SKILL_ROOT, outputArg) : null;

let html = readFileSync(inputPath, 'utf-8');

// ── 收集所有 echoarts.init 调用的 DOM 容器 ──
const echartsInits = [];
const initPatterns = [
  /echarts\.init\s*\(\s*document\.getElementById\(["']([^"']+)["']\)/gi,
  /echarts\.init\s*\(\s*document\.querySelector\(["']([^"']+)["']\)/gi,
];

for (const pattern of initPatterns) {
  let match;
  while ((match = pattern.exec(html)) !== null) {
    echartsInits.push({
      method: match[0].includes('querySelector') ? 'querySelector' : 'getElementById',
      selector: match[1],
      full: match[0]
    });
  }
}

// 也检测变量形式: var chartDom = document.getElementById("xxx"); echarts.init(chartDom);
const varDeclPattern = /(?:var|let|const)\s+(\w+)\s*=\s*document\.getElementById\(["']([^"']+)["']\)/gi;
const varMap = new Map();
let varMatch;
while ((varMatch = varDeclPattern.exec(html)) !== null) {
  varMap.set(varMatch[1], varMatch[2]);
}

const varInitPattern = /echarts\.init\s*\(\s*(\w+)\s*\)/gi;
let varInitMatch;
while ((varInitMatch = varInitPattern.exec(html)) !== null) {
  const varName = varInitMatch[1];
  // 不要在变量名层面排除——只要能通过 varMap 解析就纳入校验
  const mappedId = varMap.get(varName);
  if (mappedId) {
    echartsInits.push({
      method: 'getElementById (via var)',
      selector: mappedId,
      full: varInitMatch[0]
    });
  }
}

// ── 收集所有 DOM 元素 id ──
const allIds = new Set();
const idPattern = /\s+id=["']([^"']+)["']/gi;
let idMatch;
while ((idMatch = idPattern.exec(html)) !== null) {
  allIds.add(idMatch[1]);
}

// ── 校验 ──
const missing = [];
const present = [];

for (const init of echartsInits) {
  const selector = init.selector;
  // querySelector 可能是 '#id' 或 '.class' 或复合选择器
  const cleanSelector = selector.startsWith('#') ? selector.slice(1) : selector;
  
  if (allIds.has(cleanSelector)) {
    present.push({ selector, method: init.method });
  } else if (/^[.#]/.test(selector)) {
    // querySelector('.class') 或 '#id' —— 检查 class/id
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      if (allIds.has(id)) {
        present.push({ selector, method: init.method });
        continue;
      }
    }
    // 无法验证 class selector，标记为需要人工确认
    missing.push({ selector, method: init.method, canFix: false });
  } else {
    missing.push({ selector, method: init.method, canFix: true });
  }
}

// 也统计 Chart.js
const chartJSCanvas = [];
const chartJSPattern = /new\s+Chart\s*\(\s*document\.getElementById\(["']([^"']+)["']\)/gi;
let cjsMatch;
while ((cjsMatch = chartJSPattern.exec(html)) !== null) {
  chartJSCanvas.push(cjsMatch[1]);
}

const canvasIds = new Set();
const canvasPattern = /<canvas[^>]*id=["']([^"']+)["']/gi;
let cvMatch;
while ((cvMatch = canvasPattern.exec(html)) !== null) {
  canvasIds.add(cvMatch[1]);
}

const missingCanvas = chartJSCanvas.filter(id => !canvasIds.has(id));

// ── 自动修复 ──
let fixedCount = 0;
if (shouldFix && missing.length > 0) {
  for (const m of missing) {
    if (!m.canFix) continue;
    // 找到对应的 echarts.init 调用位置，在其上方注入容器 div
    const escapedSelector = m.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const initRegex = new RegExp(
      `echarts\\.init\\s*\\(\\s*document\\.getElementById\\(["']${escapedSelector}["']\\)`,
      'i'
    );
    const match = html.match(initRegex);
    if (match) {
      const insertPos = html.indexOf(match[0]);
      if (insertPos > 0) {
        // 向前搜索最近一个 </script> 的结束或合适的插入点
        // 简化策略：在最近的一个 </div> 或 </section> 之后插入
        const before = html.slice(0, insertPos);
        const after = html.slice(insertPos);
        const lastClose = Math.max(
          before.lastIndexOf('</div>'),
          before.lastIndexOf('</section>'),
          before.lastIndexOf('</h2>'),
          before.lastIndexOf('</h3>')
        );
        // 动态计算闭合标签结束位置（而非硬编码 +6）
        let insertPoint = insertPos;
        if (lastClose > 0) {
          const tagClose = before.indexOf('>', lastClose);
          if (tagClose > lastClose) insertPoint = tagClose + 1;
        }
        
        const containerDiv = `\n    <div id="${m.selector}" class="chart-box" style="height:400px;"></div>\n`;
        html = html.slice(0, insertPoint) + containerDiv + html.slice(insertPoint);
        fixedCount++;
      }
    }
  }
  
  if (fixedCount > 0 && outputPath) {
    // 重新验证
    const updatedIds = new Set();
    const ip2 = /\s+id=["']([^"']+)["']/gi;
    let m2;
    while ((m2 = ip2.exec(html)) !== null) updatedIds.add(m2[1]);
    
    // 重新计数 missing
    const stillMissing = [];
    for (const init of echartsInits) {
      const s = init.selector.startsWith('#') ? init.selector.slice(1) : init.selector;
      if (!updatedIds.has(s)) {
        stillMissing.push(init.selector);
      }
    }
    
    writeFileSync(outputPath, html, 'utf-8');
    
    if (jsonOutput) {
      console.log(JSON.stringify({
        ok: stillMissing.length === 0 && missingCanvas.length === 0,
        echarts_total: echartsInits.length,
        echarts_missing: stillMissing.length,
        echarts_fixed: fixedCount,
        echarts_missing_details: stillMissing,
        chartjs_total: chartJSCanvas.length,
        chartjs_missing: missingCanvas.length,
        chartjs_missing_details: missingCanvas
      }));
    } else {
      console.log(`[validate-chart-dom] 🔍 图表 DOM 容器完整性校验`);
      console.log(`  ECharts 初始化: ${echartsInits.length} 处`);
      console.log(`  已找到容器: ${present.length} 处`);
      console.log(`  缺失容器: ${stillMissing.length} 处`);
      if (fixedCount > 0) {
        console.log(`  自动修复: ${fixedCount} 处 → 已写入 ${outputPath}`);
        console.log(`  修复后仍有缺失: ${stillMissing.length} 处`);
        for (const s of stillMissing) {
          console.log(`    ✗ echarts.init(document.getElementById("${s}")) — 无对应 DOM 容器`);
        }
      }
      console.log(`  Chart.js 初始化: ${chartJSCanvas.length} 处`);
      console.log(`  缺失 Canvas: ${missingCanvas.length} 处`);
      for (const c of missingCanvas) {
        console.log(`    ✗ new Chart(document.getElementById("${c}")) — 无对应 canvas 元素`);
      }
      
      if (stillMissing.length === 0 && missingCanvas.length === 0 && present.length > 0) {
        console.log(`\n  ✅ 全部通过`);
      } else if (stillMissing.length > 0 || missingCanvas.length > 0) {
        console.log(`\n  ❌ 存在未修复的缺失`);
      }
    }
    
    process.exit(stillMissing.length > 0 || missingCanvas.length > 0 ? 1 : 0);
  }
}

// ── 无修复模式 ──
if (jsonOutput) {
  console.log(JSON.stringify({
    ok: missing.filter(m => m.canFix).length === 0 && missingCanvas.length === 0,
    echarts_total: echartsInits.length,
    echarts_present: present.length,
    echarts_missing: missing.filter(m => m.canFix).length,
    echarts_missing_details: missing.filter(m => m.canFix).map(m => m.selector),
    echarts_need_review: missing.filter(m => !m.canFix).map(m => m.selector),
    chartjs_total: chartJSCanvas.length,
    chartjs_missing: missingCanvas.length,
    chartjs_missing_details: missingCanvas
  }));
} else {
  console.log(`[validate-chart-dom] 🔍 图表 DOM 容器完整性校验`);
  console.log(`  ECharts 初始化: ${echartsInits.length} 处`);
  console.log(`  已找到容器: ${present.length} 处`);
  console.log(`  缺失容器: ${missing.filter(m => m.canFix).length} 处`);
  console.log(`  需人工确认: ${missing.filter(m => !m.canFix).length} 处`);
  for (const m of missing) {
    if (m.canFix) {
      console.log(`    ✗ echarts.init(document.getElementById("${m.selector}")) — 无对应 DOM 容器`);
    } else {
      console.log(`    ⚠️ echarts.init(document.querySelector("${m.selector}")) — 无法自动验证`);
    }
  }
  console.log(`  Chart.js 初始化: ${chartJSCanvas.length} 处`);
  console.log(`  缺失 Canvas: ${missingCanvas.length} 处`);
  for (const c of missingCanvas) {
    console.log(`    ✗ new Chart(document.getElementById("${c}")) — 无对应 canvas`);
  }
  
  if (missing.filter(m => m.canFix).length === 0 && missingCanvas.length === 0) {
    console.log(`\n  ✅ 全部通过`);
  } else {
    console.log(`\n  ❌ 存在缺失（使用 --fix 自动修复或手动补充）`);
  }
}

// ── 图表容器高度完整性检查 ──
// 检测所有 [id^="chart-"] 的 div 是否有显式 height（style 属性中）
// 缺失 height → ECharts 容器高度为 0 → canvas 0×0 → 图表不可见
let heightFixedCount = 0;
const chartDivNoHeight = [];

// 匹配 <div id="chart-N" style="width:100%;"> 或 <div id="chart-N" style="width:100%">
// 即 id 以 chart- 开头但 style 中缺少 height 的 div
const chartDivRegex = /<div\b[^>]*\bid\s*=\s*["']chart-(\d+)["'][^>]*>/gi;
let cdMatch;
while ((cdMatch = chartDivRegex.exec(html)) !== null) {
  const fullTag = cdMatch[0];
  const chartNum = cdMatch[1];
  // 提取 style 属性值
  const styleMatch = fullTag.match(/style\s*=\s*["']([^"']*)["']/i);
  // 没有 style 属性，或有 style 但缺少 height → 标记
  if (!styleMatch || !/\bheight\s*:/.test(styleMatch[1])) {
    chartDivNoHeight.push({ id: `chart-${chartNum}`, fullTag, chartNum });
  }
}

if (shouldFix && chartDivNoHeight.length > 0) {
  for (const item of chartDivNoHeight) {
    const oldTag = item.fullTag;
    let newTag;
    // 提取现有 style
    const styleMatch = oldTag.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) {
      // 有 style 属性 → 追加 height:100%
      const existingStyle = styleMatch[1].trim();
      const newStyle = existingStyle.endsWith(';') || existingStyle.endsWith(' ')
        ? `${existingStyle} height:100%;`
        : `${existingStyle}; height:100%;`;
      newTag = oldTag.replace(/style\s*=\s*["'][^"']*["']/i, `style="${newStyle}"`);
    } else {
      // 没有 style 属性 → 注入 style="width:100%;height:100%;"
      newTag = oldTag.replace(/\s*>$/, ` style="width:100%;height:100%;">`);
    }
    html = html.replace(oldTag, newTag);
    heightFixedCount++;
  }
  
  if (heightFixedCount > 0 && outputPath) {
    writeFileSync(outputPath, html, 'utf-8');
  }
}

// 最终统计中包含高度修复数
if (jsonOutput) {
  // 追加 height_fixed 字段到已输出的 JSON（在 --fix 分支中已输出）
  // 非 --fix 分支需要单独输出
  if (!shouldFix) {
    console.log(JSON.stringify({
      ok: missing.filter(m => m.canFix).length === 0 && missingCanvas.length === 0 && chartDivNoHeight.length === 0,
      echarts_total: echartsInits.length,
      echarts_present: present.length,
      echarts_missing: missing.filter(m => m.canFix).length,
      echarts_missing_details: missing.filter(m => m.canFix).map(m => m.selector),
      echarts_need_review: missing.filter(m => !m.canFix).map(m => m.selector),
      chartjs_total: chartJSCanvas.length,
      chartjs_missing: missingCanvas.length,
      chartjs_missing_details: missingCanvas,
      height_missing: chartDivNoHeight.length,
      height_missing_details: chartDivNoHeight.map(c => c.id)
    }));
  }
} else if (chartDivNoHeight.length > 0) {
  console.log(`  ⚠️ 图表 div 缺少 height: ${chartDivNoHeight.length} 处（将导致 canvas 0×0 不可见）`);
  for (const item of chartDivNoHeight) {
    console.log(`    ✗ #${item.id} — style 中缺少 height 属性`);
  }
  if (heightFixedCount > 0) {
    console.log(`  自动修复: ${heightFixedCount} 处 → 已注入 height:100%`);
  }
}

process.exit(missing.filter(m => m.canFix).length > 0 || missingCanvas.length > 0 || chartDivNoHeight.length > 0 ? 1 : 0);
