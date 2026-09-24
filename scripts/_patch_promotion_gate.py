#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""职级晋升门槛修补（幂等）：见 activity/issues/bug-career-rank-outruns-stats.md。

① jobRanks.promotion 增加 gateInFunction / storyBypass / inviteRankBump 三块；
② 两条晋升线（promo-to-expert / promo-to-director）的「接受」选项补 storyPromo: true
   —— 它们本来就是剧情晋升，缺这个标记会连年度上限都不走。

备份：scripts/_cw_before_promotion_gate.json（只在首次真正改动时写）。
"""
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW = os.path.join(ROOT, "activity", "career-world.json")
BK = os.path.join(ROOT, "scripts", "_cw_before_promotion_gate.json")

ANCHOR = '''   "maxPerYear": 1,
'''

NEW_KEYS = '''   "gateInFunction": true,
   "storyBypass": true,
   "inviteRankBump": {
    "comment": "挖人（邀约）带职级的条件。旧口径是 canPromoteCareer 或 fame>=8 —— 声望与主职维无关，于是「每年被挖一次 +1 级」成了绕过 mainStat 硬门槛的主通道（实测占全部晋升 52.6%，终局 T6 时主职维平均只有 46.7）。现在：requireQualified 要求够晋升资格才带级；mainStatSlack>0 才允许「主职维差一点点也带」；fameFallback 设 0 即彻底不用声望兜底。",
    "enabled": true,
    "requireQualified": true,
    "mainStatSlack": 0,
    "fameFallback": 0
   },
'''

OPT_OLD = '''        "label": "%s",
        "advance": true,
        "complete": true,
        "effects": {
         "promote": true
        }'''
OPT_NEW = '''        "label": "%s",
        "advance": true,
        "complete": true,
        "effects": {
         "promote": true,
         "storyPromo": true
        }'''


def main():
    raw = io.open(CW, encoding="utf-8").read()
    data = json.loads(raw)
    promo = data["jobRanks"]["promotion"]
    changed = []

    # ① promotion 段补三块（⚠ 已被 _patch_promotion_stat_only.py 取代：inviteRankBump 换成
    # inviteRank；这里只在「既没有 inviteRank 也没有 inviteRankBump」的老数据上补 legacy 块）
    if "inviteRank" not in promo and "inviteRankBump" not in promo:
        assert raw.count(ANCHOR) == 1, "promotion anchor not unique"
        raw = raw.replace(ANCHOR, ANCHOR + NEW_KEYS, 1)
        changed.append("promotion += gateInFunction/storyBypass/inviteRankBump")

    # ② 两条晋升线补 storyPromo
    for label in ("接受晋升", "接受任命"):
        old = OPT_OLD % label
        new = OPT_NEW % label
        if new in raw:
            continue
        assert raw.count(old) == 1, "option anchor not unique: " + label
        raw = raw.replace(old, new, 1)
        changed.append("option 「%s」 += storyPromo" % label)

    if not changed:
        print("already patched; nothing to do")
        return 0

    if not os.path.exists(BK):
        shutil.copyfile(CW, BK)
        print("backup ->", BK)

    chk = json.loads(raw)
    p = chk["jobRanks"]["promotion"]
    assert p["gateInFunction"] is True and p["inviteRankBump"]["requireQualified"] is True
    assert p["inviteRankBump"]["fameFallback"] == 0

    io.open(CW, "w", encoding="utf-8", newline="\n").write(raw)
    print("patched: " + "; ".join(changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
