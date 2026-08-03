# 阶段 1：数据基座构建与勾稽校验

> **认知层次**：数据层 — 在分析开始前先验数据，冻结唯一数据来源
> **自 V2 起**：本阶段为所有后续分析的先决条件。未经本阶段校验的数据不得进入阶段 2。

---

## 本轮职责

接收原始数据文件后，执行以下操作：

1. **数据提取** — 从原始数据中抽取出用于分析的数值矩阵
2. **5 项勾稽校验** — 确保数据内部一致、逻辑自洽
3. **数据形态归类** — 识别每个变量的 S1-S17 形态，为后续图表选型铺路
4. **质量评级** — 给出 A/B/C/D 四级评定
5. **建立 D 编号体系** — 为每个关键数值点分配唯一编号，供后续所有轮次引用

---

## 第〇步：源文件就位 + 创建输出目录

> ⚠️ 必须首先执行，否则后续步骤无写入目标。

### 第〇·A 步：源文件就位

若用户指定的源数据文件在 SKILL_ROOT 之外：
1. 先将其**复制**（cp）到待创建的 `SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/` 目录下
2. 原文件保留不动，不修改、不删除
3. 确认复制后的文件存在且可读后，继续下一步

若用户指定的源数据文件已在 SKILL_ROOT 内：
1. 同样复制一份到上述目录（保留原始副本不动）

> 全流程从此目录读取数据，与原始外部分路径彻底解耦。

### 第〇·B 步：创建隔离子目录

```
SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/
```

1. 根据用户指定的源数据文件，确定 `task_name`，**规范化规则**：
   - 提取文件名中的核心关键词，取 `[A-Za-z0-9\u4e00-\u9fff]+` 连续字符
   - 剔除纯数字、日期格式、文件后缀
   - 合并碎片，截断至 **≤12 字符**（中文按字切、英文/数字整体保留）
   - 避免泛化词（如"分析""报告""数据"单独作为 task_name）
   - 示例：`煤矿安全事故2025年度统计.xlsx` → `task_name = "煤矿安全事故"`
2. 生成时间戳 `YYYYMMDD_HHMM`（当前时间）
3. 拼接完整路径：`SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/`
4. 创建目录，将源数据文件**复制**到该目录下
5. **写入锚点文件** — 在 **SKILL_ROOT** 创建 `.analysis-session`，内容仅一行：`work_dir={完整绝对路径}`。这是全流程唯一的外部锚点，后续阶段无需搜索文件，直接读此文件即可定位
6. 将 `work_dir` 字段（完整路径字符串）写入 `analysis-state-s1.md` 的「分析参数」章节
7. 后续所有产物（analysis-state-s1.md、report.html）均输出到此目录
8. 完成后立即运行以下命令确认锚定成功 → **exit ≠ 0 则 HALT**，报告"工作目录创建失败"并停止：

```bash
node agent-tools/scripts/validate-session.mjs
```

> **task_id 校验规则**：写入 `analysis-state-s1.md` 前，LLM 必须校验 `task_id` 是否严格匹配模式 `^[A-Za-z0-9\u4e00-\u9fff]{2,12}_\d{8}_\d{4}$`。不匹配 → 重新生成 `task_name` 和时间戳，不得写入异常格式。阶段 7 从合并后的 `analysis-state.md` 读取 `task_id` 时也执行此校验，不一致则判定为数据串染。

> 不得将文件散落放置在源数据文件所在目录而不创建子目录。
> 阶段 7 从合并后的 `analysis-state.md` 读取 `work_dir` 构造组装/验证命令，**不得凭记忆重新推导路径**。

### 第零·五步：计算数据指纹（脚本接管）

在进入任何分析步骤前，必须先执行哈希计算 — **此步骤由脚本全权执行，LLM 不得自行计算或猜测哈希值**：

```bash
node agent-tools/scripts/hash-data.mjs "<数据文件的完整绝对路径>"
```

> 🔴 **脚本接管规则**：hash-data.mjs 直接输出 8 位十六进制 SHA-256 哈希。LLM 仅读取 stdout 输出值并原样写入 `analysis-state-s1.md` 的 `data_hash` 字段，**不得做任何转换或截断**。
> 后续轮次通过重新执行此命令来校验文件未被意外替换或修改，确保全流程引用同一份数据。
> **exit ≠ 0 → HALT**，报告"数据指纹计算失败"并停止。

---

## 第一步：数据提取（Extract）

从原始数据文件中提取出分析用数据表：

```
D0: 完整数据表（行列矩阵）
  ├─ 行数: N
  ├─ 列数: M
  ├─ 列名清单（含单位、数据类型）
  └─ 时间范围（如有）
```

对每列标注：
- 数据类型：连续数值 / 离散类别 / 文本 / 日期时间
- 缺失率（NA/NULL 占比）
- 值域范围（min / max / unique_count）

---

## 第二步：5 项勾稽校验（Reconcile）— 脚本接管

> 🔴 **脚本接管**：R1-R5 全部数值计算由 reconcile-report.mjs 执行。LLM **不执行手工计算**，仅负责识别列参数并传递给脚本。

### 第二步·A：识别列参数并调用脚本

LLM 根据第一步的数据列清单，按以下规则判定参数，然后**直接调用** reconcile-report.mjs：

```bash
node agent-tools/scripts/reconcile-report.mjs \
  --data "<输出目录中的源数据副本路径>" \
  --time-col "<时间列名（可选，无时间列则省略）>" \
  --total-col "<总量列名（可选，无法确定则省略）>" \
  --sub-cols "<子列1>,<子列2>,..." \
  --output "<analysis-state-s1.md 路径>"
```

**参数选择规则：**

| 参数 | 何时必传 | LLM 如何判定 |
|------|----------|-------------|
| `--data` | 始终必传 | 输出目录中第一步复制进去的源数据文件路径 |
| `--time-col` | 数据含时间轴时传 | 读取列清单，查找日期/时间类型列 |
| `--total-col` | 存在明确的"合计/总计"列时传 | 列名含"合计\|总计\|总量\|total\|sum"，或数值明显为子列之和 |
| `--sub-cols` | 与 `--total-col` 配对传 | 列出组成 total 的所有子列名 |
| `--output` | 始终必传 | analysis-state-s1.md 的路径，脚本将 R1-R5 结果追加写入 |

> ⚠️ **R1 特殊说明**：R1（总量一致性）仅在 `--total-col` + `--sub-cols` 同时传入时激活。若 LLM 无法判定总量/子列关系，省略这两个参数 → R1 输出 N/A，不影响其余 4 项检查。
>
> **exit ≠ 0 → HALT**，报告"勾稽脚本执行失败"并输出 stderr 内容，由 LLM 排查原因后重试。

脚本输出直接追加到 analysis-state-s1.md 的 `### 勾稽结果` 章节中（覆盖 LLM 手工检查结果）。LLM 职责缩减为：解读脚本输出的 PASS/WARN/FAIL/Flag 标记，据此判定质量评级。

---

## 第三步：数据形态自动归类（脚本接管）

> 🔴 **脚本接管**：数据形态分类由 classify-data-shape.mjs 全权执行。LLM 不得手工分类。

在第一步数据提取完成后，立即调用脚本对源数据进行 S1-S17 形态自动归类：

```bash
node agent-tools/scripts/classify-data-shape.mjs "<输出目录中的源数据副本路径>" --json
```

脚本输出包含：
- 每个数值列/列组的形态代号（S1-S17）
- Pearson 相关系数矩阵（连续数值列之间）
- 图表推荐映射（形态 → 建议图表类型 → 模板文件路径）

| 形态 | 触发条件 |
|------|---------|
| S1 一维数组 | 一列数值 + 一列类别（N 个实体） |
| S2 多维矩阵 | 多列数值，共享同一维度 |
| S3 极简 KPI | 2-6 个孤立数值，无分组 |
| S4 时间序列 | 同一指标 ≥3 个时间点 |
| S5 双变量 | 两列连续数值，一一对应 |
| S6 构成/占比 | 数值为百分比，和为 100% |
| S13 流程 | 源→目标→数值的三列结构 |
| ... | 其余按 visualization-mapping.md 决策树匹配 |

> **exit ≠ 0 → HALT**，报告"数据形态分类失败"并输出 stderr 内容。

LLM 将脚本输出的形态清单和图表推荐映射写入 analysis-state-s1.md 的 `MORPH` 字段，供第 6 轮图表规划直接引用。

---

## 第四步：质量评级

综合 5 项勾稽结果，给出评级：

```
┌───────┬──────────────────────────────────────────┐
│  A 级 │ 5/5 PASS               → 数据可信，可走满全链 │
│  B 级 │ 含 WARN，无 FAIL       → 可以分析，报告中标注风险 │
│  C 级 │ 含 ≤2 FAIL，非核心字段  → 降级分析，每轮同步标注不确定性 │
│  D 级 │ 含 >2 FAIL 或核心字段FAIL → 建议终止，询问用户后决定     │
└───────┴──────────────────────────────────────────┘
```

**D 级特殊流程**（见 `references/methodology/convergence-rules.md` 中断 0）：
- 产出一份数据质量报告
- 明确告知用户缺陷清单
- 询问："当前数据存在 N 项致命缺陷，是否仍要继续分析？"
- 用户确认后 → 降级为 C 级流程，报告中全程标注

---

## 第五步：建立 D 编号体系

为后续所有轮次建立唯一引用编号：

```
D-FOUNDATION:
  ├─ D0: 完整数据表（行×列矩阵）
  ├─ D1..Dk: 每列的数据轮廓（缺失率、范围、分布摘要）
  ├─ R1..R5: 5 项勾稽结果
  ├─ MORPH: 形态归类清单
  └─ QUALITY: 质量评级结果

编号原则：后续轮次中任何引用数据数值时，使用 [D0.r{C}c{M}] 或 [D0.r{C}.col 格式
例如：[D0.r3.c5] 表示第3行第5列的数值
```

---

## 写入 analysis-state-s1.md

本阶段产出写入 `analysis-state-s1.md` 的 `## 数据基座` 章节，包含：

> ⚠️ **分析参数（P0/P6/P7/P1-P5）已由主 SKILL 在前置问答后写入，本阶段不得重复写入。** 本阶段仅补充数据相关字段：data_hash、数据文件路径、work_dir、数据概况、列清单、勾稽结果、质量评级、D 编号体系。

```markdown
## 数据基座

### 数据字段补充（由阶段 1 写入）
- data_hash: {8位SHA-256} — 通过 `node agent-tools/scripts/hash-data.mjs <数据文件路径>` 生成
- 数据文件: {相对路径}
- work_dir: {SKILL_ROOT/workspace/{task_name}_{YYYYMMDD}_{HHMM}/} — 阶段 1 创建，全流程唯一输出目录

### 数据概况
- 行数: N, 列数: M
- 时间范围: YYYY-MM-DD ~ YYYY-MM-DD

### 列清单
| 列名 | 类型 | 缺失率 | 范围 | 形态代号 |
|------|------|--------|------|----------|
| ... | ... | ... | ... | ... |

### 勾稽结果
- R1 (总量一致性): PASS/WARN/FAIL — 详情
- R2 (时间连续性): PASS/WARN/FAIL/N/A — 详情
- R3 (字段完整性): PASS/WARN/FAIL — 详情
- R4 (逻辑一致性): PASS/WARN/FAIL — 详情
- R5 (量纲合理性): PASS/WARN/FAIL — 详情

### 质量评级
评级: A/B/C/D
关键发现: ...（如评级不是 A，说明降级原因和后续风险）

### D 编号体系
（关键数据点的唯一引用编号清单）
```

---

## 第五步·B：数据指纹一致性校验（verify-data-hash.mjs）

> 🔴 **脚本接管**：analysis-state-s1.md 写入完成后，必须用脚本验证 data_hash 字段与源文件指纹一致。LLM 不得跳过此步骤。

```bash
node agent-tools/scripts/verify-data-hash.mjs "<analysis-state-s1.md 路径>" "<源数据文件路径>"
```

**校验逻辑**：脚本从 analysis-state-s1.md 提取 `data_hash` 字段 → 对源数据文件重新计算 SHA-256 → 比对二者是否一致。

> **exit ≠ 0 → HALT**，报告"数据指纹不匹配"并停止。这通常意味着源文件在阶段 1 执行期间被外部替换，必须重新从第零·五步开始。

---

## 本轮完成标准

- [ ] 输出目录已创建，源数据文件已复制
- [ ] `.analysis-session` 锚点文件已写入 SKILL_ROOT
- [ ] `node agent-tools/scripts/validate-session.mjs` exit=0
- [ ] `node agent-tools/scripts/hash-data.mjs` exit=0，data_hash 已写入 state
- [ ] `node agent-tools/scripts/reconcile-report.mjs` exit=0，R1-R5 结果已写入 state
- [ ] 数据提取完毕，列清单完整（含缺失率和范围）
- [ ] `node agent-tools/scripts/classify-data-shape.mjs` exit=0，形态归类完成
- [ ] 质量评级有充分依据
- [ ] D 编号体系建立，关键数据点有唯一标识
- [ ] 全部结果已写入 analysis-state-s1.md
- [ ] `node agent-tools/scripts/verify-data-hash.mjs` exit=0，指纹一致性已验证

---

## 对接后续轮次

- 第 1 轮：从 D0 读取数据，从 D-FOUNDATION 读取列清单和形态
- 第 2 轮：信号筛选时参考质量评级（C 级信号标注更高不确定性）
- 第 3 轮：归因时引用 D 编号，如 [D0.r15.c3]
- 第 6 轮：图表规划直接从 MORPH 清单选型
- 阶段 7b：报告中必须包含"数据质量声明"一节，内容来自本轮评级
