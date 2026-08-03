依赖：puppeteer-core（连接系统 Chrome，无需下载 Chromium）
Chrome 路径：硬编码 C:/Program Files/Google/Chrome/Application/chrome.exe，跨机器需改
视口：1200px × 40000px，1200 避开 @media(max-width:800px)，40000 是初始渲染高度
去分页 CSS：注入 break-after:auto + min-height:auto，保留 A4 宽度和原有视觉样式
高度测量：用 last.offsetTop + last.offsetHeight 而非 scrollHeight，避免被视口高度截断
输出：210mm 宽 × 内容高度 mm 单页 PDF，deviceScaleFactor:1.5 高清