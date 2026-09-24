# -*- coding: utf-8 -*-
"""P4a：给真实事件选项挂 req 门禁样本（赶工类 req.health、挖人请人类 req.renown）。

幂等：检测到 '"req"' 已存在即跳过。备份：scripts/_cw_before_p4req.json。
"""
import io
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")
BAK = os.path.join(ROOT, "scripts", "_cw_before_p4req.json")


def read(p):
    return io.open(p, encoding="utf-8", newline="").read()


def line_indent(s, pos):
    start = s.rfind("\n", 0, pos) + 1
    i = start
    while i < len(s) and s[i] == " ":
        i += 1
    return s[start:i]


def add_req(s, scope_anchor, opt_id, req_obj, window=4000):
    base = s.find(scope_anchor)
    assert base >= 0 and s.count(scope_anchor) == 1, "scope anchor: %s" % scope_anchor
    pos = s.find('"id": "%s"' % opt_id, base, base + len(scope_anchor) + window)
    assert pos >= 0, "opt missing: %s in %s" % (opt_id, scope_anchor)
    indent = line_indent(s, pos)
    line = indent + '"req": %s,' % json.dumps(req_obj, ensure_ascii=False, separators=(", ", ": "))
    end = s.find("\n", pos)
    return s[:end + 1] + line + "\n" + s[end + 1:]


def main():
    s = read(CW)
    if '"req": {' in s:
        print("already patched, skip")
        return
    shutil.copyfile(CW, BAK)

    w = json.loads(s)
    de = {e["id"]: e for e in w["devEvents"]["list"]}
    pl = {e["id"]: e for e in (w.get("postLaunch") or {}).get("events", [])}

    # 赶工/连轴类：要求健康 ≥3（weekendCrunch 的「来」要 ≥4）——低健康自动解锁「下周补/改期」等退路
    plan = [
        ("weekendCrunch", "comeIn", {"health": 4}),
        ("eightShots", de["eightShots"]["choices"][0]["id"], {"health": 3}),
        ("demoBlackScreen", de["demoBlackScreen"]["choices"][0]["id"], {"health": 3}),
        ("vendorFlaked", de["vendorFlaked"]["choices"][0]["id"], {"health": 3}),
        ("placeholderAudio", de["placeholderAudio"]["choices"][0]["id"], {"health": 3}),
        ("mustCrash", pl["mustCrash"]["choices"][0]["id"], {"health": 3}),
    ]
    for eid, oid, req in plan:
        s = add_req(s, '"id": "%s"' % eid, oid, req)

    # 高声望才请得动人：请人唱主题（req.renown 2 = 业界熟脸档）
    s = add_req(s, '"id": "hireSinger"', de["hireSinger"]["choices"][0]["id"], {"renown": 2})

    json.loads(s)
    io.open(CW, "w", encoding="utf-8", newline="").write(s)
    chk = json.loads(read(CW))
    n = s.count('"req": {')
    print("req fields:", n)
    assert n == 7, "expected 7 req fields, got %d" % n
    print("OK")


if __name__ == "__main__":
    main()
