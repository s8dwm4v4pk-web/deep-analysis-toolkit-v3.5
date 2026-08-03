/**
 * hash-data.mjs — 计算数据文件的 SHA-256 前 8 位
 *
 * 用法: node agent-tools/scripts/hash-data.mjs <数据文件路径>
 * 输出: 8 位十六进制字符串
 *
 * 用途: 为 analysis-state.md 生成 data_hash，确保全流程引用的是同一份数据
 *       后续轮次从 analysis-state.md 读取 data_hash 用于校验
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '../..');

const filePath = resolve(SKILL_ROOT, process.argv[2] || '');
if (!process.argv[2]) {
  console.error('用法: node agent-tools/scripts/hash-data.mjs <数据文件路径>');
  process.exit(2);
}

try {
  const content = readFileSync(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  const shortHash = hash.substring(0, 8);
  console.log(shortHash);
} catch (e) {
  console.error('文件读取失败:', e.message);
  process.exit(1);
}
