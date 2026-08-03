#!/usr/bin/env node
/**
 * state-query.mjs — 状态文件切片查询器（P0 · 轻量化改造）
 *
 * 用途：从完整 analysis-state-s{N}.md / analysis-state.md 中「按需切片提取」字段或章节，
 *       以 JSON 输出到 stdout。替代「整文件 read_file」的全量回读，是消灭上下文溢出的核心手段。
 *
 * 设计原则：LLM 只把需要的字段拉进上下文；完整状态文件仍保留在磁盘，供
 *           audit-state-structure / verify / trace 等脚本全量审计。
 *
 * 用法:
 *   node agent-tools/scripts/state-query.mjs <状态文件路径> --fields=D_DATASET,S_SIGNALS [--json] [--max-lines=40]
 *   node agent-tools/scripts/state-query.mjs <状态文件路径> --sections=数据基座,决策建议 [--json] [--max-lines=40]
 *   node agent-tools/scripts/state-query.mjs <状态文件路径> --fields=CAUSAL_CHAIN --section-ctx=## 深度归因 [--json]
 *
 * 参数:
 *   --fields=A,B,C      按字段名提取（匹配 "KEY:" / "KEY：" / "KEY=" 的字段块，大小写不敏感）
 *   --sections=甲,乙    按 Markdown 章节标题提取（匹配 "## 甲" / "### 甲"）
 *   --section-ctx=T     限定字段只在指定章节内查找（如 --section-ctx=## 数据基座）
 *   --max-lines=N       每个字段/章节最多输出 N 行（默认 40，超长截断并标注）
 *   --json              强制 JSON 输出（默认 stdout 即 JSON，便于脚本消费）
 *   --all               输出全部顶层章节索引（不输出正文，先看有哪些章节）
 *
 * Exit code:
 *   0  → 查询成功，所有请求的字段/章节均找到
 *   1  → 部分/全部未找到（输出缺失清单，LLM 应据此判断是否 HALT）
 *   2  → 参数错误 / 文件不可读
 *
 * 输出（JSON）:
 *   {
 *     "ok": true, "file": "<绝对路径>",
 *     "found": {"D_DATASET": "…内容…", "S_SIGNALS": "…内容…"},
 *     "missing": ["…未找到的字段…"],
 *     "sizes": {"D_DATASET": 1234, "S_SIGNALS": 567},
 *     "truncated": ["D_DATASET"],
 *     "total_chars": 1801
 *   }
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);

// ── 参数解析 ──────────────────────────────────────────
const positional = argv.filter(a => !a.startsWith('--'));
const inputPath = positional[0];
const jsonOutput = argv.includes('--json') || !argv.some(a => a.startsWith('--sections=') || a.startsWith('--fields=') || a.includes('--all')) || true;
const allMode = argv.includes('--all');

const flag = name => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};

const fieldsArg = flag('fields');
const sectionsArg = flag('sections');
const sectionCtxArg = flag('section-ctx');
const maxLines = parseInt(flag('max-lines') || '40', 10);

const fields = fieldsArg ? fieldsArg.split(',').map(s => s.trim()).filter(Boolean) : [];
const sections = sectionsArg ? sectionsArg.split(',').map(s => s.trim()).filter(Boolean) : [];

function fail(code, msg, extra = {}) {
  console.log(JSON.stringify({ ok: false, error: msg, ...extra }, null, 2));
  process.exit(code);
}

if (!inputPath) {
  fail(2, '缺少参数。用法: node agent-tools/scripts/state-query.mjs <状态文件路径> --fields=A,B,C | --sections=甲,乙 [--max-lines=N]');
}
if (fields.length === 0 && sections.length === 0 && !allMode) {
  fail(2, '必须提供 --fields= 或 --sections= 或 --all 之一');
}

const absPath = resolve(SKILL_ROOT, inputPath);
if (!existsSync(absPath)) fail(2, `文件不存在: ${absPath}`);

let content;
try {
  content = readFileSync(absPath, 'utf-8');
} catch (e) {
  fail(2, `无法读取文件: ${e.message}`);
}

// ── 章节切块：按 Markdown 标题（#/##/###）拆 ──────────
// 返回 [{level, title, body}]
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
      // 标题前的引言/注释块：归入 level 0
      if (!out[0] || out[0].level !== 0) out.unshift({ level: 0, title: '(文件头)', body: [] });
      out[0].body.push(line);
    }
  }
  if (cur) out.push(cur);
  return out;
}

const allSections = splitSections(content);

// ── 字段提取：在给定文本范围内找 "KEY:" 字段块 ────────
// 字段块起点：行内出现 KEY[：:=]，可带 **、-、数字前缀；终点：下一个字段KEY或任意标题
function extractField(text, key, maxLines) {
  const keyRe = new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*${escapeRegExp(key)}\\s*(?:\\*\\*)?\\s*[：:＝=]`, 'i');
  const lines = text.split(/\r?\n/);
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (keyRe.test('\n' + lines[i])) { startIdx = i; break; }
  }
  if (startIdx === -1) return null;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // 遇到新的字段KEY（含 KEY: 模式）或标题即结束
    if (/^\s*(?:#{1,6}\s+)/.test(line)) { endIdx = i; break; }
    if (/^\s*(?:\*\*|-\s*|\d+[.、]\s*)?[A-Z][A-Z0-9_]{1,24}\s*(?:\*\*)?\s*[：:＝=]/.test(line)) { endIdx = i; break; }
  }

  let body = lines.slice(startIdx, endIdx).join('\n').trim();
  let truncated = false;
  const bodyLines = body.split('\n');
  if (bodyLines.length > maxLines) {
    body = bodyLines.slice(0, maxLines).join('\n') + `\n… [已截断至 ${maxLines} 行，完整内容见 ${absPath}]`;
    truncated = true;
  }
  return { value: body, truncated };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── --all 模式：只输出章节索引 ────────────────────────
if (allMode) {
  const index = allSections.map(s => ({
    level: s.level,
    title: s.title,
    lines: s.body.length,
    chars: s.body.join('\n').length,
  }));
  console.log(JSON.stringify({ ok: true, file: absPath, sections: index, total_chars: content.length }, null, 2));
  process.exit(0);
}

// ── 正常查询 ──────────────────────────────────────────
const found = {};
const missing = [];
const sizes = {};
const truncated = [];

// 限定章节上下文（--section-ctx）时，先切出该章节文本
let searchScope = content;
if (sectionCtxArg) {
  const target = sectionCtxArg.replace(/^#{1,6}\s*/, '').trim();
  const idx = allSections.find(s => s.title.includes(target) || target.includes(s.title));
  if (idx) searchScope = idx.body.join('\n');
}

for (const f of fields) {
  const hit = extractField(searchScope, f, maxLines);
  if (hit) {
    found[f] = hit.value;
    sizes[f] = hit.value.length;
    if (hit.truncated) truncated.push(f);
  } else {
    missing.push(f);
  }
}

for (const s of sections) {
  const matched = allSections.filter(x => x.title.includes(s) || s.includes(x.title));
  if (matched.length === 0) {
    missing.push(s);
    continue;
  }
  // 从首个匹配章节起，连续收集其所有更深层子章节，直到遇到同层/更浅层章节
  const firstIdx = allSections.indexOf(matched[0]);
  const baseLevel = matched[0].level;
  const collect = [allSections[firstIdx]];
  for (let i = firstIdx + 1; i < allSections.length; i++) {
    const x = allSections[i];
    if (x.level <= baseLevel) break;
    collect.push(x);
  }
  const joined = collect.map(h => `${'#'.repeat(Math.min(h.level, 4))} ${h.title}\n${h.body.join('\n')}`).join('\n');
  let value = joined.trim();
  let isTrunc = false;
  const bodyLines = value.split('\n');
  if (bodyLines.length > maxLines) {
    value = bodyLines.slice(0, maxLines).join('\n') + `\n… [已截断至 ${maxLines} 行]`;
    isTrunc = true;
  }
  found[s] = value;
  sizes[s] = value.length;
  if (isTrunc) truncated.push(s);
}

const totalChars = Object.values(sizes).reduce((a, b) => a + b, 0);
const ok = missing.length === 0;

console.log(JSON.stringify({
  ok,
  file: absPath,
  found,
  missing,
  sizes,
  truncated,
  total_chars: totalChars,
  note: ok ? 'OK' : '存在缺失字段，请结合 audit-state-structure 判定是否 HALT',
}, null, 2));

process.exit(ok ? 0 : 1);
