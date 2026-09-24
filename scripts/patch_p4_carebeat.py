# -*- coding: utf-8 -*-
"""P4b 收尾：低健康「人物线关怀拍」事件（careCheck，manualOnly 不进随机池）。

触发在 career-pace.js（health ≤ 2 且每年至多一次）；恢复选项 healthDelta +1。
幂等：检测到 careCheck 即跳过。备份：scripts/_cw_before_p4care.json。
"""
import io
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CW = os.path.join(ROOT, "activity", "career-world.json")


def main():
    s = io.open(CW, encoding="utf-8", newline="").read()
    if '"careCheck"' in s:
        print("already patched, skip")
        return
    shutil.copyfile(CW, os.path.join(ROOT, "scripts", "_cw_before_p4care.json"))

    ev = (
        '   {\n'
        '    "id": "careCheck",\n'
        '    "manualOnly": true,\n'
        '    "displayName": "身边人的饭局",\n'
        '    "text": "连着出状况，你脸色差得藏不住。有人不由分说把你拽去吃了顿热乎饭。",\n'
        '    "presentation": "choice",\n'
        '    "choices": [\n'
        '     {\n'
        '      "id": "goEat",\n'
        '      "label": "去吧",\n'
        '      "qualityDim": [\n'
        '       "fun"\n'
        '      ],\n'
        '      "qualityDelta": [\n'
        '       2\n'
        '      ],\n'
        '      "healthDelta": 1\n'
        '     },\n'
        '     {\n'
        '      "id": "brushOff",\n'
        '      "label": "改天吧，还得赶",\n'
        '      "qualityDim": [\n'
        '       "program"\n'
        '      ],\n'
        '      "qualityDelta": [\n'
        '       1\n'
        '      ]\n'
        '     }\n'
        '    ]\n'
        '   },\n'
    )
    # devEvents.list 的第一条事件前插入：锚定 "devEvents": { ... "list": [ 后的第一个 "   {"
    anchor = '"list": ['
    i = s.find(anchor, s.find('"devEvents"'))
    assert i >= 0, "devEvents.list not found"
    first_obj = s.find("   {", i)
    assert first_obj >= 0 and first_obj - i < 40, "unexpected devEvents.list layout"
    s = s[:first_obj] + ev + s[first_obj:]

    json.loads(s)
    io.open(CW, "w", encoding="utf-8", newline="").write(s)
    chk = json.loads(io.open(CW, encoding="utf-8", newline="").read())
    hit = [e for e in chk["devEvents"]["list"] if e["id"] == "careCheck"]
    assert len(hit) == 1 and hit[0].get("manualOnly") is True
    print("careCheck inserted, list size:", len(chk["devEvents"]["list"]))


if __name__ == "__main__":
    main()
