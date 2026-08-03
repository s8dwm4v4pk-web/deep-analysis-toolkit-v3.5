#!/usr/bin/env node
/**
 * validate-blueprint-for-7b.mjs — 7b HTML 生成前蓝图门禁
 * 检查 7 项规则：图表清单完整性、chart_id 唯一性、数据引用一致性、
 *               模板变量已解析、章节结构完整、图表/S信号比例、极高优先级覆盖
 * 用法: node agent-tools/scripts/validate-blueprint-for-7b.mjs <blueprint.md> <analysis-state.md> [--json]
 * Exit 0=通过, 1=存在缺陷
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');
const positional = argv.filter(a => !a.startsWith('--'));
if (positional.length < 2) { console.error('用法: ...validate-blueprint-for-7b.mjs <blueprint.md> <analysis-state.md> [--json]'); process.exit(2); }

const bpFile = resolve(SKILL_ROOT, positional[0]);
const stFile = resolve(SKILL_ROOT, positional[1]);
if (!existsSync(bpFile)) { const e = { ok: false, error: `蓝图不存在: ${bpFile}` }; console.log(jsonOutput ? JSON.stringify(e) : `[validate-blueprint] ❌ ${e.error}`); process.exit(1); }
if (!existsSync(stFile)) { const e = { ok: false, error: `state不存在: ${stFile}` }; console.log(jsonOutput ? JSON.stringify(e) : `[validate-blueprint] ❌ ${e.error}`); process.exit(1); }

const bp = readFileSync(bpFile, 'utf-8');
const st = readFileSync(stFile, 'utf-8');
const issues = [];

// ── 1. 图表存在 + chart_id + type + data_ref ──
const chartDefs = [...bp.matchAll(/(?:chart|图表)\s*[{：:][\s\S]*?\{[\s\S]*?\}/gi)];
const cids = new Set();
let cCount = 0, cWithId = 0, cWithType = 0, cWithRef = 0;
for (const m of chartDefs) {
  cCount++; const t = m[0];
  const id = t.match(/(?:id|chart_id)\s*[:：]\s*["']?([\w-]+)/);
  const tp = t.match(/(?:type|chart_type)\s*[:：]\s*["']?(\w+)/);
  const rf = t.match(/(?:data_ref|data|source)\s*[:：]\s*["']?(D-\d+)/);
  if (id) { cWithId++; if (cids.has(id[1])) issues.push({ cat:'chart', rule:'unique_id', detail:`重复chart_id "${id[1]}"`, sev:'critical' }); cids.add(id[1]); }
  if (tp) cWithType++; else issues.push({ cat:'chart', rule:'has_type', detail:`图表#${cCount} 缺type`, sev:'high' });
  if (rf) { cWithRef++; if (!st.includes(rf[1])) issues.push({ cat:'data', rule:'d_ref_exists', detail:`${rf[1]} 不存在于analysis-state`, sev:'critical' }); }
  else issues.push({ cat:'chart', rule:'has_data_ref', detail:`图表#${cCount} 缺data_ref`, sev:'high' });
}
if (cCount === 0) issues.push({ cat:'chart', rule:'charts_exist', detail:'蓝图中无图表定义', sev:'critical' });

// ── 2-6. 模板变量 / 章节结构 / 图表比例 / 极高优先级覆盖 ──
if (/\{\{(?!echarts)[^}]+\}\}/.test(bp)) issues.push({ cat:'template', rule:'no_unresolved', detail:'存在未解析模板变量', sev:'critical' });
const sections = ['概述|overview|summary', '发现|findings|analysis', '图表|charts|visualization', '决策|recommend|建议'];
let secFound = 0; sections.forEach(s => { if (new RegExp(s, 'i').test(bp)) secFound++; });
if (secFound < 3) issues.push({ cat:'structure', rule:'sections_complete', detail:`仅${secFound}/4 章节就位`, sev:'high' });

const sTotal = (st.match(/S-\d+/g) || []).length;
const ratio = sTotal > 0 ? (cCount / sTotal * 100).toFixed(0) : 0;
if (sTotal > 0 && cCount / sTotal < 0.6) issues.push({ cat:'coverage', rule:'chart_signal_ratio', detail:`图表${cCount} vs S信号${sTotal} (${ratio}% < 60%)`, sev:'high' });

const criticalS = [...st.matchAll(/优先级[：:\s]*(极高|critical)/gi)].length;
if (criticalS > cCount) issues.push({ cat:'coverage', rule:'critical_coverage', detail:`极高优先级S信号${criticalS}个 > 图表${cCount}个`, sev:'high' });

// ── 汇总 ──
const passed = issues.length === 0 || issues.every(i => i.sev !== 'critical');
const result = { ok: passed, total_charts: cCount, issues, summary: { with_id: cWithId, with_type: cWithType, with_ref: cWithRef, sections: secFound, s_signals: sTotal, chart_ratio: ratio + '%' } };

if (jsonOutput) { console.log(JSON.stringify(result, null, 2)); }
else {
  console.log(`[validate-blueprint] 🏗️  7b 蓝图门禁 (${cCount} 图表)`);
  for (const i of issues) console.log(`  ${i.sev === 'critical' ? '❌' : '⚠️'} [${i.cat}/${i.rule}] ${i.detail}`);
  if (passed) console.log(`  🎯 蓝图门禁通过 → 进入 7b HTML 生成`);
}
process.exit(passed ? 0 : 1);
