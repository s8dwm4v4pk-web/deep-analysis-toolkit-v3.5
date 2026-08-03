#!/usr/bin/env python3
"""
merge-analysis-state.py — 确定性合并脚本
将阶段 1-5(+3b) 各自写入的独立状态文件合并为统一的 analysis-state.md
供质量门禁脚本（assemble/verify/trace/audit）审计消费；
阶段 6/7 的 LLM 执行按 v3.5 交接协议只读 handoff 摘要，不整读此文件。

调用方式:
  python agent-tools/scripts/merge-analysis-state.py <work_dir>

被合并的文件（必须全部存在，否则 HALT）:
  analysis-state-s1.md   → 阶段 1：数据基座
  analysis-state-s2.md   → 阶段 2：维度扫描
  analysis-state-s3.md   → 阶段 3：深度归因
  analysis-state-s3b.md  → 阶段 3b：Safety Lifecycle 评估
  analysis-state-s4.md   → 阶段 4：情景预判
  analysis-state-s5.md   → 阶段 5：决策建议
  （阶段 6 独立写 analysis-state-s6.md，并同步追加至本合并文件存档）

合并输出:
  analysis-state.md     → 统一存档文件（仅脚本审计，LLM 禁整读）

exit code:
  0  → 合并成功
  1  → 参数错误
  2  → 锚点文件缺失或不可读
  3  → 某个阶段文件缺失
  4  → 合并写入失败
"""

import sys
import os
import re
from datetime import datetime

# ─── 配置 ────────────────────────────────────────────
EXPECTED_FILES = [
    ("analysis-state-s1.md", "阶段 1 – 数据基座"),
    ("analysis-state-s2.md", "阶段 2 – 维度扫描"),
    ("analysis-state-s3.md", "阶段 3 – 深度归因"),
    ("analysis-state-s3b.md", "阶段 3b – Safety Lifecycle"),
    ("analysis-state-s4.md", "阶段 4 – 情景预判"),
    ("analysis-state-s5.md", "阶段 5 – 决策建议"),
]

HEADER = """# 分析状态文件（合并版）
> ⚠️ 本文件由 `merge-analysis-state.py` 从阶段 1-5(+3b) 独立文件合并生成。
> 阶段 6 独立写 analysis-state-s6.md 并同步追加至此文件存档。
> 本文件仅供质量门禁脚本审计使用；LLM 执行阶段 6/7 时禁整读，只读 handoff 摘要。
> 生成时间: {timestamp}

---

"""


def die(code: int, msg: str):
    print(f"[MERGE ERROR] {msg}", file=sys.stderr)
    sys.exit(code)


def validate_task_id(task_id: str) -> bool:
    """校验 task_id 格式: 2-12字符(中/英/数字)_8位日期_4位时间"""
    pattern = r'^[A-Za-z0-9\u4e00-\u9fff]{2,12}_\d{8}_\d{4}$'
    return bool(re.match(pattern, task_id))


def main():
    if len(sys.argv) < 2:
        die(1, "缺少参数。用法: python merge-analysis-state.py <work_dir>")

    work_dir = os.path.abspath(sys.argv[1])

    # ── 步骤 0: 验证工作目录 ──────────────────────────
    if not os.path.isdir(work_dir):
        die(2, f"工作目录不存在: {work_dir}")

    # ── 步骤 1: 校验任务目录命名 ──────────────────────
    dir_name = os.path.basename(work_dir.rstrip("/\\"))
    if not validate_task_id(dir_name):
        die(2, f"工作目录名不符合 task_id 格式: {dir_name}")

    # ── 步骤 2: 检查所有阶段文件是否存在 ──────────────
    missing_files = []
    for filename, label in EXPECTED_FILES:
        fpath = os.path.join(work_dir, filename)
        if not os.path.isfile(fpath):
            missing_files.append(f"  - {filename} ({label})")
        elif os.path.getsize(fpath) == 0:
            missing_files.append(f"  - {filename} ({label}) — 文件为空")

    if missing_files:
        die(3, f"缺少以下阶段文件:\n" + "\n".join(missing_files))

    # ── 步骤 3: 读取并合并 ────────────────────────────
    merged_content = HEADER.format(timestamp=datetime.now().strftime("%Y-%m-%d %H:%M"))

    for filename, label in EXPECTED_FILES:
        fpath = os.path.join(work_dir, filename)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        # 为每个阶段添加分隔标记
        merged_content += f"<!-- === {label} === -->\n\n"
        merged_content += content.strip() + "\n\n"

    # ── 步骤 4: 写入合并文件 ──────────────────────────
    output_path = os.path.join(work_dir, "analysis-state.md")
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(merged_content)
    except OSError as e:
        die(4, f"无法写入合并文件: {output_path}\n{e}")

    # ── 步骤 5: 输出合并报告 ──────────────────────────
    print(f"[MERGE OK] 合并完成")
    print(f"  输出: {output_path}")
    total_bytes = len(merged_content.encode("utf-8"))
    print(f"  总大小: {total_bytes} bytes ({total_bytes / 1024:.1f} KB)")
    print(f"  包含阶段: 1 → 2 → 3 → 3b → 4 → 5")
    sys.exit(0)


if __name__ == "__main__":
    main()
