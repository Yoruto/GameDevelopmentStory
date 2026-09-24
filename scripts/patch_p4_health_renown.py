# -*- coding: utf-8 -*-
"""P4：健康(careerHealth) + 声望(renown) 配置块 + 事件 healthDelta/textLate 数据。

全部走精确字符串手术（不动 json.dumps 往返），写盘前 json.loads 复核语法。
幂等：二次运行检测到标记键即跳过。
"""
import io
import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")
CFG = os.path.join(ROOT, "activity", "config.json")


def read(p):
    return io.open(p, encoding="utf-8", newline="").read()


def write(p, s):
    io.open(p, "w", encoding="utf-8", newline="").write(s)


def line_indent(s, pos):
    """pos 处字符所在行的缩进。"""
    start = s.rfind("\n", 0, pos) + 1
    i = start
    while i < len(s) and s[i] == " ":
        i += 1
    return s[start:i]


def insert_after_line(s, pos, text):
    """在 pos 所在行之后插入 text（自带换行结尾由调用方保证）。"""
    end = s.find("\n", pos)
    if end < 0:
        end = len(s)
    return s[:end + 1] + text + s[end + 1:]


def add_option_field(s, scope_anchor, opt_id, field_line, window=4000, tag=""):
    """在 scope_anchor 之后的 opt_id 选项 id 行后插入 field_line（同级缩进）。"""
    base = s.find(scope_anchor)
    assert base >= 0, "scope anchor missing: %s %s" % (scope_anchor, tag)
    assert s.count(scope_anchor) == 1, "scope anchor not unique: %s %s" % (scope_anchor, tag)
    opt_anchor = '"id": "%s"' % opt_id
    pos = s.find(opt_anchor, base, base + len(scope_anchor) + window)
    assert pos >= 0, "opt anchor missing: %s in %s %s" % (opt_id, scope_anchor, tag)
    indent = line_indent(s, pos)
    return insert_after_line(s, pos, indent + field_line + "\n")


def add_event_field(s, event_id, field_line, after_key='"text": ', window=2000):
    """在事件 event_id 的 after_key 行后插入 field_line（事件字段缩进）。"""
    anchor = '"id": "%s"' % event_id
    assert s.count(anchor) == 1, "event anchor not unique: %s" % event_id
    base = s.find(anchor)
    pos = s.find(after_key, base, base + window)
    assert pos >= 0, "after_key missing: %s in %s" % (after_key, event_id)
    indent = line_indent(s, pos)
    return insert_after_line(s, pos, indent + field_line + "\n")


def add_into_effects(s, beat_anchor, opt_id, field="health"):
    """在 beat_anchor 作用域内 opt_id 选项的 effects { 后插入一行。"""
    assert s.count(beat_anchor) == 1, "beat anchor not unique: %s" % beat_anchor
    base = s.find(beat_anchor)
    pos = s.find('"id": "%s"' % opt_id, base, base + 4000)
    assert pos >= 0, "opt missing in beat: %s %s" % (beat_anchor, opt_id)
    eff = s.find('"effects": {', pos, pos + 1500)
    assert eff >= 0, "effects missing: %s %s" % (beat_anchor, opt_id)
    indent = line_indent(s, s.find("\n", eff) + 1)
    ins = eff + len('"effects": {')
    return s[:ins] + "\n" + indent + '"%s": 1,' % field + s[ins:]


def main():
    # ── 查表（只读 json，用于把选项下标解析成 id）──
    w = json.loads(read(CW))
    de = {e["id"]: e for e in w["devEvents"]["list"]}
    pe = {e["id"]: e for e in w["producerEvents"]["list"]}
    pl = {e["id"]: e for e in (w.get("postLaunch") or {}).get("events", [])}

    def opt_id_at(group, event_id, idx):
        return group[event_id]["choices"][idx]["id"]

    s = read(CW)
    if '"careerHealth"' in s:
        print("already patched, skip")
        return

    # ── 1) 配置块：careerHealth + renown（世界顶层，锚定 devEvents）──
    anchor = ' "devEvents": {'
    assert s.count(anchor) == 1, "config anchor not unique"
    block = (
        ' "careerHealth": {\n'
        '  "comment": "P4b 健康：5 段体检条（UI 不显数字）。只随事件选项变动（healthDelta ±1，钳在 min..max），绝不随时间自动衰减；eraLateYear 之后赶工类事件文案换重口径（textLate），数值规则不变。v2 铁律：健康不影响作品质量。",\n'
        '  "init": 4,\n'
        '  "min": 1,\n'
        '  "max": 5,\n'
        '  "eraLateYear": 2010\n'
        ' },\n'
        ' "renown": {\n'
        '  "comment": "P4c 声望称号链（累积制）：score = 获奖(playerWon)次数×winWeight + 署名已发售作品均分≥scoreThreshold 的部数；tier=满足的最高档（tiers 升序阈值，5 档）。反哺：邀约权重 ×(1+inviteWeightPerTier×(tier-1))；供 req.renown 门禁与 P7 结局分档。数值待原型验证。",\n'
        '  "winWeight": 2,\n'
        '  "scoreThreshold": 8.5,\n'
        '  "tiers": [\n'
        '   0,\n'
        '   6,\n'
        '   14,\n'
        '   26,\n'
        '   42\n'
        '  ],\n'
        '  "inviteWeightPerTier": 0.25\n'
        ' },\n'
    )
    s = s.replace(anchor, block + anchor, 1)

    # ── 2) 赶工类：healthDelta -1 ──
    crunch = [
        ("dev", "animStutter", 2),
        ("dev", "demoBlackScreen", 0),
        ("dev", "vendorFlaked", 0),
        ("dev", "weekendCrunch", 0),
        ("dev", "eightShots", 0),
        ("dev", "placeholderAudio", 0),
        ("pl", "mustCrash", 0),
        ("pl", "placeholderShipped", 0),
        ("pl", "brokenArtHot", 0),
        ("prod", "prodScopeCut", 1),
    ]
    groups = {"dev": de, "pl": pl, "prod": pe}
    for grp, eid, idx in crunch:
        oid = opt_id_at(groups[grp], eid, idx)
        s = add_option_field(s, '"id": "%s"' % eid, oid, '"healthDelta": -1,', tag="crunch")

    # ── 3) 恢复：进修/ clinics +1 ──
    for eid in ("genrePlayClinic", "prodSkillClinic"):
        for c in groups["dev" if eid in de else "prod"][eid]["choices"]:
            s = add_option_field(s, '"id": "%s"' % eid, c["id"], '"healthDelta": 1,', tag="clinic")

    # ── 4) 空窗抉择：休息 / 进修 +1 ──
    for oid in ("rest", "study"):
        s = add_option_field(s, '"idleGap"', oid, '"healthDelta": 1,', window=2000, tag="idleGap")

    # ── 5) 人物线正反馈拍：effects.health +1 ──
    for beat, opt in [('"id": "own-voice"', "own"),
                      ('"id": "finale-relation"', "reconcile"),
                      ('"id": "meet"', "teach"),
                      ('"id": "finale"', "keep")]:
        s = add_into_effects(s, beat, opt)

    # ── 6) 赶工类 textLate（年代文案，数值不变）──
    late = {
        "animStutter": "档期钉死了，这周不加班抠完，跳票的账就算在你头上。",
        "demoBlackScreen": "开发机黑到底。这个年纪还通宵，是在拿身体换演示不崩。",
        "vendorFlaked": "外包整段鸽了。通宵自己顶上，不然这区永远静音。",
        "weekendCrunch": "项目等不起，家里的事只能推。周末组里所有人都在看你。",
        "eightShots": "八张图明早就交。咖啡续到第几杯，自己都数不清了。",
        "placeholderAudio": "占位音上架就是事故。连夜换，天亮前必须全部到位。",
        "mustCrash": "必现闪退挂在外面。这一夜修不完，明天热搜见。",
        "placeholderShipped": "占位音被玩家做成了梗。连夜换掉，别让梗活过这个补丁。",
    }
    for eid, txt in late.items():
        s = add_event_field(s, eid, '"textLate": "%s",' % txt)

    json.loads(s)  # 语法自检
    write(CW, s)

    # ── 7) copy 键（config.json）──
    c = read(CFG)
    assert '"continueButton"' in c
    if '"renownTiers"' not in c:
        anchor_c = '   "yearNewsTpl": "{year}年，《{title}》风靡业界。",'
        assert c.count(anchor_c) == 1, "copy anchor not unique"
        add = (
            anchor_c + "\n"
            '   "healthLabel": "健康",\n'
            '   "renownLabel": "声望",\n'
            '   "renownTiers": [\n'
            '    "无名新人",\n'
            '    "业界熟脸",\n'
            '    "中坚力量",\n'
            '    "明星制作人",\n'
            '    "时代之名"\n'
            '   ],\n'
            '   "lockPrefix": "需要：",'
        )
        c = c.replace(anchor_c, add, 1)
        json.loads(c)
        write(CFG, c)

    # ── 写后回读确认 ──
    chk = json.loads(read(CW))
    print("careerHealth:", chk["careerHealth"]["init"], chk["careerHealth"]["min"], "-", chk["careerHealth"]["max"])
    print("renown tiers:", chk["renown"]["tiers"])
    n_health = s.count('"healthDelta"')
    n_late = s.count('"textLate"')
    n_eff = s.count('"health": 1')
    print("healthDelta fields:", n_health, "| textLate:", n_late, "| effects.health:", n_eff)


if __name__ == "__main__":
    main()
