# -*- coding: utf-8 -*-
"""P2-fix-b：让「过渡项目」（池作）本身成为有意义的一段经历。

背景：P2-fix 让池作从「待命太久才长出来的虚拟作」变成「公司排不出目录真作时的顶班」。
P2-fix-a 补完 188 部真实历史作品后，玩家时间轴上仍有 17% 是池作 —— 而池作原来是一条
**惩罚线**：不给奖项、不进榜单、履历里只写「过渡项目」，成长还被砍半
（xpPerVirtualRelease 5 vs 历史作 8、virtualReleaseScale / virtualScale 0.5、
virtualCreditWeight 0.4）。结果就是「你的职业生涯里近五分之一的时间在打白工」。

这一版把它掰成中性偏好的一条线，同时给足叙事交代：

  1. 成长对齐（不再罚）：
     · companyXp.xpPerVirtualRelease      5 → 7（历史作 8，留 1 点差距表示不是署名作）
     · jobRanks.statGain.virtualReleaseScale 0.5 → 0.75
     · jobRanks.jobXpGain.virtualScale       0.5 → 0.75
     · jobRanks.virtualCreditWeight       0.4 → 0.5（晋升的「作品学分」折价率）
  2. 开发期小幅加成（titlePool.devStatMult / devJobXpMult = 1.15）：
     小项目什么都得自己上手，所以池作的**开发月**成长比目录作略高。
     只在 kind === "dev" 时生效，发售那一笔仍按 virtualReleaseScale 打折。
  3. 叙事：copy.career.poolNotes —— 按作品落盘分数档给一句专属评语，履历行显示；
     履历页顶部再给「署名 N 部 · 过渡 M 部」的拆分。

写盘前备份 _cw_before_poolreward.json / _cfg_before_poolreward.json。
幂等。用法：python scripts/patch_pool_rewards.py [--dry-run]
"""
import json
import shutil
import sys

CW = "activity/career-world.json"
CFG = "activity/config.json"
BCW = "scripts/_cw_before_poolreward.json"
BCFG = "scripts/_cfg_before_poolreward.json"

# ── 过渡项目评语：按落盘分数的档位（沿用 release.media 的 top/high/low 档）。
#    硬约束同 mediaQuotePools：一句话、2~18 字、口语、不带机构名、不写成行业腔。
POOL_NOTES = {
    "top": [
        "本来只是填空，结果成了代表作。",
        "过渡项目做到这份上，服了。",
        "没人看好的活，做成了招牌。",
        "小预算里挤出了好东西。",
    ],
    "high": [
        "过渡项目，但练出真本事了。",
        "档期紧，活儿反而扎实。",
        "没人指望它，做出来还不错。",
        "小项目里什么都得自己上手。",
        "没有 KPI 的活，手感最真。",
    ],
    "mid": [
        "过渡项目，交差而已。",
        "填档期的活，谈不上代表作。",
        "预算小，能做的都做了。",
        "完成了，也就完成了。",
        "不丢人，但也不出彩。",
        "干完了，没留下什么。",
    ],
    "low": [
        "过渡项目，草草收尾。",
        "赶工的活，自己都不好意思提。",
        "档期紧到没能做完。",
        "交是交了，心里清楚。",
        "这种活，做完就想忘。",
        "凑数的项目，别再提了。",
    ],
}


def main():
    dry = "--dry-run" in sys.argv
    cw = json.load(open(CW, encoding="utf-8"))
    cfg = json.load(open(CFG, encoding="utf-8"))
    logs = []

    def setv(host, path, old, new, where):
        """按 path 写值，并校验旧值（防止数据被人改过导致静默覆盖）。"""
        node = host
        for k in path[:-1]:
            node = node[k]
        cur = node.get(path[-1])
        if cur == new:
            logs.append("  %-42s 已是 %s" % (where, new))
            return
        if old is not None and cur != old:
            raise SystemExit("%s 现值 %s，预期 %s" % (where, cur, old))
        node[path[-1]] = new
        logs.append("  %-42s %s -> %s" % (where, cur, new))

    setv(cw["companyXp"], ["xpPerVirtualRelease"], 5, 7, "companyXp.xpPerVirtualRelease")
    setv(cw["jobRanks"]["statGain"], ["virtualReleaseScale"], 0.5, 0.75, "jobRanks.statGain.virtualReleaseScale")
    setv(cw["jobRanks"]["jobXpGain"], ["virtualScale"], 0.5, 0.75, "jobRanks.jobXpGain.virtualScale")
    setv(cw["jobRanks"], ["virtualCreditWeight"], 0.4, 0.5, "jobRanks.virtualCreditWeight")

    tp = cw["titlePool"]
    tp["devStatMult"] = 1.15
    tp["devJobXpMult"] = 1.15
    logs.append("  %-42s %s" % ("titlePool.devStatMult / devJobXpMult", "1.15 / 1.15"))
    tp["comment"] = tp["comment"] + (
        " 【P2-fix-b 收益】过渡项目不再是惩罚线：xpPerVirtualRelease 5→7（历史作 8）、"
        "statGain.virtualReleaseScale / jobXpGain.virtualScale 0.5→0.75、"
        "virtualCreditWeight 0.4→0.5；开发月另有 devStatMult / devJobXpMult 的小幅加成"
        "（小项目什么都得自己上手）。叙事上走 copy.career.poolNotes，按落盘分数档给一句专属评语。"
    )

    cc = cfg["copy"]["career"]
    cc["poolNotes"] = POOL_NOTES
    cc["resumeSignedCount"] = "署名 {n} 部"
    cc["resumePoolCount"] = "过渡 {n} 部"
    logs.append("  %-42s %s" % ("copy.career.poolNotes", "4 档 %d 条" % sum(len(v) for v in POOL_NOTES.values())))

    for ln in logs:
        print(ln)
    if dry:
        print("[dry-run] 未写盘")
        return

    shutil.copyfile(CW, BCW)
    shutil.copyfile(CFG, BCFG)
    for path, data in ((CW, cw), (CFG, cfg)):
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    c2 = json.loads(open(CW, encoding="utf-8").read())
    g2 = json.loads(open(CFG, encoding="utf-8").read())
    assert c2["jobRanks"]["statGain"]["virtualReleaseScale"] == 0.75
    assert c2["titlePool"]["devStatMult"] == 1.15
    assert g2["copy"]["career"]["poolNotes"]["mid"]
    print("写盘完成：备份 %s / %s" % (BCW, BCFG))


main()
