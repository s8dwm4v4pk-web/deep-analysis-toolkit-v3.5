# 共享锚定文件（阶段感知路由表）v3.5

> 本文件是每个分析阶段启动时必须先读取的**唯一全局路由表**。
> 它决定：当前阶段读哪些文件、写哪些文件、用哪个锚点。
> v3.5 轻量化改造：**LLM 只读 Handoff 摘要 + state-query 切片，完整状态文件仅脚本审计用。**

---

## 0. 阶段隔离铁律（不变量，勿改）

- 一次只执行一个阶段；每阶段完成后**必须停下等用户「继续」**。
- 阶段间唯一的「记忆交接通道」是 **`s{N}-handoff.md` 交接摘要**（脚本生成，确定性）。
- 完整状态文件 `analysis-state-s{N}.md` 是**脚本数据库**：LLM 只在极少数需要精确回溯时用 `state-query.mjs` 切片读取，**绝不整文件读入**。
- 质量门禁脚本（assemble / verify / trace / audit）读**完整状态文件**，不读摘要。

---

## 1. 会话锚点（workspace 根）

| 锚点 | 存在条件 | 内容 | 谁写 |
|------|----------|------|------|
| `.analysis-session` | 会话创建时 | `session_id`、`work_dir`、`analysis_id` | 启动阶段 |
| `analysis-state-s1.md` … `analysis-state-s7b.md` | 各自阶段完成后 | 该阶段完整产出（脚本数据库） | 各阶段 |
| `s1-handoff.md` … `s7a-handoff.md` | 各自阶段完成后 | 该阶段交接摘要（LLM 只读） | `generate-handoff.mjs` |
| `analysis-state.md` | merge（s5+3b 后）+ s6 追加 | 全量合并存档（仅脚本审计用） | `merge-analysis-state.py` |
| `blueprint.md` | 7b 后 | 最终可视化报告蓝图 | 7b 阶段 |

---

## 2. 阶段 → 文件读写路由表

> 规则 N（核心）：**阶段 N 只读 `s1-handoff.md`…`s{N-1}-handoff.md` 全部摘要（总预算 ~8-12K token），
> 以及用 `state-query.mjs` 定向切片。禁止整文件读取任何 `analysis-state-s*.md`。**

| 阶段 | 读取（LLM 视角） | 写入 | 交接摘要由谁生成 |
|------|------------------|------|------------------|
| S1 数据基座 | 源文件 + `.analysis-session` | `analysis-state-s1.md` | `generate-handoff.mjs s1` |
| S2 多维度扫描 | `s1-handoff.md` | `analysis-state-s2.md` | `generate-handoff.mjs s2` |
| S3 深度归因 | `s1-handoff` + `s2-handoff` | `analysis-state-s3.md` | `generate-handoff.mjs s3` |
| S4 情景预判 | `s1..s3-handoff` + `s3b-handoff` | `analysis-state-s4.md` | `generate-handoff.mjs s4` |
| S5 决策建议 | `s1..s4-handoff` + `s3b-handoff` | `analysis-state-s5.md` | `generate-handoff.mjs s5` |
| S6 叙事规划 | `s1..s5-handoff` + `s3b-handoff` | `analysis-state-s6.md`（并追加至 `analysis-state.md` 存档） | `generate-handoff.mjs s6` |
| S7a 报告生成 | `s1..s6-handoff` + `s3b-handoff` | 章节文件 → `merge-analysis-state.py` 合成 `analysis-state.md` | — |
| S7b 可视化编排 | `s1..s7a-handoff` + `state-query` 切片 | `blueprint.md` | — |

> 7a/7b 若需精确字段（如 `D_NUMBERS`、`S_SIGNALS`、图表面板数据），
> 用 `node agent-tools/scripts/state-query.mjs <file> --fields=D_NUMBERS,S_SIGNALS` 定向提取，禁止整读。

---

## 3. 锚定步骤（每个阶段强制前置动作）

阶段启动时，LLM 必须按序执行：

1. **读本路由表**（即本文件）。
2. **确认会话锚点**：`.analysis-session` 存在；否则按启动协议创建。
3. **读取前一阶段的 Handoff 摘要**（禁止读完整状态文件）：
   - 用 `read_file` 读 `s{N-1}-handoff.md`（若存在）。
   - 多个前序阶段时，逐一读取所有 `s1-handoff.md` … `s{N-1}-handoff.md`。
4. **按需切片**：需要某个字段/章节的精确内容时，调用 `state-query.mjs`（见 §2 示例）。
5. **执行本阶段任务**，产出写入 `analysis-state-s{N}.md`。
6. **生成交接摘要**：调用 `node agent-tools/scripts/generate-handoff.mjs analysis-state-s{N}.md s{N}-handoff.md --stage={N}`。
7. **校验**：摘要生成成功后，再执行本阶段质量门禁（如有）。
8. **停下，等用户「继续」**。

> 铁律：摘要未生成成功前，不得声称本阶段完成；下游阶段一律以摘要为交接依据。

---

## 4. 错误处理与 HALT 条件

| 情形 | 动作 |
|------|------|
| 缺少 `.analysis-session` | HALT，按启动协议创建后重试 |
| 缺少 `s{N-1}-handoff.md` | HALT，提示回退执行上一阶段的交接生成步骤 |
| `state-query.mjs` 返回 `missing` | 用 `--sections=` 扩大范围重试；仍缺则 HALT 并报缺失字段 |
| 摘要体积 > 3K token | 用 `--max-lines=` 收紧重生成，确保交接预算 |

---

## 5. 变更记录

- **v3.5（轻量化）**：新增 Handoff 交接协议与 state-query 切片；LLM 不再整文件读取 `analysis-state-s*.md`；完整文件降级为脚本审计存档。功能板块、D/V/S 编号体系、勾稽校验、质量门禁全部不变。
- v3.4 及以前：阶段 N 强制读 `s1..s{N-1}` 全量状态文件（上下文溢出根源，已废弃）。
