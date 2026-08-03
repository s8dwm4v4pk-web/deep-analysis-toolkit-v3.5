#!/usr/bin/env node
/**
 * html2pdf-flow-puppeteer.js
 * 去分页、自然流动、单页 PDF，避免裁切。
 * 用法: node html2pdf-flow-puppeteer.js <input.html> <output.pdf>
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const INJECT_CSS = `
<style>
/* === 去分页，自然流动 === */
@page { size: auto; margin: 0; }
.page {
  break-after: auto !important;
  break-before: auto !important;
  page-break-after: auto !important;
  page-break-before: auto !important;
  min-height: auto !important;
  margin: 0 auto !important;
  box-shadow: none !important;
}
body {
  background: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
}
</style>
`;

const inputHtml = process.argv[2];
const outputPdf = process.argv[3];

if (!inputHtml || !outputPdf) {
  console.error('用法: node html2pdf-flow-puppeteer.js <input.html> <output.pdf>');
  process.exit(1);
}

(async () => {
  // 1. 注入 CSS 到临时文件
  let html = fs.readFileSync(inputHtml, 'utf-8');
  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx === -1) {
    const bodyIdx = html.indexOf('<body');
    html = html.slice(0, bodyIdx) + INJECT_CSS + '\n' + html.slice(bodyIdx);
  } else {
    html = html.slice(0, headCloseIdx) + INJECT_CSS + '\n' + html.slice(headCloseIdx);
  }

  const tmpFile = path.join(process.env.TEMP || '/tmp', 'html2pdf_flow_' + Date.now() + '.html');
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();

    // 视口宽度必须 > 800px，避免触发 @media(max-width:800px) 移动布局
    // 高度 40000px 足够渲染，真实高度通过 DOM offsetTop 测量
    await page.setViewport({ width: 1200, height: 40000, deviceScaleFactor: 1.5 });

    await page.goto('file:///' + tmpFile.replace(/\\/g, '/'), {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // 等待 ECharts 渲染
    await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 2000));
      if (typeof echarts !== 'undefined') {
        document.querySelectorAll('[_echarts_instance_]').forEach(el => {
          const inst = echarts.getInstanceByDom(el);
          if (inst) inst.resize();
        });
      }
      await new Promise(r => setTimeout(r, 1500));
    });

    // 去掉每个 .page 的 min-height 后，用最后一个元素的 BoundingRect 精确测量
    const dims = await page.evaluate(() => {
      // 确认去分页 CSS 生效
      document.querySelectorAll('.page').forEach(p => {
        p.style.minHeight = 'auto';
        p.style.breakAfter = 'auto';
      });
      // 使用 lastChild / last .page 的真实底部来量高度
      const pages = document.querySelectorAll('.page');
      let contentHeight = 0;
      if (pages.length > 0) {
        const last = pages[pages.length - 1];
        contentHeight = last.offsetTop + last.offsetHeight;
      } else {
        contentHeight = document.body.offsetHeight;
      }
      return {
        width: 794,  // 210mm ≈ 794px @96dpi
        height: contentHeight,
      };
    });

    console.log(`  内容真实高度: ${dims.height}px (${Math.ceil(dims.height * 25.4 / 96)}mm)`);

    // 加到足够显示全部内容的视口高度（加缓冲）
    const pageHeightPx = dims.height + 100;

    // 重新设置视口以完整包含内容
    await page.setViewport({ width: 1200, height: pageHeightPx, deviceScaleFactor: 1.5 });
    await new Promise(r => setTimeout(r, 1000));

    // px → mm (96dpi)
    const pageHeightMm = Math.ceil(pageHeightPx * 25.4 / 96);

    await page.pdf({
      path: outputPdf,
      width: '210mm',
      height: `${pageHeightMm}mm`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false,
      pageRanges: '1',
    });

    const stat = fs.statSync(outputPdf);
    console.log(`完成: ${outputPdf} (210mm × ${pageHeightMm}mm, ${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    await browser.close();
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
})();
