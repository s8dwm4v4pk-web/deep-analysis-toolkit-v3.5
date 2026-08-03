#!/usr/bin/env node
/**
 * validate-session.mjs — 阶段级接地检查 (v3.4.0 阶段感知隔离)
 *
 * 用途：在每个阶段开始前，验证锚点文件和前序阶段文件完整性。
 *       防止因上下文丢失导致 Agent 在错误目录跨阶段越权。
 *
 * 调用方式：
 *   node agent-tools/scripts/validate-session.mjs --stage=N
 *   node agent-tools/scripts/validate-session.mjs --todo-mode    # TODO 编排模式新增
 *
 * 检查项（默认模式）：
 *  1. .analysis-session 锚点文件存在
 *  2. work_dir 目录存在
 *  3. 前序阶段文件 analysis-state-s{N-1}.md 存在（N>1 时）
 *  4. analysis-state-s{N}.md 中的 work_dir 字段与锚点一致
 *  5. task_id 格式合法
 *
 * 检查项（--todo-mode）：
 *  1. pipeline-state.json 在 work_dir 中存在
 *  2. pipeline-state.json JSON Schema 合规
 *  3. current_todo 字段存在且值合法
 *  4. todos 数组与 pipeline-todo.json 定义一致
 *
 * exit 0 = 通过, exit 1 = 失败
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SKILL workspace root = agent-tools/ 的上级目录（项目根）
const SKILL_ROOT = resolve(__dirname, '../..');

const ANCHOR_FILE = resolve(SKILL_ROOT, '.analysis-session');

// ── 参数解析 ──
const TODO_MODE = process.argv.includes('--todo-mode');

function parseStage() {
  const stageIdx = process.argv.indexOf('--stage');
  if (stageIdx === -1 || stageIdx + 1 >= process.argv.length) {
    return null;
  }
  const val = parseInt(process.argv[stageIdx + 1], 10);
  if (isNaN(val) || val < 1) {
    console.error(`[validate-session] ❌ --stage 参数无效: ${process.argv[stageIdx + 1]}`);
    process.exit(1);
  }
  return val;
}

const CURRENT_STAGE = TODO_MODE ? null : parseStage();

function fail(msg) {
  console.error(`[validate-session] ❌ ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[validate-session] ⚠️  ${msg}`);
}

function ok(msg) {
  console.log(`[validate-session] ✅ ${msg}`);
}

// ── 阶段感知文件名 ──
function stageFilename(n) {
  return `analysis-state-s${n}.md`;
}

// ── 检查 1：锚点文件是否存在 ──
if (!existsSync(ANCHOR_FILE)) {
  fail(`锚点文件缺失: ${ANCHOR_FILE}\n`
    + `  原因：阶段 1 未完成或未正确写入 .analysis-session。\n`
    + `  解决：回到阶段 1 重新执行数据基座构建。`);
}
ok(`锚点文件存在: ${ANCHOR_FILE}`);

// ── 检查 2：读取并解析 work_dir ──
let anchorContent;
try {
  anchorContent = readFileSync(ANCHOR_FILE, 'utf-8').trim();
} catch (e) {
  fail(`无法读取锚点文件: ${e.message}`);
}

const workDirMatch = anchorContent.match(/^work_dir=(.+)$/m);
if (!workDirMatch) {
  fail(`锚点文件格式错误，期望 "work_dir={绝对路径}"，实际内容:\n${anchorContent}`);
}
const workDir = workDirMatch[1].trim();

// 必须是绝对路径
if (!workDir || (!workDir.startsWith('/') && !/^[A-Za-z]:[/\\]/.test(workDir))) {
  warn(`work_dir 可能不是绝对路径: "${workDir}"，尝试解析...`);
}

ok(`work_dir = ${workDir}`);

// ── 检查 3：work_dir 目录是否存在 ──
if (!existsSync(workDir)) {
  fail(`工作目录不存在: ${workDir}\n`
    + `  可能原因：目录被手动删除、移动，或锚点文件记录的是过期路径。\n`
    + `  解决：删除 .analysis-session，重新从阶段 1 开始。`);
}
try {
  const st = statSync(workDir);
  if (!st.isDirectory()) {
    fail(`${workDir} 存在但不是目录`);
  }
} catch (e) {
  fail(`无法访问工作目录: ${e.message}`);
}
ok(`工作目录存在: ${workDir}`);

// ── TODO 编排模式检查 ──
if (TODO_MODE) {
  // 检查 4：pipeline-state.json 存在
  const statePath = resolve(workDir, 'pipeline-state.json');
  if (!existsSync(statePath)) {
    fail(`pipeline-state.json 不存在: ${statePath}\n`
      + `  可能原因：阶段 0（前置问答）未完成。\n`
      + `  解决：重新从阶段 0 开始，确保前置问答完成后创建 pipeline-state.json。`);
  }
  ok(`pipeline-state.json 存在: ${statePath}`);

  // 检查 5：解析 pipeline-state.json
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch (e) {
    fail(`pipeline-state.json 解析失败: ${e.message}\n`
      + `  JSON 格式错误，请检查文件是否被手动编辑损坏。`);
  }

  // 检查 6：必需字段存在
  const requiredFields = ['session_id', 'work_dir', 'params', 'current_todo', 'pipeline_status', 'todos'];
  for (const field of requiredFields) {
    if (state[field] === undefined || state[field] === null) {
      fail(`pipeline-state.json 缺少必需字段: "${field}"`);
    }
  }
  ok(`必需字段完整 (${requiredFields.join(', ')})`);

  // 检查 7：current_todo 在 todos 数组中
  const todoIds = state.todos.map(t => t.id);
  if (!todoIds.includes(state.current_todo)) {
    fail(`current_todo "${state.current_todo}" 不在 todos 定义中\n`
      + `  可用 TODO IDs: ${todoIds.join(', ') || '(无)'}`);
  }
  ok(`current_todo "${state.current_todo}" 在 todos 定义中`);

  // 检查 8：todos 中各条目状态合法
  const validStatuses = ['pending', 'in_progress', 'done', 'blocked', 'failed'];
  for (const t of state.todos) {
    if (!t.id || !t.status) {
      fail(`todos 条目缺少 id 或 status: ${JSON.stringify(t)}`);
    }
    if (!validStatuses.includes(t.status)) {
      fail(`todos["${t.id}"].status 不合法: "${t.status}"（期望 ${validStatuses.join('/')}）`);
    }
  }
  ok(`全部 ${state.todos.length} 个 TODO 状态合法`);

  // 检查 9：pipeline_status 合法
  const validPipelineStatuses = ['running', 'complete', 'failed', 'blocked'];
  if (!validPipelineStatuses.includes(state.pipeline_status)) {
    fail(`pipeline_status 不合法: "${state.pipeline_status}"（期望 ${validPipelineStatuses.join('/')}）`);
  }
  ok(`pipeline_status = ${state.pipeline_status}`);

  // 检查 10：work_dir 一致性
  if (state.work_dir !== workDir) {
    fail(`work_dir 不一致！锚点文件: ${workDir}  vs  pipeline-state.json: ${state.work_dir}\n`
      + `  这表示会话与文件系统指向不同目录。\n`
      + `  解决：检查 pipeline-state.json 或 .analysis-session 是否被手动修改。`);
  }
  ok(`work_dir 与锚点一致`);

  console.log(`[validate-session] 🎯 TODO 编排模式接地检查全部通过 — 当前 TODO: ${state.current_todo} [${state.todos.find(t => t.id === state.current_todo).status}]`);
  console.log(`[validate-session] 📊 进度: ${state.todos.filter(t => t.status === 'done').length}/${state.todos.length} 完成`);
  process.exit(0);
}

// ── 默认模式：前序阶段文件是否存在（阶段隔离核心检查）──
if (CURRENT_STAGE !== null && CURRENT_STAGE > 1) {
  const prevStage = CURRENT_STAGE - 1;
  const prevFile = resolve(workDir, stageFilename(prevStage));
  if (!existsSync(prevFile)) {
    fail(`前序阶段文件缺失: ${prevFile}\n`
      + `  阶段 ${CURRENT_STAGE} 要求阶段 ${prevStage} 产出 ${stageFilename(prevStage)} 存在。\n`
      + `  可能原因：阶段 ${prevStage} 未完成或写入失败。\n`
      + `  解决：返回阶段 ${prevStage} 重新执行。`);
  }
  ok(`前序阶段文件存在: ${stageFilename(prevStage)}`);
} else if (CURRENT_STAGE === 1) {
  // 阶段 1 无前序文件，但需确认该文件尚未存在（防止重复初始化）
  const s1File = resolve(workDir, stageFilename(1));
  if (existsSync(s1File)) {
    warn(`阶段 1 文件已存在: ${stageFilename(1)}（将覆盖，请确认是否需要重新初始化）`);
  }
}

// ── 检查 5：当前阶段状态文件中的 work_dir 与锚点一致性 ──
// 确定要检查的状态文件：当前阶段若已存在，检查它；否则检查 s1
const targetStage = (CURRENT_STAGE !== null && CURRENT_STAGE > 1) ? 1 : (CURRENT_STAGE || 1);
const stateFile = resolve(workDir, stageFilename(targetStage));

if (!existsSync(stateFile)) {
  // 如果目标阶段文件也不存在（例如阶段 1 但 s1 也不存在），降级为宽松检查
  if (targetStage === 1) {
    warn(`${stageFilename(1)} 不存在，跳过 work_dir 一致性检查（阶段 1 可能尚未完成写入）`);
    // 不 fatal：阶段 1 正在执行中，文件可能尚未最终写入
  } else {
    fail(`状态文件缺失: ${stateFile}\n`
      + `  期望找到 ${stageFilename(targetStage)} 但文件不存在。\n`
      + `  解决：重新运行目标阶段以生成状态文件。`);
  }
} else {
  let stateContent;
  try {
    stateContent = readFileSync(stateFile, 'utf-8');
  } catch (e) {
    fail(`无法读取 ${stageFilename(targetStage)}: ${e.message}`);
  }

  const stateWorkDirMatch = stateContent.match(/^work_dir:\s*(.+)$/m);
  if (!stateWorkDirMatch) {
    fail(`${stageFilename(targetStage)} 中缺少 work_dir 字段。文件可能未完成阶段初始化。`);
  }
  const stateWorkDir = stateWorkDirMatch[1].trim();

  if (stateWorkDir !== workDir) {
    fail(`路径不一致！\n`
      + `  锚点文件 work_dir: ${workDir}\n`
      + `  ${stageFilename(targetStage)} work_dir: ${stateWorkDir}\n`
      + `  这表示存在多个状态文件或锚点文件被篡改。\n`
      + `  解决：删除 .analysis-session 和所有 analysis-state-s*.md，重新从阶段 1 开始。`);
  }
  ok(`work_dir 锚点与 ${stageFilename(targetStage)} 一致`);
}

// ── 检查 6：task_id 格式校验 ──
if (existsSync(stateFile)) {
  const stateContent = readFileSync(stateFile, 'utf-8');
  const taskIdMatch = stateContent.match(/^task_id:\s*"?(.+?)"?$/m);
  if (!taskIdMatch) {
    warn(`${stageFilename(targetStage)} 中未找到 task_id 字段（非致命）`);
  } else {
    const taskId = taskIdMatch[1].trim();
    const taskIdPattern = /^[A-Za-z0-9\u4e00-\u9fff]{2,12}_\d{8}_\d{4}$/;
    if (!taskIdPattern.test(taskId)) {
      fail(`task_id 格式不合法: "${taskId}"\n`
        + `  期望格式: 2-12位字母/数字/汉字_8位日期_4位时间（如 煤矿安全事故_20260723_1430）\n`
        + `  这表示分析状态文件可能来自不同的分析任务（数据串染）。`);
    }
    ok(`task_id 格式合法: ${taskId}`);
  }
}

// ── 阶段隔离报告 ──
const stageLabel = CURRENT_STAGE !== null ? `阶段 ${CURRENT_STAGE}` : '阶段入口';
console.log(`[validate-session] 🎯 接地检查全部通过 — 安全进入 ${stageLabel}`);
process.exit(0);
