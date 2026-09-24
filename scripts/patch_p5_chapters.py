# -*- coding: utf-8 -*-
"""P5a/5c 数据：chapters 容器（六阶段开场/收束）+ 颁奖双档文案键 + tgaStartYear。

幂等：检测到 chapters 即跳过。备份：scripts/_cw_before_p5.json / _cfg_before_p5.json。
"""
import io
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")
CFG = os.path.join(ROOT, "activity", "config.json")

CHAPTERS = {
    "ch1": {
        "name": "软盘与梦想",
        "open_lines": [
            "盗版光碟在小店里堆成小山，报摊上挂着新出的游戏杂志。",
            "工作室的灯下泡面冒着热气，谁都相信下一个十年是自己的。",
            "写一行代码像埋一颗种子，没人知道哪颗会长成树。"
        ],
        "close_line": "新世纪要来了。硬盘里的源码还在，杂念也是。"
    },
    "ch2": {
        "name": "网游淘金",
        "open_lines": [
            "网吧通宵排队的年代，传奇与奇迹一个接一个点亮全国。",
            "客厅里的主机还进不来，掌机在课桌下悄悄传阅。",
            "点卡像火车票，一张张卖向看不见尽头的世界。"
        ],
        "close_line": "淘金的人来了又走，留下的人学会了做长线。"
    },
    "ch3": {
        "name": "高清门槛",
        "open_lines": [
            "主机换了高清世代，开发成本翻着跟头往上蹿。",
            "小团队开始把作品搬上刚刚兴起的数字商店，独立二字还没流行。",
            "引擎授权像军火生意，谁买得起谁说话。"
        ],
        "close_line": "门槛最高的时候，也是最小的队伍悄悄攒劲的时候。"
    },
    "ch4": {
        "name": "手游浪潮",
        "open_lines": [
            "智能手机把所有人都变成玩家，榜单一天一个样。",
            "有人一夜暴富，有人在买量的洪流里守着自己那点手艺。",
            "会议桌上最常出现的词，从玩法变成了留存。"
        ],
        "close_line": "浪头退下去，才知道谁在裸泳，谁在造船。"
    },
    "ch5": {
        "name": "直播与买量",
        "open_lines": [
            "直播间里主播一声吆喝，销量就是一波洪峰。",
            "Steam 的中文评论多了起来，国产二字第一次理直气壮。",
            "发行商学会了算账号，制作人学会了守本心。"
        ],
        "close_line": "流量教会所有人敬畏内容，也教会内容敬畏流量。"
    },
    "ch6": {
        "name": "云端与新章",
        "open_lines": [
            "补票党把老作品抬上高分榜，重制版比新作还好卖。",
            "国产大作开始在全世界刷屏，当年抄笔记的人成了被抄笔记的人。",
            "云与 AI 在门口探头，下一章的名字还没人敢写。"
        ],
        "close_line": "故事讲到这里。后面的，留给屏幕前的你来写。"
    }
}


def main():
    s = io.open(CW, encoding="utf-8", newline="").read()
    if '"chapters"' in s:
        print("already patched, skip")
        return
    shutil.copyfile(CW, os.path.join(ROOT, "scripts", "_cw_before_p5.json"))

    def ch_block(cid, spec):
        lines = ",\n".join('    "%s"' % ln for ln in spec["open_lines"])
        years = {cid: [1995, 1999], "ch2": [2000, 2004], "ch3": [2005, 2009],
                 "ch4": [2010, 2014], "ch5": [2015, 2019], "ch6": [2020, 2025]}[cid]
        return (
            '  {\n'
            '   "id": "%s",\n'
            '   "name": "%s",\n'
            '   "years": [\n'
            '    %d,\n'
            '    %d\n'
            '   ],\n'
            '   "open": {\n'
            '    "lines": [\n%s\n    ]\n'
            '   },\n'
            '   "closeLine": "%s"\n'
            '  }' % (cid, spec["name"], years[0], years[1], lines, spec["close_line"])
        )

    order = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"]
    blocks = ",\n".join(ch_block(cid, CHAPTERS[cid]) for cid in order)
    block = (
        ' "chapters": {\n'
        '  "comment": "P5a 章容器：章界硬约定 95-99/00-04/05-09/10-14/15-19/20-25（validate_career_world 的线×章覆盖表读它）。开场演出 = 年份大字幕 + open.lines（时代白描 2~3 行，风格对齐 landmark 的 shipQuote）；章末收束 = closeLine + 该年年终颁奖。开场命中即节点停机（skipToNextNode）。",\n'
        '  "list": [\n%s\n  ]\n'
        ' },\n' % blocks
    )
    anchor = ' "devEvents": {'
    assert s.count(anchor) == 1, "anchor not unique"
    s = s.replace(anchor, block + anchor, 1)
    json.loads(s)
    io.open(CW, "w", encoding="utf-8", newline="").write(s)

    # ── config.json：tgaStartYear + 双档文案键 ──
    c = io.open(CFG, encoding="utf-8", newline="").read()
    if '"tgaStartYear"' not in c:
        a1 = '"month": 11,'
        assert c.count(a1) == 1, "awards.month anchor not unique"
        c = c.replace(a1, a1 + '\n  "tgaStartYear": 2014,', 1)
    if '"awardNightKickerClassic"' not in c:
        anchor_c = '   "awardNightKicker": "{year}年度盛典",'
        assert c.count(anchor_c) == 1, "awardNightKicker anchor not unique"
        add = (
            anchor_c + "\n"
            '   "awardNightKickerClassic": "{year}年度游戏大赏",\n'
            '   "awardNightKickerTga": "{year} TGA 年度盛典",\n'
            '   "awardNewsKicker": "年度快讯",\n'
            '   "awardNewsTpl": "{show}颁给《{title}》",\n'
            '   "lostAwardHintTpl": "评委提到你的{dim}还差一口气——下一部把它补上。",'
        )
        c = c.replace(anchor_c, add, 1)
    json.loads(c)
    io.open(CFG, "w", encoding="utf-8", newline="").write(c)

    chk = json.loads(io.open(CW, encoding="utf-8", newline="").read())
    assert [x["id"] for x in chk["chapters"]["list"]] == order
    cchk = json.loads(io.open(CFG, encoding="utf-8", newline="").read())
    print("chapters:", len(chk["chapters"]["list"]),
          "| tgaStartYear:", cchk["awards"]["tgaStartYear"],
          "| copy keys ok:", "awardNightKickerTga" in cchk["copy"]["career"])


if __name__ == "__main__":
    main()
