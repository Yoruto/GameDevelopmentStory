# -*- coding: utf-8 -*-
"""P5e 节奏调参（Master 拍板 1+2）：
1) devEvents.maxPerYear 5 → 2（每年带选项/氛围事件至多 2 次）；
2) 12 条纯氛围 choice 事件降级为 notice（选项中间档效果提为顶层，删 choices）。

幂等：检测 maxPerYear==2 且首条已降级即跳过。备份：scripts/_cw_before_p5e.json。
"""
import io
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")

# 12 条降级名单（桶位校验过：每个 role:phase 桶降后仍 ≥2 条 choice，守住
# run-sim-tests 的 role/phase 覆盖矩阵）：
#   art/production 4→2（colorFight, emptyScene）  art/prepro 3→2（refFight）
#   art/alpha 4→2（feetFloat, clothesMismatch）   art/polish 3→2（nightTooDark）
#   design/gold 3→2（reviewThreeHours）           music/alpha 4→2（oneSongFortyMin, voiceVsMusic）
#   music/production 4→3（themeSoundsLike）       music/polish 4→2（headphonesPain, uglyStretch）
DEMOTE = ["colorFight", "emptyScene", "refFight", "feetFloat", "clothesMismatch",
          "nightTooDark", "reviewThreeHours", "oneSongFortyMin", "voiceVsMusic",
          "themeSoundsLike", "headphonesPain", "uglyStretch"]


def fmt_field(name, val, indent):
    body = json.dumps(val, ensure_ascii=False)
    # 多行数组，与文件风格一致
    if isinstance(val, list):
        items = ",\n".join(" " * (indent + 1) + json.dumps(v, ensure_ascii=False) for v in val)
        body = "[\n" + items + "\n" + " " * indent + "]"
        return " " * indent + '"%s": %s,' % (name, body)
    return " " * indent + '"%s": %s,' % (name, json.dumps(val, ensure_ascii=False))


def event_span(s, event_id):
    """事件对象的 [start,end) 文本范围。事件级 id 是 4 空格缩进，选项 id 是 6 空格——
    用 '\\n    "id": "' 锚定同级，避免截断在选项里。"""
    anchor = '"id": "%s"' % event_id
    assert s.count(anchor) == 1, "event anchor not unique: %s" % event_id
    start = s.rfind("\n", 0, s.find(anchor)) + 1
    nxt = s.find('\n    "id": "', s.find(anchor) + len(anchor))
    end = s.rfind("\n", 0, nxt) if nxt >= 0 else len(s)
    return start, end


def main():
    s = io.open(CW, encoding="utf-8", newline="").read()
    if '"maxPerYear": 2' in s:
        print("already patched, skip")
        return
    shutil.copyfile(CW, os.path.join(ROOT, "scripts", "_cw_before_p5e.json"))

    w = json.loads(s)
    de_map = {e["id"]: e for e in w["devEvents"]["list"]}
    for eid in DEMOTE:
        ev = de_map[eid]
        assert (ev.get("presentation") or "notice") == "choice", "%s not choice" % eid
        assert not any(c.get("healthDelta") or c.get("req") or c.get("skillGrant") for c in ev["choices"]), \
            "%s has special option fields" % eid

    # ── 1) maxPerYear 5 → 2（锚定 devEvents 段内的 chance 行附近，确保唯一）──
    anchor = '"pityMonths": 6,'
    assert s.count(anchor) == 1, "pityMonths anchor not unique"
    old = '"maxPerYear": 5,'
    pos = s.find(old, s.find(anchor))
    assert pos >= 0 and pos - s.find(anchor) < 80, "maxPerYear not next to pityMonths"
    s = s[:pos] + '"maxPerYear": 2,' + s[pos + len(old):]

    # ── 2) 12 条降级 ──
    for eid in DEMOTE:
        ev = de_map[eid]
        mid = ev["choices"][1]  # 中间档效果提为顶层
        start, end = event_span(s, eid)
        block = s[start:end]
        # a) presentation choice → notice（块内唯一）
        assert block.count('"presentation": "choice"') == 1, eid
        block = block.replace('"presentation": "choice"', '"presentation": "notice"', 1)
        # b) 顶层注入中间档 qualityDim/qualityDelta（插在 presentation 行后）
        pres_pos = block.find('"presentation": "notice"')
        line_end = block.find("\n", pres_pos)
        indent = "   "
        inject = fmt_field("qualityDim", mid["qualityDim"], len(indent)) + "\n" + \
                 fmt_field("qualityDelta", mid["qualityDelta"], len(indent)) + "\n"
        block = block[:line_end + 1] + inject + block[line_end + 1:]
        # c) 删除 "choices": [...] 块（含前导行与尾逗号）
        ck = block.find('"choices": [')
        assert ck >= 0, "choices missing in " + eid
        i = ck + len('"choices": ')
        depth = 0
        while True:
            c = block[i]
            if c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        ck_end = i + 1
        if ck_end < len(block) and block[ck_end] == ",":
            ck_end += 1
        line_start = block.rfind("\n", 0, ck)
        block = block[:line_start] + block[ck_end:]
        s = s[:start] + block + s[end:]

    json.loads(s)
    io.open(CW, "w", encoding="utf-8", newline="").write(s)

    chk = json.loads(io.open(CW, encoding="utf-8", newline="").read())
    assert chk["devEvents"]["maxPerYear"] == 2
    still = [e for e in chk["devEvents"]["list"] if (e.get("presentation") or "notice") == "choice"]
    demoted = [e for e in chk["devEvents"]["list"] if e["id"] in DEMOTE]
    for e in demoted:
        assert e["presentation"] == "notice" and "choices" not in e and e.get("qualityDim"), e["id"]
    print("maxPerYear:", chk["devEvents"]["maxPerYear"],
          "| choice events:", len(still), "(was 78, minus 12 demoted + careCheck manualOnly)")


if __name__ == "__main__":
    main()
