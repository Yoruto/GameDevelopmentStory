# -*- coding: utf-8 -*-
"""P3 前置配平（2026-09-20 拍板选①）：statGain.perDevMonth 0.12 -> 0.10。

背景：P2-fix-a/b 把空窗从 151 月压到 5 月，凭空多出 146 个有成长的月份，
34 年主职维终值抬到 97.7（probe 实测）。本次只削 perDevMonth 一个数，
把曲线拉回 80 出头；promotion.requirements[].mainStat 门槛不动。

幂等：二次运行时若已是 0.10 则直接跳过。备份：scripts/_cw_before_perdevmonth.json。
"""
import io
import json
import os
import sys

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "activity", "career-world.json")
P = os.path.normpath(P)

OLD_NUM = '"perDevMonth": 0.12,'
NEW_NUM = '"perDevMonth": 0.10,'

# comment 是单行长串，锚点取其中唯一片段
OLD_COMMENT = "实测原本 34 年主维能到 111.7，现在到 80 出头，属性重新变成「一辈子的事业」。"
NEW_COMMENT = (
    "实测原本 34 年主维能到 111.7，到 80 出头，属性重新变成「一辈子的事业」。"
    "2026-09-20 P2-fix 填满空窗（空窗 151→5 月，凭空多 146 个成长月）把终值抬到 97.7，"
    "Master 拍板选「削 perDevMonth 0.12→0.10」（只动这一个数、不抬晋升门槛），"
    "把 34 年主维终值拉回 80 出头——本句「80 出头」的实测自此重新成立。"
)

s = io.open(P, encoding="utf-8", newline="").read()

if NEW_NUM in s and OLD_NUM not in s:
    print("already patched (perDevMonth=0.10), skip")
    sys.exit(0)

assert s.count(OLD_NUM) == 1, "perDevMonth 锚点不唯一或缺失: count=%d" % s.count(OLD_NUM)
assert s.count(OLD_COMMENT) == 1, "comment 锚点不唯一或缺失: count=%d" % s.count(OLD_COMMENT)

s = s.replace(OLD_NUM, NEW_NUM).replace(OLD_COMMENT, NEW_COMMENT)

json.loads(s)  # 语法自检

io.open(P, "w", encoding="utf-8", newline="").write(s)

# 写后立刻回读确认键值
chk = json.loads(io.open(P, encoding="utf-8", newline="").read())
sg = chk["jobRanks"]["statGain"] if "jobRanks" in chk and "statGain" in chk.get("jobRanks", {}) else chk.get("statGain")
print("perDevMonth ->", sg["perDevMonth"])
print("perRelease ->", sg["perRelease"])
print("perPostLaunchMonth ->", sg["perPostLaunchMonth"])
