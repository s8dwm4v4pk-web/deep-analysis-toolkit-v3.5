#!/usr/bin/env node
/**
 * validate-chart-checklist.mjs — 图表需求清单自验收
 *
 * 用途：解析 analysis-state.md 中的「图表需求清单」表格，逐行计数，
 *       与 P7 阈值对比。LLM 自报经常不准确，脚本直接数出来更可靠。
 *
 * 此脚本在阶段 6 产出后运行，作为阶段 6 的自动自验收闸门。
 *
 * 用法: node agent-tools/scripts/validate-chart-checklist.mjs <analysis-state.md路径> [--p7-standard|--p7-compact|--p7-exhaustive]
 *       node agent-tools/scripts/validate-chart-checklist.mjs <analysis-state.md路径> --min-total=12 --min-advanced=3 --min-multi=1 --min-dim=5
 *       --json  输出 JSON
 *
 * P7 预设:
 *   standard   总计≥12 / 高级≥3 / 多维≥1
 *   compact    总计≥8  / 高级≥2 / 多维≥1
 *   exhaustive 总计≥16 / 高级≥5 / 多维≥2
 *
 * Exit 0 = 达标, 1 = 不达标/解析失败
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

const PRESETS = {
  standard:  { total: 12, advanced: 3, multi: 1, dim: 5 },
  compact:   { total: 8,  advanced: 2, multi: 1, dim: 4 },
  exhaustive:{ total: 16, advanced: 5, multi: 2, dim: 5 },
};

// 解析参数
const inputArg = argv.find(a => !a.startsWith('--'));
let thresholds = null;

const presetFlag = argv.find(a => a.startsWith('--p7-'));
if (presetFlag) {
  const key = presetFlag.replace('--p7-', '');
  if (PRESETS[key]) {
    thresholds = { ...PRESETS[key] };
  }
}

// 也支持显式 --min-total=N
const getFlag = (name) => {
  const f = argv.find(a => a.startsWith(`--${name}=`));
  return f ? parseInt(f.split('=')[1], 10) : null;
};

const explicitTotal = getFlag('min-total');
const explicitAdvanced = getFlag('min-advanced');
const explicitMulti = getFlag('min-multi');
const explicitDim = getFlag('min-dim');

if (explicitTotal || explicitAdvanced || explicitMulti) {
  thresholds = {
    total: explicitTotal || thresholds?.total || 12,
    advanced: explicitAdvanced || thresholds?.advanced || 3,
    multi: explicitMulti || thresholds?.multi || 1,
    dim: explicitDim || thresholds?.dim || 5,
  };
}

if (!thresholds) {
  if (!jsonOutput) {
    console.error('用法: node agent-tools/scripts/validate-chart-checklist.mjs <analysis-state.md> [--p7-standard|--p7-compact|--p7-exhaustive]');
    console.error('      node agent-tools/scripts/validate-chart-checklist.mjs <analysis-state.md> --min-total=12 --min-advanced=3 --min-multi=1');
    console.error('      --json  输出 JSON');
  } else {
    console.log(JSON.stringify({ ok: false, error: '缺少 P7 阈值参数' }));
  }
  process.exit(2);
}

if (!inputArg) {
  if (!jsonOutput) console.error('❌ 缺少 analysis-state.md 路径');
  else console.log(JSON.stringify({ ok: false, error: '缺少文件路径' }));
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (!jsonOutput) console.error(`❌ 文件不存在: ${inputPath}`);
  else console.log(JSON.stringify({ ok: false, error: `文件不存在: ${inputPath}` }));
  process.exit(1);
}

const content = readFileSync(inputPath, 'utf-8');

// ── 解析图表需求清单 ──
// 查找「图表需求清单」章节，解析结构化 8 列表格
const chartSectionMatch = content.match(/#{2,3}\s+图表需求清单/);
const chartSectionStart = chartSectionMatch ? chartSectionMatch.index : -1;
if (chartSectionStart === -1) {
  if (!jsonOutput) {
    console.error('[validate-chart-checklist] ❌ 未找到「图表需求清单」章节');
    console.error('  阶段 6 未写入图表需求清单，请回溯阶段 6');
  } else {
    console.log(JSON.stringify({ ok: false, error: '未找到图表需求清单章节' }));
  }
  process.exit(1);
}

// 从表格头开始截取
const sectionContent = content.slice(chartSectionStart);
// 找第一个 Markdown 表格（以 | 开头行）
const lines = sectionContent.split('\n');
let tableStart = -1;
let tableEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('|') && tableStart === -1) {
    tableStart = i;
  } else if (tableStart !== -1 && !line.startsWith('|') && line !== '' && tableEnd === -1) {
    tableEnd = i;
    break;
  }
}
if (tableEnd === -1) tableEnd = lines.length;

if (tableStart === -1) {
  if (!jsonOutput) {
    console.error('[validate-chart-checklist] ❌ 图表需求清单中未找到 Markdown 表格');
  } else {
    console.log(JSON.stringify({ ok: false, error: '未找到图表表格' }));
  }
  process.exit(1);
}

// 解析表格行（跳过表头和分隔行）
const ADVANCED_TYPES = [
  '雷达图', '桑基图', '旭日图', '矩形树图', '平行坐标', '瀑布图',
  '仪表盘', '箱线图', '力导向图', '哑铃图', '日历热力图',
  '散点+回归', '棒棒糖图', '子弹图', '气泡图', '象形柱图', 
  '折线+标注', '3D散点', 'heatmap', 'radar', 'sankey', 'treemap',
  'sunburst', 'parallel', 'waterfall', 'gauge', 'boxplot', 'force',
  'dumbbell', 'calendar',
];

const chartRows = [];
for (let i = tableStart; i < tableEnd; i++) {
  const line = lines[i].trim();
  if (!line.startsWith('|')) continue;
  // 跳过分隔行（仅含 --- 和 |）
  if (/^\|[\s\-:|]+\|$/.test(line)) continue;
  // 跳过表头（图编号 / 章节 / 叙事功能...）
  if (/图编号/.test(line) && /章节/.test(line)) continue;

  const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
  if (cells.length >= 7) {
    const isAdvanced = cells[6]?.includes('✅') || cells[6]?.includes('✔') || cells[6]?.toLowerCase() === 'yes' || cells[6]?.toLowerCase() === 'true';
    const isMulti = cells[7]?.includes('✅') || cells[7]?.includes('✔') || cells[7]?.toLowerCase() === 'yes' || cells[7]?.toLowerCase() === 'true';
    
    // 也通过模板文件名判断
    const template = cells[4] || '';
    const engine = cells[3] || '';
    const desc = cells[2] || '';
    const isAdvancedByType = ADVANCED_TYPES.some(t => template.toLowerCase().includes(t.toLowerCase()) || desc.includes(t));
    const isMultiByType = /radar|parallel|sankey|heatmap/.test(template.toLowerCase());
    
    chartRows.push({
      id: cells[0],
      chapter: cells[1],
      function: desc,
      engine,
      template,
      dataBlock: cells[5],
      isAdvanced: isAdvanced || isAdvancedByType,
      isMulti: isMulti || isMultiByType,
    });
  }
}

const totalCharts = chartRows.length;
const advancedCharts = chartRows.filter(r => r.isAdvanced);
const multiCharts = chartRows.filter(r => r.isMulti);

const totalOK = totalCharts >= thresholds.total;
const advancedOK = advancedCharts.length >= thresholds.advanced;
const multiOK = multiCharts.length >= thresholds.multi;

const allPassed = totalOK && advancedOK && multiOK;

const result = {
  ok: allPassed,
  thresholds,
  actual: {
    total: totalCharts,
    advanced: advancedCharts.length,
    multi: multiCharts.length,
  },
  checks: {
    total: { pass: totalOK, required: thresholds.total, actual: totalCharts },
    advanced: { pass: advancedOK, required: thresholds.advanced, actual: advancedCharts.length },
    multi: { pass: multiOK, required: thresholds.multi, actual: multiCharts.length },
  },
  charts: chartRows.map(r => ({
    id: r.id,
    chapter: r.chapter,
    advanced: r.isAdvanced,
    multi: r.isMulti,
  })),
  failures: [],
};

if (!totalOK) result.failures.push(`图表总数不足: ${totalCharts}/${thresholds.total}`);
if (!advancedOK) result.failures.push(`高级图表不足: ${advancedCharts.length}/${thresholds.advanced}`);
if (!multiOK) result.failures.push(`多维图表不足: ${multiCharts.length}/${thresholds.multi}`);

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[validate-chart-checklist] 📊 图表需求清单自验收`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  阈值: 总计≥${thresholds.total} / 高级≥${thresholds.advanced} / 多维≥${thresholds.multi}`);
  console.log(`  实际: 总计=${totalCharts} / 高级=${advancedCharts.length} / 多维=${multiCharts.length}`);
  
  console.log(`\n  明细:`);
  for (const r of chartRows) {
    const tags = [];
    if (r.isAdvanced) tags.push('高级');
    if (r.isMulti) tags.push('多维');
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    console.log(`    图${r.id}: ${r.chapter} — ${r.function}${tagStr}`);
  }
  
  console.log(`\n  验收结果:`);
  console.log(`    总计: ${totalOK ? '✅' : '❌'} ${totalCharts}/${thresholds.total}`);
  console.log(`    高级: ${advancedOK ? '✅' : '❌'} ${advancedCharts.length}/${thresholds.advanced}`);
  console.log(`    多维: ${multiOK ? '✅' : '❌'} ${multiCharts.length}/${thresholds.multi}`);
  
  if (allPassed) {
    console.log(`\n  🎯 全部达标 — 可进入阶段 7a`);
  } else {
    console.log(`\n  ❌ 不达标 — 阶段 6 必须重跑以补充图表`);
    for (const f of result.failures) {
      console.log(`    ↳ ${f}`);
    }
  }
}

process.exit(allPassed ? 0 : 1);
