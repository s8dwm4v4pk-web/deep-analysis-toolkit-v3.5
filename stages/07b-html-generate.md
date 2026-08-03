# 阶段 7b：HTML 生成

> **认知层次**：表达层 — 从叙事蓝图生成自包含 HTML 报告
> **本轮核心原则**：忠实翻译蓝图，不改变叙事内容。工程服务于认知。

---

## §0 文件锚定（强制执行）

> 执行 `stages/_shared-anchor.md` 定义的**[轻量锚定（表达层专用）]**：读取 `.analysis-session` → 提取 `work_dir`。**禁止读取 `analysis-state.md`**——7b 的唯一内容来源是 `blueprint.md`，~200KB+ 的分析状态文件不应进入本阶段上下文。

---

## §-1 蓝图读取与结构校验

> 🔴 **7b 的唯一内容来源是 `{work_dir}/blueprint.md`**，不回退读取 `analysis-state.md` 中的分析章节。

### 步骤 A：读取蓝图

```
read_file {work_dir}/blueprint.md
```

### 步骤 B：蓝图结构校验（防用户手动编辑导致格式错误）

读取后逐项检查以下 7 项规则，任一不通过 → **HALT**，报告具体缺失/异常项并要求用户修复后重试：

| 检查项 | 判定规则 | 严重级别 |
|--------|---------|---------|
| 封面标题 | `## 封面信息` 下 `主标题` 字段非空 | **HALT** — 缺少报告标题，无法生成 |
| 章节数量 | blueprint 中 `## 章节 N：` 块数量 ≥ 元数据头「> 章节规划数量:」值 | **HALT** — 章节缺失，可能编辑时误删 |
| KPI 横幅 | `## KPI 横幅` 下表格行数 ≥ 3 | **WARN** — KPI 少于 3 个，报告信息量不足，但继续生成 |
| 假说验证表 | `## 假说验证总览` 下表格行数 ≥ 1 | **HALT** — 缺少假说验证数据，这是报告核心组成部分 |
| 建议层次 | `## 四层决策建议` 下至少包含 🔴 紧急 + 🟡 短期 | **HALT** — 建议层次不完整 |
| 局限性声明 | `## 局限性声明` 下内容非空 | **WARN** — 缺失影响报告可信度，但继续生成 |
| 图表数据 | 逐张检查：每张图表的数据块 JSON 可解析 | 单张缺失 → 该图降级为文字替代；全部缺失 → **HALT** |

> 蓝图校验通过后，P6/P7/P8 等参数从蓝图的元数据头（`> 报告格式:` 等行）中读取，不再回溯 `analysis-state.md`。

---

## §-2 主题加载（Vendor 加载之前）

根据蓝图元数据中的「报告格式」确定对应主题文件：

| 报告格式 | 主题文件 | 特征 |
|---------|---------|------|
| 纯网页版 | `themes/theme-dark.css` | 深色背景、金色主色调、连续滚动、适合屏幕阅读 |
| A4分页版 | `themes/theme-a4.css` | A4 幅面、深蓝封面渐变、浅色内页、适合打印/公文 |

> 🔴 **上下文纪律**：主题 CSS 由 `assemble-report.mjs` 在组装阶段自动内联，**LLM 不调用 `read_file` 读取 CSS 文件**。生成骨架 HTML 所需的全部 CSS 类名查阅 `references/methodology/theme-classes.md`（语义化类名速查表，不含样式代码）。LLM 在 HTML 中仅写入 `<link href="...">` 引用，由组装脚本内联 CSS 全文。

> 🔴 **类名锁死**：LLM 必须在生成骨架 HTML 之前调用 `read_file('references/methodology/theme-classes.md')` 将该表**全文加载至上下文**（~2KB，不可省略）。HTML 中使用的**每一个 CSS 类名必须从该表中选取**——不得发明、缩写、或跨主题照搬另一列的名称。
> - A4 分页版 → 使用右列名（`kpi-grid` / `kpi-card` / `val` / `lbl`）
> - 纯网页版 → 使用左列名（`stats-banner` / `stat-card` / `num` / `label`）
> - 混淆类名列 → `verify-report.mjs` 将因 CSS 未被激活而检测失败

> 🔴 **资源来源硬门禁**：主题 CSS 必须来自 SKILL 包内 `themes/` 目录。
> - ✅ 允许：`read_file('references/methodology/theme-classes.md')` 查阅类名速查表
> - ✅ 允许：在 HTML 中写入 `<link href="themes/theme-dark.css">` 或 `<link href="themes/theme-a4.css">` 引用
> - ❌ 禁止：手写 CSS 替代主题（即使颜色和布局"看起来一样"）
> - ❌ 禁止：调用 `read_file` 加载主题 CSS 文件进上下文
> - ❌ 禁止：只内联主题 CSS 的"摘要版"或"精简版"
> - 闸门 `verify-report.mjs` 会通过 CSS 指纹检查验证来源，非包内主题 → exit ≠ 0

---

## §-3 自包含声明（V3.4 Link-then-Inline 模式）

Vendor 库（echarts.min.js 等 ~1-3MB）**不再由 LLM 读取和内联**。改为骨架 + 脚本组装的 Link-then-Inline 模式：

- LLM 在 HTML 中使用标准 `<script src="references/vendor/echarts.min.js">` 引用 vendor 库
- CSS 使用标准 `<link rel="stylesheet" href="themes/theme-dark.css">` 引用主题
- 报告生成完毕后，运行 `node agent-tools/scripts/assemble-report.mjs` 完成内联
- 最后执行 `node agent-tools/scripts/verify-report.mjs` 质量闸门

🔴 **LLM 不得调用 `read_file` 加载 vendor 库源码**——这些大文件不进上下文。LLM 只需知道文件路径和 API（从模板文件获知）。详细步骤见下方"第一步：自包含策略"。

---

## 本轮职责

读取 `blueprint.md`（7a 产物，可能已被用户手动修改），将语义内容翻译为一份**自包含的、断网可用的、面向决策者的单文件 HTML 报告**。

7b 不产生任何新的分析结论、不修改蓝图中的叙事内容、不自行决定图表选型——一切图表规格已由 7a 在蓝图中写明。

---

## 第一步：自包含策略（V3.4 Link-then-Inline）

**绝对禁止 CDN 外部引用。报告必须断网双击直接可用。**

### 1a. LLM 阶段：路径预检 + 模板加载（必须先于骨架 HTML 生成执行）

在写入任何 `src`/`href` 引用之前，验证所有引用指向的资源确实在 SKILL 包内存在：

1. 根据蓝图元数据的「报告格式」确定主题文件路径（`themes/theme-dark.css` 或 `themes/theme-a4.css`）
2. 从蓝图的图表规格中提取所有使用的引擎名，按下表映射到 vendor JS 文件路径，用 `read_file` 仅读取文件**首行**确认存在——vendor 库体积 ~200KB-1MB，不加载进上下文：

| 引擎名 | vendor JS 文件路径 |
|--------|-------------------|
| ECharts | `references/vendor/echarts.min.js` |
| Chart.js | `references/vendor/chart.js.min.js` |
| ApexCharts | `references/vendor/apexcharts.min.js` |
| D3 | `references/vendor/d3.v7.min.js` |
| Three.js | `references/vendor/three.min.js` |
3. 从蓝图图表规格中汇总所有模板文件路径（蓝图中存储为 `echarts/radar.html` 等形式），拼接完整路径为 `references/templates/{模板文件}`，用 `read_file` **全量读取**（模板文件 ~1-5KB 每个，共 ~20-50KB，包含 IIFE 代码块）。读取即确认存在——文件不存在时 `read_file` 返回错误，此时报告具体缺失文件并中断，**不得**使用替代路径绕过。🔴 **读取后上下文中将保有每个模板的完整 IIFE 结构（外壳、变量声明、echarts.init、setOption、resize 监听）。生成图表脚本时必须逐字复制这些结构，仅将示例数据替换为蓝图数据。不得将多个模板的 IIFE 合并、不得提取共性创建辅助函数、不得在模板 IIFE 之外创建第二次 `echarts.init()` 调用。** 详见下方 §1b-1 图表脚本生成铁律
4. 任一文件不存在 → 报告具体缺失文件，**不得**使用替代路径绕过

### 1b. LLM 阶段：生成骨架 HTML

在 HTML 中使用标准 `src` / `href` 引用 SKILL 包内资源，**不内联 vendor 库源码**：

| 需要 | 在 HTML 中写入 | 体积 |
|------|---------------|------|
| 主题 CSS | `<link rel="stylesheet" href="themes/theme-dark.css">` 或 `href="themes/theme-a4.css"` | ~5-10KB |
| ECharts（默认引擎） | `<script src="references/vendor/echarts.min.js"></script>` | ~1MB |
| ApexCharts（甘特图/径向柱图/K线） | `<script src="references/vendor/apexcharts.min.js"></script>` | ~510KB |
| D3（力导向/PCA/凸包/频谱图等） | `<script src="references/vendor/d3.v7.min.js"></script>` | ~273KB |
| Chart.js（仅基础图表） | `<script src="references/vendor/chart.js.min.js"></script>` | ~196KB |
| Three.js（3D 图表） | `<script src="references/vendor/three.min.js"></script>` | ~654KB |

**图表初始化脚本**（IIFE + try-catch）保持**内联**写入——7b 读取模板文件获得 IIFE 代码块，将其内联到骨架 HTML 中，替换蓝图中指定的数据。

**硬约束**：
- ❌ 报告中**不得出现**任何 `http://` 或 `https://` CDN 引用（组装脚本会直接报错退出）
- ✅ 所有 CSS/JS 引用必须使用 SKILL 包内相对路径（如 `themes/...`、`references/vendor/...`）
- ✅ 图表模板 IIFE（从 `references/templates/echarts/*.html` 复制）直接内联到 HTML 中
- ✅ 骨架 HTML 可用浏览器直接预览（CSS 和 JS 通过 src/href 正常加载，方便调试）
- 🔴 **LLM 不得调用 `read_file` 加载 vendor 库**——只需知道文件路径和 API（从模板文件获知）
- 🔴 **甘特图引擎硬门禁**：凡蓝图内标记为「甘特图 / Gantt / 时间区间 / rangeBar」的图表，**必须**使用 ApexCharts 模板 `references/templates/apexcharts/gantt.html`，**禁止**用 ECharts `type:'time'` + `type:'bar'` 手写甘特图。ApexCharts 的 `rangeBar` 原生支持区间数据 `y: [start_timestamp, end_timestamp]`，无需 `encode` 映射。若蓝图含甘特图，vendor 引用表必须同时包含 `<script src="references/vendor/apexcharts.min.js">`——缺失 → `assemble-report.mjs` 缺失 ApexCharts 库 → 甘特图区域空白
- 🔴 **图表脚本独立性硬门禁**：每张图表的初始化代码必须是独立的 `<script>...</script>` IIFE 块，一对一复制自模板文件，仅替换数据。禁止创建共享 `init` 辅助函数、禁止合并多个图表脚本到同一 script 标签、禁止在图表 IIFE 之外创建第二次 `echarts.init()` 调用。任何形式的图表脚本"优化合并"均属违规。详见 §1b-1 图表脚本生成铁律
- 🔴 **资源来源硬门禁**：所有 vendor JS 必须来自 SKILL 包内路径，闸门 `verify-report.mjs` 会对每个使用的库执行特征 API 指纹验证，来源不一致 → exit ≠ 0

### 1b-1. 🔴 图表脚本生成铁律（模板逐字复制 + 数据替换，零即兴发挥）

> 7b 唯一合法操作：读取模板 → 复制其完整 IIFE 结构 → 将示例数据替换为蓝图数据。**模板结构（IIFE 外壳、变量声明、echarts.init、setOption、resize 监听）一行不改、一行不删。**

#### 六条铁律

| # | 规则 | 说明 |
|---|------|------|
| **1** | 每图一 `<script>` 块 | 每张图表 = 一个独立的 `<script>...</script>` 块。禁止将多张图表的初始化代码合并到同一个 script 标签内 |
| **2** | 变量不跨图共享 | 每张图表使用独立变量作用域（IIFE 提供的函数作用域），禁止在图与图之间共享变量名 |
| **3** | 禁止创建共享辅助函数 | 禁止任何形式的 `var init=function(id,opt){...}`、`function makeChart(...){...}` 等包装函数 |
| **4** | 禁止创建"注册表"二次 init | 禁止 `var _cr={}; _cr.c1=echarts.init(...)` — 这会导致同一 DOM 被 `echarts.init()` 两次 → ECharts 控制台报 Warning |
| **5** | 模板结构完整保留 | 模板中的 IIFE 外壳 `(function() { ... })()`、`echarts.init()`、`myChart.setOption(...)`、`window.addEventListener('resize', ...)` — 全部一对一逐字复制 |
| **5a** | 🔴 变量名一致性自检 | 模板中的变量名（dom / chart / options / myChart）是模板**结构**的一部分，不属于"数据"——**禁止重命名**。若必须重命名（如 `dom` → `chartDom`），则 IIFE 内所有引用点必须同步更新：包括 guard check `if (!dom)`、`echarts.init(dom)`、`new ApexCharts(dom, options)`。后处理管线 `fix-chart-varname.mjs`（5A-0.5）会自动检测并修复不一致 |
| **6** | 仅替换数据 | 模板中唯一允许修改的部分：示例数据数组/对象字面量 → 替换为蓝图指定的真实数据 |

#### 🔴 铁律 #7：custom 系列 renderItem 数据访问规范

> 当模板使用 `type: 'custom'` + `renderItem` 且同时声明了 `encode` 时，
> **禁止**在 renderItem 函数体内通过 `params.data.xxx` 访问原始数据属性。
> 原因：`encode` 会触发 ECharts 对 data item 进行内部格式变换，
> 原始对象属性（如 `params.data.b`）可能变为 undefined，
> 导致 `api.coord([undefined, ...])` → NaN → 整图空白。
>
> **正确做法**：使用 `api.value(N)` 按 encode 声明的维度序号获取值：
> - `api.value(0)` → encode 中 y 维度（通常为序列索引）
> - `api.value(1)` → encode 中第一个 x 维度
> - `api.value(2)` → encode 中第二个 x 维度
>
> ```javascript
> // ❌ 禁止：依赖原始属性名
> renderItem: function(params, api) {
>   const x1 = api.coord([params.data.before, 0])[0];  // 可能为 undefined
> }
>
> // ✅ 正确：按维度序号取值
> renderItem: function(params, api) {
>   const x1 = api.coord([api.value(1), 0])[0];  // 始终可靠
> }
> ```

#### 🔴 铁律 #8：gauge 系列禁止 markLine / markArea / markPoint

> `markLine`、`markArea`、`markPoint` 是笛卡尔坐标系（grid + xAxis/yAxis）的标注组件。
> `type: 'gauge'` 仪表盘没有 grid，setOption 时传入 markLine 会直接报错，
> 导致该图表 IIFE 内部抛异常、整张仪表盘不渲染。
>
> 若需要在仪表盘上标注阈值线，应使用 `axisLine.lineStyle.color` 的分段色条
> 或 `detail.formatter` 来呈现"达标/未达标"判断，而非 markLine。

#### 禁止行为速查表

| 违规行为 | ❌ 错误做法示例 | 后果 |
|----------|----------------|------|
| 共享 init 辅助函数 | `var init=function(id,opt){var c=echarts.init(document.getElementById(id));c.setOption(opt);}; init('chart-1',{...}); init('chart-2',{...});` | 脚本管线（`ensure-contain-label.mjs` / `safeguard-echarts-grid.mjs`）无法精确匹配单张图表 |
| 合并多图脚本 | 一个 `<script>` 块内包含 16 个 `setOption` 调用 | 同上 |
| 重复初始化注册表 | `var _cr={}; try{_cr.c1=echarts.init(document.getElementById("chart-1")); _cr.c2=echarts.init(document.getElementById("chart-2")); ...}catch(e){}` | 每个 DOM 被 `echarts.init()` 两次，控制台报 `There is a chart instance already initialized` |
| 绕过模板手写配置 | 不读模板文件，直接手写 `setOption({xAxis:{...},series:[...]})` | 缺少模板预设的 grid 间距、containLabel 等关键参数 |
| 删除 resize 监听 | 复制模板时删掉 `window.addEventListener('resize', () => myChart.resize())` | 断网双击窗口变化时图表不响应 |

#### ✅ 正确示例

以下示例来自模板 `references/templates/echarts/radar.html`，**唯一被修改的是数据变量 `indicators` 和 `seriesData` 的值**。其余一切——IIFE 外壳、`const dom`、`echarts.init`、`setOption` 调用、`resize` 监听——均来自模板逐字复制：

```html
<!-- 图14：Safety Lifecycle 七维雷达图 — 模板 references/templates/echarts/radar.html -->
<script>
(function() {
  const dom = document.getElementById('chart-14');
  if (!dom) return;
  const myChart = echarts.init(dom);
  // ▼▼▼ 仅以下数据从蓝图替换模板中的示例数据 ▼▼▼
  const indicators = [
    { name: '制度化', max: 4 },
    { name: '数据质量', max: 4 },
    { name: '风险响应', max: 4 },
    { name: '改善趋势', max: 4 },
    { name: '文化成熟度', max: 4 },
    { name: '资源配置效率', max: 4 },
    { name: '战略前瞻性', max: 4 }
  ];
  const seriesData = [
    { name: '觉醒期(1.6)', value: [2, 2, 1, 1, 2, 1.5, 1] }
  ];
  // ▲▲▲ 以上为唯一被替换的部分 ▲▲▲
  try {
    myChart.setOption({
      legend: { data: seriesData.map(d => d.name), bottom: 0 },
      radar: { indicator: indicators, center: ['50%', '50%'], radius: '55%' },
      series: [{ type: 'radar', data: seriesData, areaStyle: { opacity: 0.1 } }]
    });
  } catch(e) {}
  window.addEventListener('resize', () => myChart.resize());
})();
</script>
```

> 🔴 关键对比：上述代码中 **没有 `var init=function`**、**没有 `_cr=` 注册表**、**没有合并多图**。IIFE 外壳、init、setOption、resize 均从模板文件逐字复制，仅数据值被替换。

#### 上下文记忆提示

在进入 HTML 生成之前，LLM 上下文中已有每个模板的完整 IIFE 代码（来自 §1a 步骤 3 的 `read_file`）。生成图表脚本时应：

1. 为蓝图中的每张图表在上下文中找到其对应的模板 IIFE
2. 复制该模板的完整 IIFE 代码
3. 将模板中的示例数据替换为蓝图数据
4. 将模板中的 `id` 属性（如 `chart-radar`）替换为蓝图分配的 `chart-{N}`
5. 包裹为 `<script>...</script>` 块，按章节顺序插入 HTML

**禁止的"简化思维"**：以为"16 个图表本质都是 `echarts.init + setOption`，可以提取共性"——这种归类思维正是导致后续脚本管线失效的根源。图表脚本的独立性是架构约束，不是代码风格建议。

### 1c. 组装阶段：运行 assemble-report.mjs

骨架 HTML 生成完毕后，在 **同一 session** 中立即运行组装脚本。路径使用 §0 锚定获取的 `work_dir` 拼接，**不得凭记忆手写**：

```
node agent-tools/scripts/assemble-report.mjs {work_dir}/report-skeleton.html {work_dir}/report.html
```

组装脚本会：
1. 解析骨架 HTML 中的所有 `<link href="...">` → 读取文件 → 替换为 `<style>全文</style>`
2. 解析骨架 HTML 中的所有 `<script src="...">` → 读取文件 → 替换为 `<script>全文</script>`
3. 禁止 CDN 引用（`http://` / `https://`）→ 发现立即 exit ≠ 0
4. 文件不存在 → 立即 exit ≠ 0
5. 残留引用检测 → 发现残留立即 exit ≠ 0
6. 输出最终文件大小（超过 3MB → warn）

#### P7 参数提取规范（从蓝图元数据头提取，用于拼接 verify CLI flag）

> ⚠️ verify-report.mjs 的四个 flag（`--min-total`、`--min-advanced`、`--min-multi`、`--min-dim`）均为**必需参数**，缺失即报错退出。LLM 必须完整提取四个值并传入，不得遗漏。

> 🔴 这四个值由 7a 写入 `blueprint.md` 的元数据头（`> P7-xxx:` 和 `> P5-xxx:` 行）。**无需回溯 `analysis-state.md`**——蓝图已自包含全部验证参数。

1. 在上下文中定位蓝图元数据头中的以下四行：
   ```
   > P7-图表阈值-min-total: N
   > P7-图表阈值-min-advanced: N
   > P7-图表阈值-min-multi: N
   > P5-多维最低维度: N
   ```
2. 提取各数值：
   - `min-total` → `--min-total` flag
   - `min-advanced` → `--min-advanced` flag
   - `min-multi` → `--min-multi` flag
   - `min-dim` → `--min-dim` flag
3. 四个字段**全部提取成功**后方可拼接 CLI flag
4. 任一字段缺失或不可解析 → **HALT**，报告缺失字段名称及"蓝图元数据头不完整，请检查 7a 是否已升级至包含 P7/P5 参数的版本"

### 1d. 验证阶段：运行 verify-report.mjs

从上下文中的 P7 阈值和 P5 维度值，按上述规范提取四个数值，拼接 CLI flag。路径从 `work_dir` 字段读取：

```
node agent-tools/scripts/verify-report.mjs {work_dir}/report.html --min-total=<N> --min-advanced=<N> --min-multi=<N> --min-dim=<N>
```

> 示例（标准模式）：`node agent-tools/scripts/verify-report.mjs {work_dir}/report.html --min-total=12 --min-advanced=3 --min-multi=1 --min-dim=4`
> 示例（精简模式）：`node agent-tools/scripts/verify-report.mjs {work_dir}/report.html --min-total=8 --min-advanced=2 --min-multi=1 --min-dim=4`
> 示例（详尽模式）：`node agent-tools/scripts/verify-report.mjs {work_dir}/report.html --min-total=16 --min-advanced=5 --min-multi=2 --min-dim=4`

> 注意：验证目标为**组装后的** `report.html`，不是骨架 `report-skeleton.html`。

exit code ≠ 0 → 修复骨架 HTML 后重新组装 + 验证。

---

## 第二步：HTML 层次组织

**章节命名硬规则**：必须使用蓝图中给定的章节名，**一字不改**。7b 不得自行重命名章节。这是防止模板化标题（如"区域对比分析"）替代发现导向标题（如"五处片区：唯一的恶化区域"）的硬约束。

**语言素材注入**：蓝图正文中已包含了阶段 6 语言素材库中的表达（7a 已代入）。7b 直接使用蓝图正文，不自行修改措辞。

---

### 若报告格式 = "A4分页版" → 使用 themes/theme-a4.css

**CSS 已由主题文件预设，不得自行手写或改写**：

主题文件 `themes/theme-a4.css` 已经提供了封面（`.page.cover`）、内页容器（`.page`）、KPI 卡片、归因链、表格、建议卡片、情景卡片、callout、警报、局限性声明、页脚等全部组件的 CSS。**通过 `<link href="themes/theme-a4.css">` 引用，由 `assemble-report.mjs` 在组装阶段内联，不修改、不删减、不覆盖。**

A4 分页版 HTML 骨架：

```html
<body>
  <!-- 封面页 -->
  <div class="page cover">
    <div class="cover-top">
      <div class="tag">深度分析报告</div>
      <h1>{蓝图封面信息 - 主标题}</h1>
    </div>
    <div class="cover-date">报告编制日期：{蓝图生成日期}</div>
  </div>

  <!-- 内页（每章一个 .page） -->
  <div class="page">
    <div class="chapter-num">第一部分</div>
    <div class="chapter-title">{蓝图章节名}</div>
    <div class="chapter-desc">{蓝图核心问题}</div>
    <!-- {蓝图正文} -->
    <div class="page-num">1</div>
  </div>

  <!-- 第一章（核心指标总览）额外内嵌 KPI 横幅页 -->
  <div class="page">
    <div class="chapter-num">第一部分</div>
    <div class="chapter-title">{核心指标章节名}</div>
    <div class="chapter-desc">{蓝图核心问题}</div>

    <!-- 🔴 A4 主题 KPI 卡片：必须使用以下类名套系，严禁替换或发明新名 -->
    <div class="kpi-grid">
      <div class="kpi-card"><div class="val red">{数值}</div><div class="lbl">{指标名}</div><div class="delta up">↑{变化幅度}</div></div>
      <div class="kpi-card"><div class="val green">{数值}</div><div class="lbl">{指标名}</div><div class="delta down">↓{变化幅度}</div></div>
      <div class="kpi-card"><div class="val amber">{数值}</div><div class="lbl">{指标名}</div><div class="delta">→{变化幅度}</div></div>
      <div class="kpi-card"><div class="val blue">{数值}</div><div class="lbl">{指标名}</div><div class="delta up">↑{变化幅度}</div></div>
    </div>
    <!-- 🔴 类名止于此处。颜色后缀（.val 子类）：red / green / amber / blue；方向后缀（.delta 子类）：up / down（A4 主题无 .flat） -->
    <!-- 字号、边距、圆角、阴影均由 theme-a4.css 预设，不得手写 style="" -->

    <!-- {蓝图正文（从 KPI 解读开始）} -->
    <div class="page-num">2</div>
  </div>

  <!-- ...更多 .page -->

  <!-- 页脚 -->
  <div class="footer">{根据蓝图元数据中的页脚格式渲染}</div>
</body>
```

封面和内页使用同一个 `.page` 容器（封面额外加 `.cover`），所有 CSS 由 `theme-a4.css` 统一定义，无需额外隔离。

**A4 封面标题来源**（由蓝图元数据「封面标题来源」决定）：
- 「自动」→ 使用蓝图元数据「封面标题文本」（7a 已从叙事主线提取）
- 「用户输入文本」→ 直接使用蓝图元数据「封面标题文本」

**A4 页脚来源**（由蓝图元数据「页脚格式」决定）：
- 「默认」→ 固定格式 `<div class="footer">本报告由 deep-analysis-toolkit-v3 生成 · 数据版本 {hash前8位} · 编制日期 YYYY-MM-DD</div>`
- 用户自定义文本 → `<div class="footer">{用户输入文本}</div>`
- 「无」→ 不输出 `.footer` 元素

---

### 若报告格式 = "纯网页版" → 使用 themes/theme-dark.css

**CSS 已由主题文件预设，不得自行手写或改写**：

主题文件 `themes/theme-dark.css` 已经提供了封面（`.cover`）、章节面板（`.section`）、KPI 横幅（`.stats-banner .stat-card`）、图表容器（`.chart-wrap`）、表格、归因链（`.cause-chain`）、建议卡片、情景卡片、callout、警报、局限性声明等全部组件的 CSS。**通过 `<link href="themes/theme-dark.css">` 引用，由 `assemble-report.mjs` 在组装阶段内联，不修改、不删减、不覆盖。**

纯网页版 HTML 骨架：

```html
<body>
  <!-- 封面 -->
  <div class="cover">
    <div class="tag">深度分析报告</div>
    <h1>{蓝图封面信息 - 主标题}</h1>
    <p class="subtitle">{蓝图封面信息 - 副标题} · {数据周期}</p>
    <div class="divider"></div>
    <p class="org">{分析对象} · {数据来源}</p>
  </div>

  <!-- KPI 横幅 -->
  <div class="stats-banner">
    <div class="stat-card"><div class="num gold">{数值}</div><div class="label">{指标名}</div><div class="delta up">↑{变化幅度}</div></div>
    <!-- ... -->
  </div>
  <!-- 🔴 以上 .stats-banner / .stat-card / .num / .label / .delta 类名仅用于纯网页版（theme-dark.css），严禁照搬到 A4 分页版。A4 必须使用 kpi-grid / kpi-card / val / lbl / delta 套系 -->

  <!-- 主内容 -->
  <div class="content">
    <div class="section">
      <h2>{蓝图章节名}</h2>
      <!-- {蓝图正文 + 图表} -->
    </div>
    <!-- ... -->
  </div>

  <!-- 页脚 -->
  <footer>{根据蓝图元数据中的页脚格式渲染}</footer>
</body>
```

**注意**：纯网页版是连续滚动布局（没有分页），`.cover` 和 `.section` 之间自然衔接。所有图表容器适应浏览器窗口宽度，不设 `max-height: 140mm` 等打印约束。

---

两种版本均保持响应式、打印友好。

```html
1. 样式层: <link rel="stylesheet" href="themes/...">（按蓝图元数据中「报告格式」互斥选择，由 assemble-report.mjs 内联）
2. 结构层: <body>  (按蓝图章节组织)
3. 引擎层: <script src="references/vendor/...">（由 assemble-report.mjs 内联）
4. 图表层: <script> (图表初始化，IIFE隔离，直接内联)
5. 交互层: <script> (响应式、导出，渐进增强，直接内联)
```

---

## 第三步：ECharts grid 安全间距（脚本接管）

> 🔴 **脚本接管**：ECharts 图表的 `containLabel` 注入和 grid 安全间距修正由后处理脚本管线全权负责。LLM 生成骨架 HTML 时**仅保留模板中的默认 grid 值即可**，不手工设定间距百分比。

**脚本执行顺序**（在第五步·A 脚本管线中自动运行）：

| 步骤 | 脚本 | 功能 |
|------|------|------|
| 5A-1 | `ensure-contain-label.mjs` | 扫描所有 ECharts grid 配置，自动注入 `containLabel: true` |
| 5A-2 | `safeguard-echarts-grid.mjs` | 校验 grid.left/right/top/bottom 符合安全间距规则，不达标自动修正 |

这两个脚本按 6 种场景规则（y轴长标签 / 底部legend / 双Y轴 / 右侧legend 等）自动调整 grid 百分比，覆盖 LLM 手工设定可能产生的遗漏或错误。

> 注意：`references/templates/echarts/` 下的模板均已包含默认 grid 值，复制时保留这些值，不要删除或缩减。**不要在复制后手工修改 grid 百分比值**——脚本管线会统一处理。

---

## 第四步：ECharts 布局时序修复（强制）

> 🔴 **所有报告必须在 `</body>` 闭合前包含以下脚本。有 ECharts 图表就必须有这段，不区分报告格式。**

**根因**：内联 `<script>` 中的 `echarts.init(el)` 在 HTML 解析阶段立即执行——此时 CSS 布局尚未完成计算，容器尺寸为 0×0 → canvas 为 0×0 → 图表不可见。打开 DevTools 触发的 resize 事件临时修复了它，但断网双击时不会触发。

**修复**：`load` + 双 `requestAnimationFrame` 确保在至少两次 repaint 后，容器有了真实的渲染尺寸，再批量 `.resize()` 所有图表实例。

**插入位置**：交互层之后、`</body>` 之前。代码块直接复制，不改动：

```html
<!-- ECharts 布局时序修复：CSS 布局完成后批量 resize 所有图表实例 -->
<script>
(function() {
  window.addEventListener('load', function() {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        try {
          var charts = document.querySelectorAll('[id^="chart-"]');
          charts.forEach(function(el) {
            var instance = echarts.getInstanceByDom(el);
            if (instance) { instance.resize(); }
          });
        } catch(e) {}
      });
    });
  });
})();
</script>
```

> `getInstanceByDom` 只操作已通过 `echarts.init()` 初始化的实例，无实例时静默跳过。双 RAF 保证跨两个 repaint 周期，比单 RAF 或 `setTimeout` 更稳定。

**验收闸门**：`agent-tools/scripts/verify-report.mjs` 检测 `echarts.init()` 存在时是否同时存在 `getInstanceByDom` 调用 — 缺 → exit ≠ 0。

---

## 第五步：自动验收

```
node agent-tools/scripts/verify-report.mjs {work_dir}/report.html --min-total={P7总计} --min-advanced={P7高级} --min-multi={P7多维} --min-dim={P5维度值}
```

exit code ≠ 0 → 修复后重新验证。

---

## 第五步·A：HTML 后处理脚本管线（强制）

> 🔴 **脚本接管**：verify-report.mjs exit=0 后，必须依序执行以下 7 个脚本。顺序不可调换——后者依赖前者的修复成果。任一脚本 exit ≠ 0 → HALT 并报告具体错误。

### 5A-0：图表 DOM 容器完整性校验

```bash
node agent-tools/scripts/validate-chart-dom.mjs "{work_dir}/report.html" --fix
```

**功能**：扫描所有 ECharts / Chart.js 图表初始化脚本，校验每个 `echarts.init(el)` / `new Chart(ctx)` 对应的 DOM 容器（`id="chart-{N}"`）是否在 HTML 中确实存在。缺失 → `--fix` 自动补全容器 `<div>`。同时检测图表容器的变量形式声明（如 `document.querySelector('[id^="chart-"]')`），确保不被遗漏。

> 此脚本必须在 5A-1（containLabel 注入）之前执行——容器必须先就位，后续脚本才能修正 grid 间距和标签。
> exit ≠ 0 → HALT，报告缺失容器的图表编号。

### 5A-0.5：图表变量名一致性自动修复

```bash
node agent-tools/scripts/fix-chart-varname.mjs "{work_dir}/report.html"
```

**功能**：扫描所有 ECharts / ApexCharts 图表 IIFE，检测声明行（`const XXX = document.getElementById(...)`）与后续引用（guard check / `echarts.init()` / `new ApexCharts()`）之间的变量名是否一致。不一致 → 自动修复为声明行变量名。

**常见不一致模式**（LLM 生成时的"部分重命名"幻觉）：
- 声明 `const chartDom = ...` → guard 用 `if (!dom) return;`（❌ 变量未定义，全部图表不渲染）
- 声明 `const dom = ...` → `echarts.init(chartDom)`（❌ 引用未声明变量）

> 此脚本在 5A-0（DOM 容器校验）之后、5A-1（containLabel 注入）之前执行——变量名先统一，后续脚本才能精确匹配图表 IIFE。
> exit ≠ 0 → HALT，报告不一致的图表编号。修复后的文件直接覆盖原文件。

### 5A-1：ECharts containLabel 强制注入

```bash
node agent-tools/scripts/ensure-contain-label.mjs "{work_dir}/report.html"
```

**功能**：扫描所有 ECharts grid 配置，确保 `containLabel: true` 已设置。缺则注入。这是 `safeguard-echarts-grid` 的前置条件。

> exit ≠ 0 → HALT，报告注入失败的图表编号。

### 5A-2：ECharts grid 安全间距校验

```bash
node agent-tools/scripts/safeguard-echarts-grid.mjs "{work_dir}/report.html"
```

**功能**：校验每个 ECharts 图表的 grid.left/right/top/bottom 符合安全间距规则。不达标则按模板规则自动修正。

> exit ≠ 0 → HALT，报告 spacing 异常的图表编号和具体偏差。

### 5A-3：图表居中对齐

```bash
node agent-tools/scripts/center-chart.mjs "{work_dir}/report.html"
```

**功能**：将图表容器内容水平和垂直居中，修正偏移。适用于纯网页版和 A4 分页版。

> exit ≠ 0 → 记录警告但继续（居中为视觉优化，非阻断性错误）。

### 5A-4：图表高度自适应

```bash
node agent-tools/scripts/taller-chart.mjs "{work_dir}/report.html"
```

**功能**：检测图表容器高度不足（内容溢出），自动增大 chart-container min-height。适用于复杂图表（如桑基图、雷达图）在大屏上显示过小的情况。

> exit ≠ 0 → 记录警告但继续。

### 5A-5：溢出修复

```bash
node agent-tools/scripts/fix-overflow.mjs "{work_dir}/report.html"
```

**功能**：检测并修复 HTML 元素溢出——长文本、宽表格、图表 canvas 超出容器边界。

> exit ≠ 0 → HALT，报告溢出元素位置和溢出量。

### 5A-6：A4 图表高度修正

```bash
node agent-tools/scripts/fix-a4-chart-height.mjs "{work_dir}/report.html"
```

**功能**：对 A4 分页版报告，调整 `.chart-box` 高度防止跨页断裂。

> 若报告格式为"纯网页版" → 此脚本静默跳过（exit=0，无操作）。
> exit ≠ 0 → HALT，报告跨页断裂的图表编号。

### 5A-6.5：A4 分页版连续流覆盖（仅 A4 版执行）

```bash
node agent-tools/scripts/flatten-a4.mjs "{work_dir}/report.html"
```

**功能**：对 A4 分页版报告注入 `<style id="flatten-override">` CSS 块，将多页分页转为连续滚动流。在 `</head>` 前插入覆盖规则：取消 `break-after: page`、隐藏页码 `.page-num`、添加虚线分隔符。纯网页版跳过。

> 🔴 **仅 A4 分页版需要执行**——纯网页版跳过（exit=0，无操作）。
> exit ≠ 0 → HALT，报告注入失败原因。

---

## 第六步：人工快速检查

- [ ] 每个图表有数据、有标题
- [ ] 所有图表坐标轴标签完整可见，无裁切截断
- [ ] 图例文字不与坐标轴标签/轴名/图表区域重叠
- [ ] 图表总数 ≥ P7 总计阈值
- [ ] 高级图表 ≥ P7 高级阈值
- [ ] 多维可视化 ≥ P7 多维阈值（同时展示维度数 ≥ P5）
- [ ] **假说验证表格独立展示**（每条 S 信号的假说穷举+三级检验可视化，含 D 编号证据引用）
- [ ] **Safety Lifecycle 面板完整**（五维评分 + 阶段判定 + 脆弱性扫描）
- [ ] F12 控制台无报错
- [ ] 断网双击可正常打开
- [ ] 章节名是发现导向的（来自蓝图，一字不改）
- [ ] 每章开头有章节描述，告诉读者本章回答什么问题
- [ ] 每个图表旁有文字解读（不是只放图）
- [ ] 报告最后一章包含分层建议
- [ ] 报告有"局限性声明"章节（诚实标注分析边界）
- [ ] 报告有"数据质量声明"章节（引用阶段 1 QUALITY 评级和勾稽校验关键发现）
- [ ] 所有数值有单位或说明（百分比、元、人、天等，不能出现裸数字）
- [ ] 统计维度覆盖：总量、集中趋势、离散程度、分布形态、集中度、相关性
- [ ] 无内部标记泄漏（如"（红）（绿）"等内部批注文字残留）

---

## HTML 报告结构框架

**不使用固定模板。** 报告的章节结构完全由蓝图的章节列表动态决定。

### 动态章节生成规则

1. 从蓝图中读取**完整章节列表**（含章节名、核心问题、正文、图表规格）
2. 按蓝图给定的顺序组织章节——**不改顺序、不改标题、不改数量**
3. 章节数是 7a 的产物，不是本阶段的固定模板

### 必须包含的公共元素（无论章节结构如何）

以下元素是报告的"外壳"，与章节结构解耦，**必须**出现在报告中但不限定位置：

| 必需元素 | 位置 | 内容来源 |
|---------|------|---------|
| **封面区域** | 报告最前 | 蓝图「封面信息」：主标题 + 副标题 + 分析对象 + 数据来源 |
| **KPI 横幅** | 封面之后、首章之前 | 蓝图「KPI 横幅」表格：3-8 个核心数字 |
| **假说验证总览** | 归因分析章节中独立展示 | 蓝图「假说验证总览」表格（含三级检验状态） |
| **Safety Lifecycle 评估** | 紧随归因章节之后 | 蓝图「Safety Lifecycle 评估」：阶段判定 + 脆弱性扫描 + 跃迁条件 |
| **反事实推断小结** | 情景预判章节中 | 阶段 4 的反事实推演关键发现（已纳入蓝图正文） |
| **建议章节** | 报告后部 | 蓝图「四层决策建议」（紧急→短期→中长期→制度） |
| **数据质量声明** | 建议之后 | 蓝图「数据质量声明」 |
| **局限性声明** | 报告末尾 | 蓝图「局限性声明」 |
| **页脚** | 报告最末 | 由蓝图元数据「页脚格式」决定。禁止添加"自动"二字、"仅供内部决策参考"等自拟文字 |

### 章节间关系（由蓝图决定，非模板规定）

蓝图的章节顺序已由 7a 按阶段 6 的认知递进逻辑排定。本阶段的职责是：

- 确保 HTML 章节顺序与蓝图完全一致
- 确保解释（归因）紧跟在描述（现象）后面
- 不强行插入额外的"背景介绍"章节（除非蓝图中有）

### 假说验证展示规范

蓝图中的假说验证成果必须在报告中以独立表格呈现，不被溶解在归因文字中：

```html
<!-- 假说验证组件示例 -->
<div class="hypothesis-table">
  <h3>假说验证：{信号名称}</h3>
  <div class="hypothesis-trace">追溯链：S-xxx ← V-xxx ← O-xxx ← [D-xxx]</div>
  <table>
    <thead>
      <tr><th>假说</th><th>内容</th><th>验证状态</th><th>证据</th></tr>
    </thead>
    <tbody>
      <tr class="supported"><td>H1</td><td>...</td><td>✅ 支持</td><td>[D0.r5.c3]=X,...</td></tr>
      <tr class="partial"><td>H2</td><td>...</td><td>🟡 部分支持</td><td>趋势吻合但量级不匹配</td></tr>
      <tr class="refuted"><td>H3</td><td>...</td><td>❌ 不支持</td><td>[D0.r3.c6]=Y < 预期W</td></tr>
      <tr class="uncertain"><td>H4</td><td>...</td><td>⚠️ 存疑</td><td>需要分段数据</td></tr>
    </tbody>
  </table>
</div>
```

CSS 主题文件已预设 `.hypothesis-table` 样式（`.supported` 绿色、`.partial` 黄色、`.refuted` 红色、`.uncertain` 灰色）。

### 动态章节 HTML 生成模板

对于蓝图中的每个章节，按以下模式生成：

```html
<div class="section">
  <h2>{蓝图章节名——一字不改}</h2>
  <div class="chapter-desc">{蓝图核心问题}</div>
  
  <!-- {蓝图正文——直接使用，不修改措辞} -->
  
  <!-- 图表容器：纯网页版 → class="chart-wrap", A4分页版 → class="chart-box"
       高度由主题 CSS 统一控制（chart-wrap=440px, chart-box=280px），不得在外层内联 height -->
  <div class="{chart-wrap 或 chart-box}">
    <!-- 🔴 内层 div 必须同时写 width:100% 和 height:100%，否则 ECharts 容器高度为 0 → canvas 0×0 → 图表不可见 -->
    <div id="chart-{N}" style="width:100%;height:100%;"></div>
    <p class="chart-caption">{蓝图图表解读}</p>
  </div>
  
  <!-- 如有归因分析，紧接在现象描述后面 -->
</div>
```

---

## 格式与工程规范

本轮额外注意：
- 🔴 图表脚本 = 独立 `<script>` IIFE 块，逐字复制自 `references/templates/echarts/*.html`，仅替换数据。禁止创建共享 init 函数、禁止合并多图脚本、禁止重复 init 注册表。详见 §1b-1
- `</script>` 转义
- 数据用 JSON.stringify 嵌入
- CSS 和 Vendor JS 库通过 `src`/`href` 引用 + `assemble-report.mjs` 组装内联，不省略、不压缩、不摘要
- 报告总大小上限 3MB（所有库 + 数据 + 样式合计），不在此上限内做人为削减

---

## 本轮完成标准

- [ ] 蓝图结构校验全部通过
- [ ] 主题 CSS 引用正确（包内路径，无手写 CSS）
- [ ] Vendor JS 引用正确（包内路径，LLM 未读取 vendor 文件进上下文）
- [ ] 报告结构按蓝图的章节顺序组织
- [ ] 每个图表有明确的叙事功能，不是"因为这个维度有数据所以画一张图"
- [ ] 章节名是发现导向的，来自蓝图，一字不改
- [ ] 报告包含"局限性声明"章节
- [ ] 所有数值有单位或说明
- [ ] ECharts grid containLabel 已设置
- [ ] ECharts 布局时序修复脚本已包含
- [ ] `node agent-tools/scripts/assemble-report.mjs` exit=0，skeleton → report 组装完成
- [ ] `node agent-tools/scripts/verify-report.mjs` exit=0，全项质量闸门通过
- [ ] `node agent-tools/scripts/validate-chart-dom.mjs` exit=0
- [ ] `node agent-tools/scripts/ensure-contain-label.mjs` exit=0
- [ ] `node agent-tools/scripts/safeguard-echarts-grid.mjs` exit=0
- [ ] `node agent-tools/scripts/center-chart.mjs` 已执行
- [ ] `node agent-tools/scripts/taller-chart.mjs` 已执行
- [ ] `node agent-tools/scripts/fix-overflow.mjs` exit=0
- [ ] `node agent-tools/scripts/fix-chart-varname.mjs` exit=0（图表变量名一致性自检+修复）
- [ ] `node agent-tools/scripts/fix-a4-chart-height.mjs` exit=0
- [ ] 🔴 图表脚本自检：每张图表一个独立 `<script>` 块，不存在 `var init=function` 共享辅助函数
- [ ] 🔴 变量名自检：每个图表 IIFE 内 declaration / guard / init 三个位置的 DOM 变量名一致
- [ ] `node agent-tools/scripts/flatten-a4.mjs` exit=0（A4 分页版 → 连续流覆盖，纯网页版跳过）
- [ ] 🔴 图表脚本自检：不存在 `var _cr={}` 或 `_cr.cN=echarts.init(...)` 形式的重复初始化注册表
- [ ] 🔴 图表脚本自检：每个图表脚本以 IIFE `(function() { ... })()` 封闭，末尾保留 `resize` 监听
- [ ] 人工快速检查全部通过
- [ ] 无内部标记泄漏
