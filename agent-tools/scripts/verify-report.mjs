/**
 * verify-report.mjs — V3 质量闸门
 *
 * 使用方式: node agent-tools/scripts/verify-report.mjs <报告文件.html> --min-total=<N> --min-advanced=<N> --min-multi=<N> --min-dim=<N>
 * Exit code 0 = 通过, 非0 = 未通过
 *
 * 检查项：信号数量声明一致性
 * 隶属 SKILL v3.4.0 | P7 三个 flag 均为必需参数，缺失或非法 → exit(2)
 * --min-dim 必需参数（P5 维度数校验）
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

// ── CLI 参数解析 ──
const argv = process.argv.slice(2);

/** 从命令行提取非 --flag 的 HTML 文件路径 */
const htmlArg = argv.find(a => !a.startsWith('--'));
if (!htmlArg) {
  console.error('用法: node agent-tools/scripts/verify-report.mjs <报告文件.html> --min-total=<N> --min-advanced=<N> --min-multi=<N> --min-dim=<N>');
  process.exit(2);
}

/** 提取指定的必需 flag，缺失或值非法 → exit(2)，无默认值、无静默回退 */
const getRequiredFlag = (name) => {
  const found = argv.find(a => a.startsWith(`--${name}=`));
  if (!found) {
    console.error(`错误: 缺少必需参数 --${name}=<N>`);
    console.error('请从 analysis-state.md 的「分析参数」章节读取 P5/P7 参数后传入.');
    console.error(`用法: node agent-tools/scripts/verify-report.mjs <报告文件.html> --min-total=<N> --min-advanced=<N> --min-multi=<N> --min-dim=<N>`);
    process.exit(2);
  }
  const val = parseInt(found.split('=')[1], 10);
  if (isNaN(val) || val < 0) {
    console.error(`错误: --${name} 的值不是有效正整数: "${found.split('=')[1]}"`);
    process.exit(2);
  }
  return val;
};

const MIN_TOTAL_CHARTS   = getRequiredFlag('min-total');
const MIN_ADVANCED_CHARTS = getRequiredFlag('min-advanced');
const MIN_MULTI_CHARTS   = getRequiredFlag('min-multi');
const MIN_DIM            = getRequiredFlag('min-dim');   // P5: 多维可视化最低维度

const filePath = resolve(SKILL_ROOT, htmlArg);

let html;
try {
  html = readFileSync(filePath, 'utf-8');
} catch (e) {
  console.error('文件读取失败:', e.message);
  process.exit(1);
}

const errors = [];
const warnings = [];

// ============================================
//  1. 自包含性检查 — 禁止任何外部脚本/CSS
// ============================================
const allExternalScripts = [...html.matchAll(/<script\s+src=["']https?:\/\//gi)];
const cdnSources = [...html.matchAll(/<script\s+src=["']https?:\/\/(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|cdn\.bootcdn\.net|cdn\.staticfile\.org)/gi)];

if (cdnSources.length > 0) {
  errors.push(`禁止使用 CDN 外部脚本（须全内联）: ${cdnSources.length} 处`);
} else if (allExternalScripts.length > 0) {
  errors.push(`检测到外部脚本引用: ${allExternalScripts.length} 处（应全内联）`);
}

// 检测任何形式的 <script src="..."> 引用（含相对路径），不仅限于 http(s)
const anySrcScripts = [...html.matchAll(/<script[\s\S]*?src=["']([^"']+)["'][\s\S]*?>/gi)];
if (anySrcScripts.length > 0) {
  const srcPaths = anySrcScripts.map(m => m[1]).filter(p => p && p.trim());
  if (srcPaths.length > 0) {
    errors.push(`HTML 中存在外部脚本文件引用 (src="..."): ${srcPaths.join(', ')}（所有脚本必须内联嵌入，不得通过 src 属性加载独立文件）`);
  }
}

const externalCss = [...html.matchAll(/<link\s+[^>]*href=["']https?:\/\/(?!fonts\.googleapis)/gi)];
if (externalCss.length > 0) {
  errors.push(`检测到外部 CSS/资源引用: ${externalCss.length} 处`);
}

// ============================================
//  2. 图表容器检查 — Chart.js
// ============================================
const canvasIds = [...html.matchAll(/<canvas[^>]*id=["']([^"']+)["']/gi)]
  .map(m => m[1]);
const chartJSCanvasIds = [...html.matchAll(/new\s+Chart\s*\(\s*document\.getElementById\(["']([^"']+)["']\)/gi)]
  .map(m => m[1]);
const chartJSContextIds = [...html.matchAll(/new\s+Chart\s*\(\s*document\.getElementById\(["']([^"']+)["']\)\s*\.getContext\(['"]2d['"]\)/gi)]
  .map(m => m[1]);

const canvasSet = new Set(canvasIds);
const chartJSIdSet = new Set([...chartJSCanvasIds, ...chartJSContextIds]);

// 全量元素 ID 收集（供 ECharts 校验，ECharts 可初始化在任意 DOM 元素上）
const allElementIds = [...html.matchAll(/\sid=["']([^"']+)["']/gi)]
  .map(m => m[1]);
const allElementSet = new Set(allElementIds);

// Chart.js 初始化引用了不存在的 canvas
for (const id of chartJSCanvasIds) {
  if (!canvasSet.has(id)) {
    errors.push(`new Chart("#${id}") 在HTML中找不到对应的canvas元素`);
  }
}
for (const id of chartJSContextIds) {
  if (!canvasSet.has(id)) {
    errors.push(`new Chart("#${id}").getContext('2d') 在HTML中找不到对应的canvas元素`);
  }
}

// ============================================
//  2b. 图表容器检查 — ECharts (V3 默认引擎)
// ============================================
const echartsByIdInits = [...html.matchAll(/echarts\.init\s*\(\s*document\.getElementById\(["']([^"']+)["']\)/gi)]
  .map(m => m[1]);
const echartsByQueryInits = [...html.matchAll(/echarts\.init\s*\(\s*document\.querySelector\(["']([^"']+)["']\)/gi)]
  .map(m => m[1]);
const echartsElVarInits = [...html.matchAll(/echarts\.init\s*\(\s*(\w+)\s*\)/gi)]
  .map(m => m[1]);

for (const id of echartsByIdInits) {
  if (!allElementSet.has(id)) {
    errors.push(`echarts.init(document.getElementById("${id}")) 在HTML中找不到对应的DOM元素`);
  }
}

// 变量形式初始化：检查变量名是否对应 DOM 中的 id 属性（变量名普遍也用作 DOM id）
for (const varName of echartsElVarInits) {
  if (!allElementSet.has(varName) && varName !== 'chartDom' && varName !== 'myChart') {
    errors.push(`echarts.init(${varName}) — 变量名 "${varName}" 在HTML中找不到对应的DOM id，且不是通用容器名`);
  }
}

if (echartsByQueryInits.length > 0) {
  warnings.push(`检测到 ${echartsByQueryInits.length} 处 querySelector 初始化 ECharts，请人工确认元素存在`);
}

const totalChartInits = chartJSCanvasIds.length + chartJSContextIds.length + echartsByIdInits.length + echartsByQueryInits.length + echartsElVarInits.length;

if (totalChartInits === 0) {
  warnings.push('未检测到任何图表初始化代码 (new Chart(...) / echarts.init(...))');
}

// ============================================
//  3. 术语白名单检查
// ============================================
const forbiddenTerms = [
  { pattern: /Engine\s*[AB]/gi, label: 'Engine A/B (内部方法学术语)' },
  { pattern: /第\d轮/g, label: '轮次标记 (流水线术语)' },
  { pattern: /Agent|Scout|Owner/gi, label: 'Agent/Scout/Owner (开发者术语)' }
];

for (const { pattern, label } of forbiddenTerms) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    warnings.push(`发现禁止术语 "${label}": ${matches.length} 处 (在方法论说明章外)`);
  }
}

// ============================================
//  4. HTML 自闭性检查
// ============================================
if (!html.includes('</html>') || !html.includes('</body>')) {
  errors.push('HTML 结构不完整 (缺少 </html> 或 </body>)');
}

// ============================================
//  5. 声明数字一致性检查
// ============================================
// 检测 "共 X 个" 或 "X 起事故" 与表格行数的一致性
const totalDeclarations = [
  ...html.matchAll(/(?:共|合计|总计)[^\d]*(\d+)\s*(?:个|起|人|条|处)/g)
];

for (const match of totalDeclarations) {
  const declaredCount = parseInt(match[1]);
  const fullDeclaration = match[0];
  // 仅记录，供人工复核
  if (declaredCount <= 25) {
    warnings.push(`声明数字 "${fullDeclaration.trim()}" — 请人工核对与对应明细表行数是否一致`);
  }
}

// ============================================
//  5b. ECharts 容器高度完整性检查
// ============================================
// 检测所有 [id^="chart-"] 的 div 是否缺少 height 样式（导致 canvas 0×0 不可见）
const chartDivPattern = /<div\b[^>]*\bid\s*=\s*["']chart-\d+["'][^>]*>/gi;
let cdMatch2;
const heightMissingDivs = [];
while ((cdMatch2 = chartDivPattern.exec(html)) !== null) {
  const fullTag = cdMatch2[0];
  // 只检查非 canvas 元素（canvas 由 Chart.js 自行管理尺寸）
  if (/^<canvas/i.test(fullTag)) continue;
  const styleMatch = fullTag.match(/style\s*=\s*["']([^"']*)["']/i);
  if (!styleMatch || !/\bheight\s*:/.test(styleMatch[1])) {
    const idMatch = fullTag.match(/id\s*=\s*["']([^"']+)["']/i);
    if (idMatch) heightMissingDivs.push(idMatch[1]);
  }
}
if (heightMissingDivs.length > 0) {
  const fixExamples = heightMissingDivs.slice(0, 3).map(id => {
    // 🔴 仅转义正则特殊字符（- 需转义；数字不是特殊字符，不可转义——\1 会被当作反向引用）
    const escapedId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const divRegex = new RegExp(`<div\\b[^>]*\\bid\\s*=\\s*["']${escapedId}["'][^>]*>`, 'i');
    const divMatch = html.match(divRegex);
    const currentTag = divMatch ? divMatch[0] : `<div id="${id}" style="width:100%;">`;
    const fixedTag = currentTag.replace(/style\s*=\s*["']([^"']*)["']/i, (_, s) => {
      const trimmed = s.trim();
      return `style="${trimmed}${trimmed.endsWith(';') ? '' : ';'} height:100%;"`;
    });
    return `    ✗ #${id}  当前: ${currentTag}\n             → 改为: ${fixedTag}`;
  }).join('\n');
  const moreHint = heightMissingDivs.length > 3 ? `\n  （共 ${heightMissingDivs.length} 处，以上仅展示前 3 处）` : '';
  errors.push(
    `ECharts 容器缺少 height 样式: ${heightMissingDivs.join(', ')}（共 ${heightMissingDivs.length} 处）—— canvas 将为 0×0 导致图表不可见。\n` +
    `修复指令（逐行修改）：\n${fixExamples}${moreHint}\n` +
    `  规则：在每个 <div id="chart-N" style="width:100%;"> 的 style 中添加 "height:100%;"\n` +
    `  最终格式: style="width:100%;height:100%;"`
  );
}

// ============================================
//  5c. Gauge markLine 误用检测
// ============================================
// 检测 type:'gauge' 的 series 中是否误写了 markLine（gauge 不支持）
// 提取上下文，给出精确的删除指令

const gaugeWithMarkLine = [];
const gaugeRegex = /type\s*:\s*['"]gauge['"]/gi;
let gaugeMatch;

while ((gaugeMatch = gaugeRegex.exec(html)) !== null) {
  // 从 gauge 声明向后取 800 字符，检测 markLine
  const tail = html.slice(gaugeMatch.index, gaugeMatch.index + 800);
  const mlMatch = tail.match(/\bmarkLine\b/);
  if (mlMatch) {
    // 反查该 gauge 所属的图表 ID
    // 从 gaugeMatch.index 向前搜索最近的 [id^="chart-"] div
    const before = html.slice(Math.max(0, gaugeMatch.index - 2500), gaugeMatch.index);
    const idMatch = before.match(/id\s*=\s*["'](chart-\d+)["']/g);
    const chartId = idMatch ? idMatch[idMatch.length - 1].match(/chart-\d+/)[0] : '未知图表';

    // 提取 markLine 完整片段（从 "markLine" 到下一个同级键或 series 结束）
    const mlStart = gaugeMatch.index + mlMatch.index;
    const mlSnippet = html.slice(mlStart, mlStart + 300);
    const mlFullMatch = mlSnippet.match(/(markLine\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\})/);
    const mlFullText = mlFullMatch ? mlFullMatch[1] : 'markLine: { ... }';

    gaugeWithMarkLine.push({ chartId, mlText: mlFullText });
  }
}

if (gaugeWithMarkLine.length > 0) {
  const fixDetails = gaugeWithMarkLine.map(item =>
    `  ── 图表: #${item.chartId}\n` +
    `     删除此行: ${item.mlText}\n` +
    `     删除后示例:\n` +
    `       series: [{ type: 'gauge',\n` +
    `         data: [{ value: XX, name: '...' }]  // ← 仅保留 data，删除上方 markLine\n` +
    `       }]`
  ).join('\n\n');

  errors.push(
    `Gauge 系列误用 markLine: ${gaugeWithMarkLine.length} 处 —— gauge 仪表盘不支持 markLine/markArea/markPoint，setOption() 时直接报错导致整张仪表盘不显示。\n` +
    `\n修复指令（逐图删除 markLine）：\n${fixDetails}\n\n` +
    `替代方案：若需要在仪表盘上标注阈值线，应使用 series.axisLine.lineStyle.color 分段色条，\n` +
    `  示例: axisLine: { lineStyle: { color: [[0.3, '#ef4444'], [0.7, '#f59e0b'], [1, '#22c55e']] } }\n` +
    `  这将自动在 30% 和 70% 处生成颜色分界，无需 markLine`
  );
}

// ============================================
//  6. 硬约束量化检查
// ============================================

// 6a. 图表总数 ≥ MIN_TOTAL_CHARTS
if (totalChartInits < MIN_TOTAL_CHARTS) {
  errors.push(`图表总数不足: ${totalChartInits} 张（要求 ≥ ${MIN_TOTAL_CHARTS}）`);
}

// 6b. 高级图表 ≥ MIN_ADVANCED_CHARTS
const advancedTypes = [
  'radar', 'sankey', 'treemap', 'sunburst', 'parallel',
  'waterfall', 'gauge', 'boxplot', 'force', 'graph',
  'dumbbell', 'calendar', 'heatmap'
];
const advancedPattern = new RegExp(`type\\s*:\\s*['"](${advancedTypes.join('|')})['"]`, 'gi');
const advancedMatches = [...html.matchAll(advancedPattern)];
const advancedCount = advancedMatches.length;

// 额外检测：散点+回归（scatter + 编码/回归特征同时出现）
const scatterWithRegression = [...html.matchAll(/type\s*:\s*['"]scatter['"][\s\S]{0,500}?(?:regression|encode|markLine|markArea)/gi)];

if (advancedCount < MIN_ADVANCED_CHARTS && scatterWithRegression.length === 0) {
  errors.push(`高级图表不足: ${advancedCount} 张（要求 ≥ ${MIN_ADVANCED_CHARTS}，从: radar/sankey/treemap/sunburst/parallel/waterfall/gauge/boxplot/dumbbell/calendar/heatmap 中选择）`);
} else if (advancedCount < MIN_ADVANCED_CHARTS && scatterWithRegression.length > 0) {
  // 散点+回归也算高级图表
  const effectiveAdvanced = advancedCount + scatterWithRegression.length;
  if (effectiveAdvanced < MIN_ADVANCED_CHARTS) {
    errors.push(`高级图表不足: ${effectiveAdvanced} 张（含散点+回归）（要求 ≥ ${MIN_ADVANCED_CHARTS}）`);
  }
}

// 6c. 多维可视化 ≥ MIN_MULTI_CHARTS
const multiDimTypes = ['radar', 'parallel', 'sankey', 'heatmap'];
const multiDimPattern = new RegExp(`type\\s*:\\s*['"](${multiDimTypes.join('|')})['"]`, 'gi');
const multiDimMatches = [...html.matchAll(multiDimPattern)];
if (multiDimMatches.length < MIN_MULTI_CHARTS) {
  errors.push(`缺少多维可视化图表: ${multiDimMatches.length} 张（要求 ≥ ${MIN_MULTI_CHARTS} 张雷达/平行坐标/桑基/热力图）`);
}

// 6c-2. 多维可视化维度数 ≥ P5 (MIN_DIM)
// 检查雷达图 indicator 数组长度 ≥ MIN_DIM
const radarIndicators = [...html.matchAll(/option\s*=\s*\{[\s\S]*?radar\s*:\s*\{[\s\S]*?indicator\s*:\s*\[([\s\S]*?)\]/gi)];
for (const match of radarIndicators) {
  const indicatorContent = match[1];
  const items = (indicatorContent.match(/\{[^}]*\}/g) || []);
  if (items.length < MIN_DIM) {
    errors.push(`雷达图维度数不足: ${items.length} 个指标（要求 ≥ ${MIN_DIM}，来自 P5 多维可视化最低维度）`);
  }
}
// 检查平行坐标 dimensions 数组长度 ≥ MIN_DIM
const parallelDimensions = [...html.matchAll(/parallelAxis\s*:\s*\[([\s\S]*?)\]/gi)];
for (const match of parallelDimensions) {
  const dimContent = match[1];
  const dims = (dimContent.match(/\{[^}]*\}/g) || []);
  if (dims.length < MIN_DIM) {
    errors.push(`平行坐标维度数不足: ${dims.length} 个轴（要求 ≥ ${MIN_DIM}，来自 P5 多维可视化最低维度）`);
  }
}

// 6d. 内部标记泄漏检测
const internalMarkers = [
  { pattern: /（红）/g, label: '（红）' },
  { pattern: /（绿）/g, label: '（绿）' },
  { pattern: /（黄）/g, label: '（黄）' },
  { pattern: /\(TODO\)/gi, label: '(TODO)' },
  { pattern: /\(FIXME\)/gi, label: '(FIXME)' },
  { pattern: /（待补充）/g, label: '（待补充）' },
  { pattern: /（内部）/g, label: '（内部）' },
];
for (const { pattern, label } of internalMarkers) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    warnings.push(`发现疑似内部标记泄漏 "${label}": ${matches.length} 处`);
  }
}

// 6e. 裸数字检测 — 常见无单位数字模式（仅 warning，允许少量合法用例）
const bareNumberPatterns = [
  // "占比X%" / "X元" / "X人" / "X天" / "X次" / "X处" / "X个" → 已有单位，跳过
  // 检测中文正文中的裸数字（后面无常见单位）
  { pattern: /[^\d](\d{2,})\s*(?:，|。|、|；|的|在|和|与|及)/g, label: '可能无单位的裸数字' },
];
for (const { pattern, label } of bareNumberPatterns) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 2) {
    warnings.push(`"${label}" 发现 ${matches.length} 处 — 请人工确认是否缺少单位`);
  }
}

// ============================================
//  7. 基础结构检查
// ============================================
if (!html.includes('<title>')) {
  errors.push('缺少 <title> 标签');
}
if (!html.includes('<style>') && !html.includes('<link rel="stylesheet"')) {
  warnings.push('未检测到样式定义');
}

// ============================================
//  7b. A4 / 纯网页版 格式一致性检查
// ============================================
const hasA4Page = /@page\s*\{[^}]*size\s*:\s*A4/i.test(html);
const hasCoverPage = /\.page\.cover\s*\{/.test(html);
const hasDarkTheme = /background\s*:\s*(?:#1a1a2e|#0d1117|#1a1d23|linear-gradient\s*\(\s*(?:135|180|90)deg\s*,\s*#0[0-9a-f])/i.test(html);

// 检测到 A4 特征但缺少对应封面 → 警告
if (hasA4Page && !hasCoverPage) {
  warnings.push('检测到 @page { size: A4 } 但缺少 .page.cover 封面样式 — 封面可能未按 A4 蓝色封面模板生成');
}

// 检测到封面但缺少 A4 分页 → 警告
if (hasCoverPage && !hasA4Page) {
  warnings.push('检测到 .page.cover 封面样式但缺少 @page { size: A4 } — A4 分页模式可能未完全启用');
}

// 检测到内页白底黑字但无 A4 page 定义（漏了分页设置）
const hasA4InnerStyle = /(?:白底|background\s*:\s*#fff|color\s*:\s*#333).*(?:210mm|A4|297mm)/i.test(html);
if (hasA4InnerStyle && !hasA4Page) {
  warnings.push('检测到 A4 幅面尺寸 (210mm/297mm) 但缺少 @page { size: A4 } 定义');
}

// ============================================
//  7c. ECharts 内联完整性兜底检查
// ============================================

// 提取所有内联 <script> 标签的文本内容（供 7c 和 7f 共用）
const inlineScriptContents = [];
const inlineScriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let _sm;
while ((_sm = inlineScriptRegex.exec(html)) !== null) {
  // 排除有 src 属性的脚本标签（那些已经在上面被拦截为 error）
  if (!/<script\s[^>]*src\s*=/i.test(_sm[0])) {
    inlineScriptContents.push(_sm[1]);
  }
}
const allInlineJS = inlineScriptContents.join('\n');

// 检测 echarts.init 存在但疑似缺少内联 ECharts 库体
const hasEchartsInit = /echarts\s*\.\s*init\s*\(/i.test(html);
if (hasEchartsInit) {
  // ECharts 内联库体特征：包含 "echarts" 关键字且体积足够大（≥ 50KB 文本）
  // 用一系列 echarts 核心 API 特征词来判断
  const echartsCoreAPIs = [
    'echarts.util', 'echarts.graphic', 'echarts.version',
    'echarts.extendSeriesModel', 'echarts.extendChartView',
    'echarts.registerMap', 'echarts.dataTool'
  ];
  const matchedCoreAPIs = echartsCoreAPIs.filter(api => allInlineJS.includes(api));
  
  // 内联库体的总字符数粗略估计
  const inlineCharCount = allInlineJS.length;
  
  if (matchedCoreAPIs.length < 2 && inlineCharCount < 50000) {
    errors.push('检测到 echarts.init() 但缺少内联 ECharts 库体（疑似通过 CDN 加载但脚本引用被隐藏）—— 所有 echarts 源码必须内联为 <script>（不含 src）');
  } else if (matchedCoreAPIs.length < 2 && inlineCharCount >= 50000) {
    warnings.push('检测到 echarts.init() 且内联脚本体积足够，但 ECharts 核心 API 特征匹配较少 — 请人工确认 ECharts 库体已完整内联');
  }
}

// ============================================
//  7c-bis. ECharts 布局时序修复检测（与 7c 共享 hasEchartsInit 判定）
// ============================================
if (hasEchartsInit) {
  // getInstanceByDom 是 batch-resize 修复脚本的特征 API
  // 该 API 在 ECharts 库体（minified）中不会作为调用出现，仅出现在用户编写的修复代码中
  const hasBatchResize = /getInstanceByDom/g.test(allInlineJS);
  if (!hasBatchResize) {
    errors.push('检测到 echarts.init() 但缺少 ECharts 布局时序修复脚本 — 必须在 </body> 前包含 batch resize（load + 双 RAF + echarts.getInstanceByDom(el).resize()），否则 CSS 布局完成前初始化的图表可能保持 0px 尺寸不可见');
  }
}

// ============================================
//  7d. 封面蓝色渐变颜色值校验
// ============================================
if (hasCoverPage) {
  // 尝试匹配 .page.cover 及其内部规则（支持嵌套大括号）
  const coverBlockRegex = /\.page\.cover\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/s;
  const coverMatch = html.match(coverBlockRegex);
  if (coverMatch) {
    const coverCSS = coverMatch[0];
    const hasGradient = /linear-gradient/.test(coverCSS);
    const hasDarkBlue = /#0a1628/.test(coverCSS);
    const hasMidBlue = /#1e5799/.test(coverCSS);
    if (!hasGradient) {
      errors.push('.page.cover 封面缺少 linear-gradient 渐变 — 必须使用 linear-gradient(135deg, ...) 深蓝渐变背景');
    }
    if (!hasDarkBlue && !hasMidBlue) {
      errors.push('.page.cover 封面色值错误 — 缺少必需色值 #0a1628 和 #1e5799（深蓝渐变），当前封面背景可能是白色或其他颜色');
    }
    if (!hasDarkBlue) {
      warnings.push('.page.cover 未检测到 #0a1628（深蓝起点色） — 请确认渐变起点是否为深蓝');
    }
    if (!hasMidBlue) {
      warnings.push('.page.cover 未检测到 #1e5799（蓝色终点色） — 请确认渐变终点是否为蓝色');
    }
  } else {
    warnings.push('.page.cover 存在但无法提取完整 CSS 规则 — 可能使用了多层嵌套，请人工确认颜色为蓝色渐变');
  }
  
  // 额外检测：body 层是否错误地设置了白色背景（会覆盖封面）
  const bodyBgWhite = /body\s*\{[^}]*background\s*:\s*(?:#fff|#ffffff|white)/i.test(html);
  if (bodyBgWhite) {
    warnings.push('body 设置了白色背景 (#fff) — 这会覆盖 .page.cover 的蓝色渐变封面。请将 body { background: none } 或将白色背景限制在 .inner-page 内');
  }
}

// ============================================
//  7e. 主题 CSS 来源指纹验证
// ============================================
// 原理：检测内联 CSS 是否包含 SKILL 包主题文件的关键标识符
// 防止手写 CSS 替代官方主题

// 检测当前报告使用的是暗色还是 A4 主题
const isDarkTheme = /--bg-deep\s*:\s*#[0-9a-fA-F]+/.test(html) || 
                    /--bg-panel\s*:\s*#[0-9a-fA-F]+/.test(html) ||
                    /--gold\s*:\s*#[0-9a-fA-F]+/.test(html);

const isA4Theme = /@page\s*\{[^}]*size\s*:\s*A4/i.test(html) ||
                  /--page-w\s*:\s*210mm/.test(html) ||
                  /--accent\s*:\s*#[0-9a-fA-F]+/.test(html);

// 暗色主题指纹：必须全部匹配
const darkThemeFingerprints = [
  { key: '--bg-deep', label: '暗色主题背景色变量' },
  { key: '--bg-panel', label: '暗色主题面板色变量' },
  { key: '--gold', label: '暗色主题金色主色调变量' },
  { key: '--bg-card', label: '暗色主题卡片色变量' },
  { key: '.cover', label: '暗色主题封面样式类' },
];

// A4 主题指纹：必须全部匹配
const a4ThemeFingerprints = [
  { key: '--page-w', label: 'A4 主题页面宽度变量' },
  { key: '--accent', label: 'A4 主题强调色变量' },
  { key: '--card-bg', label: 'A4 主题卡片背景变量' },
  { key: '.page.cover', label: 'A4 主题封面样式类' },
  { key: 'A4', label: 'A4 页面尺寸定义' },
];

if (isDarkTheme && !isA4Theme) {
  // 检测到暗色主题特征 → 验证暗色主题指纹
  const missingDark = darkThemeFingerprints.filter(fp => !html.includes(fp.key));
  if (missingDark.length > 0) {
    const missingList = missingDark.map(fp => fp.label).join('、');
    errors.push(`主题 CSS 来源异常（暗色主题）：缺少包内 theme-dark.css 的关键标识 [${missingList}]。CSS 必须完整内联 themes/theme-dark.css，不得手写替代`);
  }
} else if (isA4Theme && !isDarkTheme) {
  // 检测到 A4 主题特征 → 验证 A4 主题指纹
  const missingA4 = a4ThemeFingerprints.filter(fp => !html.includes(fp.key));
  if (missingA4.length > 0) {
    const missingList = missingA4.map(fp => fp.label).join('、');
    errors.push(`主题 CSS 来源异常（A4 主题）：缺少包内 theme-a4.css 的关键标识 [${missingList}]。CSS 必须完整内联 themes/theme-a4.css，不得手写替代`);
  }
} else if (!isDarkTheme && !isA4Theme) {
  // 完全没有识别到任何已知主题特征
  errors.push('主题 CSS 来源异常：未检测到 themes/theme-dark.css 或 themes/theme-a4.css 的任何关键标识。CSS 必须来自 SKILL 包内 themes/ 目录，不得手写 CSS 替代');
} else {
  // 同时检测到两种主题特征 → 异常
  warnings.push('同时检测到暗色和 A4 主题特征 — 可能存在两套 CSS 混合，请确认只内联了一个主题文件');
}

// ============================================
//  7f. Vendor JS 来源指纹验证
// ============================================
// 原理：检测内联 JS 是否包含 SKILL 包 vendor 库的核心 API 特征
// 防止用 CDN 版本或阉割版替代

// ECharts 指纹（已有 7c 兜底，此处加强为硬约束）
if (hasEchartsInit) {
  const echartsRequiredAPIs = [
    'echarts.util',
    'echarts.graphic', 
    'echarts.version',
    'echarts.extendSeriesModel',
  ];
  const echartsMissing = echartsRequiredAPIs.filter(api => !allInlineJS.includes(api));
  if (echartsMissing.length > 0) {
    errors.push(`Vendor JS 来源异常（ECharts）：缺少核心 API [${echartsMissing.join(', ')}]。echarts.min.js 必须来自 SKILL 包内 references/vendor/echarts.min.js，完整内联`);
  }
}

// Chart.js 指纹
const hasChartJS = /\bnew\s+Chart\s*\(/i.test(html);
if (hasChartJS) {
  const chartJSRequiredAPIs = ['Chart.defaults', 'Chart.helpers', 'Chart.registry'];
  const chartJSMissing = chartJSRequiredAPIs.filter(api => !allInlineJS.includes(api));
  if (chartJSMissing.length > 0) {
    errors.push(`Vendor JS 来源异常（Chart.js）：缺少核心 API [${chartJSMissing.join(', ')}]。chart.js.min.js 必须来自 SKILL 包内 references/vendor/chart.js.min.js，完整内联`);
  }
}

// D3 指纹
const hasD3 = /\bd3\.(select|scaleLinear|axis|hierarchy|force)\b/i.test(html);
if (hasD3) {
  const d3RequiredAPIs = ['d3.select', 'd3.scaleLinear', 'd3.axisBottom'];
  const d3Missing = d3RequiredAPIs.filter(api => !allInlineJS.includes(api));
  if (d3Missing.length > 0) {
    errors.push(`Vendor JS 来源异常（D3）：缺少核心 API [${d3Missing.join(', ')}]。d3.v7.min.js 必须来自 SKILL 包内 references/vendor/d3.v7.min.js，完整内联`);
  }
}

// ApexCharts 指纹
const hasApexCharts = /\bnew\s+ApexCharts\b/i.test(html) || /\bApexCharts\b/i.test(html);
if (hasApexCharts) {
  const apexRequiredAPIs = ['ApexCharts', 'Apex'];
  const apexMissing = apexRequiredAPIs.filter(api => !allInlineJS.includes(api));
  if (apexMissing.length > 0) {
    errors.push(`Vendor JS 来源异常（ApexCharts）：缺少核心标识 [${apexMissing.join(', ')}]。apexcharts.min.js 必须来自 SKILL 包内 references/vendor/apexcharts.min.js，完整内联`);
  }
}

// ============================================
//  8. 页脚签名检查
// ============================================

// ============================================
//  9. 假说验证 + Safety Lifecycle + 反事实推断
// ============================================

// 9a. 假说验证表格
const hypTable = html.match(/class\s*=\s*["']hypothesis-table["']/gi);
const statusMatches = [...html.matchAll(/✅\s*支持|🟡\s*部分支持|❌\s*不支持|⚠️\s*存疑/gi)];
if (!hypTable) {
  errors.push('缺少假说验证表格 (.hypothesis-table) — 报告必须包含阶段3的三级检验结果');
} else if (statusMatches.length === 0) {
  warnings.push('假说验证表格存在但未找到三级检验状态标记 (✅/🟡/❌/⚠️)');
}

// 9b. Safety Lifecycle 面板
const lcPanel = html.match(/class\s*=\s*["']lifecycle-stage["']/gi);
const lcMetrics = html.match(/class\s*=\s*["']stage-metrics["']/gi);
if (!lcPanel) {
  warnings.push('缺少 Safety Lifecycle 评估面板 (.lifecycle-stage) — 阶段3b结果可能未展示');
} else if (!lcMetrics) {
  warnings.push('Safety Lifecycle 面板不完整：缺少五维评分矩阵 (.stage-metrics)');
}

// 9c. 反事实推断内容
const cfContent = html.match(/反事实|Counterfactual|counterfactual/gi);
if (!cfContent) {
  warnings.push('未检测到反事实推断内容 — 阶段4的反事实推演可能未纳入报告');
}

// ============================================
const forbiddenFooter = [
  /编印/g,
  /统计中心.*出品/g,
  /编制.*单位/g,
  /本报告由.*自动生成/g,
  /仅供内部/g,
  /内部决策参考/g
];
for (const pattern of forbiddenFooter) {
  if (pattern.test(html)) {
    warnings.push(`发现可能的自拟署名: "${pattern.source}"`);
  }
}

// 正向校验：如果 HTML 中存在 .footer 元素，必须包含标准签名格式
const hasFooter = /<div\s+class="footer"/i.test(html) || /<footer/i.test(html);
if (hasFooter) {
  const expectedFooter = /本报告由\s+deep-analysis-toolkit-v3\s+生成/g;
  if (!expectedFooter.test(html)) {
    warnings.push('页脚已存在但缺少标准签名: "本报告由 deep-analysis-toolkit-v3 生成 · 数据版本 XXXXXXXX · 编制日期 XXXX-XX-XX"');
  }
}

// ============================================
// 输出结果
// ============================================
console.log('='.repeat(56));
console.log(`  报告质量闸门 — ${filePath.split('/').pop()}`);
console.log('='.repeat(56));

if (errors.length > 0) {
  console.log(`\n  ERROR (${errors.length}):`);
  errors.forEach(e => console.log(`    ✗ ${e}`));
}

if (warnings.length > 0) {
  console.log(`\n  WARNING (${warnings.length}):`);
  warnings.forEach(w => console.log(`    ⚠ ${w}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n  全部检查通过');
}

console.log(`\n  图表统计: ${totalChartInits} 个初始化调用`);
console.log(`    DOM元素: ${allElementIds.length} 个带ID元素 | Canvas: ${canvasIds.length} 个`);
console.log(`    Chart.js: ${chartJSCanvasIds.length + chartJSContextIds.length} | ECharts: ${echartsByIdInits.length + echartsByQueryInits.length + echartsElVarInits.length}`);
console.log(`    高级图表: ${advancedCount} 张 | 多维可视化: ${multiDimMatches.length} 张`);
console.log(`    图表门槛: ≥${MIN_TOTAL_CHARTS} 总数 / ≥${MIN_ADVANCED_CHARTS} 高级 / ≥${MIN_MULTI_CHARTS} 多维`);

console.log('='.repeat(56));

process.exit(errors.length > 0 ? 1 : 0);
