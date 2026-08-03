# Agent Tools — deep-analysis-toolkit-v3 工具包

## 概述

本目录包含 `deep-analysis-toolkit-v3` SKILL 运行所需的全部工具定义和脚本，设计为**自包含的工具包**，可直接被任何兼容的 Agent 平台加载使用。

## TODO 编排接入

本 SKILL 支持 **TODO 编排模式**：第三方 CODE 软件通过 `pipeline-todo.json`（SKILL 根目录）实现全程外部控制。
- `pipeline-todo.json`：78 个原子 TODO 的静态定义，含依赖、参数、质量门禁
- `pipeline-state.json`：运行时状态文件，写入 `{work_dir}/`，记录每个 TODO 的进度
- `pipeline-state-schema.json`：状态文件的 JSON Schema 约束
- 本目录下的脚本（`scripts/*.mjs`）在 TODO 编排模式下通过 `action_type: script` 被调用
- 关键标志 `--todo-mode` 在 `validate-session.mjs` 中启用 TODO 编排环境校验

## 目录结构

```
agent-tools/
├── README.md                          # 本文件
├── registry.json                      # 工具总注册表（Agent 加载入口）
├── tool-schema.json                   # 工具定义 JSON Schema 约束
├── platform/                          # 平台内置工具接口规范（8个）
│   ├── read_file.tool.json
│   ├── ask_followup_question.tool.json
│   ├── search_file.tool.json
│   ├── search_content.tool.json
│   ├── list_dir.tool.json
│   ├── preview_url.tool.json
│   ├── RAG_search.tool.json
│   └── use_skill.tool.json
└── scripts/                           # Node.js 脚本工具（28 个 .mjs + 27 个 .tool.json + 1 个 .py）
    ├── *.mjs                          # 脚本实现（28 个）
    ├── *.tool.json                    # 脚本工具接口定义（27 个）
    └── merge-analysis-state.py        # 阶段 5(+3b) 后确定性合并脚本（无 tool.json）
```

## 快速接入

### 步骤 1：加载注册表

```javascript
const registry = JSON.parse(fs.readFileSync('agent-tools/registry.json', 'utf-8'));
```

### 步骤 2：按需加载工具定义

```javascript
// 加载所有平台工具定义
for (const [name, info] of Object.entries(registry.tools.platform)) {
    const def = JSON.parse(fs.readFileSync(info.definition, 'utf-8'));
    registerTool(name, def);
}

// 加载所有脚本工具定义
for (const [name, info] of Object.entries(registry.tools.scripts)) {
    const def = JSON.parse(fs.readFileSync(info.definition, 'utf-8'));
    registerTool(name, def);
}
```

### 步骤 3：按阶段加载所需工具

```javascript
// 获取 stage-7b 需要的所有工具
const stageTools = registry.stages['stage-7b'].required;
```

## 工具清单

### 平台内置工具（8个）

| 工具名 | 类别 | 描述 |
|--------|------|------|
| `read_file` | io | 读取文件内容 |
| `ask_followup_question` | interaction | 向用户发起结构化问答 |
| `search_file` | io | 按 glob 模式搜索文件 |
| `search_content` | io | 正则全文搜索 |
| `list_dir` | io | 列出目录内容 |
| `preview_url` | interaction | IDE 内置浏览器预览 |
| `RAG_search` | knowledge | 知识库检索 |
| `use_skill` | meta | 加载 SKILL 扩展 |

### 脚本工具（28个）

| 工具名 | 类别 | 阶段 | 描述 |
|--------|------|------|------|
| `validate-session` ⚠ | validation | all | 会话目录结构校验 |
| `audit-state-structure` ⚠ | validation | all | analysis-state.md 章节完整性审计 |
| `hash-data` | validation | stage-1 | 数据文件 SHA-256 哈希计算 |
| `reconcile-report` | validation | stage-1 | 总和-子项勾稽校验 |
| `verify-data-hash` ⚠ | validation | stage-1 | 数据完整性哈希校验 |
| `classify-data-shape` | processing | stage-2 | 数据形态分类 |
| `trace-d-numbers` | validation | stage-6,7a | d-N 指标来源追踪 |
| `verify-chart-data-blocks` | validation | stage-7a | 图表数据块完整性校验 |
| `check-blueprint-fields` | validation | stage-7a | blueprint 字段完整性校验 |
| `validate-chart-checklist` | quality-gate | stage-6 | 图表覆盖度 checklist 校验 |
| `assemble-report` | assembly | stage-7b | 报告骨架组装 |
| `verify-report` ⚠ | quality-gate | stage-7b | 报告图表数量门禁 |
| `center-chart` | post-processing | stage-7b | 图表容器居中 |
| `ensure-contain-label` | post-processing | stage-7b | 数据标签防溢出 |
| `fix-a4-chart-height` | post-processing | stage-7b | A4 图表高度修复 |
| `fix-overflow` | post-processing | stage-7b | 内容溢出修复 |
| `flatten-a4` | post-processing | stage-7b | A4 扁平化布局 |
| `lift-grid-top` | post-processing | stage-7b | ECharts grid 上移 |
| `safeguard-echarts-grid` | post-processing | stage-7b | ECharts grid 守护 |
| `taller-chart` | post-processing | stage-7b | 图表高度增加 |
| `validate-chart-dom` | quality-gate | stage-7b | 图表 DOM 结构校验 |
| `generate-handoff` ⚠ | processing | stage-1..7b | 阶段交接摘要生成（s{N}-handoff.md） |
| `state-query` | processing | stage-2..7b | 状态文件定向切片查询（--fields/--sections） |
| `check-convergence` ⚠ | quality-gate | stage-2..6 | 收敛门禁检查（convergence-rules.md） |
| `validate-o-v-s-chain` | validation | stage-3,4 | O→V→S 三层穿透链校验 |
| `validate-blueprint-for-7b` ⚠ | quality-gate | stage-6,7a | 蓝图门禁（7 项规则） |
| `match-chart-templates` | processing | stage-6 | 图表模板智能匹配（35 个模板库） |

> ⚠ = 强制门禁工具，exit ≠ 0 则 HALT

## 自定义 Agent 平台适配指南

### 接口规范

每个 `.tool.json` 文件遵循 `tool-schema.json` 定义的统一接口：

```json
{
  "name": "工具唯一标识",
  "type": "platform | script",
  "category": "工具分类",
  "description": "中文描述",
  "parameters": { "参数名": { "type": "类型", "required": true/false, "description": "说明" } },
  "returns": { "type": "返回值类型", "description": "返回值说明" },
  "invocation": "仅 type=script: node 调用命令",
  "exitCodes": { "0": "成功说明", "1": "失败说明" },
  "mandatory": true/false,
  "stageUsage": ["stage-N", "..."]
}
```

### 适配清单

1. **platform 工具**：将参数定义映射到目标平台的原生工具上下文
2. **script 工具**：确保目标环境支持 `node` 运行时调用
3. **强制门禁**：`mandatory=true` 的工具在失败时必须停止流水线
4. **阶段模式**：按 `registry.json → stages` 加载对应阶段工具子集，减少不必要开销

### 版本兼容性

- Node.js ≥ 18.x（ESM 模块）
- 所有脚本均为纯 Node.js ESM，无外部依赖
- UTF-8 编码

---

Generated by deep-analysis-toolkit-v3.5 agent-tools bundler.
