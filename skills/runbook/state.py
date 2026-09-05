#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Colorbox 活动交付状态机代理入口。

用法（在活动工作区运行，activity/ 产物目录默认取当前目录下 activity/）：
    python3 state.py init                  # 初始化任务状态（无 activity.json 也可，默认身份 workspace）
    python3 state.py current [--json]      # 每轮必跑：注入当前阶段指引
    python3 state.py confirm <phase>       # 标记某阶段已获确认（用户「确认」/ 自检通过）
    python3 state.py advance [--note ...]  # 门禁通过后翻到下一阶段
    python3 state.py reject [--to <phase>] # 打回（如测试失败回 implement）
    python3 state.py log <note>            # 追加历史备注
    python3 state.py goto <phase>          # 显式跳转（纠正用）
    python3 state.py tree [--json]         # 查看决策树：已定/待定/前沿
    python3 state.py decide <id> <选项>    # 记录一个决策（依赖未定会被拒绝）
    python3 state.py clean                 # 一键清空环境（活动产物、状态文件与缓存）

状态落盘：state/<identity>.json（identity = activity.json 的 activityId，缺省 workspace）；
阶段定义：PROCESS.md（唯一事实源，改流程只改它）；激活链 = 文件中非可选阶段的顺序。
身份与凭据分离：activity.json 只放活动身份；credentials.json 放云凭据（仅部署阶段用）。
决策树：activity/decisions.json（requirements 阶段产物，只经 state.py decide 修改）。
"""
from __future__ import annotations

import sys
from cli.commands import main

if __name__ == "__main__":
    sys.exit(main())
