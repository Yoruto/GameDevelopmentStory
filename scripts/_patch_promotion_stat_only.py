#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""晋升只看属性 + 挖人按属性给位置（幂等）。见 activity/issues/bug-career-rank-outruns-stats.md。

① 移除 promotion.requirements[].mainStatOrJobXp（「主职维或职级经验二选一」）；
② promotion.inviteRankBump → promotion.inviteRank（mode=stat：按主职维够到的职级给，公司体量封顶）；
③ mobility 加 inviteFitPenalty（邀约挑选按「属性档位 ↔ 公司体量」匹配度加权）；
④ 更新 promotion.comment / mobility.comment 的口径说明。

备份：scripts/_cw_before_promotion_stat_only.json
"""
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW = os.path.join(ROOT, "activity", "career-world.json")
BK = os.path.join(ROOT, "scripts", "_cw_before_promotion_stat_only.json")

OLD_PROMO_COMMENT = ('普通晋升必须够 mainStat；mainStatOrJobXp 仍是主职维或职级经验二选一。'
                     '故事/事件线 effects.promote 走 applyCareerPromotion(story) 可跳过门槛。'
                     'mainStat 门槛按「开局主维约 24 起算的增量」标定，2026-09-18 随属性成长削弱 35% 同步下调'
                     '（30/40/50/65/80 → 28/34/41/51/60），保住原本的升职年份节奏。'
                     'mainStatOrJobXp 那条走 jobXp，jobXpGain 未参与削弱，故维持原值。')

NEW_PROMO_COMMENT = ('晋升只看属性：requirements[].mainStat（28/34/41/51/60）是无条件硬门槛，'
                     '按「开局主维约 24 起算的增量」标定，2026-09-18 随属性成长削弱 35% 同步下调'
                     '（30/40/50/65/80 → 28/34/41/51/60）。2026-09-22 移除 mainStatOrJobXp'
                     '（原「主职维或职级经验二选一」）：jobXp 每开发月 +1、生涯能到 400+，那条条款永远满足，'
                     '既不拦人也不赋能——职级经验现在只是展示与人设素材（天赋 jobXpMult、事件 jobXpDelta 仍在加它），'
                     '不再参与晋升判定。故事/事件线 effects.promote 走 applyCareerPromotion(story) 仍可跳过门槛'
                     '（storyBypass）。')

NEW_INVITE_RANK = '''   "inviteRank": {
    "comment": "挖人/跳槽给什么职级。mode=stat（默认）：按玩家主职维够到的那一级给——外面只认能力、不认你在这家公司熬的资历；结果是 max(当前职级, 属性够到的职级)，再按公司体量用 rankCapByPower 封顶（小作坊给不了总监位）。mode=bump 是旧写法「当前职级 +1」，那版唯一的条件是 fame>=8（声望与主职维无关），已废。",
    "enabled": true,
    "mode": "stat",
    "rankCapByPower": {
     "1": 3,
     "2": 5,
     "3": 6
    }
   },
'''

MOBILITY_ANCHOR = '''  "inviteMaxPerYear": 1,
'''
MOBILITY_ADD = '''  "inviteFitPenalty": 0.35,
'''

MOBILITY_COMMENT_TAIL = ('邀约（挖人）按年掷骰：inviteChance 就是「这一年会不会有厂商来挖」的概率，'
                         '命中后最多给 inviteMaxPerYear 条；邀约本身必成（acceptCareerInvite 不掷骰）。')
MOBILITY_COMMENT_ADD = ('挖人来的那一家要跟玩家属性档次匹配：抽公司权重除了熟练度/声望/国内加成，'
                        '再乘 1/(1+|属性够到的职级 − 该公司体量对应的理想职级|×inviteFitPenalty)，'
                        'inviteFitPenalty=0 即关掉这个倾斜。给到的职级见 jobRanks.promotion.inviteRank。')


def cut_block(raw, key):
    """按花括号配平切掉 `"key": {...},` 整块，返回 (新文本, 旧块文本)。"""
    i = raw.index('"' + key + '"')
    ls = raw.rfind("\n", 0, i) + 1
    j = raw.index("{", i)
    depth, k = 0, j
    while True:
        c = raw[k]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    end = k + 1
    while end < len(raw) and raw[end] in ",\n":
        end += 1
    return raw[:ls] + raw[end:], raw[ls:end]


def main():
    raw = io.open(CW, encoding="utf-8").read()
    changed = []

    # ① 移除 mainStatOrJobXp
    new, n = re.subn(r'\n\s*"mainStatOrJobXp": \d+,', "", raw)
    if n:
        raw = new
        changed.append("removed mainStatOrJobXp x%d" % n)

    # ② promotion.comment 换口径
    if OLD_PROMO_COMMENT in raw:
        raw = raw.replace(OLD_PROMO_COMMENT, NEW_PROMO_COMMENT, 1)
        changed.append("rewrote promotion.comment")

    # ③ inviteRankBump -> inviteRank
    if '"inviteRankBump"' in raw:
        raw, _old = cut_block(raw, "inviteRankBump")
        anchor = '   "onShip": true,\n'
        assert raw.count(anchor) == 1, "onShip anchor not unique"
        raw = raw.replace(anchor, NEW_INVITE_RANK + anchor, 1)
        changed.append("inviteRankBump -> inviteRank(mode=stat)")

    # ④ mobility 加 inviteFitPenalty
    if '"inviteFitPenalty"' not in raw:
        assert raw.count(MOBILITY_ANCHOR) == 1, "inviteMaxPerYear anchor not unique"
        raw = raw.replace(MOBILITY_ANCHOR, MOBILITY_ANCHOR + MOBILITY_ADD, 1)
        changed.append("mobility += inviteFitPenalty")

    # ⑤ mobility.comment 补口径
    if MOBILITY_COMMENT_TAIL in raw and MOBILITY_COMMENT_ADD not in raw:
        raw = raw.replace(MOBILITY_COMMENT_TAIL, MOBILITY_COMMENT_TAIL + MOBILITY_COMMENT_ADD, 1)
        changed.append("mobility.comment += fit rule")

    if not changed:
        print("already patched; nothing to do")
        return 0

    if not os.path.exists(BK):
        shutil.copyfile(CW, BK)
        print("backup ->", BK)

    chk = json.loads(raw)
    p = chk["jobRanks"]["promotion"]
    assert "mainStatOrJobXp" not in json.dumps(chk["jobRanks"]["promotion"]["requirements"], ensure_ascii=False)
    assert p["inviteRank"]["mode"] == "stat" and p["inviteRank"]["rankCapByPower"]["1"] == 3
    assert chk["mobility"]["inviteFitPenalty"] == 0.35
    assert all(r is None or "mainStat" in r for r in p["requirements"])

    io.open(CW, "w", encoding="utf-8", newline="\n").write(raw)
    print("patched: " + "; ".join(changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
