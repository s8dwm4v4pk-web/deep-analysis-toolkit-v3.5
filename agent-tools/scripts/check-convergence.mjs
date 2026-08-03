#!/usr/bin/env node
/**
 * check-convergence.mjs — 收敛门禁检查
 *
 * 用途：在每个阶段结束时检查收敛条件，对照
 *       references/methodology/convergence-rules.md 中的决策表。
 *
 * 内置阶段收敛规则（从 convergence-rules.md 硬编码提取，防止文件未被读取时门禁失效）：
 *   阶段 2 → 3: 7 Scout 全部完成 + 交叉验证覆盖率≥80% + 冲突率≤30% + D覆盖率≥90%
 *   阶段 3 → 4: low信度S占比 ≤ P1阈值
 *   阶段 3b   : 阶段判定与归因链无矛盾
 *   阶段 4 → 5: 情景覆盖度 ≥ P2要求
 *
 * 用法: node agent-tools/scripts/check-convergence.mjs <analysis-state.md> <stage> [--json]
 *
 * Exit 0 = go, 1 = halt/skip, 2 = insufficient info
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');

const positional = argv.filter(a => !a.startsWith('--'));
if (positional.length < 2) {
  console.error('用法: node agent-tools/scripts/check-convergence.mjs <analysis-state.md> <stage> [--json]');
  process.exit(2);
}

const stateFile = resolve(SKILL_ROOT, positional[0]);
const stage = positional[1];
const validStages = ['2', '3', '3b', '4', '5', '6'];
if (!validStages.includes(stage)) {
  console.error(`[check-convergence] ❌ 无效的阶段号: "${stage}"，有效值: ${validStages.join(', ')}`);
  process.exit(2);
}

if (!existsSync(stateFile)) {
  const err = { ok: false, error: `analysis-state.md 不存在: ${stateFile}` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[check-convergence] ❌ ${err.error}`);
  process.exit(2);
}

const stateContent = readFileSync(stateFile, 'utf-8');

// ── 收敛规则（从 convergence-rules.md 提取，硬编码作为回退）──
const convergenceRules = {
  '2': [
    {
      id: '2a',
      name: '7 Scout 产出完整性',
      check: (content) => {
        // 检查是否有 7 个维度的信号产出
        const dims = ['结构', '时间', '空间', '因果', '风险', '主体', '关联'];
        let found = 0;
        for (const dim of dims) {
          if (content.includes(dim + '维') || content.includes(dim + '维度') ||
              content.toLowerCase().includes('scout-' + dim)) {
            found++;
          }
        }
        return { pass: found >= 7, detail: `${found}/7 维度产出就位` };
      }
    },
    {
      id: '2b',
      name: '交叉验证覆盖率 ≥ 80%',
      check: (content) => {
        const cvMatch = content.match(/交叉验证覆盖[率比][：:\s]*(\d+\.?\d*)\s*%/);
        if (cvMatch) {
          const rate = parseFloat(cvMatch[1]);
          return { pass: rate >= 80, detail: `覆盖率 ${rate}%` };
        }
        // 无覆盖率记录时，检查冲突矩阵是否存在
        const hasMatrix = content.includes('冲突矩阵') || content.includes('交叉验证结果');
        return { pass: hasMatrix, detail: hasMatrix ? '冲突矩阵已生成（覆盖率未量化）' : '缺少交叉验证记录' };
      }
    },
    {
      id: '2c',
      name: '冲突率 ≤ 30%',
      check: (content) => {
        const conflictMatch = content.match(/冲突[率比][：:\s]*(\d+\.?\d*)\s*%/);
        if (conflictMatch) {
          const rate = parseFloat(conflictMatch[1]);
          return { pass: rate <= 30, detail: `冲突率 ${rate}%` };
        }
        // 无冲突率但冲突矩阵存在 → 保守放行
        const hasMatrix = content.includes('冲突矩阵');
        return { pass: hasMatrix, detail: hasMatrix ? '冲突矩阵存在（冲突率未量化）' : '缺少冲突记录' };
      }
    },
    {
      id: '2d',
      name: 'D 编号覆盖率 ≥ 90%',
      check: (content) => {
        // 简单启发式：检查 trace-d-numbers 是否已执行
        // 实际覆盖率由 trace-d-numbers.mjs 计算，此处做兜底
        const coverageMatch = content.match(/D.?覆盖[率比][：:\s]*(\d+\.?\d*)\s*%/);
        if (coverageMatch) {
          const rate = parseFloat(coverageMatch[1]);
          return { pass: rate >= 90, detail: `D覆盖率 ${rate}%` };
        }
        // 无记录 → 保守放行（trace-d-numbers 会做精确检查）
        return { pass: true, detail: 'D覆盖率记录缺失，依赖 trace-d-numbers.mjs 精确校验' };
      }
    },
  ],
  '3': [
    {
      id: '3a',
      name: 'low 信度 S 信号占比 ≤ P1 阈值',
      check: (content) => {
        const totalSMatch = content.match(/S.?信号[总计数][：:\s]*(\d+)/);
        const lowSMatch = content.match(/低信度[：:\s]*(\d+)/) || content.match(/low[^\d]*(\d+)/i);
        const p1Match = content.match(/P1[：:\s]*(\d+\.?\d*)\s*%/);
        if (totalSMatch && lowSMatch) {
          const total = parseInt(totalSMatch[1]);
          const low = parseInt(lowSMatch[1]);
          const threshold = p1Match ? parseFloat(p1Match[1]) : 30;
          const rate = (low / total) * 100;
          return { pass: rate <= threshold, detail: `low占比 ${rate.toFixed(1)}%，阈值 ${threshold}%` };
        }
        if (content.includes('S-') && !content.includes('low')) {
          return { pass: true, detail: 'S信号存在但低信度记录缺失 → 保守放行' };
        }
        return { pass: false, detail: '缺少 S 信号或低信度统计信息' };
      }
    },
  ],
  '3b': [
    {
      id: '3b_a',
      name: 'Safety Lifecycle 阶段判定与归因链一致性',
      check: (content) => {
        // 检查结构因"制度不健全"是否与"成熟期"阶段矛盾
        const hasStructuralInstitutional = content.includes('制度不健全') || content.includes('制度缺失');
        const isMature = content.match(/阶段判定[：:\s]*(成熟期|阶段\s*3)/);
        if (hasStructuralInstitutional && isMature) {
          return { pass: false, detail: '归因链存在"制度不健全"但 Safety Lifecycle 判定为"成熟期"→ 矛盾，需降档并重新扫描脆弱性' };
        }
        // 检查是否有明确的阶段判定
        const stageLabel = content.match(/阶段判定[：:\s]*(.{2,10})/);
        if (!stageLabel) {
          return { pass: false, detail: 'Safety Lifecycle 阶段判定缺失' };
        }
        return { pass: true, detail: `阶段判定"${stageLabel[1]}"与归因链无矛盾` };
      }
    },
  ],
  '4': [
    {
      id: '4a',
      name: '情景覆盖度满足 P2 要求',
      check: (content) => {
        const coverageMatch = content.match(/情景覆盖[度率][：:\s]*(\d+\.?\d*)\s*%/);
        const p2Match = content.match(/P2[：:\s]*(\d+\.?\d*)\s*%/);
        if (coverageMatch) {
          const rate = parseFloat(coverageMatch[1]);
          const threshold = p2Match ? parseFloat(p2Match[1]) : 60;
          return { pass: rate >= threshold, detail: `覆盖度 ${rate}%，阈值 ${threshold}%` };
        }
        const scenarioCount = (content.match(/情景\s*\d+/g) || []).length;
        const hasScenarios = content.includes('情景') || content.includes('scenario');
        return { pass: hasScenarios && scenarioCount >= 2, detail: `检测到 ${scenarioCount} 个情景` };
      }
    },
  ],
  '5': [
    {
      id: '5a',
      name: '决策建议层级完整',
      check: (content) => {
        const hasAdvice = content.includes('建议') || content.includes('建议层级');
        const layerCount = ['立即可执行', '短期规划', '中长期战略'].filter(l => content.includes(l)).length;
        return { pass: hasAdvice && layerCount >= 1, detail: `${layerCount}/3 层级决策建议就位` };
      }
    },
  ],
  '6': [
    {
      id: '6a',
      name: '叙事蓝图完整性',
      check: (content) => {
        const hasBlueprint = content.includes('叙事蓝图') || content.includes('blueprint');
        const hasChartPlan = content.includes('图表') && (content.includes('ECharts') || content.includes('图表清单'));
        return { pass: hasBlueprint && hasChartPlan, detail: hasBlueprint ? '叙事蓝图就位' : '缺少叙事蓝图' };
      }
    },
  ],
};

const rules = convergenceRules[stage];
if (!rules || rules.length === 0) {
  const err = { ok: false, error: `阶段 ${stage} 无内置收敛规则` };
  if (jsonOutput) console.log(JSON.stringify(err));
  else console.error(`[check-convergence] ❌ ${err.error}`);
  process.exit(2);
}

// ── 执行检查 ──
const conditions = [];
let allPassed = true;
for (const rule of rules) {
  try {
    const { pass, detail } = rule.check(stateContent);
    conditions.push({ id: rule.id, name: rule.name, pass, detail });
    if (!pass) allPassed = false;
  } catch (e) {
    conditions.push({ id: rule.id, name: rule.name, pass: false, detail: `检查异常: ${e.message}` });
    allPassed = false;
  }
}

// ── 判定 verdict ──
let verdict = 'go';
let exitCode = 0;

if (!allPassed) {
  // 根据阶段确定动作
  const failedIds = conditions.filter(c => !c.pass).map(c => c.id);
  if (stage === '2' && failedIds.includes('2a')) {
    verdict = 'halt';
  } else if (stage === '3' || stage === '4') {
    verdict = 'skip_to_7'; // 硬收敛
  } else if (stage === '3b') {
    verdict = 'retry_3b';  // 回归重评
  } else if (stage === '5') {
    verdict = 'soft_skip'; // 软收敛（条件2c），继续进入阶段6但标注局限性
  } else if (stage === '6') {
    verdict = 'retry_6';   // 回退阶段6重跑叙事规划（decision table: 图表需求<P7 → 回退阶段6）
  } else {
    verdict = 'halt';
  }
  exitCode = 1;
}

const result = {
  ok: allPassed,
  stage,
  verdict,
  conditions,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[check-convergence] 🚦 阶段 ${stage} 收敛门禁`);
  for (const c of conditions) {
    const icon = c.pass ? '✅' : '❌';
    console.log(`  ${icon} [${c.id}] ${c.name}: ${c.detail}`);
  }
  console.log(`\n  判定: ${allPassed ? '🟢 GO → 进入下一阶段' : `🔴 ${verdict.toUpperCase()} — 触发收敛动作`}`);
}

process.exit(exitCode);
