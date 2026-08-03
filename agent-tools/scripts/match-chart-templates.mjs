#!/usr/bin/env node
/**
 * match-chart-templates.mjs — 图表模板智能匹配
 * 读取数据形态分类 + analysis-state S信号 → 推荐最佳 ECharts 图表类型
 * 用法: node agent-tools/scripts/match-chart-templates.mjs <data-shape.json> <analysis-state.md> [--output=charts.json] [--json]
 * Exit 0=完成, 1=输入错误
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

const positional = argv.filter(a => !a.startsWith('--'));
if (positional.length < 2) { console.error('用法: ...match-chart-templates.mjs <data-shape.json> <analysis-state.md> [--output=charts.json] [--json]'); process.exit(1); }

const shapeFile = resolve(SKILL_ROOT, positional[0]);
const stateFile = resolve(SKILL_ROOT, positional[1]);
const outputArg = argv.find(a => a.startsWith('--output='));
const outputFile = outputArg ? resolve(SKILL_ROOT, outputArg.split('=')[1]) : null;

if (!existsSync(shapeFile)) { const e = { ok: false, error: `data-shape.json 不存在: ${shapeFile}` }; console.log(jsonOutput ? JSON.stringify(e) : `[match-chart-templates] ❌ ${e.error}`); process.exit(1); }
if (!existsSync(stateFile)) { const e = { ok: false, error: `analysis-state.md 不存在: ${stateFile}` }; console.log(jsonOutput ? JSON.stringify(e) : `[match-chart-templates] ❌ ${e.error}`); process.exit(1); }

let shapeData;
try { shapeData = JSON.parse(readFileSync(shapeFile, 'utf-8')); } catch (e) { console.error(`[match-chart-templates] ❌ data-shape.json 解析失败: ${e.message}`); process.exit(1); }
const stateContent = readFileSync(stateFile, 'utf-8');

// ── 图表类型映射决策树 ──
const shapeToChart = {
  time_series: 'line',
  categorical_comparison: 'bar',
  categorical_ranking: 'horizontal_bar',
  part_to_whole: 'pie',
  distribution: 'histogram',
  correlation: 'scatter',
  hierarchy: 'treemap',
  geographic: 'map',
  flow: 'sankey',
  proportion_over_time: 'stacked_area',
  multi_var_comparison: 'radar',
  funnel: 'funnel',
  gauge: 'gauge',
};

// ── 提取 S 信号 ──
const sSignals = [];
const sRegex = /(S-\d+)[\s\S]*?(?=\n(?:S-\d+|## |$))/gi;
let m;
while ((m = sRegex.exec(stateContent)) !== null) {
  const block = m[1] + ' ' + (m[0] || '');
  const priority = block.match(/优先级[：:\s]*(极高|高|中)/) || [];
  sSignals.push({ id: m[1], priority: priority[1] || '中', block });
}

// ── 匹配推荐 ──
const recommendations = [];
const shapes = shapeData.shapes || shapeData;
const shapeEntries = Array.isArray(shapes) ? shapes : Object.entries(shapes).map(([k, v]) => ({ ...v, name: k }));

for (const sig of sSignals) {
  let bestChart = 'bar', bestConf = 0.3;
  for (const shape of shapeEntries) {
    if (sig.block.toLowerCase().includes(shape.name?.toLowerCase() || '')) {
      const chartType = shapeToChart[shape.name] || 'bar';
      const conf = 0.7;
      if (conf > bestConf) { bestChart = chartType; bestConf = conf; }
    }
  }
  // 关键词兜底
  if (sig.block.includes('趋势') || sig.block.includes('时间')) { bestChart = 'line'; bestConf = 0.8; }
  else if (sig.block.includes('占比') || sig.block.includes('比例')) { bestChart = 'pie'; bestConf = 0.8; }
  else if (sig.block.includes('对比') || sig.block.includes('排名')) { bestChart = 'bar'; bestConf = 0.7; }
  else if (sig.block.includes('分布')) { bestChart = 'histogram'; bestConf = 0.7; }
  else if (sig.block.includes('相关') || sig.block.includes('关联')) { bestChart = 'scatter'; bestConf = 0.6; }

  recommendations.push({ signal_id: sig.id, priority: sig.priority, chart_type: bestChart, confidence: bestConf });
}

const result = { ok: true, recommendations, summary: { total_signals: sSignals.length, chart_types: [...new Set(recommendations.map(r => r.chart_type))] } };

if (outputFile) writeFileSync(outputFile, JSON.stringify(recommendations, null, 2), 'utf-8');
if (jsonOutput) { console.log(JSON.stringify(result, null, 2)); }
else {
  console.log(`[match-chart-templates] 📊 图表模板匹配完成 (${sSignals.length} 信号)`);
  for (const r of recommendations) console.log(`  ${r.signal_id} [${r.priority}] → ${r.chart_type} (置信度 ${(r.confidence * 100).toFixed(0)}%)`);
}
process.exit(0);
