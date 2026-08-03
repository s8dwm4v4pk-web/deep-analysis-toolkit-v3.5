# CHANGELOG — v3.4 → v3.5（轻量化改造，P0）

> 本次改造遵循硬性约束：**现有功能板块不变 + 结果质量不变**。
> 只改变两条信息流：①阶段间如何交接状态；②完整状态文件如何进入上下文。

## 问题背景（v3.4 上下文溢出根源）

- 阶段 N 强制全量读取 `analysis-state-s1.md`…`analysis-state-s{N-1}.md`（阶段 5 读 ~50KB、7a 读合并后 ~200KB）；
- 状态文件「叙事+坐标」双轨格式膨胀 + 方法论/模板反复全量读入；
- 7b 模板全量输入 + HTML 全量输出双向占满。

## 改造清单（P0：仅加载方式，不动架构）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `agent-tools/scripts/generate-handoff.mjs`（新增） | 阶段 N 末尾从 `analysis-state-s{N}.md` 提取白名单章节，生成 2-3K token 的 `s{N}-handoff.md` 交接摘要。纯脚本截取，零 LLM 开销，无丢字段风险 |
| 2 | `agent-tools/scripts/generate-handoff.tool.json`（新增） | 脚本注册（工具发现） |
| 3 | `agent-tools/scripts/state-query.mjs`（新增） | 按字段/章节白名单从完整状态文件定向切片，JSON 输出，替代整文件 `read_file` |
| 4 | `agent-tools/scripts/state-query.tool.json`（新增） | 脚本注册（工具发现） |
| 5 | `stages/_shared-anchor.md`（重写） | 阶段感知路由表改为「LLM 只读 handoff 摘要 + state-query 切片；完整状态文件仅脚本审计用」；新增 §3 锚定步骤（含生成 handoff）、§4 错误处理 |
| 6 | `pipeline-todo.json` | 版本升 3.5.0；每个写状态文件阶段后插入 `generate-handoff` 步骤（s1-11/s2-7/s3-6/s3b-6/s4-8/s5-7/s6-8）；读取步骤 `input_vars` 从全量 `merged_state_content` 改为 `s{N}-handoff` 摘要 + `state-query` 切片；merge 步骤标注「仅脚本审计存档」 |
| 7 | `SKILL.md` | 版本升 v3.5.0（frontmatter name/description、正文头）；阶段隔离铁律新增第 7 条 handoff 交接；阶段 1 步骤 12 生成 handoff；阶段 5→6 合并说明改为摘要交接；阶段 7a 就绪检查改为基于 handoff；脚本清单补两新脚本；全局写入规则第 4 步改读 handoff |
| 8 | `stages/02-*.md`、`03-*.md`、`04-*.md`、`05-*.md`、`06-*.md`、`07a-*.md`（11 处） | 「整读全量状态文件」指令全部改为「读取 `s{N}-handoff.md` 交接摘要 + 缺失字段用 `state-query.mjs` 定向切片」 |
| 9 | `CHANGELOG-v3.5.md`（本文件） | 升级说明 |

## 未改动（功能与质量门禁全保留）

- D→V→S 三层编号体系、5 项勾稽校验、7 维度 Scout 并行扫描、交叉验证、假说穷举+三级证据检验、Safety Lifecycle 评估、反事实推断、情景预判、信号优先级矩阵、四层决策建议；
- 质量门禁脚本：`verify-report.mjs` / `assemble-report.mjs` / `trace-d-numbers.mjs` / `reconcile-report.mjs` / `audit-state-structure.mjs` 等全部原样保留，且仍读**完整状态文件**（脚本审计不受摘要影响）。

## 预期收益

- 阶段 5 输入：~50KB → ~5KB（只读 4 份 handoff）；
- 阶段 6/7a 输入：合并后 ~200KB 整读 → 读 handoff（~8-12K token）+ 按需切片；
- 全流程 Token 预算：~150-250K → ~40-60K（降幅约 70-75%），功能与质量不变。

## 回退方式

- v3.4 行为未删除，git 可直接回退；
- 若某次运行发现 handoff 字段不足，改用 `state-query.mjs --sections=` 扩大提取范围，或临时回退为整读（`_shared-anchor.md` 旧版路由表在 git 历史中）。

## 后续（P1/P2，本次未实施）

- P1：Scout 子会话隔离（7 路并行扫描不占主上下文）、methodology-brief 单例加载；
- P2：7b 模板脚本化（`data-chart-spec` 声明式填充）、输出分块。

---

# 修复记录（端到端推演诊断后，v3.5.1）

> 依据「全流程推演和诊断」报告的 P0/P1/P2 三级问题清单逐项落盘。核心缺陷：**handoff 章节提取曾因阶段输出标题与 HANDBOOK 白名单脱钩而静默丢失内容**。

## 修复清单

| 级别 | 问题 | 修复内容 | 涉及文件 |
|------|------|----------|----------|
| P0-A | HANDBOOK 白名单 × 阶段输出标题脱钩，s3-s6 章节提取可能静默丢失 | HANDBOOK 扩充 `params` 组及 6 阶段关键词；各阶段输出模板顶层加 `## 深度归因 / 情景预判 / 决策建议 / 叙事规划 / Safety Lifecycle 评估` 包装标题；`extractChapter` 恢复「命中即收集、遇同层/更浅停止」 | `generate-handoff.mjs`；`stages/03-04-05-06-03b-*.md`；`references/methodology/analysis-state-protocol.md` |
| P0-B | s6-3 输入仍是全量 `merged_state_content` | `input_vars` 改 `s1-s5_handoffs` | `pipeline-todo.json` |
| P0-C | 06 §0 存在「只读合并文件」矛盾指令 | 改为「禁读合并文件、只读 s1-s5+s3b-handoff」 | `stages/06-narrative-weave.md` |
| P1-D | 07a 就绪检查字段来源仍指向全量文件 | 来源列全部改 handoff 通道，新增 s3b 必读警告（缺失→终止） | `stages/07a-narrative-assembly.md` |
| P1-E | 06 P7 阈值无 handoff 通道 | 改从 `s1-handoff` 读取，附 `state-query` 回退 | `stages/06-narrative-weave.md` |
| P1-F | s6-handoff 体积失控 | s6-7 目标改独立 `analysis-state-s6.md`；s6-8 从 `analysis-state-s6.md` 生成 handoff | `pipeline-todo.json` |
| P2-G | s3b 三处断链（pipeline/脚本/共享锚点） | s5-1/s6-1/s7a-1 补 `s3b-handoff`；merge 脚本拆独立 `analysis-state-s3b.md`；`_shared-anchor.md` 路由表补 s3b | `pipeline-todo.json`；`merge-analysis-state.py`；`stages/_shared-anchor.md` |

## 验证结果

- `pipeline-todo.json` JSON 解析通过；`node --check generate-handoff.mjs`、`python -m py_compile merge-analysis-state.py` 均通过；
- 关键词命中实测：新旧格式双兜底 7/7 PASS（t-s3/s4/s5/s6/s3b/s1 等样例，临时目录已清理）；
- 脚本审计类脚本（`verify-data-hash` / `validate-o-v-s-chain` / `check-convergence` / `audit-state-structure`）仍读完整状态文件，符合「脚本审计消费全量、LLM 只读 handoff」原则，未改动。

## 建议实测

1. 任取一个 `analysis-state-s{N}.md` 样例（s3-s6）跑 `node agent-tools/scripts/generate-handoff.mjs <file> --json`；
2. 核对输出 JSON 含 `deep_attribution / scenarios / decisions / narrative / params` 等章节（新格式标题）或旧格式关键词兜底命中；
3. 跑一次 `pipeline-todo.json` 中 s6-3 → s6-8 序列，确认 s6-handoff 体积正常、阶段 6/7a 均只读 handoff。
