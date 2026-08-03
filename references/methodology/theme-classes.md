# 主题 CSS 类名速查表

> **用途**：供阶段 7 在生成骨架 HTML 时查阅所需 CSS 类名。
> **原则**：LLM 不读取主题 CSS 文件（~10KB 样式代码，由 `assemble-report.mjs` 内联），仅通过本表查询语义化类名。
> **维护**：主题 CSS（`themes/theme-*.css`）更新时，本表必须同步更新。本表未列出的类名 → 不存在，不要凭空创造。

## 封面与元信息

| 元素 | P6="纯网页版" (`theme-dark.css`) | P6="A4分页版" (`theme-a4.css`) |
|------|----------------------------------|-------------------------------|
| 封面容器 | `.cover` | `.page.cover` |
| 标签 | `.tag` | `.tag` |
| 标题 | `h1` | `h1` |
| 副标题 | `.subtitle` | `.page.cover .sub` |
| 分隔线 | `.divider` | — |
| 机构/来源 | `.org` | — |
| 补充信息行 | `.meta-row` | `.page.cover .meta` |
| 封面上区（tag+标题） | — | `.cover-top` |
| 封面日期 | — | `.cover-date` |

## KPI 指标卡片

| 元素 | P6="纯网页版" | P6="A4分页版" |
|------|--------------|---------------|
| 卡片网格 | `.stats-banner` | `.kpi-grid` |
| 单个卡片 | `.stat-card` | `.kpi-card` |
| 数值基类 | `.num` | `.val` |
| 数值颜色 | `gold` / `red` / `blue` / `green` / `cyan` | `red` / `green` / `amber` / `blue` |
| 标签 | `.label` | `.lbl` |
| 变化量 | `.delta` | `.delta` |
| 变化方向 | `up`(红) / `down`(绿) / `flat`(灰) | `up`(红) / `down`(绿) |
| 溯源引用 | `.d-ref` | `.d-ref` |

## 章节结构

| 元素 | P6="纯网页版" | P6="A4分页版" |
|------|--------------|---------------|
| 主内容包裹 | `.content` | —（`.page` 即容器） |
| 章节容器 | `.section` | `.page` |
| 章节编号 | — | `.chapter-num` |
| 章节标题 | `h2` | `.chapter-title` |
| 章节描述 | `.lead` | `.chapter-desc` / `.sec-desc` |
| 子标题 | `h3` / `h4` | `h3` / `h4` |
| 段落（首行缩进） | `p` | `p` |
| 段落（无缩进） | `p.noid` | `p.noid` |
| 页码 | — | `.page-num` |

## 图表容器

| 元素 | P6="纯网页版" | P6="A4分页版" |
|------|--------------|---------------|
| 默认 | `.chart-wrap`（440px） | `.chart-box`（280px） |
| 加高 | `.chart-wrap.tall`（540px） | `.chart-box.tall`（340px） |
| 矮化 | `.chart-wrap.short`（340px） | `.chart-box.short`（220px） |
| 迷你 | `.chart-wrap.xs`（240px） | `.chart-box.xs`（200px） |
| 图表 DOM ID | `#chart-N` | `#chart-N` |
| 图表说明 | `.chart-caption` | `.chart-caption` |

> 🔴 **图表内层 div 强制规范**：每个 `#chart-N` 容器必须设置 `style="width:100%;height:100%;"` 以继承外层 `.chart-box` / `.chart-wrap` 的固定高度。**仅设 `width:100%` 而不设 `height` 会导致 ECharts 容器高度为 0 → canvas 0×0 → 图表不可见。** 正确写法：
> ```html
> <div class="chart-box">
>   <div id="chart-1" style="width:100%;height:100%;"></div>
>   <p class="chart-caption">图1：...</p>
> </div>
> ```

## 表格

| 元素 | 类名 | 适用范围 |
|------|------|---------|
| 通用表格 | `table` / `th` / `td` | 两套通用 |
| 滚动包裹 | `.tbl-wrap` | 仅 A4 版 |
| 建议分级行 | `tr.urgent` / `tr.shortterm` / `tr.midterm` / `tr.structural` | 仅暗色版，需配合 `table.rec-table` |
| 行高亮 | `tr.highlight-row` | 仅 A4 版 |
| 红色标记 | `.flag-red` | 两套通用 |
| 绿色标记 | `.flag-green` | 两套通用 |
| 黄色标记 | `.flag-amber` | 两套通用 |

## 归因链

| 元素 | 类名 | 说明 |
|------|------|------|
| 容器 | `.cause-chain` | 两套通用 |
| 结构性原因 | `.c-struct` | 紫色文字 |
| 远因 | `.c-far` | 橙色文字 |
| 近因 | `.c-near` | 红色文字 |
| 箭头 | `.c-arrow` | 金色箭头 |

## 假说验证表格

| 元素 | 类名 |
|------|------|
| 容器 | `.hypothesis-table` |
| 追溯链 | `.hypothesis-trace` |
| 支持行（绿左边框） | `tr.supported` |
| 部分支持（黄左边框） | `tr.partial` |
| 不支持（红左边框） | `tr.refuted` |
| 存疑（灰左边框） | `tr.uncertain` |
| 状态徽章基类 | `.status-badge` |
| 支持徽章 | `.status-badge.supported` |
| 部分支持徽章 | `.status-badge.partial` |
| 不支持徽章 | `.status-badge.refuted` |
| 存疑徽章 | `.status-badge.uncertain` |

## Safety Lifecycle 面板

| 元素 | 类名 |
|------|------|
| 容器 | `.lifecycle-stage` |
| 阶段标签 | `.stage-badge` |
| 五维指标网格 | `.stage-metrics` |
| 单维度指标 | `.stage-metric` |
| 指标分值 | `.metric-score` |
| 指标名称 | `.metric-label` |
| 脆弱性列表（2列） | `.vulnerability-list` |
| 脆弱性条目 | `.vulnerability-item` |

## 情景卡片

| 元素 | 类名 | 说明 |
|------|------|------|
| 网格 | `.scenario-grid` | 自适应列数 |
| 卡片 | `.scenario-card` | |
| 置信度-高 | `.confidence.high` | 绿色 |
| 置信度-中 | `.confidence.medium` | 黄色 |
| 置信度-低 | `.confidence.low` | 红色（`#fdeaea` 底 / `var(--danger)` 字） |

## 建议卡片

| 元素 | 类名 | 说明 |
|------|------|------|
| 网格 | `.advice-grid` | 2列 |
| 紧急建议 | `.advice-card.urgent` | 红左边框 |
| 短期建议 | `.advice-card.short` | 橙左边框 |
| 中期建议 | `.advice-card.mid` | 绿左边框 |
| 制度建议 | `.advice-card.structural` | 紫左边框 |
| 建议标题 | `.advice-header` | |
| 建议正文 | `.advice-body` | |
| 建议溯源 | `.advice-trace` | |

## 辅助组件

| 组件 | 类名 | 适用范围 |
|------|------|---------|
| 预警盒子 | `.alert-box` + `.alert-item` | 两套通用 |
| 预警序号 | `.alert-rank` | 仅暗色版 |
| 信息框（蓝） | `.callout` | 两套通用 |
| 信息框（红） | `.callout.red` | 两套通用 |
| 信息框（黄） | `.callout.amber` | 两套通用 |
| 信息框（绿） | `.callout.green` | 仅暗色版 |
| 信号溯源 | `.signal-ref` | 两套通用 |
| 文字高亮 | `.highlight` | 两套通用 |
| 文字强调 | `.emph`(红) / `.emph-g`(绿) / `.emph-w`(黄) | 仅 A4 版 |
| 内联小标签 | `.tag-sm.danger` / `.warn` / `.ok` | 仅 A4 版 |
| 徽章 | `.badge.red` / `.yellow` / `.green` / `.blue` / `.purple` | 仅暗色版 |
| 局限性声明容器 | `.limitations` | 两套通用 |
| 脚注文字 | `.footnote` | 仅 A4 版 |
| 引用块 | `blockquote` | 仅暗色版 |

## 页脚

| 元素 | P6="纯网页版" | P6="A4分页版" |
|------|--------------|---------------|
| 页脚容器 | `footer` | `.footer` |
| 页码 | — | `.page-num`（每页底部） |

> **A4 页脚格式**：由 P8 参数决定。默认格式为 `本报告由 deep-analysis-toolkit-v3 生成 · 数据版本 XXXXXXXX · 编制日期 XXXX-XX-XX`，通过 `text-align:center` 居中、`line-height:1.7` 保证长文本自然折行。

## 使用规则

1. **P6 参数决定列**：P6="纯网页版" → 使用暗色版列；P6="A4分页版" → 使用 A4 版列
2. **共用类名直接使用**：两套主题均支持的类名不区分版本
3. **互斥类名不混用**：表中注明"仅xx版"的类名，必须在 P6 匹配时才输出对应 HTML
4. **本表为权威来源**：生成骨架 HTML 时，所有类名必须能在本表或阶段 7 的 HTML 骨架示例中找到。不确定的类名 → 不存在 → 不要凭空创造
