# -*- coding: utf-8 -*-
"""把 activity/config.json 同步成 H5 可读的两份生成物。生涯世界表 activity/career-world.json 在同步时并入 careerWorld。改完跑本脚本，再 node tests/run-sim-tests.js。"""
from __future__ import print_function

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "activity", "config.json")
CAREER = os.path.join(ROOT, "activity", "career-world.json")
H5_JSON = os.path.join(ROOT, "h5", "config.json")
H5_JS = os.path.join(ROOT, "h5", "js", "config.generated.js")


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    if os.path.isfile(CAREER):
        with open(CAREER, "r", encoding="utf-8") as f:
            data["careerWorld"] = json.load(f)
    os.makedirs(os.path.dirname(H5_JSON), exist_ok=True)
    os.makedirs(os.path.dirname(H5_JS), exist_ok=True)
    merged = json.dumps(data, ensure_ascii=False, indent=2)
    with open(H5_JSON, "w", encoding="utf-8", newline="\n") as f:
        f.write(merged if merged.endswith("\n") else merged + "\n")
    dumped = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    js = (
        "/* generated from activity/config.json — do not edit by hand */\n"
        "(function (root) {\n"
        "  var GDS = root.GDS = root.GDS || {};\n"
        "  GDS.CONFIG = " + dumped + ";\n"
        "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n"
    )
    with open(H5_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    print("synced", SRC, "+", os.path.basename(CAREER), "->", H5_JSON)
    print("synced", SRC, "+", os.path.basename(CAREER), "->", H5_JS)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("sync_config failed:", e, file=sys.stderr)
        sys.exit(1)
