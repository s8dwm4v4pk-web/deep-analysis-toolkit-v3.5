#!/usr/bin/env node
/**
 * reconcile-report.mjs — 自动勾稽校验报告生成器
 *
 * 用途：从 CSV/JSON 数据文件自动执行阶段 1 的 5 项勾稽校验，输出结构化 JSON，
 *       替换提示词中教 LLM 如何做数学校验的大量文本。
 *
 * 5 项校验:
 *   R1 — 总量一致性：子列之和是否等于总列
 *   R2 — 时间连续性：时间序列间隔是否均匀
 *   R3 — 字段完整性：各列缺失率
 *   R4 — 逻辑一致性：逻辑上应对齐的字段是否一致
 *   R5 — 量纲合理性：数值是否在合理范围内（基于 Z-score）
 *
 * 用法: node agent-tools/scripts/reconcile-report.mjs <data.csv|data.json> [--total-col=<name>] [--sub-cols=a,b,c] [--date-col=<name>] [--json]
 *
 * 支持格式:
 *   CSV: 自动检测分隔符（逗号/制表符）和表头行
 *   JSON: 对象数组 [{col:val,...},...]
 *
 * Exit 0 = 成功, 1 = 文件错误
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
  console.error('用法: node agent-tools/scripts/reconcile-report.mjs <data.csv|data.json> [--total-col=NAME] [--sub-cols=A,B,C] [--date-col=NAME] [--json]');
  console.error('  --total-col  总量/汇总列名');
  console.error('  --sub-cols   子列名，逗号分隔');
  console.error('  --date-col   日期列名');
  console.error('  --json       输出 JSON');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (jsonOutput) console.log(JSON.stringify({ error: `文件不存在: ${inputPath}` }));
  else console.error(`[reconcile-report] ❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

const rawContent = readFileSync(inputPath, 'utf-8').trim();

// ── 解析参数 ──
const getFlag = (name) => {
  const f = argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.split('=').slice(1).join('=') : null;
};

const totalColFlag = getFlag('total-col');
const subColsFlag = getFlag('sub-cols');
const dateColFlag = getFlag('date-col');

const totalCol = totalColFlag || null;
const subCols = subColsFlag ? subColsFlag.split(',').map(s => s.trim()).filter(Boolean) : [];
const dateCol = dateColFlag || null;

// ── 解析 CSV ──
const parseCSV = (text) => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // 自动检测分隔符
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length !== headers.length) continue; // 跳过不规则行
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      const num = parseFloat(val);
      row[h] = isNaN(num) ? val : num;
    });
    rows.push(row);
  }

  return { headers, rows, delimiter };
};

// ── 解析 JSON ──
const parseJSON = (text) => {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = Object.keys(data[0]);
    return { headers, rows: data };
  } catch {
    return { headers: [], rows: [] };
  }
};

// ── 主解析 ──
const isJSON = rawContent.startsWith('[') || rawContent.startsWith('{');
const { headers, rows } = isJSON ? parseJSON(rawContent) : parseCSV(rawContent);

if (rows.length === 0) {
  if (jsonOutput) console.log(JSON.stringify({ error: '无法解析数据: 0 行' }));
  else console.error('[reconcile-report] ❌ 无法解析数据（0 行有效数据）');
  process.exit(1);
}

// ── 辅助函数 ──
const isNumeric = (v) => typeof v === 'number' && !isNaN(v);

const numericCols = headers.filter(h => rows.some(r => isNumeric(r[h])));
const allNumericCols = headers.filter(h => rows.every(r => isNumeric(r[h])));

// ── R1: 总量一致性 ──
let r1Result = { status: 'N/A', detail: '未指定总量列/子列' };
if (totalCol && subCols.length > 0) {
  const failRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const total = parseFloat(row[totalCol]) || 0;
    const sumSub = subCols.reduce((sum, col) => sum + (parseFloat(row[col]) || 0), 0);
    const diff = Math.abs(total - sumSub);
    const pct = total !== 0 ? diff / Math.abs(total) : (sumSub !== 0 ? diff / Math.abs(sumSub) : 0);
    if (pct > 0.005 && diff > 0.01) {
      failRows.push({ row: i + 1, total, sumSub, diff, pct: (pct * 100).toFixed(1) + '%' });
    }
  }
  r1Result = {
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    totalCol,
    subCols,
    checked: rows.length,
    failures: failRows.length,
    detail: failRows.length === 0 ? '全部行子列之和 = 总列（容差 0.5%）' : `${failRows.length} 行不匹配`,
    failRows: failRows.slice(0, 10), // 最多展示 10 行
  };
}

// ── R2: 时间连续性 ──
let r2Result = { status: 'N/A', detail: '未指定日期列或无时间维度' };
if (dateCol && headers.includes(dateCol)) {
  const dates = rows.map(r => {
    const d = r[dateCol];
    if (d instanceof Date) return d;
    const parsed = new Date(String(d));
    return isNaN(parsed.getTime()) ? null : parsed;
  }).filter(Boolean);

  if (dates.length >= 3) {
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)); // 天数
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const gaps = intervals.filter(iv => iv > avgInterval * 2);
    r2Result = {
      status: gaps.length === 0 ? 'PASS' : 'WARN',
      totalPoints: dates.length,
      avgIntervalDays: avgInterval.toFixed(1),
      intervalRange: `${Math.min(...intervals).toFixed(0)}-${Math.max(...intervals).toFixed(0)} 天`,
      gaps: gaps.length,
      gapDetail: gaps.length > 0 ? `${gaps.length} 处跳空（> ${(avgInterval * 2).toFixed(0)} 天）` : '无断档',
    };
  }
}

// ── R3: 字段完整性 ──
const missingRates = headers.map(h => {
  const total = rows.length;
  const missing = rows.filter(r => r[h] === null || r[h] === undefined || r[h] === '' || (typeof r[h] === 'number' && isNaN(r[h]))).length;
  return { column: h, total, missing, rate: (missing / total * 100).toFixed(1) + '%' };
});

const criticalMissing = missingRates.filter(m => parseFloat(m.rate) > 5);
const severeMissing = missingRates.filter(m => parseFloat(m.rate) > 30);
const r3Result = {
  status: severeMissing.length > 0 ? 'FAIL' : (criticalMissing.length > 0 ? 'WARN' : 'PASS'),
  totalCols: headers.length,
  highMissing: criticalMissing.map(m => `${m.column}(${m.rate})`),
  severeMissing: severeMissing.map(m => `${m.column}(${m.rate})`),
  allRates: missingRates,
};

// ── R4: 逻辑一致性 ──
let r4Result = { status: 'N/A', detail: '无内置逻辑检查（需指定关联字段）' };
const logicIssues = [];

// 如果所有列都是数值，检查百分比列是否和为 100（近似）
if (allNumericCols.length >= 3) {
  let pctColCount = 0;
  for (const h of headers) {
    const vals = rows.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
    if (vals.length > 0 && vals.every(v => v >= 0 && v <= 1)) {
      pctColCount++;
    }
  }
  if (pctColCount >= 2) {
    logicIssues.push(`检测到 ${pctColCount} 列值域在 [0,1]，可能是比例数据 — 需人工确认是否应和为 1`);
  }
}

if (dateCol) {
  // 可以在这里加更多逻辑校验
  logicIssues.push(`日期列 "${dateCol}" 存在 — 建议人工确认开始≤结束等业务逻辑`);
}

r4Result = {
  status: logicIssues.length > 0 ? 'WARN' : 'N/A',
  issues: logicIssues,
  detail: logicIssues.join('; ') || '无逻辑矛盾',
};

// ── R5: 量纲合理性 ──
const zScoreResults = [];
for (const col of numericCols) {
  const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (vals.length < 3) continue;

  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // 使用 n-1 样本标准差，对小样本离群值判断更保守准确
  const std = vals.length > 1
    ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1))
    : 0;
  if (std === 0) continue;

  const outliers = vals
    .map((v, i) => ({ row: i + 1, value: v, zScore: (v - mean) / std }))
    .filter(o => Math.abs(o.zScore) > 5);

  if (outliers.length > 0) {
    zScoreResults.push({
      column: col,
      mean: mean.toFixed(2),
      std: std.toFixed(2),
      outliers: outliers.slice(0, 3).map(o => `行${o.row}: ${o.value} (z=${o.zScore.toFixed(1)})`),
    });
  }
}

const r5Result = {
  status: zScoreResults.length > 0 ? 'WARN' : 'N/A',
  checkedCols: numericCols.length,
  suspiciousCols: zScoreResults.length,
  detail: zScoreResults.length > 0 
    ? zScoreResults.map(z => `${z.column}: ${z.outliers.join(', ')}`).join('; ')
    : '无量纲异常',
  zScoreDetails: zScoreResults,
};

// ── 质量评级 ──
const failCount = [r1Result, r3Result].filter(r => r.status === 'FAIL').length;
const warnCount = [r1Result, r2Result, r3Result, r4Result, r5Result].filter(r => r.status === 'WARN').length;
let quality;
if (failCount === 0 && warnCount === 0) quality = 'A';
else if (failCount === 0) quality = 'B';
else if (failCount <= 2) quality = 'C';
else quality = 'D';

// ── 输出 ──
const report = {
  file: inputPath,
  rows: rows.length,
  columns: headers.length,
  numericColumns: numericCols.length,
  headers,
  quality,
  reconciliations: {
    R1: r1Result,
    R2: r2Result,
    R3: r3Result,
    R4: r4Result,
    R5: r5Result,
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`[reconcile-report] 📊 自动勾稽校验报告`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  维度: ${rows.length} 行 × ${headers.length} 列 (${numericCols.length} 数值列)`);
  console.log(`  质量评级: ${quality} 级\n`);
  
  console.log(`  R1 总量一致性: ${r1Result.status}  ${r1Result.detail}`);
  console.log(`  R2 时间连续性: ${r2Result.status}  ${r2Result.detail}`);
  console.log(`  R3 字段完整性: ${r3Result.status}  ${r3Result.highMissing.length > 0 ? '高缺失: ' + r3Result.highMissing.join(', ') : '全部字段缺失率 ≤ 5%'}`);
  console.log(`  R4 逻辑一致性: ${r4Result.status}  ${r4Result.detail}`);
  console.log(`  R5 量纲合理性: ${r5Result.status}  ${r5Result.detail}`);
  
  if (r1Result.failRows) {
    console.log(`\n  R1 不一致明细:`);
    for (const fr of r1Result.failRows) {
      console.log(`    行${fr.row}: 总和=${fr.sumSub} ≠ 总量=${fr.total} (差 ${fr.diff.toFixed(2)}, ${fr.pct})`);
    }
  }
}

process.exit(0);
