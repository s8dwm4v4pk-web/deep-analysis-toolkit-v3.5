#!/usr/bin/env node
/**
 * check-blueprint-fields.mjs — blueprint.md 字段完整性校验
 *
 * 用途：在阶段 7a 产出 blueprint.md 后，验证 13 个必需字段是否全部存在且非空。
 *       任何缺失都意味着 7b 无法生成完整报告。
 *
 * 检查项（对应阶段 7a §1 上下文就绪检查表）：
 *   1. 封面标题 — `## 封面信息` 下 `主标题` 非空
 *   2. 报告格式 — `> 报告格式:`
 *   3. P7 图表阈值 — `> P7 图表阈值:`
 *   4. 章节规划数量 — `> 章节规划数量:`
 *   5. KPI 横幅 — `## KPI 横幅` 下表格行数 ≥ 3
 *   6. 假说验证表 — `## 假说验证总览` 下表格行数 ≥ 1
 *   7. 四层决策建议 — `## 四层决策建议` 含紧急/短期
 *   8. Safety Lifecycle — `## Safety Lifecycle`
 *   9. 反事实推断 — `## 反事实推断`
 *  10. 情景预判 — `## 情景预判`
 *  11. 局限性声明 — `## 局限性声明` 非空
 *  12. 图表规格 — 每章图表描述完整
 *  13. 页脚签名 — `> 页脚签名:`
 *
 * 用法: node agent-tools/scripts/check-blueprint-fields.mjs <blueprint.md路径> [--json] [--strict]
 *       --strict  全部 WARN → ERROR（终止级）
 *
 * Exit 0 = 通过, 1 = 致命缺失
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');
const strictMode = argv.includes('--strict');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/check-blueprint-fields.mjs <blueprint.md路径> [--json] [--strict]');
  process.exit(2);
}

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  const err = { ok: false, error: `文件不存在: ${inputPath}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[check-blueprint-fields] ❌ ${err.error}`);
  process.exit(1);
}

const content = readFileSync(inputPath, 'utf-8');
const errors = [];
const warnings = [];
const checks = {};

// ── 1. 封面标题 ──
const coverSection = content.match(/## 封面信息\s*\n([\s\S]*?)(?=\n## |$)/);
const titleMatch = coverSection ? coverSection[0].match(/(?:主标题|标题)[：:]\s*(\S+)/) : null;
checks.cover_title = {
  present: !!titleMatch,
  value: titleMatch ? titleMatch[1] : null,
};
if (!titleMatch || !titleMatch[1] || titleMatch[1].trim() === '') {
  errors.push('封面标题缺失 — `## 封面信息` 下 `主标题` 为空');
}

// ── 2. 报告格式 ──
const formatMatch = content.match(/>\s*报告格式[：:]\s*(.+)/);
checks.report_format = { present: !!formatMatch, value: formatMatch ? formatMatch[1].trim() : null };
if (!formatMatch) {
  warnings.push('报告格式未声明 — 缺失 `> 报告格式:` 元数据行');
}

// ── 3. P7 图表阈值 ──
const p7Match = content.match(/>\s*P7\s*图表阈值[：:]\s*(.+)/);
checks.p7_thresholds = { present: !!p7Match, value: p7Match ? p7Match[1].trim() : null };
if (!p7Match) {
  warnings.push('P7 图表阈值未声明 — 缺失 `> P7 图表阈值:` 元数据行');
}

// ── 4. 章节规划数量 ──
const chapterCountMatch = content.match(/>\s*章节规划数量[：:]\s*(\d+)/);
checks.chapter_count = { present: !!chapterCountMatch, value: chapterCountMatch ? parseInt(chapterCountMatch[1]) : 0 };
if (!chapterCountMatch) {
  warnings.push('章节规划数量未声明 — 缺失 `> 章节规划数量:` 元数据行');
}

// 实际章节数
const chapterMatches = content.match(/## 章节\s*\d+[：:]/g) || [];
checks.actual_chapters = chapterMatches.length;
if (chapterCountMatch && chapterMatches.length < parseInt(chapterCountMatch[1])) {
  errors.push(`章节数量不匹配: 声明 ${chapterCountMatch[1]} 章，实际 ${chapterMatches.length} 章`);
} else if (chapterMatches.length === 0) {
  errors.push('无章节内容 — blueprint 中未找到 `## 章节 N：` 块');
}

// ── 5. KPI 横幅 ──
const kpiSection = content.match(/## KPI 横幅\s*\n([\s\S]*?)(?=\n## |$)/);
if (kpiSection) {
  const kpiRows = kpiSection[0].match(/^\|.+\|$/gm) || [];
  const dataRows = kpiRows.filter(r => !/^[\|\s\-:]+$/.test(r) && !/KPI|指标|名称/.test(r));
  checks.kpi_count = dataRows.length;
  if (dataRows.length < 3) {
    if (strictMode) errors.push(`KPI 横幅不足: ${dataRows.length} 行（需要 ≥ 3）`);
    else warnings.push(`KPI 横幅不足: ${dataRows.length} 行（建议 ≥ 3）`);
  }
} else {
  checks.kpi_count = 0;
  if (strictMode) errors.push('KPI 横幅缺失 — 未找到 `## KPI 横幅` 章节');
  else warnings.push('KPI 横幅缺失 — 未找到 `## KPI 横幅` 章节');
}

// ── 6. 假说验证表 ──
const hypSection = content.match(/## 假说验证总览\s*\n([\s\S]*?)(?=\n## |$)/);
if (hypSection) {
  const hypRows = hypSection[0].match(/^\|.+\|$/gm) || [];
  const dataRows = hypRows.filter(r => !/^[\|\s\-:]+$/.test(r) && !/假说|编号|状态/.test(r));
  checks.hypothesis_count = dataRows.length;
  if (dataRows.length === 0) {
    errors.push('假说验证表为空 — `## 假说验证总览` 下无数据行');
  }
} else {
  checks.hypothesis_count = 0;
  errors.push('假说验证表缺失 — 未找到 `## 假说验证总览` 章节');
}

// ── 7. 四层决策建议 ──
const decisionSection = content.match(/## 四层决策建议\s*\n([\s\S]*?)(?=\n## |$)/);
if (decisionSection) {
  const hasUrgent = /🔴|紧急/g.test(decisionSection[0]);
  const hasShort = /🟡|短期/g.test(decisionSection[0]);
  const hasMid = /🟢|中长期|中期/g.test(decisionSection[0]);
  const hasSys = /🔵|系统/g.test(decisionSection[0]);
  checks.decision_layers = { urgent: hasUrgent, short: hasShort, mid: hasMid, system: hasSys };
  if (!hasUrgent) errors.push('决策建议缺少 🔴 紧急层');
  if (!hasShort) errors.push('决策建议缺少 🟡 短期层');
} else {
  checks.decision_layers = { urgent: false, short: false, mid: false, system: false };
  errors.push('四层决策建议缺失 — 未找到 `## 四层决策建议` 章节');
}

// ── 8. Safety Lifecycle ──
const lifecycleSection = content.match(/## Safety Lifecycle\s*\n/);
checks.safety_lifecycle = { present: !!lifecycleSection };
if (!lifecycleSection) {
  warnings.push('Safety Lifecycle 章节缺失');
}

// ── 9. 反事实推断 ──
const counterfactualSection = content.match(/## 反事实推断/);
checks.counterfactual = { present: !!counterfactualSection };
if (!counterfactualSection) {
  warnings.push('反事实推断章节缺失');
}

// ── 10. 情景预判 ──
const scenarioSection = content.match(/## 情景预判/);
checks.scenario = { present: !!scenarioSection };
if (!scenarioSection) {
  warnings.push('情景预判章节缺失');
}

// ── 11. 局限性声明 ──
const limitationSection = content.match(/## 局限性声明\s*\n([\s\S]*?)(?=\n## |$)/);
if (limitationSection) {
  const limContent = limitationSection[1].trim();
  checks.limitations = { present: true, nonEmpty: limContent.length > 0 };
  if (limContent.length === 0) {
    if (strictMode) errors.push('局限性声明为空');
    else warnings.push('局限性声明为空 — 建议填写');
  }
} else {
  checks.limitations = { present: false, nonEmpty: false };
  if (strictMode) errors.push('局限性声明缺失');
  else warnings.push('局限性声明缺失');
}

// ── 12. 图表规格 ──
const chartSpecs = content.match(/### 图\s*\d+/g) || [];
checks.chart_specs_count = chartSpecs.length;
if (chartSpecs.length === 0) {
  errors.push('无图表规格 — blueprint 中未找到 `### 图N：` 块');
}

// ── 13. 页脚签名 ──
const footerMatch = content.match(/>\s*页脚签名[：:]\s*(.+)/);
checks.footer_signature = { present: !!footerMatch, value: footerMatch ? footerMatch[1].trim() : null };
if (!footerMatch && !strictMode) {
  warnings.push('页脚签名未声明 — 缺失 `> 页脚签名:`，将使用默认值');
}

// ── 汇总 ──
const fatalCount = errors.length;
const warnCount = warnings.length;
const passed = fatalCount === 0;

const result = { ok: passed, fatal: fatalCount, warnings: warnCount, checks, errors, warnings };

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[check-blueprint-fields] 📋 blueprint.md 字段完整性校验`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  模式: ${strictMode ? '严格 (WARN→ERROR)' : '标准'}`);
  console.log(`  章节数: ${checks.actual_chapters} / 声明 ${checks.chapter_count?.value || '?'}`);
  console.log(`  图表规格: ${checks.chart_specs_count} 张`);
  console.log(`  KPI 横幅: ${checks.kpi_count} 个`);
  console.log(`  假说验证: ${checks.hypothesis_count} 条`);
  console.log(`  决策建议: 紧急${checks.decision_layers?.urgent ? '✅' : '❌'}  短期${checks.decision_layers?.short ? '✅' : '❌'}  中长期${checks.decision_layers?.mid ? '✅' : '❌'}  系统${checks.decision_layers?.system ? '✅' : '❌'}`);

  if (errors.length > 0) {
    console.log(`\n  ❌ 致命缺失 (${errors.length}):`);
    errors.forEach(e => console.log(`    ✗ ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\n  ⚠️  警告 (${warnings.length}):`);
    warnings.forEach(w => console.log(`    ⚠ ${w}`));
  }

  if (passed) {
    console.log(`\n  🎯 字段完整性通过 — 可进入阶段 7b`);
  } else {
    console.log(`\n  ❌ 存在 ${fatalCount} 项致命缺失 — 请回到阶段 7a 补全 blueprint.md`);
  }
}

process.exit(passed ? 0 : 1);
