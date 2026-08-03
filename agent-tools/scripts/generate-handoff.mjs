#!/usr/bin/env node
/**
 * generate-handoff.mjs — 阶段交接摘要生成器（P0 · 轻量化改造）
 *
 * 用途：在阶段 N 结束时，从「完整状态文件 analysis-state-s{N}.md」提取关键章节，
 *       生成 2-3K token 的交接摘要 s{N}-handoff.md，供阶段 N+1 读取。
 *       完整状态文件保留在磁盘，仅作脚本审计与回溯存档，不再全量进入 LLM 上下文。
 *
 * 设计原则（确定性优先，零 LLM 开销）：
 *   - 只做「章节白名单 + 行数截断」，不做 LLM 复述 → 摘要质量与原文一致，无丢字段风险。
 *   - 按 Markdown 标题切块，按章节关键词定位，保证摘要内容按章节干净组织、不串块。
 *   - 生成 handoff 头（task_id / data_hash / 来源文件），便于下游勾稽校验继续工作。
 *
 * 用法:
 *   node agent-tools/scripts/generate-handoff.mjs <完整状态文件路径> <输出handoff路径> [--stage=N] [--max-lines=30] [--json]
 *
 * 示例:
 *   node agent-tools/scripts/generate-handoff.mjs workdir/analysis-state-s4.md workdir/handoffs/s4-handoff.md --stage=4
 *
 * Exit code: 0 = 成功；1 = 源文件缺失/无有效章节；2 = 参数错误
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const positional = argv.filter(a => !a.startsWith('--'));
const jsonOutput = argv.includes('--json');

const flag = name => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};

const stage = flag('stage') || null;
const maxLines = parseInt(flag('max-lines') || '30', 10);

const [srcArg, outArg] = positional;

function fail(code, msg) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(code);
}

if (!srcArg || !outArg) {
  fail(2, '缺少参数。用法: node agent-tools/scripts/generate-handoff.mjs <完整状态文件> <输出handoff路径> [--stage=N] [--max-lines=30]');
}

const srcPath = resolve(SKILL_ROOT, srcArg);
const outPath = resolve(SKILL_ROOT, outArg);

if (!existsSync(srcPath)) fail(1, `源状态文件不存在: ${srcPath}`);

const content = readFileSync(srcPath, 'utf-8');

// ── 章节切块（与 state-query.mjs 保持同一逻辑）─────────
function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { level: m[1].length, title: m[2].trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else {
      if (!out[0] || out[0].level !== 0) out.unshift({ level: 0, title: '(文件头)', body: [] });
      out[0].body.push(line);
    }
  }
  if (cur) out.push(cur);
  return out;
}

const allSections = splitSections(content);

// ── 白名单：章节关键词 → 摘要节名 ─────────────────────
// 每个条目用「标题关键词」匹配一个顶层章节及其全部子章节
const HANDBOOK = [
  { key: 'meta', label: '元信息', keywords: ['(文件头)'] },
  // 分析参数（P6/P7/P8 等前置参数）——s1 文件中标题为「分析参数」；task_id/data_hash 由文件头 metaLines 提取，无需在此匹配
  { key: 'params', label: '分析参数（P6/P7/P8 前置参数）', keywords: ['分析参数'] },
  { key: 'data_foundation', label: '数据基座（D 层）', keywords: ['数据基座'] },
  { key: 'dim_scan', label: '多维度扫描（S 信号）', keywords: ['多维度扫描', '维度扫描'] },
  // 关键词与 D/V/S 协议实际标题对齐（`### 归因: S-xxx` / `### 建议框架` / `### 叙事主线` 等）
  { key: 'deep_attribution', label: '深度归因（假说验证）', keywords: ['深度归因', '根因分析', '归因:'] },
  { key: 'safety_lifecycle', label: 'Safety Lifecycle', keywords: ['Safety Lifecycle', '安全生命周期', 'Lifecycle 评估'] },
  { key: 'scenarios', label: '情景预判', keywords: ['情景预判', '关键不确定变量', '反事实推断', '情景空间', '最可能路径'] },
  { key: 'decisions', label: '决策建议', keywords: ['决策建议', '四层决策建议', '建议框架'] },
  { key: 'narrative', label: '叙事规划', keywords: ['叙事规划', '叙事编织', '叙事主线', '章节决策', '图表需求清单', '图表数据块', '语言素材库'] },
];

// 从 allSections 中提取「标题包含任一关键词」的顶层章节及其更深层子章节
// 注意：各阶段输出模板已为归因/情景/决策/叙事等章节提供 `##` 顶层包装标题
// （如 `## 深度归因`），因此遇到「同层或更浅」标题即停止，可完整收集包装下的
// 全部平级子块（如多个 `### 归因: S-xxx`）；若 LLM 未按模板写包装标题，
// 放宽后的 HANDBOOK 关键词（如 `归因:`）仍能兜底命中首个块，不会 capturedChapters==0。
function extractChapter(sections, keywords) {
  const matched = sections.filter(x => keywords.some(k => x.title.includes(k)));
  if (matched.length === 0) return null;
  const firstIdx = sections.indexOf(matched[0]);
  const baseLevel = matched[0].level;
  const collect = [sections[firstIdx]];
  for (let i = firstIdx + 1; i < sections.length; i++) {
    const x = sections[i];
    if (x.level <= baseLevel) break;
    collect.push(x);
  }
  return collect;
}

// 收集正文行（跳过文件头中的 task_id 等，避免与元信息重复，但保留数据基座内的元字段）
const sectionsOut = [];
let capturedChapters = 0;
let truncatedAny = false;
let totalChars = 0;

for (const item of HANDBOOK) {
  const chapter = extractChapter(allSections, item.keywords);
  if (!chapter) continue;
  // 顶层章节标题由小节标题（label）呈现，避免重复；正文只输出子章节标题 + 有效正文行
  const [top, ...subs] = chapter;
  const lines = [];
  for (const sec of [top, ...subs]) {
    const body = sec.body.filter(l => l.trim() !== '');
    if (sec === top) {
      lines.push(...body);
    } else {
      lines.push(`${'#'.repeat(Math.min(sec.level, 4))} ${sec.title}`, ...body);
    }
  }
  const raw = lines.join('\n').trim();
  let value = raw.trim();
  let isTrunc = false;
  const bodyLines = value.split('\n');
  if (bodyLines.length > maxLines) {
    value = bodyLines.slice(0, maxLines).join('\n') + `\n… [已截断至 ${maxLines} 行，完整内容见存档文件]`;
    isTrunc = true;
    truncatedAny = true;
  }
  sectionsOut.push({ key: item.key, label: item.label, body: value });
  capturedChapters++;
  totalChars += value.length;
}

if (capturedChapters === 0) {
  fail(1, `源文件中未匹配到任何白名单章节: ${srcPath}`);
}

// ── 元信息提取（task_id / data_hash / work_dir / session_id）─
const metaLines = content.split(/\r?\n/).filter(l => /^\s*(task_id|data_hash|work_dir|session_id)\s*[：:]/.test(l)).slice(0, 5);
// 若文件头章节未捕获元信息，从 meta 章节体补齐
const metaChapter = sectionsOut.find(s => s.key === 'meta');
if (metaChapter) {
  const metaBodyLines = metaChapter.body.split('\n').filter(l => !l.startsWith('#'));
  metaChapter.body = metaLines.length >= metaBodyLines.length ? metaChapter.body : null;
}

// ── 生成 Markdown 摘要 ─────────────────────────────────
const stageTag = stage ? `s${stage}` : basename(srcPath, '.md');

const header = [
  `# ${stageTag}-handoff — 阶段交接摘要`,
  ``,
  `> 本文件由 \`generate-handoff.mjs\` 自动生成，供阶段 ${stage ? `s${stage}` : ''} 之后的下游阶段读取。`,
  `> 完整状态文件: \`${srcPath}\`（脚本审计/回溯存档专用，LLM 无需整文件读取）。`,
  ``,
  `## 交接头`,
  ``,
  metaLines.length ? metaLines.join('\n') : `（源文件未含 task_id/data_hash 元信息行）`,
  ``,
].join('\n');

const bodyParts = sectionsOut
  .filter(s => s.body !== null)
  .map(s => `## ${s.label}\n\n${s.body}`);

const footer = [
  ``,
  `---`,
  `> 摘要捕获章节: ${sectionsOut.map(s => s.key).join(' / ')}（共 ${sectionsOut.length} 组）`,
  truncatedAny
    ? `> ⚠️ 部分章节已截断（每章节上限 ${maxLines} 行），如需完整内容请用 \`state-query.mjs --sections=...\` 定向提取。`
    : `> 全部章节完整，未截断。`,
  `> 生成时间: ${new Date().toISOString()}`,
].join('\n');

const markdown = header + '\n\n' + bodyParts.join('\n\n') + '\n' + footer + '\n';

// ── 写盘 ──────────────────────────────────────────────
try {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, 'utf-8');
} catch (e) {
  fail(1, `写入失败: ${e.message}`);
}

const approxTokens = Math.round(markdown.length / 1.5);

const result = {
  ok: true,
  src: srcPath,
  out: outPath,
  stage: stage || null,
  sections: sectionsOut.map(s => s.key),
  section_count: sectionsOut.length,
  truncated: truncatedAny,
  chars: markdown.length,
  approx_tokens: approxTokens,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[generate-handoff] ✅ ${stageTag}-handoff 已生成: ${outPath}`);
  console.log(`  摘要章节: ${sectionsOut.map(s => s.key).join(', ')}`);
  console.log(`  体积: ${markdown.length} 字符 ≈ ${approxTokens} token${truncatedAny ? '（部分截断）' : ''}`);
}
process.exit(0);
