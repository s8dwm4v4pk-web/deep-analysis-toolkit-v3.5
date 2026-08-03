#!/usr/bin/env node
/**
 * classify-data-shape.mjs — 自动数据形状分类
 *
 * 用途：输入 CSV/JSON 数据文件 → 对每列自动判定 S1-S17 形态分类，
 *       输出结构化清单，供阶段 6 图表规划直接引用。
 *       替换提示词中教 LLM 根据行列数、值类型判断数据形状的大量文本。
 *
 * 形态体系 (S1-S17):
 *   S1  一维数组    — 1 列数值 + 1 列类别，N 个实体
 *   S2  多维矩阵    — ≥3 列数值，共享同一维度
 *   S3  极简 KPI   — 2-6 个孤立数值
 *   S4  时间序列    — 同一指标 ≥3 个时间点
 *   S5  双变量      — 2 列连续数值，一一对应
 *   S6  构成/占比   — 数值为百分比，和为 ≈100%
 *   S7  排名        — 数值降序后可排序
 *   S8  分布        — 大量同类型数值，可做直方图
 *   S9  地理        — 类别列疑似地名
 *   S10 层级        — 类别列有层次结构
 *   S11 关联        — 2+ 列数值，相关性 ≥ 0.7
 *   S12 异常        — 含显著离群值（Z > 3）
 *   S13 流程/网络   — 源→目标→数值三元组
 *   S14 周期        — 时间序列，可检测周期性
 *   S15 文本混合    — 含大量文本/分类标签
 *   S16 稀疏        — 大量零值/空值（> 50%）
 *   S17 多维复合    — 同时匹配 3+ 个形态
 *
 * 用法: node agent-tools/scripts/classify-data-shape.mjs <data.csv|data.json> [--json]
 *
 * Exit 0 = 成功
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/classify-data-shape.mjs <data.csv|data.json> [--json]');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (jsonOutput) console.log(JSON.stringify({ error: `文件不存在: ${inputPath}` }));
  else console.error(`[classify-data-shape] ❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

const rawContent = readFileSync(inputPath, 'utf-8').trim();

// ── CSV 解析 ──
const parseCSV = (text) => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      const num = parseFloat(val);
      row[h] = isNaN(num) ? val : num;
    });
    rows.push(row);
  }
  return { headers, rows };
};

const parseJSON = (text) => {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return { headers: [], rows: [] };
    return { headers: Object.keys(data[0] || {}), rows: data };
  } catch { return { headers: [], rows: [] }; }
};

const isJSON = rawContent.startsWith('[');
const { headers, rows } = isJSON ? parseJSON(rawContent) : parseCSV(rawContent);

if (rows.length === 0) {
  if (jsonOutput) console.log(JSON.stringify({ error: '0 行有效数据' }));
  else console.error('[classify-data-shape] ❌ 无法解析数据');
  process.exit(1);
}

// ── 辅助函数 ──
const isNumeric = (v) => typeof v === 'number' && !isNaN(v);
const isDate = (v) => {
  if (v instanceof Date) return true;
  if (typeof v !== 'string') return false;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  // 宽松检测：包含年月日分隔符
  return /^\d{2,4}[-/年]\d{1,2}[-/月]\d{0,2}/.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v);
};

const getColumnType = (col) => {
  const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return 'empty';
  const numericCount = vals.filter(v => isNumeric(v)).length;
  const dateCount = vals.filter(v => isDate(v)).length;
  if (numericCount === vals.length) return 'numeric';
  if (dateCount === vals.length) return 'date';
  if (numericCount > vals.length * 0.8) return 'mostly_numeric';
  return 'text';
};

// ── 全局特征 ──
const colTypes = {};
for (const h of headers) {
  colTypes[h] = getColumnType(h);
}

const numericCols = headers.filter(h => colTypes[h] === 'numeric');
const textCols = headers.filter(h => colTypes[h] === 'text');
const dateCols = headers.filter(h => colTypes[h] === 'date');

// ── 逐列分类 ──
const shapeResults = [];

for (const col of headers) {
  const type = colTypes[col];
  const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
  const numericVals = vals.filter(v => isNumeric(v)).map(v => parseFloat(v));
  const shapes = [];

  // S1: 一维数组 — 该列为数值，且存在另一文本分类列
  if (type === 'numeric' && textCols.length >= 1) {
    shapes.push('S1');
  }

  // S2: 多维矩阵 — ≥3 列数值
  if (numericCols.length >= 3 && type === 'numeric') {
    shapes.push('S2');
  }

  // S3: 极简 KPI — 总行数 2-6
  if (type === 'numeric' && rows.length >= 2 && rows.length <= 6) {
    shapes.push('S3');
  }

  // S4: 时间序列 — 存在日期列
  if (type === 'numeric' && dateCols.length >= 1) {
    shapes.push('S4');
  }

  // S5: 双变量 — 2 列数值
  if (type === 'numeric' && numericCols.length === 2) {
    shapes.push('S5');
  }

  // S6: 构成/占比 — 数值在 [0,1] 或 [0,100]，且和为 ~1 或 ~100
  if (type === 'numeric' && numericVals.length > 0) {
    const allInPercent = numericVals.every(v => v >= 0 && v <= 100);
    const allInRatio = numericVals.every(v => v >= 0 && v <= 1);
    const sum = numericVals.reduce((a, b) => a + b, 0);
    if (allInPercent && sum > 80 && sum < 120) shapes.push('S6');
    else if (allInRatio && sum > 0.8 && sum < 1.2) shapes.push('S6');
  }

  // S7: 排名 — 数值列单调（升序或降序均为排名数据）
  if (type === 'numeric' && numericVals.length >= 2) {
    let isSortedDesc = true;
    let isSortedAsc = true;
    for (let i = 1; i < numericVals.length; i++) {
      if (numericVals[i] > numericVals[i - 1]) { isSortedDesc = false; }
      if (numericVals[i] < numericVals[i - 1]) { isSortedAsc = false; }
    }
    if (isSortedDesc || isSortedAsc) shapes.push('S7');
  }

  // S8: 分布 — ≥20 个数值，可做直方图
  if (type === 'numeric' && numericVals.length >= 20) {
    shapes.push('S8');
  }

  // S9: 地理 — 文本列疑似地名（含省/市/区/县/镇）
  if (type === 'text') {
    const textVals = vals.map(v => String(v));
    const geoKeywords = ['省', '市', '区', '县', '镇', '乡', '街道', '路'];
    const geoCount = textVals.filter(v => geoKeywords.some(k => v.includes(k))).length;
    if (geoCount > textVals.length * 0.3) shapes.push('S9');
  }

  // S10: 层级 — 文本列有层次分隔符（/ - >）
  if (type === 'text') {
    const textVals = vals.map(v => String(v));
    const hierCount = textVals.filter(v => /[/>\-]/.test(v) && v.length > 3).length;
    if (hierCount > textVals.length * 0.2) shapes.push('S10');
  }

  // S11: 关联 — 2+ 列数值，Pearson r ≥ 0.7（采样前 2 列数值）
  if (type === 'numeric' && numericCols.length >= 2) {
    const otherNumeric = numericCols.filter(h => h !== col).slice(0, 1);
    for (const otherCol of otherNumeric) {
      const pairs = [];
      for (const row of rows) {
        const a = parseFloat(row[col]);
        const b = parseFloat(row[otherCol]);
        if (!isNaN(a) && !isNaN(b)) pairs.push([a, b]);
      }
      if (pairs.length >= 3) {
        const n = pairs.length;
        const sumX = pairs.reduce((s, p) => s + p[0], 0);
        const sumY = pairs.reduce((s, p) => s + p[1], 0);
        const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
        const sumX2 = pairs.reduce((s, p) => s + p[0] ** 2, 0);
        const sumY2 = pairs.reduce((s, p) => s + p[1] ** 2, 0);
        const r = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
        if (Math.abs(r) > 0.7) shapes.push('S11');
      }
    }
  }

  // S12: 异常 — Z-score > 3
  if (type === 'numeric' && numericVals.length >= 5) {
    const mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
    const std = Math.sqrt(numericVals.reduce((s, v) => s + (v - mean) ** 2, 0) / (numericVals.length - 1));
    if (std > 0) {
      const hasOutlier = numericVals.some(v => Math.abs((v - mean) / std) > 3);
      if (hasOutlier) shapes.push('S12');
    }
  }

  // S13: 流程/网络 — 仅当列名符合 source→target→value 语义时标记
  if (headers.length >= 3 && textCols.length >= 2 && numericCols.length >= 1) {
    const colLower = col.toLowerCase();
    const isSourceTarget = /^(source|from|origin|src|源|出发|起点)\b/i.test(colLower) ||
                           /^(target|to|destination|dest|dst|目标|到达|终点)\b/i.test(colLower);
    const isValueInTriplet = type === 'numeric' && (
      /^(value|weight|count|flow|amount|size|量|值|权重|计数|流量)\b/i.test(colLower) ||
      (numericCols.length === 1 && textCols.length === 2 && headers.length === 3)
    );
    if ((type === 'text' && isSourceTarget) || (type === 'numeric' && isValueInTriplet)) {
      shapes.push('S13');
    }
  }

  // S14: 周期 — 有日期列且有 ≥12 个时间点
  if (type === 'numeric' && dateCols.length >= 1 && rows.length >= 12) {
    shapes.push('S14');
  }

  // S15: 文本混合 — 既有数值又有文本
  if (type === 'mostly_numeric') {
    shapes.push('S15');
  }

  // S16: 稀疏 — >50% 为零或空
  if (type === 'numeric' && numericVals.length > 0) {
    const zeroCount = numericVals.filter(v => v === 0).length;
    if (zeroCount > numericVals.length * 0.5) shapes.push('S16');
  }
  if (vals.length > 0 && (rows.length - vals.length) > rows.length * 0.5) {
    shapes.push('S16');
  }

  // S17: 多维复合 — 匹配 3+ 个形态
  if (shapes.length >= 3) shapes.push('S17');

  shapeResults.push({
    column: col,
    type,
    count: vals.length,
    uniqueCount: new Set(vals.map(v => String(v))).size,
    shapes: [...new Set(shapes)], // 去重
  });
}

// ── 整体数据集分类 ──
const overallShapes = new Set();
shapeResults.forEach(sr => sr.shapes.forEach(s => overallShapes.add(s)));

// ── 推荐图表类型 ──
const shapeToChart = {
  'S1': ['柱状图', '条形图', '饼图'],
  'S2': ['分组柱状图', '雷达图', '平行坐标', '热力图'],
  'S3': ['KPI 卡片', '仪表盘', '数字大屏'],
  'S4': ['折线图', '面积图', '日历热力图'],
  'S5': ['散点图', '气泡图', '回归线'],
  'S6': ['饼图', '环形图', '堆叠柱状图', '旭日图'],
  'S7': ['条形图', '排行榜', '棒棒糖图'],
  'S8': ['直方图', '箱线图', '小提琴图', '密度图'],
  'S9': ['地图', '地理热力图'],
  'S10': ['旭日图', '矩形树图', '桑基图'],
  'S11': ['散点图+回归', '相关性矩阵', '热力图'],
  'S12': ['箱线图', '散点图', '标注异常柱状图'],
  'S13': ['桑基图', '力导向图', '弦图'],
  'S14': ['折线图+周期标注', '季节性分解'],
  'S15': ['词云', '文本分类柱状图'],
  'S16': ['稀疏矩阵热力图', '缺失模式图'],
  'S17': ['仪表板', '多维联动图表'],
};

const recommendedCharts = new Set();
overallShapes.forEach(s => {
  (shapeToChart[s] || []).forEach(c => recommendedCharts.add(c));
});

// ── 输出 ──
const result = {
  file: inputPath,
  summary: {
    rows: rows.length,
    columns: headers.length,
    numericCols: numericCols.length,
    textCols: textCols.length,
    dateCols: dateCols.length,
    detectedShapes: [...overallShapes].sort(),
    recommendedCharts: [...recommendedCharts],
  },
  columns: shapeResults,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[classify-data-shape] 🔬 数据形状自动分类`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  维度: ${rows.length} 行 × ${headers.length} 列`);
  console.log(`  数值列: ${numericCols.length} | 文本列: ${textCols.length} | 日期列: ${dateCols.length}`);
  console.log(`  检测到的形态: ${[...overallShapes].sort().join(', ') || '无'}`);
  console.log(`  推荐图表: ${[...recommendedCharts].join(', ')}\n`);

  console.log(`  逐列分类:`);
  for (const sr of shapeResults) {
    const shapeTags = sr.shapes.map(s => `[${s}]`).join(' ');
    console.log(`    ${sr.column.padEnd(20)} ${sr.type.padEnd(10)} ${sr.count} 行  ${sr.uniqueCount} 唯一值  ${shapeTags}`);
  }
}

process.exit(0);
