# -*- coding: utf-8 -*-
"""把 activity/config.json 同步成 H5 可读的两份生成物。改数值只改 activity/config.json，然后跑本脚本。"""
from __future__ import print_function

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "activity", "config.json")
H5_JSON = os.path.join(ROOT, "h5", "config.json")
H5_JS = os.path.join(ROOT, "h5", "js", "config.generated.js")


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    os.makedirs(os.path.dirname(H5_JSON), exist_ok=True)
    os.makedirs(os.path.dirname(H5_JS), exist_ok=True)
    with open(H5_JSON, "w", encoding="utf-8", newline="\n") as f:
        f.write(raw if raw.endswith("\n") else raw + "\n")
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
    print("synced", SRC, "->", H5_JSON)
    print("synced", SRC, "->", H5_JS)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("sync_config failed:", e, file=sys.stderr)
        sys.exit(1)
