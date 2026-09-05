#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""环境清理工具。

用于测试阶段一键清空活动产物数据、状态文件与 Python 缓存，恢复干净状态。

用法：
    python3 scripts/clean.py                   # 清理默认 activity/ 目录与当前任务状态
    python3 scripts/clean.py --all             # 清空 state/ 下所有 JSON 与 activity/ 目录
    python3 scripts/clean.py --activity-dir D  # 清理指定 activity 目录
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.io import load_identity
from core.paths import STATE_DIR, resolve_activity_dir


def clean_environment(activity_dir_str: str = "activity", clean_all: bool = False) -> int:
    """一键清理活动环境与状态。"""
    print("🧹 开始清理测试环境数据...")
    cleaned_items = 0

    # 1. 清理 state 状态文件
    if STATE_DIR.is_dir():
        if clean_all:
            for p in STATE_DIR.glob("*.json"):
                p.unlink()
                print(f"  ✓ 已删除状态文件: {p.relative_to(PROJECT_ROOT)}")
                cleaned_items += 1
        else:
            identity = (load_identity() or {}).get("activityId") or "workspace"
            state_file = STATE_DIR / f"{identity}.json"
            if state_file.is_file():
                state_file.unlink()
                print(f"  ✓ 已删除当前任务状态: {state_file.relative_to(PROJECT_ROOT)}")
                cleaned_items += 1

    # 2. 清理 activity/ 产物目录中的内容
    adir = resolve_activity_dir(activity_dir_str)
    if adir.is_dir():
        for item in adir.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
                print(f"  ✓ 已清理产物目录: {item.relative_to(PROJECT_ROOT) if item.is_relative_to(PROJECT_ROOT) else item}")
                cleaned_items += 1
            else:
                item.unlink()
                print(f"  ✓ 已清理产物文件: {item.relative_to(PROJECT_ROOT) if item.is_relative_to(PROJECT_ROOT) else item}")
                cleaned_items += 1

    # 3. 清理 Python __pycache__ 缓存目录
    for cache_dir in PROJECT_ROOT.glob("**/__pycache__"):
        if cache_dir.is_dir():
            shutil.rmtree(cache_dir)
            print(f"  ✓ 已清理缓存: {cache_dir.relative_to(PROJECT_ROOT)}")
            cleaned_items += 1

    print(f"✨ 环境清理完成！共清理 {cleaned_items} 项。现在可以运行 state.py init 重新测试。")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="一键清理活动环境与状态")
    ap.add_argument("--activity-dir", default="activity", help="活动产物目录（默认 ./activity）")
    ap.add_argument("--all", action="store_true", help="清理所有状态文件（而不仅仅是当前任务）")
    args = ap.parse_args()
    return clean_environment(args.activity_dir, args.all)


if __name__ == "__main__":
    sys.exit(main())
