---
name: deep-analysis-toolkit-v3.5
description: >
  深度分析工具箱 V3.5 — 四层递进认知架构（数据基座→维度扫描→认知循环深度归因→高级可视化报告），映射至 9 个分析阶段全自动执行（含 Stage 0 前置问答则共 10 个阶段）。
  每次分析自动走满全流程，覆盖 D→V→S 三层可追溯编号体系、5 项勾稽校验、7 维度 Scout 并行扫描、
  交叉验证、假说穷举+三级证据检验（支持/部分支持/不支持）、Safety Lifecycle Theory 安全演化评估、
  反事实推断、情景预判、信号优先级矩阵（极高/高/中）、四层决策建议。
  V3 核心特性：数据基座协议、通用图表选型决策树、ECharts 模板、双主题 CSS 预设、并行多Agent编排引擎、7a/7b 叙事与HTML拆分。
  V3.5 轻量化：阶段间以 handoff 摘要交接（generate-handoff.mjs）+ state-query 切片读取，功能板块与结果质量不变。
  NOT for: 简单描述统计、只做图表展示、快速数据探索。
---

# 深度分析工具箱 V3.5

> ⚡ **TODO 编排模式**：第三方 CODE 软件挂载此 SKILL 后，建议使用 `pipeline-todo.json` 作为流程控制面。
> 详见下方「TODO 编排接入」章节，获取主循环伪代码和执行协议。



> 版本：v3.5.0 | 架构：路由型 SKILL — 参数收集 + 引擎选择 + 分阶段调度
> V3.5 轻量化：阶段交接走 `s{N}-handoff.md` 摘要（脚本自动生成），状态全量文件仅脚本审计用。
> 核心原则：尽最大努力，不留余力。确保广度、深度、前瞻性。

---

## 四阶段认知循环 → 执行阶段映射

本 SKILL 的认知架构是四层递进，每层内阶段不可跳跃、层间不可跨层：

```
 L1 事实层              L2 解释层                 L3 预判层               L4 决断层
"发生了什么"          "为什么会这样"           "接下来会怎样"           "应该怎么做"
┌──────────┐         ┌──────────┐            ┌──────────┐            ┌──────────┐
│ 阶段 1   │         │ 阶段 3   │            │ 阶段 4   │            │ 阶段 5   │
│ 数据基座 │──→阶段2─→│ 深度归因 │──→阶段3b──→│ 情景预判 │──→阶段6──→│ 决策建议 │──→阶段7a
│ D编号体系│ 维度扫描 │ 假说验证 │ Safety    │ 反事实推断│ 叙事规划  │ 四层建议 │  叙事组装
└──────────┘ O→V→S   │ 归因链   │ Lifecycle  │ 情景空间  │           └──────────┘    │
           三层穿透   └──────────┘            └──────────┘                          │
                                                                                   ↓
                                                                              ┌──────────┐
                                                                              │ 阶段 7b  │
                                                                              │ HTML生成 │
                                                                              │ report.html│
                                                                              └──────────┘
```

| 认知层 | 阶段 | 阶段名称 | 核心产物 |
|--------|------|---------|---------|
| **L1 事实层** | 阶段 1 | 数据基座构建 | D 编号体系 + 5 项勾稽 + 质量评级 |
| **L1 事实层** | 阶段 2 | 维度扫描 | O→V→S 三层穿透信号 + 极高/高/中优先级矩阵 |
| **L2 解释层** | 阶段 3 | 深度归因 | 假说穷举+三级检验+近因→远因→结构因归因链 |
| **L2 解释层** | 阶段 3b | Safety Lifecycle | 安全演化阶段判定 + 阶段特征 + 脆弱性扫描 |
| **L3 预判层** | 阶段 4 | 情景预判 | 情景空间 + 反事实推断 + 最可能路径 |
| **L4 决断层** | 阶段 5 | 决策建议 | 四层可追溯建议（紧急/短期/中长期/制度） |
| **L4 决断层** | 阶段 6 | 叙事规划 | 动态章节决策 + 图表需求 + 语言素材 |
| **表达层** | 阶段 7a | 叙事组装 | blueprint.md（语义完备的叙事蓝图） |
| **表达层** | 阶段 7b | HTML 生成 | 自包含单文件 HTML 报告 |

---

## 一、前置问答（分两批，第一批 P0 + P6 + P7，第二批 P8 + 封面标题）

在进入分析之前，使用 `ask_followup_question` 分两批询问五个问题：

> **options 格式硬约束**：使用**纯字符串数组**，不得使用 `{label, description}` 对象格式。

### 问题 1：分析深度（P0）

| 问题 | options |
|------|------|
| 分析深度 | `["深度分析 — 7维度并行扫描 + 交叉验证 + 冲突矩阵 + 盲区聚合 + 置信度校准，全功能全流程 (★默认)", "轻量分析 — 串行认知扫描，跳过冲突矩阵/盲区聚合/置信度校准，适合快速探索"]` |

> **P0 决定阶段 2 引擎路由**：
> - 「深度分析」→ `stages/02-multi-dim-scan.md`（多Agent并行，全功能）
> - 「轻量分析」→ `stages/02-cognitive-scan.md`（认知循环串行扫描）

### 问题 2：报告格式（P6）

| 问题 | options |
|------|------|
| 报告格式 | `["纯网页版 — 连续滚动，暗色主题，金色主色调，适合屏幕阅读 (★默认)", "A4分页版 — 分页设计，A4 幅面，深蓝封面，浅色内页，适合打印和公文流转"]` |

### 问题 3：图表数量级别（P7）

| 问题 | options |
|------|------|
| 图表数量级别 | `["标准 — ≥12张总计 / ≥3张高级图表 / ≥1张多维图表 (★默认)", "精简 — ≥8张总计 / ≥2张高级图表 / ≥1张多维图表", "详尽 — ≥16张总计 / ≥5张高级图表 / ≥2张多维图表"]` |

> **P7 决定阶段 6/7 图表约束**：
> - 「标准」→ 总数≥12 / 高级≥3 / 多维≥1
> - 「精简」→ 总数≥8 / 高级≥2 / 多维≥1
> - 「详尽」→ 总数≥16 / 高级≥5 / 多维≥2
> - P7 阈值写入 `analysis-state-s1.md` 的「分析参数」章节，格式为分立三字段（`min-total` / `min-advanced` / `min-multi`），经 `s1-handoff.md` 交接给阶段 6/7，阶段 6 图表需求清单不得低于此阈值，阶段 7 按规范提取后传入 `verify-report.mjs` 强制执行。

第一批回答写入 `analysis-state-s1.md` 的「分析参数」章节。P7 采用分立 KV 格式（三个独立行），供阶段 7 逐字段正则提取。

---

### 第二批：页脚格式（P8）+ A4 封面标题

第一批答案写入完毕后，使用 `ask_followup_question` 询问第二批两个问题：

> **options 格式硬约束**：使用**纯字符串数组**，不得使用 `{label, description}` 对象格式。

#### 问题 4：页脚格式（P8）

| 问题 | options |
|------|------|
| 页脚格式 | `["本报告由 deep-analysis-toolkit-v3 生成 (★默认)", "用户自行输入", "不需要页脚"]` |

> **P8 决定阶段 7 页脚输出**：
> - 「默认」→ 固定格式"本报告由 deep-analysis-toolkit-v3 生成 · 数据版本 XXXXXXXX · 编制日期 XXXX-XX-XX"
> - 「用户自行输入」→ 使用用户输入的自定义页脚文本
> - 「不需要页脚」→ 不输出 `.footer` 元素

#### 问题 5：A4 封面标题（仅 A4 分页版有效）

| 问题 | options |
|------|------|
| A4 封面标题 | `["自动生成 — 从阶段6叙事主线提取 (★默认)", "用户自行输入"]` |

> **仅 P6="A4分页版" 时生效**，纯网页版忽略此参数。
> - 「自动」→ 阶段 7 从阶段 6 叙事主线提取核心短语作为标题（不超过 25 字）
> - 「用户自行输入」→ 直接使用用户输入的标题文本

第二批回答写入 `analysis-state-s1.md` 的「分析参数」章节：

```
P8: {默认|用户输入文本|无}
A4封面标题: {自动|用户输入文本}
```

---

**收敛与算法参数（P1-P5）** 使用默认值，无需询问：

| 参数 | 默认值 | 含义 |
|------|--------|------|
| P0 | 深度分析 | 分析引擎深度（用户前置问答选择） |
| P1 | 67% | 归因收敛阈值 |
| P2 | <2 | 情景收敛门槛 |
| P3 | 3 | 建议层级完整性 |
| P4 | A×0.55+B×0.45 | 筛选权重 |
| P5 | ≥4 | 多维可视化最低维度 |
| P7 | 标准 | 图表数量级别（用户前置问答选择） |
| P8 | 默认 | 页脚格式（用户前置问答选择） |

> 高级用户可在触发时直接指定 P0-P5。

---

## 二、文件锚定协议（全流程强制执行）

### 路径契约（全流程唯一权威定义）

本 SKILL 中**所有"根目录"均指同一个目录**，以下名词视为同义：
- **SKILL_ROOT** = 包含 `agent-tools/`、`SKILL.md`、`stages/` 的目录

全流程产物落点：
```
SKILL_ROOT/                          ← 包含 agent-tools/ 和 SKILL.md 的目录
├── .analysis-session                ← 唯一外部锚点（阶段 1 创建）
├── agent-tools/scripts/
├── stages/
├── themes/
├── references/
└── workspace/                       ← 一切任务级临时构建均在此进行
    └── {task_name}_{YYYYMMDD}_{HHMM}/
        ├── {源数据文件}              ← 阶段 1 将源文件复制至此
        ├── analysis-state-s1.md…s6.md  ← 各阶段独立状态文件（脚本数据库）
        ├── analysis-state.md        ← merge+s6 追加后的全量存档（仅脚本审计）
        ├── blueprint.md             ← 阶段 7a 产物
        └── report.html              ← 阶段 7b 产物
```

**work_dir 定义**：`SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/`，即 `.analysis-session` 中 `work_dir=` 行的值。

**运行约束（强制）**：
1. 所有 `node agent-tools/scripts/xxx.mjs` 命令，**cwd 必须为 SKILL_ROOT**
2. 每个阶段第一步从 `.analysis-session` 读取 work_dir 真实绝对路径，严格替换本阶段所有 `{work_dir}` 占位符，**禁止凭记忆/拼接推断路径**
3. 若用户提供的源数据文件不在 SKILL_ROOT 内，**先将其复制到 `SKILL_ROOT/workspace/{task_name}_{...}/` 下**，再开始流程

---

### 2.1 锚点文件机制

为防止跨阶段路径丢失导致重复生成 `analysis-state.md`，引入**双重锚定**：

| 锚定物 | 位置 | 内容 | 创建者 |
|--------|------|------|--------|
| `.analysis-session` | **SKILL_ROOT** | 仅一行：`work_dir={绝对路径}` | 阶段 1 |
| `analysis-state-s1.md` 的 `work_dir` 字段 | 工作目录内 | `work_dir: {绝对路径}` | 阶段 1 |

> `.analysis-session` 是**外部锚点**——它不依赖状态文件就能定位工作目录。无论上下文如何重置，只要 SKILL_ROOT 不变，就能找到正确的 `analysis-state-s1.md`。

### 2.2 工作目录结构

```
SKILL_ROOT/
├── .analysis-session              ← 阶段 1 创建，全流程不变的锚点
├── workspace/
│   └── {task_name}_{YYYYMMDD}_{HHMM}/
│       ├── {源数据文件名}          ← 阶段 1 将源文件复制至此
│       ├── analysis-state-s1.md    ← 阶段 1 创建（各阶段独立状态文件）
│       ├── analysis-state.md       ← merge+s6 追加存档（仅脚本审计）
│       └── {最终报告}.html          ← 阶段 7 生成
```

### 2.3 全局文件写入规则（所有阶段强制执行）

```
┌──────────────────────────────────────────────────────────┐
│  ⛔ 绝对禁止：                                            │
│  • 用 search_file / search_content 搜索 analysis-state.md │
│  • 用相对路径或凭记忆写入 analysis-state.md               │
│  • 在任何非 work_dir 目录创建 analysis-state.md           │
│                                                          │
│  ✅ 强制流程（每个阶段的第一步）：                          │
│  1. read_file SKILL_ROOT/.analysis-session             │
│  2. 解析 work_dir 值                                     │
│  3. node agent-tools/scripts/validate-session.mjs（exit≠0→HALT）     │
│  4. read_file {work_dir}/s{N-1}-handoff.md（读前序交接摘要；│
│     禁止整读 analysis-state*.md，精确字段用 state-query 切片）│
│  5. node agent-tools/scripts/audit-state-structure.mjs {work_dir}/...(exit≠0→HALT)│
│  6. 追加写入时使用完整绝对路径 {work_dir}/analysis-state-s{N}.md│
└──────────────────────────────────────────────────────────┘
```

### 2.4 阶段级接地检查脚本

每个阶段执行写入操作前，可运行以下命令验证路径一致性：

```bash
node agent-tools/scripts/validate-session.mjs
```

脚本行为：
- 读取 `.analysis-session` → 提取 `work_dir`
- 检查 `work_dir` 目录是否存在
- 检查 `work_dir/analysis-state.md` 是否存在
- 校验 `analysis-state.md` 中的 `work_dir` 与锚点是否一致
- 校验 `task_id` 格式是否合法
- 失败时打印明确错误信息，终止流程

> 阶段 7 **必须**通过接地检查后才能组装报告。阶段 1 创建锚点后必须立即通过校验。

### 2.5 阶段 1 锚点创建规则

1. 阶段 1 创建 `SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/` 目录
2. 将用户指定的源数据文件**复制**到该目录下
3. 写入 `.analysis-session` 到 **SKILL_ROOT**：`work_dir={完整绝对路径}`
4. `analysis-state-s1.md` 在该目录下创建，`work_dir` 字段记录相同绝对路径
5. 运行 `node agent-tools/scripts/validate-session.mjs` 确认锚定成功

---

## 三、执行流水线

> ⛔ **阶段隔离铁律（最高优先级，覆盖所有阶段回调）**：
> 
> 1. **一次只执行一个阶段**。当前阶段完成后，必须 ⏸️ 报告完成 + 等待用户回复「继续」。
> 2. **禁止同时读取多个阶段的 .md 文件**。只读当前阶段文件。
> 3. **禁止跳过阶段**。必须按 1→2→3→3b→4→5→合并→6→7a→7b 顺序执行。
> 4. **写入失败 ≠ 跳阶段**。写入失败时 HALT，不得跳过继续。
> 5. ⛔ **7a→7b 蓝图确认阻断**：阶段 7a 完成后必须调用 `ask_followup_question`
>    呈现三个选项（确定，继续生成 HTML 报告 / 我修改了蓝图，使用修改后的版本 / 重新生成蓝图），
>    在收到用户选择之前：
>    - 禁止读取 `stages/07b-html-generate.md`
>    - 禁止执行任何 HTML 生成脚本
>    - 禁止构思 report-skeleton 结构
>    - 违者立即中断，回到 7a 暂停点
> 6. ⛔ **阶段文件隔离**：各阶段输出独立文件 `analysis-state-s{N}.md`，
>    禁止跨阶段直接写入同一 `analysis-state.md`。
>    阶段 5(+3b) 完成后由 `merge-analysis-state.py` 确定性合并 `analysis-state.md`；
>    阶段 6 写独立 `analysis-state-s6.md`，其内容同步追加至 `analysis-state.md`（仅存档，LLM 禁读）。
> 7. ⛔ **handoff 交接（v3.5 轻量化核心）**：阶段 N 结束后必须用
>    `node agent-tools/scripts/generate-handoff.mjs analysis-state-s{N}.md s{N}-handoff.md --stage={N}`
>    生成交接摘要。下游阶段**只读 `s{N}-handoff.md` 摘要**（以及 `state-query.mjs` 定向切片），
>    **禁止整文件读取 `analysis-state-s*.md` / `analysis-state.md`**（那是脚本审计用的数据库）。
>    完整文件如需精确字段，用 `state-query.mjs --fields=... / --sections=...` 按需切片。

### 阶段 1：数据基座 → `stages/01-data-foundation.md`

1. **创建输出目录**：`SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/`
2. 复制源数据文件到该目录
3. **写入锚点文件**：`SKILL_ROOT/.analysis-session`（内容：`work_dir={绝对路径}`）
4. 执行 `node agent-tools/scripts/validate-session.mjs` → exit≠0 则 HALT
5. 执行 `node agent-tools/scripts/hash-data.mjs <数据文件路径>`，写入 data_hash
6. D 编号体系 + 5 项勾稽校验（概念性检查）
7. 执行 `node agent-tools/scripts/reconcile-report.mjs` → 脚本化 R1-R5 全项勾稽
8. 数据形态自动归类（S1-S17）→ **注：classify-data-shape.mjs 为待研究脚本，本期不嵌入**
9. 质量评级（A/B/C/D）
10. 全部写入输出目录下的 `analysis-state-s1.md`
11. 执行 `node agent-tools/scripts/verify-data-hash.mjs` → 指纹一致性校验，exit≠0 则 HALT
12. 执行 `node agent-tools/scripts/generate-handoff.mjs analysis-state-s1.md s1-handoff.md --stage=1` → 生成交接摘要（供阶段 2 只读，不整读 s1 全量）

> 阶段 1 完成后，`.analysis-session` 是后续所有阶段定位 `analysis-state-s1.md` 的唯一依据。后续阶段通过 `_shared-anchor.md` 的阶段感知路由确定应读取哪个 s{N} 文件；阶段 N 一律**只读 `s{N-1}-handoff.md` 摘要**。

### 阶段 2：维度扫描 — P0 引擎路由（强制执行）

根据前置问答中用户选择的 P0 参数决定引擎，**禁止跳过**：

| P0 选择 | 路由 | 引擎 | 能力 |
|---------|------|------|------|
| 「深度分析」（默认） | `stages/02-multi-dim-scan.md` | 多Agent全功能并行扫描 | 7 Scout 并行 + 7×7 冲突矩阵 + 盲区聚合 + 置信度交叉校准 + D 编号覆盖率检查 |
| 「轻量分析」 | `stages/02-cognitive-scan.md` | 认知循环串行扫描 | 7 维度顺序扫描 + 基础交叉验证（3 项） |

**两条路径的共通要求**：
- 均产出 O→V→S 三层穿透编号信号
- 均产出极高/高/中优先级矩阵
- 均汇入阶段 3 深度归因（统一入口，自动检测来源路径）

### 阶段 3：深度归因 → `stages/03-root-cause-reasoning.md`

假说穷举（≥3 种）→ 三级证据检验（支持/部分支持/不支持）→ 近因→远因→结构因归因链 → 残余未解释标注

### 阶段 3b：Safety Lifecycle 评估 → `stages/03b-safety-lifecycle.md`

安全演化阶段判定 → 阶段特征识别 → 脆弱性扫描 → 阶段跃迁触发条件分析 → 收敛门禁（`check-convergence.mjs stage=3b`，检查阶段判定与归因链一致性）

### 阶段 4：情景预判 → `stages/04-scenario-predict.md`

1. 识别关键不确定变量：从归因链提取可继续变化的变量（≥2 个），标注当前状态 + 可能走向（≥2 条路径）+ 影响权重
2. 构建情景空间：关键变量组合 ≥2 个互斥情景，每个标注触发条件 + 置信度评估
3. **反事实推断**：识别关键决策节点（≥2 个）→ 构建反事实路径（每个 ≥1 条）→ 标注"真正杠杆点"与"虚假杠杆"
4. 评估最可能路径 + 标注偏离条件
5. O→V→S 穿透链校验（`validate-o-v-s-chain.mjs`）
6. D 编号追溯校验（`trace-d-numbers.mjs`）
7. 收敛门禁（`check-convergence.mjs stage=4`，检查情景覆盖度）
8. 写入 `analysis-state-s4.md`
9. ⏸️ **暂停** — 报告关键变量数 / 情景数 / 反事实推断数 / 置信度分布，等待用户回复「继续」

### 阶段 5：决策建议 → `stages/05-decision-advice.md`

1. 🔴 紧急措施：针对高优先级信号，窗口期 ≤ 1 个决策周期，含可逆性评估 + 可度量验证指标
2. 🟡 短期措施：窗口期 1-3 个决策周期，含中期先行指标
3. 🟢 中长期措施：针对归因链中的结构因，窗口期 3-12 个决策周期，含方向性建议 + 见效周期估计
4. 📋 制度性建议：跨周期的系统性调整，含预期阻力 + 成功标志
5. 每条建议可追溯至 D/V/S 编号（完整追溯链格式：`S-xxx ← V-xxx ← O-xxx ← [D-xxx]`）
6. D 编号追溯校验（`trace-d-numbers.mjs`）
7. 收敛门禁（`check-convergence.mjs stage=5`，检查决策层级完整性）
8. 写入 `analysis-state-s5.md`
9. ⏸️ **暂停** — 报告四层建议数量摘要，等待用户回复「继续」

### 阶段 5→6 合并：执行确定性合并脚本

```bash
python agent-tools/scripts/merge-analysis-state.py "{work_dir}"
```
> 将 `analysis-state-s1.md`、`analysis-state-s2.md`、`analysis-state-s3.md`、`analysis-state-s3b.md`、`analysis-state-s4.md`、`analysis-state-s5.md` 合并为统一 `analysis-state.md`（**仅脚本审计/回溯存档用**）。
> 阶段 6 及之后流程**只读 `s1-handoff.md`…`s5-handoff.md` 及 `s3b-handoff.md` 摘要**（总量 ~8-12K token），禁止整文件接触 s1-s5(+3b) 分文件；精确字段用 `state-query.mjs` 切片。
> exit ≠ 0 → HALT，报告缺失文件清单。
> ⏸️ 合并完成后暂停，等待用户回复「继续」方可进入阶段 6。

### 阶段 6：叙事规划 → `stages/06-narrative-weave.md`

1. 叙事主线：一句话核心发现（有张力、可追溯）
2. 叙事暗线：被掩盖但也重要的次要发现
3. 动态章节决策：发现导向命名 + 每章命名理由 + 核心问题 + 阅读后心智状态
4. 图表需求清单：结构化 8 列表格，不低于 P7 阈值
5. 图表模板匹配（`match-chart-templates.mjs`）+ 清单验收（`validate-chart-checklist.mjs`）
6. 图表数据块构造 + D 编号追溯校验（`trace-d-numbers.mjs`）
7. 蓝图门禁（`validate-blueprint-for-7b.mjs`）+ 收敛门禁（`check-convergence.mjs stage=6`）
8. 语言素材库提取
9. 写入 `analysis-state-s6.md`（s6 独立状态文件，并同步追加至 `analysis-state.md` 存档）
10. ⏸️ **暂停** — 报告叙事主线 + 章节数 + 图表需求清单行数，等待用户回复「继续」

### 阶段 7a：叙事组装 → `stages/07a-narrative-assembly.md`

将前 6 轮 + 3b 分析成果组装为语义完备的**叙事蓝图**（`blueprint.md`），纯 Markdown，零 HTML。

1. 上下文就绪检查（12 个字段逐一判定）— 基于 `s1-handoff.md`…`s6-handoff.md` + `s3b-handoff.md` 摘要；缺失字段用 `state-query.mjs` 定向切片核验
2. 核实叙事完整性与数据到位
3. 执行 `node agent-tools/scripts/trace-d-numbers.mjs` → D 编号一致性交叉校验
4. 图表引擎选型（ECharts/Chart.js/ApexCharts/D3/Three.js）→ 继承校验
5. 执行 `node agent-tools/scripts/verify-chart-data-blocks.mjs` → 图表需求清单与数据块双向匹配
6. 数据格式转换
7. 撰写全部章节正文 + 图表解读 + 假说验证表 + Safety Lifecycle + 四层建议 + 质量声明 + 局限性声明
8. 写入 `{work_dir}/blueprint.md`
9. 执行 `node agent-tools/scripts/check-blueprint-fields.mjs` → 蓝图字段完整性校验
10. ⏸️ **暂停** — 提示蓝图文件位置（用户可直接编辑），点击"确定"后进入 7b

### 阶段 7b：HTML 生成 → `stages/07b-html-generate.md`

从终审通过的 `blueprint.md` 生成自包含 HTML 报告。V3.4 起采用 **Link-then-Inline** 组装模式。

1. 读取 `blueprint.md`（可能已被用户手动修改）→ 蓝图结构校验（7 项规则）
2. 根据蓝图元数据选择主题：`<link href="themes/theme-dark.css">` 或 `<link href="themes/theme-a4.css">`（**禁止手写 CSS**）
3. 根据蓝图的**动态章节结构**构建报告 HTML（不使用固定模板）
4. **Vendor 引用**（不 `read_file`）：写 `<script src="references/vendor/echarts.min.js">` + 按需
5. 图表 IIFE 内联：从模板文件复制 + 替换蓝图数据
6. 组装：`node agent-tools/scripts/assemble-report.mjs <骨架.html> <报告.html>` → 纯内联单文件
7. 质量闸门：`node agent-tools/scripts/verify-report.mjs <报告.html> --min-total=<N> --min-advanced=<N> --min-multi=<N> --min-dim=<N>`
8. **后处理脚本管线**（强制顺序）：`validate-chart-dom.mjs` → `ensure-contain-label.mjs` → `safeguard-echarts-grid.mjs` → `center-chart.mjs` → `taller-chart.mjs` → `fix-overflow.mjs` → `fix-a4-chart-height.mjs`
   - **5A-0（validate-chart-dom.mjs）**：所有 chart-container DOM 存在性 + chart_id 完整性 + canvas/div 标签闭合校验
   - 自包含性检查：禁止任何外部引用（组装后零 src/href）
   - **主题 CSS 来源指纹验证**：必须匹配包内 themes/ 文件
   - **Vendor JS 来源指纹验证**：必须匹配包内 references/vendor/ 文件
   - 图表数量 / 类型 / 结构完整性检查

---

## 四、目标目录结构

```
deep-analysis-toolkit-v3/
├── SKILL.md                              # 本文件：纯路由
├── stages/                               # 分阶段执行 prompt
│   ├── 01-data-foundation.md
│   ├── 02-cognitive-scan.md              # 认知循环扫描（中小数据）
│   ├── 02-multi-dim-scan.md              # 多Agent并行扫描入口（大数据）
│   ├── 02-orchestrator.md                # 多Agent主控编排器
│   ├── 02-scout-template.md              # 7维度Scout通用提示词模板
│   ├── 02-cross-validation.md            # 结构化交叉验证
│   ├── 02-merge-gate.md                  # 多Agent→认知循环适配层
│   ├── 03-root-cause-reasoning.md
│   ├── 03b-safety-lifecycle.md           # Safety Lifecycle Theory 评估
│   ├── 04-scenario-predict.md
│   ├── 05-decision-advice.md
│   ├── 06-narrative-weave.md
│   ├── 07a-narrative-assembly.md         # 叙事组装 → blueprint.md
│   ├── 07b-html-generate.md              # HTML 生成 → report.html
│   └── _shared-anchor.md                 # 跨阶段共享锚定协议
├── themes/                               # CSS 主题预设
│   ├── theme-dark.css                    # 纯网页版：暗色 + 金色主色调
│   └── theme-a4.css                      # A4 分页版：深蓝封面 + 浅色内页
├── references/
│   ├── methodology/                      # 共享方法论（单份）
│   │   ├── 7-dimension-methodology.md
│   │   ├── analysis-state-protocol.md
│   │   ├── convergence-rules.md
│   │   ├── theme-classes.md
│   │   └── visualization-mapping.md
│   ├── templates/                         # 图表模板（按引擎分目录，35 个独立文件）
│   │   ├── echarts/  (20)
│   │   ├── apexcharts/  (3)
│   │   ├── d3/  (8)
│   │   ├── chartjs/  (1)
│   │   └── threejs/  (3)
│   └── vendor/                           # 图表库
│       ├── echarts.min.js
│       ├── apexcharts.min.js
│       ├── d3.v7.min.js
│       ├── chart.js.min.js
│       └── three.min.js
└── agent-tools/scripts/                              # 全流程自动化脚本（28 个 .mjs + 27 个 .tool.json + merge-analysis-state.py）
    ├── validate-session.mjs               # 锚点完整性校验（_shared-anchor 强制前置）
    ├── hash-data.mjs                      # 数据源 SHA-256 指纹计算（阶段 1，产出供 verify-data-hash 全流程校验）
    ├── reconcile-report.mjs               # R1-R5 全项勾稽脚本（阶段 1 + 阶段 6 最终勾稽）
    ├── verify-data-hash.mjs               # 数据指纹一致性校验（全阶段 1→7b，依赖 hash-data.mjs）
    ├── audit-state-structure.mjs          # analysis-state.md 结构审计（_shared-anchor 强制前置）
    ├── generate-handoff.mjs               # 阶段交接摘要生成（v3.5 核心，阶段 N 末尾产出 s{N}-handoff.md）
    ├── state-query.mjs                    # 状态文件切片查询（v3.5 核心，按字段/章节定向提取，替代整文件读取）
    ├── │
    ├── trace-d-numbers.mjs                # D 编号全流程追溯校验（阶段 2→7a 全链路，覆盖率≥90%）
    ├── validate-o-v-s-chain.mjs           # O→V→S 三层穿透链校验（阶段 3 + 阶段 4）
    ├── check-convergence.mjs              # 收敛门禁检查（阶段 2→6，对照 convergence-rules.md）
    ├── │
    ├── classify-data-shape.mjs            # 数据形态自动归类（阶段 6，供 match-chart-templates 消费）
    ├── match-chart-templates.mjs          # 图表模板智能匹配（阶段 6，S信号 → ECharts类型推荐）
    ├── validate-chart-checklist.mjs       # 图表清单叙事质量（阶段 6 + 阶段 7a）
    ├── validate-blueprint-for-7b.mjs      # 蓝图门禁（阶段 6 + 阶段 7a，7项规则校验）
    ├── │
    ├── verify-chart-data-blocks.mjs        # 图表需求清单-数据块双向匹配（阶段 7a）
    ├── check-blueprint-fields.mjs         # blueprint.md 字段完整性（阶段 7a）
    ├── │
    ├── assemble-report.mjs                # Link-then-Inline 组装（阶段 7b）
    ├── verify-report.mjs                  # 质量闸门（阶段 7b）
    ├── ensure-contain-label.mjs            # ECharts containLabel 强制注入（阶段 7b）
    ├── safeguard-echarts-grid.mjs         # ECharts grid 安全间距（阶段 7b）
    ├── center-chart.mjs                   # 图表居中（阶段 7b）
    ├── taller-chart.mjs                   # 图表高度自适应（阶段 7b）
    ├── fix-overflow.mjs                   # 溢出修复（阶段 7b）
    ├── fix-a4-chart-height.mjs            # A4 图表高度修正（阶段 7b）
    ├── validate-chart-dom.mjs             # 图表 DOM 容器完整性校验（阶段 7b，5A-0 后处理首步）
    ├── fix-chart-varname.mjs               # 图表变量名一致性自动修复（阶段 7b，5A-0.5）
    │
    ├── flatten-a4.mjs                      # A4 分页→连续流覆盖（阶段 7b，5A-6.5）
    └── lift-grid-top.mjs (manual)              # 图表 grid 顶部抬高（手动工具 — 仅 ECharts grid.top 偏移不足时手动调用，不纳入自动编排）
```

---

## 五、V3 核心增强

| 模块 | 内容 |
|------|------|
| 四阶段认知循环 | L1事实→L2解释→L3预判→L4决断 四层递进，不可跳跃 |
| 数据基座 | D 编号体系 + 5 项勾稽校验，报告数字可追溯 |
| 三层穿透 | O（观测）→ V（验证）→ S（筛选）三级编号，每条建议可追溯至具体信号和数据 |
| 假说验证 | 逐条假说 + 三级证据检验（支持/部分支持/不支持），归因不再是推断而是检验 |
| Safety Lifecycle | 安全演化阶段理论：判定系统所处阶段、阶段脆弱性、跃迁触发条件 |
| 反事实推断 | 系统性反事实推演："如果关键变量在过去取了不同值，结果会怎样变化" |
| 信号优先级矩阵 | 极高/高/中 三级，基于影响×置信度二维交叉评估 |
| 多Agent编排 | 自动路由 + 7 Scout 并行 + 交叉验证 + 汇入适配，大数据集强制启用 |
| 图表决策树 | `methodology/visualization-mapping.md` 17 种形态 × 38 种图表 |
| ECharts 模板 | `templates/` 35 个独立模板（echarts 20 + apexcharts 3 + d3 8 + chartjs 1 + threejs 3） |
| 动态章节 | 报告章节由阶段 6 动态决策，不使用固定模板 |
| 双主题 CSS | `themes/` 暗色 + A4 双套方案 |
| 文件指纹 | `agent-tools/scripts/hash-data.mjs` 确保全流程数据一致 |

---

## 六、认知戒律

1. **戒单一归因** — 必须穷举至少 3 种假说
2. **戒相关即因果** — 相关性不是因果性
3. **戒忽略基数** — 百分比必须配绝对数
4. **戒选择性报告** — 正面和负面发现同等呈现
5. **戒伪精确** — 不使用假数据/编造趋势
6. **戒模糊时态** — 不用"未来可能上升"的模糊判断

---

## 七、TODO 编排接入（第三方 CODE 软件外部调度协议）

> **核心原则**：TODO 编排不是可选优化，而是本 SKILL 被第三方 CODE 软件挂载时的唯一运行时骨架。
>
> 当 CODE 软件选择「TODO 编排模式」时，所有阶段转移和任务执行的决策权从 LLM 自驱转移至 TODO 调度器。
> 本 SKILL 的输出由 `pipeline-todo.json`（静态定义） + `pipeline-state.json`（运行时状态） 两个文件完全约束。

### 7.1 协议概述

| 文件 | 角色 | 位置 | 内容 |
|------|------|------|------|
| `pipeline-todo.json` | 静态任务定义 | `{SKILL_ROOT}/pipeline-todo.json` | 78 个原子 TODO，分属 10 个阶段；每个 TODO 包含 `action_type`、`dependencies`、`quality_gate`、`conditional_on` 等字段 |
| `pipeline-state.json` | 运行时状态 | `{work_dir}/pipeline-state.json` | 当前会话的 TODO 执行进度、`current_todo` 指针、`errors[]`、`user_pause_queue` |
| `pipeline-state-schema.json` | 状态文件 Schema | `{SKILL_ROOT}/pipeline-state-schema.json` | JSON Schema 定义 `pipeline-state.json` 的合法结构，CODE 软件可在每次写入后做 `validate` |
| `stages/*.md` | 阶段 prompt（降级使用） | `{SKILL_ROOT}/stages/` | TODO 编排模式下仅做参考上下文，不作为执行流程 |

### 7.2 TODO 调度器主循环（伪代码）

以下伪代码描述第三方 CODE 软件应如何实现 TODO 调度器：

```python
# TODOScheduler — 供第三方 CODE 软件嵌入
# 使用 pipeline-todo.json + pipeline-state.json 驱动全流程

def todo_scheduler_main(state_path, todo_path):
    # 1. 加载状态
    state = load_json(state_path)         # pipeline-state.json
    todos_def = load_json(todo_path)      # pipeline-todo.json
    
    # 2. 从状态中获取当前 TODO 指针
    current_id = state["current_todo"]    # e.g. "s0-1"
    if current_id is None:
        current_id = "s0-1"               # 初始从 s0-1 开始
    
    # 3. 迭代执行直到 pipeline_complete
    while state["pipeline_status"] != "complete":
        todo = lookup_todo(todos_def, current_id)
        
        # 3a. 检查 conditional_on（P0 分支路由）
        if "conditional_on" in todo:
            param_value = state["params"][todo["conditional_on"]["param"]]
            if param_value != todo["conditional_on"]["value"]:
                current_id = todo["conditional_on"]["skip_to"]
                update_state(state, current_id)
                continue
        
        # 3b. 检查所有 dependencies 已完成
        deps = todo.get("dependencies", [])
        if not all_done(state["todos"], deps):
            block_id = first_unmet_dep(state["todos"], deps)
            # 阻塞回退：标记当前 TODO 为 blocked，跳转到缺失的依赖 TODO
            current_id = block_id
            mark_blocked(state["todos"], todo["id"])
            update_state(state, current_id)
            continue
        
        # 3c. 权限校验：检查 tools_required
        if not check_tool_permissions(todo.get("tools_required", [])):
            halt_pipeline(state, f"缺少工具权限: {todo['tools_required']}")
            break
        
        # 3d. 执行 action
        result = execute_action(todo["action_type"], todo["params"])
        
        # 3e. 质量门（quality_gate）
        gate = todo.get("quality_gate", {})
        if gate:
            quality_pass = verify_quality(result, gate)
            if not quality_pass:
                handle_failure(todo, state)
                if todo.get("on_fail") == "halt":
                    break
                # else warn and continue
        
        # 3f. 标记完成
        mark_done(state["todos"], todo["id"])
        # 若 user_pause == true，等待用户确认
        if todo.get("user_pause"):
            push_pause(state, todo["id"])
            update_state(state, current_id)
            wait_for_user_resume()
            pop_pause(state)
        
        # 3g. 推进到下一个 TODO
        current_id = next_todo(todos_def, current_id)
        state["current_todo"] = current_id
        update_state(state, current_id)
    
    # 4. 全部完成
    state["pipeline_status"] = "complete"
    save_state(state)
```

### 7.3 action_type 执行协议

每个 `action_type` 对应 CODE 软件中不同的执行单元：

| action_type | 执行单元 | 输入 | 输出行为 |
|-------------|---------|------|---------|
| `script` | 调用 `node {SKILL_ROOT}/agent-tools/scripts/{params.script}` | `params.args` 数组 | 等待命令 exit code；非 0 且 `on_fail=halt` 则挂起管道 |
| `question` | 调用 `ask_followup_question` | `params.questions` 数组 | 收集用户回答 -> 写入 `pipeline-state.json` 的 `llm_context_cache` 对应字段 |
| `llm_analysis` | 读取 `params.context_files` + `params.stage_prompt` -> 调用 LLM | 上下文文件列表 + `params.llm_context` | LLM 输出写入 `{work_dir}/analysis-state-s{N}.md`；之后触发 `quality_gate` 校验 |
| `llm_write` | 读取上下文 -> 调用 LLM -> 直接写入一个文件 | `params.output_file` | 写入指定文件；之后触发 `quality_gate` 校验 |
| `file_op` | 文件系统操作 | `params.operation` (copy/mkdir/read/write) | 执行操作；校验预期文件存在 |

### 7.4 质量门定义

`quality_gate` 字段定义执行后的验证标准：

```json
{
  "type": "content_regex" | "file_exists" | "exit_code" | "custom_script",
  "pattern": "正则表达式或文件路径",
  "fail_message": "验证失败时的提示信息"
}
```

- `content_regex`：在 action 输出文件中对内容做正则匹配
- `file_exists`：检查指定文件是否存在
- `exit_code`：检查脚本 exit code 是否为 0
- `custom_script`：运行 `node {agent-tools}/scripts/{script}` 脚本并检查 exit code

### 7.5 状态文件生命周期

```
阶段 0（前置问答）    ──→ 创建 pipeline-state.json（初始状态，current_todo = "s0-1"）
阶段 1 → 阶段 7b    ──→ 每完成一个 TODO，更新 pipeline-state.json（mark_done + 更新 current_todo）
                     ──→ 每次 user_pause 触发时，同步保存 state 到磁盘
管道异常中断          ──→ 标记 pipeline_status = "failed"，写入 errors[]
管道恢复              ──→ CODE 软件读取 pipeline-state.json，从 current_todo 处恢复执行
管道完成              ──→ 标记 pipeline_status = "complete"，所有 todos 均为 done
```

### 7.6 CODE 软件接入 Checklist

第三方 CODE 软件若要完整嵌入此 SKILL 的 TODO 编排模式，需：

1. 读取 `{SKILL_ROOT}/pipeline-todo.json` 获取全部 TODO 定义
2. 在阶段 0（前置问答）完成后创建 `{work_dir}/pipeline-state.json`
3. 实现上文的主循环调度器（或等效控制流）
4. 每个 TODO 执行前运行 `node agent-tools/scripts/validate-session.mjs --todo-mode`
5. 每个 TODO 执行后运行 `node agent-tools/scripts/audit-state-structure.mjs --todo-mode`（如有 analysis-state 写入）
6. 在 `user_pause: true` 的 TODO 处暂停并等用户确认
7. 支持崩溃恢复：从 `pipeline-state.json` 的 `current_todo` 处继续执行
