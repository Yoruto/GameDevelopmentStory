# -*- coding: utf-8 -*-
"""P6 正反馈呈现层（数据侧）：
1) statMilestones：主职维五档里程碑（at 对齐 promotion.requirements[].mainStat）；
2) 9 条 eventLines 各一条正反馈拍（effects.cheer，挂在有正效果的选项上）；
3) postLaunch.events 追加 6 条「玩家的玩家反馈」notice 事件（每条 ≤2 行）。

幂等：检测到 statMilestones 即跳过。备份：scripts/_cw_before_p6.json。
"""
import io
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")

MILESTONES = [
    (28, "模块归你带", "主程把新模块的骨架拍在你桌上：这次你来主导。你忽然意识到，这不是门槛，是别人开始把你当回事的刻度。"),
    (34, "薪火", "组里新人开始拿着笔记本过来问问题了。你讲得磕磕绊绊，却想起当年的那位前辈——原来传承，就是从这一刻开始的。"),
    (41, "名字进了扉页", "发行商的资料册上，你的名字第一次排进核心成员那栏。从熟练到权威的那条线，你踩过去了。"),
    (51, "立项书", "制作人把一份立项书推到你面前：下一个项目，你想做什么？会议室安静下来，所有人都在等你开口。"),
    (60, "时代之名", "行业大会上，主持人介绍你时加了头衔——「定义过这个时代的制作人之一」。你摸了摸工牌，想起软盘时代的那个下午。")
]

CHEER = {
    "company-merger": "合并文件签下来的那天，老团队的留用名单上你的名字被圈了红圈。留用骨干——四个字，比什么奖都踏实。",
    "promo-to-expert": "专家答辩全票通过。评审只说了一句：这个人对系统的理解，已经不需要题目来证明。",
    "promo-to-director": "任命邮件抄送全公司，回复栏滚过一整排祝贺。你后知后觉：带一支队伍，是从被人信任开始的。",
    "become-producer": "工牌换成制作人的那天，老组长在走廊里拦住你，只说了一句：你可以出师了。",
    "bond-mentor": "评审会上，前辈当着全组的面说：这个方案比我当年的好。散会后你看见他眼角的笑纹——师徒这一程，他是真替你高兴。",
    "bond-peer": "年度演示放完，那位老对手第一个起立鼓掌，巴掌拍得比谁都响。较了那么多年劲，这一下掌声是真的。",
    "bond-junior": "新人独立负责的模块一次通过评审。你只检查了两行代码就签了字——那种放心，比自己做出好东西还满。",
    "epic-title": "试玩结束，会议室里没人说话。半分钟后有人开口：这会是我们的代表作。你等这句话，等了很多年。",
    "era-return-china": "国服上线那天，服务器排队排到六位数。你在玩家列表里看到无数熟悉的中文 ID——回家的路，终于通到了服务器。"
}

FAN_EVENTS = [
    ("fanTattoo", "玩家的纹身", "玩家晒出一张照片：把游戏里的角色纹在了手臂上。你放大看了很久——原来真的有人把它当成了人生的一部分。"),
    ("fanMeme", "梗图出圈", "一张你的游戏截图被做成梗图，转发破了十万。评论区吵翻了天，但每个人都记得那句台词。"),
    ("fanLetter", "三千字的长信", "后台躺着一封三千字的长信，有人写下游戏陪他度过的那段日子。你回了两个字：谢谢。手是抖的。"),
    ("fanCover", "同人曲", "有人给你的主题曲填词翻唱，播放量比官方 PV 还高。你听完只说了一句：这版编曲不错。"),
    ("fanCosplay", "漫展重逢", "漫展上有人 cos 了你的角色，道具做得比官方周边还用心。她举着牌子：谢谢你们做过这个游戏。"),
    ("fanSpeedrun", "速通社区", "速通社区把你的游戏拆到了极限，最短通关纪录又双叒被刷新。你默默点了个赞，顺手把那个卡墙点记进了备忘录。")
]


def main():
    s = io.open(CW, encoding="utf-8", newline="").read()
    if '"statMilestones"' in s:
        print("already patched, skip")
        return
    shutil.copyfile(CW, os.path.join(ROOT, "scripts", "_cw_before_p6.json"))

    # ── 1) statMilestones 顶层块 ──
    rows = ",\n".join(
        '   {\n    "at": %d,\n    "title": "%s",\n    "body": "%s"\n   }' % (at, t, b)
        for at, t, b in MILESTONES
    )
    block = (
        ' "statMilestones": {\n'
        '  "comment": "P6 属性里程碑：主职维突破 at 触发「被世界承认」拍（节点停机，每档一次，flag 落 st.career.statMilestones）。at 必须对齐 jobRanks.promotion.requirements[].mainStat（28/34/41/51/60）——改门槛必须同步改这里，tests 有断言。",\n'
        '  "list": [\n%s\n  ]\n'
        ' },\n' % rows
    )
    anchor = ' "devEvents": {'
    assert s.count(anchor) == 1, "anchor not unique"
    s = s.replace(anchor, block + anchor, 1)

    # ── 2) 9 条线各一条正反馈拍（程序化定位：优先「数字正效果」选项，退而求其次
    #      第一个 choice 拍里带 effects 的建设向选项——company-merger 的 stay=joinSuccessor）──
    w = json.loads(s)
    for line in w["eventLines"]["lines"]:
        lid = line["id"]
        assert lid in CHEER, "no cheer text for line %s" % lid
        hit = None
        positive = ("honor", "fame", "promote", "mainStat", "jobXp", "startBecomeProducer",
                    "joinSuccessor", "promotePeer", "moveStudio", "changeRole")
        for b in line.get("beats", []):
            if (b.get("presentation") or "notice") != "choice":
                continue
            fallback = None
            for o in b.get("options", []):
                eff = o.get("effects") or {}
                if not eff:
                    continue
                if any(k in eff for k in positive):
                    hit = (b["id"], o["id"])
                    break
                if fallback is None and not eff.get("kickOut"):
                    fallback = (b["id"], o["id"])
            if hit:
                break
            if hit is None and fallback and b is line.get("beats", [])[0]:
                hit = fallback  # 该线仅此一个 choice 拍时用兜底
        if hit is None:
            for b in line.get("beats", []):
                if (b.get("presentation") or "notice") != "choice":
                    continue
                for o in b.get("options", []):
                    if o.get("effects"):
                        hit = (b["id"], o["id"])
                        break
                if hit:
                    break
        assert hit, "no positive beat found in %s" % lid
        # 字符串手术：在该线作用域内，定位 beat→option 的 effects { 后插入 cheer 行
        line_anchor = '"id": "%s"' % lid
        base = s.find(line_anchor)
        assert base >= 0 and s.count(line_anchor) == 1, "line anchor: %s" % lid
        beat_anchor = s.find('"id": "%s"' % hit[0], base)
        assert beat_anchor >= 0, "beat anchor: %s/%s" % (lid, hit[0])
        opt_pos = s.find('"id": "%s"' % hit[1], beat_anchor)
        assert opt_pos >= 0, "opt anchor: %s/%s" % (lid, hit[1])
        eff_pos = s.find('"effects": {', opt_pos)
        assert eff_pos >= 0 and eff_pos - opt_pos < 1200, "effects: %s/%s" % (lid, hit[1])
        nl = s.find("\n", eff_pos) + 1
        indent = s[nl:nl + len(s[nl:]) - len(s[nl:].lstrip())]
        s = s[:nl] + indent + '"cheer": "%s",\n' % CHEER[lid] + s[nl:]

    # ── 3) postLaunch.events 追加 6 条 notice ──
    evs = ",\n".join(
        '   {\n'
        '    "id": "%s",\n'
        '    "displayName": "%s",\n'
        '    "text": "%s",\n'
        '    "presentation": "notice",\n'
        '    "qualityDim": [\n'
        '     "fun"\n'
        '    ],\n'
        '    "qualityDelta": [\n'
        '     1\n'
        '    ]\n'
        '   }' % (eid, dn, txt)
        for eid, dn, txt in FAN_EVENTS
    )
    pa = s.find('"postLaunch"')
    assert pa >= 0, "postLaunch missing"
    ev_anchor = s.find('"events": [', pa)
    assert ev_anchor >= 0, "postLaunch.events missing"
    insert_at = ev_anchor + len('"events": [')
    s = s[:insert_at] + "\n" + evs + "," + s[insert_at:]

    json.loads(s)
    io.open(CW, "w", encoding="utf-8", newline="").write(s)

    chk = json.loads(io.open(CW, encoding="utf-8", newline="").read())
    ms = [m["at"] for m in chk["statMilestones"]["list"]]
    reqs = [r["mainStat"] for r in chk["jobRanks"]["promotion"]["requirements"]
            if r and r.get("mainStat") is not None]
    assert ms == reqs, "milestones misaligned: %s vs %s" % (ms, reqs)
    n_cheer = s.count('"cheer": "')
    n_fan = sum(1 for e in chk["postLaunch"]["events"] if e["id"].startswith("fan"))
    print("milestones:", ms, "| cheer beats:", n_cheer, "| fan events:", n_fan)
    assert n_cheer == 9 and n_fan == 6


if __name__ == "__main__":
    main()
