# 通用图表选型决策树 v3.4.0

> **定位**：基于数据形态（data shape）和任务意图（why）推导图表类型。覆盖 D3/ECharts/Chart.js/ApexCharts/Three.js 五引擎约 38 种图表。领域无关 —— 不绑定矿山、金融、医疗等任何特定领域。
> **使用者**：阶段 6 叙事规划 + 阶段 7 报告生成。
> **原则**：数据特征决定图类池的下限（合理），分析意图决定上限（高级）。所有规则基于可视化认知科学。

---

## 第一部分：数据形态速查表（10 秒定位你的数据属于哪种）

| 形态 | 名称 | 一句话描述 |
|------|------|-----------|
| **S1** | 一维数组 | 一个指标分布在 N 个类别上 |
| **S2** | 多维矩阵 | M 个实体 × N 个指标，指标量纲可能不同 |
| **S3** | 极简数据集 | 2-6 个孤立 KPI 数字，无分组无时序 |
| **S4** | 时间序列 | 同一组指标在 ≥3 个时间点的值 |
| **S5** | 双变量关系 | 每个实体有 X 和 Y 两个连续变量 |
| **S6** | 构成/占比 | 一个整体被拆分为互斥子类（总和 100%） |
| **S7** | 排名序列 | ≥8 个实体按某指标排序 |
| **S8** | 分级/阈值 | 一个值落在某个等级/区间中 |
| **S9** | 三变量关系 | 每个实体有 X, Y, Z 三个连续变量 |
| **S10** | 层级/树形 | 数据有嵌套父子关系 |
| **S11** | 关系网络 | 节点 + 边（含权重和方向） |
| **S12** | 多维时序矩阵 | 时间 × 类别 × 数值的网格 |
| **S13** | 流程/转移 | 资源/流量从源到目标的转移 |
| **S14** | 时间区间 | 每个任务/事件有起止时间 |
| **S15** | 高维数据 | ≥4 个变量，需要可视化降维 |
| **S16** | 空间/地理 | 数据绑定到地理位置 |
| **S17** | 3D 数值 | 三个数值维度需要立体呈现 |

---

## 第二部分：完整决策树

每条规则格式：`标准方案` / `高级方案(引擎)` — `为何高级`

### S1：一维数组

**特征**：一个指标 × N 个类别（N ≥ 2）。

**标准方案**：柱状图 vertical bar（D3/Chart.js/ECharts）— N ≤ 12 用垂直柱，> 12 用横向条形

**高级方案**：

| 场景 | 图表 | 引擎 | 为何高级 |
|------|------|------|---------|
| 强调偏离均值的程度 | 棒棒糖图 lollipop | ECharts `echarts/lollipop.html` | 视觉焦点从柱子面积转移到端点位置 |
| 展示数据离散程度 | 箱线图 boxplot 或小提琴图 | D3/ECharts `echarts/boxplot.html` | 同时呈现中位数/IQR/离群值/分布形状 |
| 体现增量的逐级贡献 | 瀑布图 waterfall | ECharts `echarts/waterfall.html` | 每个柱子的起点是前一根的终点 |
| 数据二值对立（多组 A vs B） | 哑铃图 dumbbell | ECharts `echarts/dumbbell.html` | 同时呈现每组变化幅度和方向 |
| 数值附带图标/象形语义 | 象形柱图 pictBar | ECharts `echarts/pict-bar.html` | 图标增强情感传达 |

### S2：多维矩阵（M 个实体 × N 个指标）

**特征**：多个实体在多个指标上的值。量纲可能不同。

**标准方案**：分组柱状图（量纲相同，N ≤ 3）/ 分面多图 small multiples（N > 3）

**高级方案**：

| 场景 | 图表 | 引擎 | 为何高级 |
|------|------|------|---------|
| N ≥ 3，量纲不同，全局对比 | 雷达图 radar | D3/ECharts `echarts/radar.html` | 标准化后的等角多边形，一眼识别轮廓凹凸 |
| 具体数值不重要，分布模式重要 | 热力图 heatmap | D3/ECharts `echarts/heatmap.html` | 数值矩阵映射为颜色——模式识别极快 |
| 需同时查看所有指标两两关系 | 平行坐标 parallel | ECharts `echarts/parallel.html` | 每条折线是一个实体，折线交叉 = 差异 |
| 降维后同时展示样本和变量贡献 | PCA 双标图 biplot | D3 `d3/biplot.html` | 一个平面编码样本聚类和变量载荷方向 |

### S3：极简数据集（2-6 个核心数字）

**特征**：几个关键 KPI，无分组、无时序。

**标准方案**：KPI 大数字卡片（HTML+CSS）：超大字号 + 同比箭头 + 颜色编码

**高级方案**：

| 场景 | 图表 | 引擎 |
|------|------|------|
| 每个数字有目标值/基准 | 子弹图 bullet | ECharts `echarts/bullet.html` |
| 0-100% 的完成率/评分 | 仪表盘 gauge | D3/ECharts `echarts/gauge.html` |
| 多个进度值并排对比 | 径向柱图 radialBar | ApexCharts `apexcharts/radial-bar.html` |
| 多指标相对最大值展示 | 极地区域图 polarArea | Chart.js `chartjs/polar-area.html` |

### S4：时间序列

**特征**：同一组指标在 ≥3 个时间点的值。

| 场景 | 图表 | 引擎 |
|------|------|------|
| 单指标时序 | 折线图 line | D3/Chart.js/ECharts |
| 多指标时序 | 多系列折线图 / 堆叠面积图 stack | ECharts `echarts/stackarea.html` |
| 需要标注关键区间 | 折线图 + 标注区间 markArea | ECharts `echarts/mark-area.html` |
| 日历模式（按日/周/月）（需连续日期数据，跨度 ≥ 2 周才有意义） | 日历热力图 calendarHeat | ECharts `echarts/calendar-heatmap.html` / ApexCharts |
| 金融 OHLC | K 线图 candlestick | ApexCharts `apexcharts/candlestick.html` |
| 单数字+趋势 | KPI 卡片内嵌微图 sparkline | 均可 |
| 频域分析 | 频谱图 spectrum(FFT) | D3 `d3/spectrum.html` |
| 已知函数形式 | 函数曲线 funcCurve | D3 `d3/func-curve.html` |

### S5：双变量关系

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 散点图 scatter | D3/Chart.js/ECharts |
| 量化相关方向和强度 | 散点 + 线性回归线（需连续双变量，避免分类混杂） | ECharts `echarts/scatter-regression.html` / D3 |
| 展示估计不确定性 | 散点 + 回归线 + 置信带（需足够样本量支撑区间估计） | ECharts `echarts/scatter-band.html` |
| 展示点集边界和离群点 | 散点 + 凸包 convexHull | D3 `d3/convex-hull.html` |
| 物理场/梯度场 | 向量场图 vectorField | D3 `d3/vector-field.html` |

### S6：构成/占比

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准（子类 ≤ 6） | 饼图 pie / 环形图 doughnut | D3/Chart.js |
| 多个整体对比构成 | 堆叠柱状图 stack | D3 |
| 多层级占比（需 2+ 层天然层级，同级分类 ≤ 15） | 矩形树图 treemap | ECharts `echarts/treemap.html` |
| 3-6 子类 | 极地区域图 polarArea | Chart.js `chartjs/polar-area.html` |

### S7：排名序列（≥8 个实体）

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 横向条形图 | 均可 |
| 减少视觉冗余 | 棒棒糖图 | ECharts `echarts/lollipop.html` |
| 两期排名变化（需明确的前/后两期配对数据） | 哑铃图 | ECharts `echarts/dumbbell.html` |

### S8：分级/阈值型

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准（单指标 vs 阈值/目标，适合 KPI 监控，避免多值堆砌） | 仪表盘 gauge | D3/ECharts `echarts/gauge.html` |
| 多值并排（多个同型指标并排对比，≤ 6 个） | 径向柱图 radialBar | ApexCharts `apexcharts/radial-bar.html` |
| 精确刻度读数（需目标值/区间参考线） | 子弹图 bullet | ECharts `echarts/bullet.html` |

### S9：三变量关系

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 气泡图 bubble（X/Y + 气泡大小 = Z） | D3/Chart.js/ECharts `echarts/bubble.html` |
| 真实三维（仅当第三维度有独立语义、非标量映射，否则用气泡图或颜色编码替代） | 3D 散点图 scatter3d | Three.js `threejs/scatter-3d.html` |

### S10：层级/树形数据

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 树状图 tree | D3 `d3/tree.html` |
| 同时编码层级和占比 | 矩形树图 treemap | ECharts `echarts/treemap.html` |
| 环形层级 + 角度占比（**仅当数据确有 2+ 层天然层级、每层均有占比含义时选用**） | 旭日图 sunburst | ECharts `echarts/sunburst.html` |

### S11：关系网络（节点 + 边）

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准（需节点+边关系数据，节点数 ≤ 50） | 力导向图 force | D3 `d3/force.html` |
| 高级（边有权重/强度差异时用粗细/颜色双编码） | 力导向图 + 边权重编码（粗细/颜色） | D3 `d3/force.html` |

### S12：多维时序矩阵（时间 × 类别 × 数值）

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 日历热力图 calendarHeat | ECharts `echarts/calendar-heatmap.html` / ApexCharts |
| 替代 | 热力图 heatmap（行=时间 列=类别） | D3/ECharts `echarts/heatmap.html` |

### S13：流程/转移数据

| 场景 | 图表 | 引擎 | 说明 |
|------|------|------|------|
| 标准 | 桑基图 sankey | ECharts `echarts/sankey.html` | 节点+流线，流线宽度 = 流量大小 |

**适用场景**：资金流向、能源消耗路径、隐患排查→分派→整改状态流转。

### S14：时间区间/进度数据

| 场景 | 图表 | 引擎 | 说明 |
|------|------|------|------|
| 标准 | 范围柱图 rangeBar（甘特图） | ApexCharts `apexcharts/gantt.html` | 横向条形，x 轴=时间，条长度=区间 |

**适用场景**：项目进度、监察计划执行窗口、整改时限追踪。

### S15：高维数据（≥4 个变量）

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 平行坐标 parallel | ECharts `echarts/parallel.html` |
| 降维到 2D | PCA 双标图 biplot | D3 `d3/biplot.html` |

### S16：空间/地理数据

| 场景 | 图表 | 引擎 | 说明 |
|------|------|------|------|
| 标准 | 等值区域图 choropleth | D3 `d3/choropleth.html` | 需要 topojson 地理数据 |

### S17：3D 数值（三维连续变量）

| 场景 | 图表 | 引擎 |
|------|------|------|
| 标准 | 3D 散点图 scatter3d | Three.js `threejs/scatter-3d.html` |
| 连续函数 Z=f(X,Y) | 3D 曲面图 surface3d | Three.js `threejs/surface-3d.html` |
| 二维网格立体柱状 | 3D 柱状图 bar3d | Three.js `threejs/bar-3d.html` |

---

## 第三部分：引擎总览表

| 引擎 | 核心优势 | 体积 | 使用场景 | 模板目录 |
|------|---------|------|---------|---------|
| **D3** | 最大灵活度，19 种图。boxplot/convexHull/biplot/force 独家 | 内联 ~273KB | 需要极灵活定制图 | `templates/d3/` (8 个模板) |
| **ECharts** | 雷达/平行坐标/桑基/treemap/日历热力/瀑布/仪表盘 | 内联 ~1MB | **默认引擎**，覆盖 80% 高级需求 | `templates/echarts/` (20 个模板) |
| **Chart.js** | 最轻量，饼/环/散点/极地区域 | 内联 ~196KB | 仅需基础图时使用 | `templates/chartjs/` (1 个模板) |
| **ApexCharts** | 甘特图/径向柱图/K 线/日历热力 | 内联 ~510KB | 需要甘特图或径向柱图 | `templates/apexcharts/` (3 个模板) |
| **Three.js** | 3D 渲染 | 内联 ~654KB | 3D 散点/曲面/柱状 | `templates/threejs/` (3 个模板) |

**混合使用规则**：
- 图表集同时需要 ECharts 的高级图和 Three.js 的 3D 图 → 两个都引入（前提总内联 < 3MB）
- 仅有基础图表 → 只用 Chart.js，不引入 ECharts
- **默认引擎 = ECharts**（覆盖面最广）

---

## 第四部分：报告页面图表组合原则

```
┌─────────────────────────────────────────┐
│  KPI 卡片行 (S3) — 一眼看到全局          │
├──────────┬──────────┬──────────────────┤
│ 时序趋势  │ 构成/占比 │ 关键对比          │
│ (S4)     │ (S6)     │ (S1)             │
├──────────┴──────────┴──────────────────┤
│ 多维矩阵 (S2) — 雷达图或热力图（全宽）    │
├──────────┬──────────┬──────────────────┤
│ 关系探查  │ 排名序列  │ 特殊图表           │
│ (S5)     │ (S7)     │ (S11/S13)        │
└──────────┴──────────┴──────────────────┘
```

---

## 第五部分：同一数据的不同选择（对比教学）

| 分析意图 | 图表 | 原因 |
|---------|------|------|
| 每个实体各项指标各自的数值 | 分组柱状图 | 精确读值 |
| 哪个实体综合最强/最弱 | 雷达图 | 同时看多个维度轮廓 |
| 指标之间有关联吗 | 散点图矩阵或平行坐标 | 看变量间关系 |
| 指标能否合成综合分 | 热力图 | 模式识别 |

---

## 第六部分：最低要求（自 V2 起 — 强制）

**每份分析报告的图表选型必须同时满足以下三条硬性指标：**

### 1. 图表总量 ≥ P7 min-total 值

> **执行前读取**：从 `analysis-state.md` 的「分析参数」章节读取 P7 → `min-total` 的实际值（标准模式=12 / 精简模式=8 / 详尽模式=16）。本条为强制底线，不得低于该值。
分析发现多少值得可视化的信号就画多少张。P7 下限是底线，上不封顶。

### 2. 高级图表 ≥ P7 min-advanced 值

> **执行前读取**：从 `analysis-state.md` 的「分析参数」章节读取 P7 → `min-advanced` 的实际值（标准模式=3 / 精简模式=2 / 详尽模式=5）。

从以下高级图表池中任选，不得少于 P7 min-advanced 种：

| 高级图表池 | 引擎 | 数据形态 | 模板 |
|-----------|------|---------|------|
| 雷达图 radar | ECharts/D3 | S2 多维矩阵 | `echarts/radar.html` |
| 桑基图 sankey | ECharts | S13 流程/转移 | `echarts/sankey.html` |
| 旭日图 sunburst | ECharts | S10 层级+占比 | `echarts/sunburst.html` |
| 矩形树图 treemap | ECharts | S6/S10 构成/层级 | `echarts/treemap.html` |
| 平行坐标 parallel | ECharts | S15 高维数据 | `echarts/parallel.html` |
| 瀑布图 waterfall | ECharts | S1 增量贡献 | `echarts/waterfall.html` |
| 仪表盘 gauge | ECharts/D3 | S8 分级/阈值 | `echarts/gauge.html` |
| 箱线图 boxplot | D3/ECharts | S1/S5 分布+离群 | `echarts/boxplot.html` |
| 力导向图 force | D3 | S11 关系网络 | `d3/force.html` |
| 哑铃图 dumbbell | ECharts | S1/S7 两期变化 | `echarts/dumbbell.html` |
| 日历热力图 calendarHeat | ECharts/ApexCharts | S12 多维时序矩阵 | `echarts/calendar-heatmap.html` |
| 散点+回归+置信带 | ECharts | S5 双变量 | `echarts/scatter-band.html` |

### 3. 多维可视化 ≥ P7 min-multi 值

> **执行前读取**：从 `analysis-state.md` 的「分析参数」章节读取 P7 → `min-multi` 的实际值（标准模式=1 / 精简模式=1 / 详尽模式=2）。

至少满足该下限，其中雷达图/平行坐标同时需满足维度数 ≥ P5（**执行前读取**：从 `analysis-state.md` 的「分析参数」章节获取 P5 的实际值，默认 4）：

| 多维图表池 | 引擎 | 模板 |
|-----------|------|------|
| 雷达图（指标轴数 ≥ P5。**执行前读取**：从 `analysis-state.md` 的「分析参数」章节获取 P5 的实际值，默认 4） | ECharts | `echarts/radar.html` |
| 平行坐标（≥4 个变量） | ECharts | `echarts/parallel.html` |
| 桑基图（多级流转） | ECharts | `echarts/sankey.html` |
| 热力图（时间×类别×数值） | D3/ECharts | `echarts/heatmap.html` |

---

### 验收清单

在阶段 7 报告生成完成后，逐项检查：

- [ ] 图表总数 ≥ P7 min-total 值（从 analysis-state.md 读取，标准=12 / 精简=8 / 详尽=16）
- [ ] 高级图表 ≥ P7 min-advanced 值（从 analysis-state.md 读取，标准=3 / 精简=2 / 详尽=5）
- [ ] 多维图表 ≥ P7 min-multi 值（从 analysis-state.md 读取，标准=1 / 精简=1 / 详尽=2），且维度数 ≥ P5
- [ ] 每张图有标题和数据源
- [ ] 每张图旁有文字解读
