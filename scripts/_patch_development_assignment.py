#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""给 career-world.json 的 development 段补 development.assignment 派工偏好块（幂等）。

用法：
  python scripts/_patch_development_assignment.py            # B 段：preferFresh + freshBucket
  python scripts/_patch_development_assignment.py --stage a  # A 段：另加 maxProgress + waitMaxMonths

约定：JSON 明文无 \\u 转义、LF；用精确字符串替换写盘 + json.loads 复核。
备份：scripts/_cw_before_assignment.json（只在首次真正改动时写，不覆盖已有备份）。
"""
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW = os.path.join(ROOT, "activity", "career-world.json")
BK = os.path.join(ROOT, "scripts", "_cw_before_assignment.json")

ANCHOR = '  "cycleMult": 1.75,\n'

COMMENT = ('派工偏好：玩家接下一部作时挑哪部（见 activity/issues/'
           'bug-career-project-phase-starts-midgame.md）。preferFresh 开着先按进度分桶'
           '（freshBucket=0.25 即四分位），桶内仍按 prestige → 发售最早——优先把玩家放进刚开工的作，'
           '又不打乱重点作品优先；关掉即回到旧的纯 prestige 排序。maxProgress 是硬门槛：'
           '当月所有候选都做得比它更深时拒收，改走池作/空窗等下一部开工'
           '（最长 waitMaxMonths 个月；超了退回最浅候选，永不死锁）。')

B_BODY = '   "preferFresh": true,\n   "freshBucket": 0.25\n'
A_BODY = '   "preferFresh": true,\n   "freshBucket": 0.25,\n   "maxProgress": 0.7,\n   "waitMaxMonths": 8\n'


def make_block(body):
    return '  "assignment": {\n   "comment": "%s",\n%s  },\n' % (COMMENT, body)


def main():
    stage = "a" if "--stage" in sys.argv and "a" in sys.argv else "b"
    raw = io.open(CW, encoding="utf-8").read()
    data = json.loads(raw)
    dev = data.get("development", {})

    if "assignment" in dev:
        print("already patched: development.assignment exists ->", json.dumps(dev["assignment"], ensure_ascii=False))
        return 0

    if ANCHOR not in raw:
        print("ERROR: anchor not found:", repr(ANCHOR))
        return 1

    if not os.path.exists(BK):
        shutil.copyfile(CW, BK)
        print("backup ->", BK)

    # B 段先只落「新鲜度偏好」，硬门槛（maxProgress / waitMaxMonths）留到 A 段。
    block = make_block(A_BODY if stage == "a" else B_BODY)

    new = raw.replace(ANCHOR, ANCHOR + block, 1)
    # 复核：能解析、且新块确实在 development 里
    chk = json.loads(new)
    got = chk["development"]["assignment"]
    assert got["preferFresh"] is True and abs(got["freshBucket"] - 0.25) < 1e-9, got

    io.open(CW, "w", encoding="utf-8", newline="\n").write(new)
    print("patched (stage %s):" % stage, json.dumps(got, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
