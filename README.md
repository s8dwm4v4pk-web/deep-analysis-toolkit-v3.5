# deep-analysis-toolkit V3.5

深度分析工具箱 V3.5 — 从实战缺陷中重构的分析引擎。

**V3 改进总结**（基于三份同源报告的交叉验证评估）：

| 问题 | V1 表现 | V3 修复 |
|------|---------|---------|
| 数据错配 | 矿区矿次分布与真实值不符 | 新增阶段 1「数据基座 + 5项勾稽校验」，冻结唯一数据来源 |
| 伪精确概率 | "72%""58%"无推导依据 | 已纳入 `7-dimension-methodology.md` 第 7 条戒律，强制定性等级 |
| 报告不完整 | 缺事故明细表/双面信号/区域分级 | 已纳入 `stages/07b-html-generate.md` checklist，8 项必备 |
| 内部术语泄露 | Engine A/B 暴露给读者 | 第6轮加入受众适配规则和术语白名单 |
| CDN 依赖 | Chart.js CDN，断网图表消失 | 第7轮强制自包含策略 |
| 失效引用 | `PROMPT_FOR_AI_AGENT.md`/`lib/` 等旧路径不存在 | 工程约定并入各轮 prompt，verify-report.mjs 现可运行 |

## 包含的分析引擎

| 引擎 | 路径 | 适用场景 |
|------|------|---------|
| **认知循环** | `stages/02-cognitive-scan.md` → `07b-html-generate.md` | 中小数据量、追求归因深度（10 阶段渐进：Stage 0 前置问答 + 9 个分析阶段） |
| **维度分工** | `stages/02-multi-dim-scan.md` | 大数据量、多层级并行扫描 |

> V3.1 重构：轮次 prompt 从旧 `cognitive-iteration/round-prompts/` 提升至 `stages/`，共享方法论去重到 `references/methodology/`。

## 安装

### 方式 1：拖入 CodeBuddy IDE（推荐）

将整个 `deep-analysis-toolkit-v3.5/` 目录拖入 WorkBuddy（或 CodeBuddy）插件管理界面。

### 方式 2：手动安装

```bash
cp -r "deep-analysis-toolkit-v3.5" ~/.workbuddy/skills/
# 然后在 WorkBuddy 技能中心刷新即可加载
```

## 插件结构

```
deep-analysis-toolkit-v3.5/
├── SKILL.md                            # 根技能（纯路由）
├── README.md                           # 本文件
├── stages/                             # 分阶段执行 prompt（V3.5，10 阶段）
│   ├── 01-data-foundation.md           # 阶段 1：数据基座 + 5 项勾稽校验
│   ├── 02-cognitive-scan.md            # 阶段 2-A：认知循环全域扫描 + 信号筛选
│   ├── 02-multi-dim-scan.md            # 阶段 2-B：多 Agent 并行扫描（入口）
│   ├── 02-orchestrator.md              # 阶段 2-B：主控编排器（并发调度）
│   ├── 02-scout-template.md            # 阶段 2-B：维度 Scout 通用模板
│   ├── 02-cross-validation.md          # 阶段 2-B：7×7 交叉验证
│   ├── 02-merge-gate.md                # 阶段 2-B：汇入适配层（V→S 格式转换）
│   ├── 03-root-cause-reasoning.md      # 阶段 3：假说穷举 + 三级证据检验
│   ├── 03b-safety-lifecycle.md         # 阶段 3b：Safety Lifecycle 安全演化评估
│   ├── 04-scenario-predict.md          # 阶段 4：情景预判与反事实推断
│   ├── 05-decision-advice.md           # 阶段 5：四层决策建议
│   ├── 06-narrative-weave.md           # 阶段 6：叙事规划
│   ├── 07a-narrative-assembly.md       # 阶段 7a：叙事组装
│   ├── 07b-html-generate.md             # 阶段 7b：HTML 报告生成
│   └── _shared-anchor.md                # 跨阶段共享锚定协议
├── themes/                             # CSS 主题预设（V3.5）
│   ├── theme-dark.css                  # 纯网页版：暗色 + 金色主色调
│   └── theme-a4.css                    # A4 分页版：深蓝封面 + 浅色内页
├── agent-tools/scripts/（28 个 .mjs + 27 个 .tool.json + merge-analysis-state.py，完整列表见 SKILL.md）
│   ├── generate-handoff.mjs            # 阶段交接摘要生成（V3.5）
│   ├── state-query.mjs                 # 状态文件定向切片查询（V3.5）
│   ├── hash-data.mjs                   # 文件指纹
│   └── verify-report.mjs              # 质量闸门脚本
└── references/
    ├── methodology/                    # 共享方法论（唯一副本）
    │   ├── 7-dimension-methodology.md
    │   ├── analysis-state-protocol.md
    │   ├── convergence-rules.md
    │   ├── theme-classes.md              # 双主题 CSS 类名速查（V3.5）
    │   └── visualization-mapping.md
    ├── templates/                       # 图表模板（按引擎分目录，35 个独立文件）
    │   ├── echarts/  (20)
    │   ├── apexcharts/  (3)
    │   ├── d3/  (8)
    │   ├── chartjs/  (1)
    │   └── threejs/  (3)
    └── vendor/                         # 图表库（全内联，零 CDN）
        ├── echarts.min.js
        ├── apexcharts.min.js
        ├── d3.v7.min.js
        ├── chart.js.min.js
        └── three.min.js
```

## 使用

在 WorkBuddy（或 CodeBuddy）IDE 对话窗口中使用触发词：

- "帮我深度分析这份数据，追溯根本原因" → 认知循环引擎
- "对这份大表做多维度并行扫描" → 维度分工引擎

V3.5 会自动执行 Stage 0 前置问答（P0/P6/P7 + P8/封面标题，P1-P5 系统默认值），随后进入阶段 1 数据基座构建与勾稽校验；每阶段产出 `s{N}-handoff.md` 交接摘要，阶段间轻量化交接（约 8-12K token）。

## 变更日志

### v3.5.0 (2026-08-02)
- **轻量化交接**：新增 `generate-handoff.mjs`，每阶段末尾生成 `s{N}-handoff.md` 摘要（约 8-12K token），后续阶段只读摘要即可继续
- **状态切片**：新增 `state-query.mjs`（`--fields` / `--sections` 定向切片），精确字段无需整文件读取
- **TODO 编排升级**：`pipeline-todo.json` 原子 TODO 从 59 个扩展至 **78 个**（10 阶段全覆盖）
- **阶段结构**：从 8 阶段扩展为 **10 阶段**（Stage 0 前置问答 + 9 个分析阶段 01→07b）
- **确定性合并**：新增 `merge-analysis-state.py`，阶段 5(+3b) 后合并 `analysis-state-s1..s5(+3b)` → `analysis-state.md`（仅脚本审计用）
- **新增门禁/校验工具**：`check-convergence.mjs`（收敛门禁）、`validate-blueprint-for-7b.mjs`（蓝图 7 项规则）、`validate-o-v-s-chain.mjs`（O→V→S 三层穿透链）
- **图表增强**：新增 `match-chart-templates.mjs`（35 模板智能匹配）+ `fix-chart-varname.mjs`（变量名一致性修复）

### v3.4.0
- **阶段拆分**：07-report-generate.md 拆分为 07a-narrative-assembly.md（叙事组装）+ 07b-html-generate.md（HTML 报告生成）
- **安全评估**：新增 03b-safety-lifecycle.md（Safety Lifecycle Theory 安全演化评估）
- **后期工具**：新增 flatten-a4.mjs（A4 打印展平）+ lift-grid-top.mjs（图表 grid 顶部抬高）
- **流程扩展**：从 7 阶段扩展为 8 阶段渐进链

### v3.1.0 (2026-07-21)
- **架构重构**：按 ask-matt 流程范式拆分为纯路由 SKILL.md + 13 个独立 stage 文件
- **共享文件去重**：两个引擎共有的方法论文件提升到 `references/methodology/`（单副本）
- **Vendor 统一**：图表库从 cognitive-iteration 移到 `references/vendor/`
- **主题预设**：新增 `themes/theme-dark.css` + `themes/theme-a4.css`（由用户精选报告提炼）
- **文件指纹**：新增 `agent-tools/scripts/hash-data.mjs`（SHA-256 前 8 位），确保全流程数据一致
- **连续会话**：06-narrative-weave → 07a-narrative-assembly → 07b-html-generate 在同一会话中连续执行，无需上下文隔离
- **CSS 类名统一**：`theme-a4.css` 使用 `.page.cover` 替代旧 `.cover-page`
- **信号筛选合并**：R1 全域扫描 + R2 信号筛选合并到 `02-cognitive-scan.md`
- **轮次引用修复**：修复跨文件断裂的"第2轮"引用
- **analysis-state 模板完善**：新增 `data_hash`、`P6` 报告格式、`P1-P5` 参数字段

### v3.0.0 (2026-07-21)
- 版本号统一升级为 V3
- 修复 README 虚引用：`quantification-discipline.md` / `report-content-baseline.md` 改为正确路径
- 统一轮次表述：R7a/R7b 合并为"第 7 轮：报告生成（含 Vendor 加载 + HTML 生成）"
- 根 SKILL.md 新增版本声明
- 功能架构说明：修正前置对话轮数为"一轮"（与 SKILL 实际行为一致）

### v2.0.2 (2026-07-20)
- `verify-report.mjs` 新增 ECharts 图表检测（三种 init 模式并行检测）
- `verify-report.mjs` 新增硬约束自动化校验：图表总数 ≥12、高级图表 ≥3、多维可视化 ≥1
- `verify-report.mjs` 新增内部标记泄漏检测 + 裸数字无单位检测
- `verify-report.mjs` 新增图表统计分项输出（Chart.js vs ECharts）
- `verify-report.mjs` 修正 ECharts 元素校验：从仅 canvas 扩展至全量 DOM 元素，修复误报
- 统一所有输出目录引用为 `workspace/{task_name}_{YYYYMMDD}_{HHMM}/`
- `06-narrative-weave.md` 图表需求章节增加 P5 参数显式引用
- 修复 `multi-agent-analysis/SKILL.md` 中 `lib/` 残留引用

### v2.0.1 (2026-07-19)
- 新建 `00-data-foundation.md`：5 项勾稽校验 + 数据形态归类 + 质量评级 + D 编号体系
- 收敛规则：从统一 15% 阈值改为逐轮收敛条件 P1/P2/P3（用户可在分析启动时通过对话表单修改，默认 P1=67%，P2=<2 个，P3=K=3）
- R2 信号上限从 ≤5 放宽至 ≥5 且 ≤8
- R5 决策建议取消硬上限，改为"每条必须有独立归因依据"
- 图表下限从 ≥10 提升至 ≥12，强制 ≥3 高级图表 + ≥1 多维可视化
- 图表模板体系：从 echarts-snippets.html 单体文件演进为 35 个独立模板文件（echarts 20 + apexcharts 3 + d3 8 + chartjs 1 + threejs 3，分目录管理）
- visualization-mapping.md 新增第六部分：图表最低要求与验收清单
- multi-agent 阶段 0 增强为数据基座构建，对齐 cognitive-iteration 的 R0

### v2.0.0 (2026-07-19)
- 新增第0轮「数据基座构建」：提取→勾稽（5项）→冻结（D 编号体系 + 5 项勾稽校验现已内置于 `round-prompts/00-data-foundation.md`）
- 新增量化约束规则（禁止伪精确概率，已纳入 `7-dimension-methodology.md` 第 7 条戒律）
- 新增报告基线标准（8 项必备模块底线，已纳入 `stages/07b-html-generate.md` checklist）
- 新增 `agent-tools/scripts/verify-report.mjs`：真实可运行的质量闸门
- 第6轮加入受众适配规则和术语白名单
- 第7轮强制自包含策略 + 内容基线验收
- 7-dimension-methodology.md 新增第7条戒律"戒伪精确"
- convergence-rules.md 新增中断0（数据基座门禁）
- cross-validation.md 新增数值勾稽复核步骤
- multi-agent-analysis 加入数据基座阶段（Scout 引用 D 编号）
- 修复所有失效引用（PROMPT_FOR_AI_AGENT.md / lib/ / SKILLS/ 跨目录引用）
- 图表面板改为浅色主题 + 打印友好方向
- 认知循环从 7 轮扩展为 8 轮

### v1.0.0
- 初始发布：双引擎（认知循环 + 多Agent并行）
