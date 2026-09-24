# -*- coding: utf-8 -*-
"""删掉目录里「同公司 + 同名 + 同发售月」的真重复作品（title + titleDetail 成对删）。

来源：P1 归并时把被砍公司的作品挂到 75 家，重复来源的作品被一起挂过来，于是同一款
游戏在目录里出现两次（据实两条 stats/score 略有差异）。后果是同一部作在榜单/奖项/
世界发售流里被算两遍。

保留规则（优先级从高到低）：
  1. 被外部引用的那条（事件线 / offer / 系列 / 其他地方提到过 id）—— 删掉会产生孤儿引用
  2. landmark（叙事锚点，P5 六章编排要用）
  3. score / prestige 更高者
  4. devStart 更早者（在 cycleMult 之后覆盖面更宽）

幂等：已经不存在就跳过。写盘前备份 scripts/_cw_before_dedupe.json。
用法：python scripts/patch_dedupe_titles.py [--dry-run]
"""
import json
import shutil
import sys

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_dedupe.json"

# 每组给两个 id，脚本自己按规则挑保留谁。
GROUPS = [
    ("mw1", "cod4"),                # 使命召唤4：现代战争
    ("mw2", "codmw2"),              # 使命召唤：现代战争2
    ("honkai2", "honkaiImpact2"),   # 崩坏学园2
    ("bladeSoul", "bns"),           # 剑灵
    ("wuwa", "wuthering"),          # 鸣潮
    ("zzz", "zzz1"),                # 绝区零
    ("xcomEu", "xcom"),             # XCOM/幽浮：未知敌人
]


def ref_count(raw, tid):
    """raw JSON 里该 id 出现的次数。每条 title/detail 各 1 次（"id": "xxx"），
    所以 2 = 只有定义、无人引用；>2 = 被别处引用。"""
    return raw.count('"%s"' % tid)


def keep_of(raw, tm, a, b):
    scored = []
    for tid in (a, b):
        if tid not in tm:
            return None
        t = tm[tid]
        scored.append((ref_count(raw, tid), 1 if t.get("landmark") else 0,
                       float(t.get("score") or 0), float(t.get("prestige") or 0), tid))
    scored.sort(key=lambda r: (-r[0], -r[1], -r[2], -r[3]))
    return scored[0][4], scored


def main():
    dry = "--dry-run" in sys.argv
    raw = open(PATH, encoding="utf-8").read()
    d = json.loads(raw)
    tm = {t["id"]: t for t in d["titles"]}
    dm = {x["id"]: x for x in d["titleDetails"]}

    drops = []
    print("%-16s %-16s %s" % ("keep", "drop", "依据(refs/landmark/score/prestige)"))
    for a, b in GROUPS:
        got = keep_of(raw, tm, a, b)
        if got is None:
            print("  跳过 %s/%s：至少一条已不存在" % (a, b))
            continue
        keep, scored = got
        drop = b if keep == a else a
        info = " | ".join("%s refs=%d lm=%d s=%s p=%s" % (r[4], r[0], r[1], r[2], r[3])
                          for r in sorted(scored, key=lambda r: r[4]))
        print("%-16s %-16s %s" % (keep, drop, info))
        if keep != drop:
            drops.append((keep, drop))

    if not drops:
        print("无改动（已是最新）")
        return
    if dry:
        print("\n[dry-run] 将删 %d 部（titles+details 成对）" % len(drops))
        return

    shutil.copyfile(PATH, BACKUP)
    drop_ids = set(x[1] for x in drops)
    d["titles"] = [t for t in d["titles"] if t["id"] not in drop_ids]
    d["titleDetails"] = [x for x in d["titleDetails"] if x["id"] not in drop_ids]
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")

    chk = json.loads(open(PATH, encoding="utf-8").read())
    assert len(chk["titles"]) == 530 - len(drops), len(chk["titles"])
    assert len(chk["titleDetails"]) == 530 - len(drops)
    for _, drop in drops:
        assert drop not in {t["id"] for t in chk["titles"]}, drop
    print("\n删除 %d 部，titles %d，备份 %s" % (len(drops), len(chk["titles"]), BACKUP))


main()
