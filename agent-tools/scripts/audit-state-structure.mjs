#!/usr/bin/env node
/**
 * audit-state-structure.mjs — analysis-state.md 章节完整性审计
 *
 * 用途：验证 analysis-state.md 包含所有应有章节，
 *       防止 LLM 在某阶段忘记写入就进入下一阶段，导致后续全部是空中楼阁。
 *
 * 检查 7 个必需章节（对应阶段 1-6 产出）：
 *   1. 数据基座 — `## 数据基座`（含 D 编号体系）
 *   2. 多维度扫描 — `## 多维度扫描`（含 S- 信号）
 *   3. 深度归因 — `## 深度归因`（含假说验证）
 *   4. Safety Lifecycle — `## Safety Lifecycle`
 *   5. 情景预判 — `## 情景预判`
 *   6. 决策建议 — `## 决策建议` 或 `## 四层决策建议`
 *   7. 叙事规划 — `## 叙事规划`（含图表需求清单）
 *
 * 用法: node agent-tools/scripts/audit-state-structure.mjs <analysis-state.md路径> [--json] [--stage=N]
 *       --stage=N  仅审计到阶段 N（如 --stage=3 只检查 1-3）
 *       --todo-mode  检查 pipeline-state.json 的 current_todo 一致性（使用--todo-mode时可不传 analysis-state.md路径）
 *
 * Exit 0 = 全部存在, 1 = 有缺失
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');
const TODO_MODE = argv.includes('--todo-mode');

// ── TODO 编排模式：检查 pipeline-state.json ──
if (TODO_MODE) {
  const anchorPath = resolve(SKILL_ROOT, '.analysis-session');
  if (!existsSync(anchorPath)) {
    const msg = '锚点文件 .analysis-session 不存在（阶段 0 尚未完成）';
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  const anchorContent = readFileSync(anchorPath, 'utf-8').trim();
  const workDirMatch = anchorContent.match(/^work_dir=(.+)$/m);
  if (!workDirMatch) {
    const msg = '锚点文件格式错误，期望 "work_dir={绝对路径}"';
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  const workDir = workDirMatch[1].trim();
  const statePath = resolve(workDir, 'pipeline-state.json');
  if (!existsSync(statePath)) {
    const msg = `pipeline-state.json 不存在: ${statePath}`;
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch (e) {
    const msg = `pipeline-state.json 解析失败: ${e.message}`;
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  // 检查 current_todo 合法性
  if (!state.current_todo) {
    const msg = 'pipeline-state.json 缺少 current_todo 字段';
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  // 检查 current_todo 在 todos 数组中存在
  const todoEntry = state.todos.find(t => t.id === state.current_todo);
  if (!todoEntry) {
    const msg = `current_todo "${state.current_todo}" 不在 todos 数组中`;
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ❌ ${msg}`);
    process.exit(1);
  }
  // 检查 pipeline_status 合法性
  const validStatuses = ['running', 'complete', 'failed', 'blocked'];
  if (!validStatuses.includes(state.pipeline_status)) {
    const msg = `pipeline_status 不合法: "${state.pipeline_status}"（期望 ${validStatuses.join('/')}）`;
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(`[audit-state-structure] ⚠️ ${msg}`);
    // 非致命：可能是初始状态
  }
  const summary = {
    ok: true,
    mode: 'todo',
    session_id: state.session_id,
    work_dir: state.work_dir,
    current_todo: state.current_todo,
    todo_status: todoEntry.status,
    pipeline_status: state.pipeline_status,
    total_todos: state.todos.length,
    done_count: state.todos.filter(t => t.status === 'done').length,
    user_pause_count: state.user_pause_queue.length,
    error_count: state.errors.length,
  };
  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`[audit-state-structure] 🚀 TODO 编排模式审计`);
    console.log(`  会话: ${summary.session_id}`);
    console.log(`  工作目录: ${summary.work_dir}`);
    console.log(`  当前 TODO: ${summary.current_todo} [${summary.todo_status}]`);
    console.log(`  管道状态: ${summary.pipeline_status}`);
    console.log(`  进度: ${summary.done_count}/${summary.total_todos} 完成`);
    console.log(`  暂停队列: ${summary.user_pause_count} 个暂停点`);
    console.log(`  错误: ${summary.error_count} 个`);
    console.log(`\n  🎯 pipeline-state.json 状态正常`);
  }
  process.exit(0);
}

// ── 默认模式：analysis-state.md 章节审计 ──
const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/audit-state-structure.mjs <analysis-state.md路径> [--json] [--stage=N]');
  process.exit(2);
}

const stageFlag = argv.find(a => a.startsWith('--stage='));
const maxStage = stageFlag ? parseInt(stageFlag.split('=')[1], 10) : 7;

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (jsonOutput) console.log(JSON.stringify({ ok: false, error: `文件不存在: ${inputPath}` }));
  else console.error(`[audit-state-structure] ❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

const content = readFileSync(inputPath, 'utf-8');

// ── 定义必需章节 ──
const REQUIRED_SECTIONS = [
  {
    stage: 1,
    name: '数据基座',
    patterns: [/## 数据基座/],
    subChecks: [
      { name: 'D 编号体系', patterns: [/### D 编号体系|D-FOUNDATION|D_DATASET/] },
      { name: '勾稽结果', patterns: [/### 勾稽结果|R1.*PASS|R1.*WARN|R1.*FAIL/] },
      { name: '质量评级', patterns: [/### 质量评级|评级[：:]\s*[ABCD]/] },
      { name: 'data_hash', patterns: [/data_hash\s*[：:]/] },
    ],
  },
  {
    stage: 2,
    name: '多维度扫描',
    patterns: [/## 多维度扫描|## 维度扫描/],
    subChecks: [
      { name: 'S 级信号', patterns: [/S-\d+/] },
      { name: '信号优先级矩阵', patterns: [/优先级|极高|优先矩阵/] },
    ],
  },
  {
    stage: 3,
    name: '深度归因',
    patterns: [/## 深度归因|## 根因分析/],
    subChecks: [
      { name: '假说穷举', patterns: [/假说|假说表|hypothesis/] },
      { name: '三级检验', patterns: [/✅.*支持|🟡.*部分支持|❌.*不支持|⚠️.*存疑/] },
      { name: '归因链', patterns: [/← 近因|归因链|因果/] },
    ],
  },
  {
    stage: '3b',
    name: 'Safety Lifecycle',
    patterns: [/## Safety Lifecycle|## 安全生命周期/],
    subChecks: [
      { name: '安全阶段判定', patterns: [/安全阶段|lifecycle.?stage|阶段[：:]/] },
      { name: '五维评分', patterns: [/stage.?metrics|评分矩阵|五维/] },
    ],
  },
  {
    stage: 4,
    name: '情景预判',
    patterns: [/## 情景预判/],
    subChecks: [
      { name: '情景矩阵', patterns: [/情景\s*\d|Scenario/] },
      { name: '反事实推断', patterns: [/反事实|Counterfactual|counterfactual/] },
    ],
  },
  {
    stage: 5,
    name: '决策建议',
    patterns: [/## 决策建议|## 四层决策建议/],
    subChecks: [
      { name: '紧急措施', patterns: [/🔴.*紧急|紧急层/] },
      { name: '短期建议', patterns: [/🟡.*短期|短期层/] },
    ],
  },
  {
    stage: 6,
    name: '叙事规划',
    patterns: [/## 叙事规划|## 叙事编织/],
    subChecks: [
      { name: '叙事主线', patterns: [/### 叙事主线|叙事主线[：:]/] },
      { name: '章节决策', patterns: [/### 章节决策|章节决策/] },
      { name: '图表需求清单', patterns: [/### 图表需求清单|图表需求清单/] },
      { name: '图表数据块', patterns: [/### 图表数据块|#### 图\d+[：:]/] },
    ],
  },
];

const results = [];
const missingSections = [];
const incompleteSections = [];

for (const section of REQUIRED_SECTIONS) {
  // stage 可以是数字（如 1, 2, 4）或字符串（如 '3b'），统一转数值用于比较
  // '3b' → parseFloat → 3，确保 Safety Lifecycle 不会被跳过
  const stageNum = typeof section.stage === 'number' ? section.stage : parseFloat(section.stage);
  if (stageNum > maxStage) continue;

  const found = section.patterns.some(p => p.test(content));
  let subIssues = [];

  if (found) {
    // 检查子项
    for (const sub of section.subChecks) {
      const subFound = sub.patterns.some(p => p.test(content));
      if (!subFound) {
        subIssues.push(sub.name);
      }
    }

    results.push({
      stage: section.stage,
      name: section.name,
      present: true,
      complete: subIssues.length === 0,
      missingSubItems: subIssues,
    });

    if (subIssues.length > 0) {
      incompleteSections.push({ stage: section.stage, name: section.name, missing: subIssues });
    }
  } else {
    results.push({
      stage: section.stage,
      name: section.name,
      present: false,
      complete: false,
      missingSubItems: [],
    });
    missingSections.push({ stage: section.stage, name: section.name });
  }
}

// ── 额外检查：task_id 和 work_dir ──
const taskIdMatch = content.match(/task_id\s*[：:]\s*"?(\S+?)"?$/m);
const workDirMatch = content.match(/work_dir\s*[：:]\s*(\S+)/);
const dataHashMatch = content.match(/data_hash\s*[：:]\s*(\S+)/);

const metaChecks = {
  task_id: !!taskIdMatch,
  task_id_value: taskIdMatch ? taskIdMatch[1] : null,
  work_dir: !!workDirMatch,
  data_hash: !!dataHashMatch,
};

const allPresent = missingSections.length === 0;
const allComplete = allPresent && incompleteSections.length === 0;

const result = {
  ok: allPresent,
  complete: allComplete,
  file: inputPath,
  maxStage,
  meta: metaChecks,
  sections: results,
  missing: missingSections,
  incomplete: incompleteSections,
  summary: {
    total: results.length,
    present: results.filter(r => r.present).length,
    missing: missingSections.length,
    incomplete: incompleteSections.length,
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[audit-state-structure] 🏗️  analysis-state.md 章节完整性审计`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  审计到阶段: ${maxStage}`);
  console.log(`  元数据: task_id=${metaChecks.task_id_value || '❌缺失'}  data_hash=${dataHashMatch ? '✅' : '❌'}  work_dir=${workDirMatch ? '✅' : '❌'}`);
  
  console.log(`\n  章节状态:`);
  for (const r of results) {
    const status = r.present ? (r.complete ? '✅' : '⚠️') : '❌';
    const subStr = r.missingSubItems.length > 0 ? ` (缺: ${r.missingSubItems.join(', ')})` : '';
    console.log(`    ${status} 阶段${r.stage}: ${r.name}${subStr}`);
  }

  console.log(`\n  汇总: ${result.summary.present}/${result.summary.total} 存在, ${result.summary.missing} 缺失, ${result.summary.incomplete} 不完整`);

  if (missingSections.length > 0) {
    console.log(`\n  ❌ 缺失章节:`);
    for (const m of missingSections) {
      console.log(`    ✗ 阶段${m.stage}: ${m.name} — 请回溯对应阶段重新写入`);
    }
  }

  if (incompleteSections.length > 0) {
    console.log(`\n  ⚠️  不完整章节:`);
    for (const m of incompleteSections) {
      console.log(`    ⚠ 阶段${m.stage}: ${m.name} — 缺少: ${m.missing.join(', ')}`);
    }
  }

  if (allComplete) {
    console.log(`\n  🎯 全部章节完整 — analysis-state.md 状态正常`);
  } else if (allPresent) {
    console.log(`\n  ⚠️  所有章节存在但有 ${incompleteSections.length} 个不完整 — 可继续但结果可能有限`);
  } else {
    console.log(`\n  ❌ ${missingSections.length} 个章节缺失 — 在补齐前无法继续`);
  }
}

process.exit(allPresent ? 0 : 1);
