# 阶段 2-B：多 Agent 并行维度扫描（入口）

> **适用条件**：P0 =「深度分析」（用户前置问答显式选择，默认深度分析）。P0 为**唯一路由权威**，无数据规模回退逻辑。
> **架构角色**：入口节点 → 调度编排器 → 7 Scout 并行 → 交叉验证 → 汇入适配 → 统一进入阶段 3

---

## §0 文件锚定（强制执行）

> 执行 `stages/_shared-anchor.md` 定义的[标准锚定流程]：读取 `.analysis-session` → 提取 `work_dir` → 读取 `s1-handoff.md` 交接摘要（禁止整读全量状态文件）。本文件不再重复定义锚定步骤。

---

## 路由规则（强制执行）

本引擎路由**由 SKILL.md 基于 P0 参数主控，P0 为唯一权威**，不接受数据规模替代路由：

```
P0 路由（唯一权威）：
├─ P0 = 「深度分析」（默认） → 使用本引擎（02-multi-dim-scan.md）
└─ P0 = 「轻量分析」        → 使用 02-cognitive-scan.md

路由决策的唯一来源：analysis-state-s1.md 中 P0 字段的字面值。
任何"数据行数 ≥ N 则自动切换引擎"的逻辑均为错误实现。
```

> **收敛规则**：本阶段产出在汇入阶段 3 前，必须满足 `references/methodology/convergence-rules.md` 的阶段 2 门禁检查：
> - 7 Scout 产出完整性：7 个维度报告全部就位（缺一则 HALT）
> - 交叉验证覆盖率 ≥ 80%
> - 冲突矩阵已生成，冲突率 ≤ 30%
> - D 编号覆盖率 ≥ 90%（执行 `trace-d-numbers.mjs` 交叉校验）

---

## 执行流程（编排式）

### 第一步：启动编排器

读取并执行 `stages/02-orchestrator.md` — 主控编排器负责：

1. 从 `analysis-state-s1.md` 提取共享上下文（D 编号清单 + 数据概况）
2. 并发调度 7 个 Scout（每个使用 `02-scout-template.md` 的标准化提示词）
3. 收集所有 Scout 的同构 JSON 输出
4. 汇总聚合为统一信号池

### 第二步：交叉验证

编排器聚合完成后，执行 `stages/02-cross-validation.md`：

1. 构建 7×7 信号冲突矩阵
2. 聚合盲区报告（数据层 + 分析层 + 系统层）
3. 置信度交叉校准（多维度支撑 → 升档，冲突 → 降档）
4. 覆盖完整性检查（D 编号覆盖率）
5. 生成 V-xxx 验证信号池（含校准后置信度）

### 第三步：汇入适配

交叉验证完成后，执行 `stages/02-merge-gate.md`：

1. V→S 映射：将 V-xxx 按优先级矩阵映射为 S-xxx
2. 格式统一：确保 S-xxx 输出格式与认知循环路径完全一致
3. 来源标记：写入 `引擎路径: multi-agent-via-02-merge-gate`
4. 阶段 3 适配指令生成

### 第四步：进入阶段 3

S-xxx 信号池写入 `analysis-state-s2.md` 后，正常进入 `03-root-cause-reasoning.md`。

阶段 3 开篇自动检测来源标记，执行多 Agent 路径适配：
- 引用 V 编号的 `calibrate_confidence` 作为先验信度
- 归因链中注明原始 Scout 编号
- 交叉验证冲突信号优先结构性假说
- 盲区合成入残余未解释

---

## 完整执行链

```
01-data-foundation.md (D编号体系)
        │
        ▼
02-multi-dim-scan.md (本文件，入口)
        │
        ├── 02-orchestrator.md (并发调度 7 Scout)
        │       │
        │       └── 02-scout-template.md × 7 (标准化输出)
        │
        ├── 02-cross-validation.md (冲突矩阵 + 盲区 + 置信度校准)
        │
        └── 02-merge-gate.md (V→S 映射 + 格式统一 + 适配指令)
                │
                ▼
        03-root-cause-reasoning.md (统一入口，自动检测来源)
```

---

## 输出格式

本入口文件不直接产出分析内容。最终产出物由以下文件定义：

| 产出 | 定义文件 | 写入位置 |
|------|---------|---------|
| 原始观测信号 (O-xxx) | `02-scout-template.md` | analysis-state-s2.md |
| 交叉验证结果 | `02-cross-validation.md` | analysis-state-s2.md |
| V-xxx 验证信号池 | `02-cross-validation.md` | analysis-state-s2.md |
| S-xxx 筛选信号 | `02-merge-gate.md` | analysis-state-s2.md |
| 优先级矩阵 | `02-merge-gate.md` | analysis-state-s2.md |
| 来源路径标记 | `02-merge-gate.md` | analysis-state-s2.md |

---

## 本入口完成标准

- [ ] 路由规则已检查（P0 =「深度分析」已确认，来源：analysis-state-s1.md P0字段）
- [ ] 02-orchestrator.md 已读取并执行（7 Scout 并行调度完成）
- [ ] 02-cross-validation.md 已读取并执行（冲突矩阵 + 盲区 + 置信度校准）
- [ ] 02-merge-gate.md 已读取并执行（V→S 映射 + 格式统一）
- [ ] D 编号覆盖率校验已通过（`trace-d-numbers.mjs` exit=0，覆盖率 ≥ 90%）
- [ ] 阶段 2 收敛门禁已执行（`node agent-tools/scripts/check-convergence.mjs <analysis-state-s2.md路径> 2` exit=0，`convergence-rules.md` 阶段 2 全文检查通过）
- [ ] S-xxx 信号已写入 analysis-state-s2.md，格式与认知循环路径一致
- [ ] 来源路径标记已写入 analysis-state-s2.md，阶段 3 可自动检测
- [ ] 完整执行链无断裂
