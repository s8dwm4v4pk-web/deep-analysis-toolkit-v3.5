#!/usr/bin/env node
/**
 * verify-chart-data-blocks.mjs — 图表数据块完整性校验
 *
 * 用途：解析 blueprint.md 或 analysis-state.md 中每张图的数据块，
 *       逐块检查：(a) 是否为合法结构化数据，(b) 非空，(c) 无占位符。
 *       防止 LLM 写"数据见 analysis-state.md"或 TODO 占位符。
 *
 * 用法: node agent-tools/scripts/verify-chart-data-blocks.mjs <blueprint.md|analysis-state.md> [--json] [--max-missing=N]
 *       --max-missing=N  允许最大缺失数（默认 2，对应 7a §1 的降级阈值）
 *
 * Exit 0 = 全部通过, 1 = 存在缺失, 2 = 用法错误
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

const inputArg = argv.find(a => !a.startsWith('--'));
if (!inputArg) {
  console.error('用法: node agent-tools/scripts/verify-chart-data-blocks.mjs <blueprint.md|analysis-state.md> [--json] [--max-missing=N]');
  process.exit(2);
}

const maxMissingFlag = argv.find(a => a.startsWith('--max-missing='));
const maxMissing = maxMissingFlag ? parseInt(maxMissingFlag.split('=')[1], 10) : 2;

const inputPath = resolve(SKILL_ROOT, inputArg);
if (!existsSync(inputPath)) {
  if (jsonOutput) console.log(JSON.stringify({ ok: false, error: `文件不存在: ${inputPath}` }));
  else console.error(`[verify-chart-data-blocks] ❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

const content = readFileSync(inputPath, 'utf-8');

// ── 匹配所有图表数据块 ──
// 格式: #### 图{N}：{标题}（{类型}） 或 ### 图{N}
const chartBlockRegex = /(?:####|###)\s*图\s*(\d+)[：:]\s*(.+?)(?=\n(?:####|###)\s*图\s*\d+|\n##\s|\n---\s*$|$)/gs;

const blocks = [];
let match;
while ((match = chartBlockRegex.exec(content)) !== null) {
  blocks.push({
    id: match[1],
    title: match[2].split('\n')[0].trim(),
    content: match[0],
  });
}

if (blocks.length === 0) {
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, error: '未找到任何图表数据块' }));
  } else {
    console.error('[verify-chart-data-blocks] ❌ 未找到任何图表数据块（`### 图N：`）');
    console.error('  文件可能不含图表数据块，或格式不匹配');
  }
  process.exit(1);
}

// ── 定义占位符列表 ──
const PLACEHOLDERS = [
  /TODO/i, /FIXME/i, /待补充/, /待填写/, /TBD/i,
  /\{\{placeholder\}\}/i, /\{\{data\}\}/i, /\[待定\]/,
  /数据见\s*analysis-state\.md/, /参见第\d轮/,
  /awaiting/i, /pending/i, /N\/A/i,
  /此处填/, /略/, /<待>/,
];

// ── 逐块校验 ──
const results = [];
let missingCount = 0;
let placeholderCount = 0;
let invalidJsonCount = 0;
let validCount = 0;

for (const block of blocks) {
  const blockContent = block.content;
  const status = { id: block.id, title: block.title, valid: true, issues: [] };

  // 检查是否有结构化数据表格
  const hasDataTable = /\|.+\|/.test(blockContent);
  // 检查是否有 JSON 数据
  // 精确 JSON 检测：要求包含 "key": value 模式或对象数组，避免 Markdown 链接误匹配
  const hasJsonData = /\{\s*"[^"]+"\s*:\s*/.test(blockContent) || /\[[\s\n\r]*\{/.test(blockContent);

  if (!hasDataTable && !hasJsonData) {
    status.valid = false;
    status.issues.push('无结构化数据（无表格也无 JSON）');
    missingCount++;
  } else {
    // 检查占位符
    for (const placeholder of PLACEHOLDERS) {
      if (placeholder.test(blockContent)) {
        status.valid = false;
        status.issues.push(`发现占位符: ${placeholder.source.replace(/\\/g, '')}`);
        placeholderCount++;
      }
    }

    // 检查数据表是否只有表头
    const tableRows = blockContent.match(/^\|.+\|$/gm) || [];
    const dataRows = tableRows.filter(r => !/^[\|\s\-:]+$/.test(r) && !/字段|名称|类别|数值|指标/i.test(r));
    if (dataRows.length === 0 && hasDataTable) {
      status.valid = false;
      status.issues.push('数据表仅含表头，无数据行');
      missingCount++;
    }

    // 如果声称需要 JSON（数据类型标注了，但 JSON 无法 parse）
    if (hasJsonData && !hasDataTable) {
      // 尝试提取 JSON
      const jsonMatch = blockContent.match(/(\[[\s\S]*?\]|\{[\s\S]*?\})/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[1]);
        } catch {
          status.issues.push('JSON 数据块解析失败');
          invalidJsonCount++;
          if (status.valid) {
            status.valid = false;
            missingCount++;
          }
        }
      }
    }
  }

  if (status.valid) validCount++;
  results.push(status);
}

const acceptable = missingCount <= maxMissing;
const allValid = missingCount === 0 && placeholderCount === 0;

const result = {
  ok: acceptable,
  all_valid: allValid,
  total: blocks.length,
  valid: validCount,
  missing: missingCount,
  placeholders: placeholderCount,
  json_errors: invalidJsonCount,
  max_allowed_missing: maxMissing,
  acceptable,
  blocks: results.map(r => ({
    id: r.id,
    title: r.title,
    valid: r.valid,
    issues: r.issues,
  })),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[verify-chart-data-blocks] 📦 图表数据块完整性校验`);
  console.log(`  文件: ${inputPath}`);
  console.log(`  总计: ${blocks.length} 个数据块`);
  console.log(`  完整: ${validCount} 个`);
  console.log(`  缺失: ${missingCount} 个（允许 ≤ ${maxMissing}）`);
  console.log(`  占位符: ${placeholderCount} 处`);
  if (invalidJsonCount > 0) console.log(`  JSON 错误: ${invalidJsonCount} 个`);

  if (missingCount > 0 || placeholderCount > 0) {
    console.log(`\n  明细:`);
    for (const r of results) {
      if (!r.valid) {
        console.log(`    ❌ 图${r.id}: ${r.title}`);
        for (const issue of r.issues) {
          console.log(`       ↳ ${issue}`);
        }
      }
    }
  }

  if (allValid) {
    console.log(`\n  🎯 全部数据块完整 — 可直接填入图表模板`);
  } else if (acceptable) {
    console.log(`\n  ⚠️  缺失数在允许范围内 (${missingCount} ≤ ${maxMissing}) — 缺失图表将降级为文字替代`);
  } else {
    console.log(`\n  ❌ 缺失数超出上限 (${missingCount} > ${maxMissing}) — 请回到阶段 6 补全数据块`);
  }
}

process.exit(acceptable ? 0 : 1);
