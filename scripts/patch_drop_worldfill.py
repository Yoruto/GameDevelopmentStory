# -*- coding: utf-8 -*-
"""P2-fix-a 收尾：删掉 6 条 worldFill_* 占位作品。

它们由已废弃的 scripts/build_career_world.py::pad_year_releases 生成（当年靠
titlePool.minWorldReleasesPerYear 给「世界年发售量」凑数），现在三个问题叠在一起：

  1. blurb 里的公司名和 companyId 对不上 —— worldFill_2015_0 挂在 koei 名下，
     blurb 却写「由 Arc System Works 发行」；2021_0 是 ea / 「Crytek」；
     2025_0 是 epic / 「Mediatonic」；2025_1 是 ea / 「Acclaim」；2025_2 是 rockstar /「Midway」。
     （注意：目录里另有约 78 条 blurb 公司名与 companyId 不符，那些是 P1 归并的**正确结果**
      —— blurb 保留历史原始发行商，如 arkhamCity 归到 capcom 但 blurb 仍写 Rocksteady。
      这里只处理 id 前缀为 worldFill 的占位作。）
  2. worldFill_2015_0 的发售年 2015 越过了 koei 的 hireUntilYear(2009)，
     等于让玩家在一家数据里已经消亡的公司做一部未来作品。
  3. minWorldReleasesPerYear 在 h5/js 里**没有任何消费方**（grep 只命中 config.generated.js
     与 build_career_world.py），删掉这 6 条不影响 sim。

幂等：id 不存在就跳过。写盘前备份 scripts/_cw_before_dropfill.json。
用法：python scripts/patch_drop_worldfill.py [--dry-run]
"""
import json
import shutil
import sys

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_dropfill.json"


def main():
    dry = "--dry-run" in sys.argv
    d = json.load(open(PATH, encoding="utf-8"))
    drop = [t["id"] for t in d["titles"] if str(t["id"]).startswith("worldFill")]
    if not drop:
        print("没有 worldFill_* 需要删除（已处理过）")
        return
    print("待删 %d 条：%s" % (len(drop), ", ".join(drop)))
    if dry:
        print("[dry-run] 未写盘")
        return
    d["titles"] = [t for t in d["titles"] if t["id"] not in set(drop)]
    d["titleDetails"] = [x for x in d["titleDetails"] if x["id"] not in set(drop)]
    shutil.copyfile(PATH, BACKUP)
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    chk = json.loads(open(PATH, encoding="utf-8").read())
    left = [t["id"] for t in chk["titles"] if str(t["id"]).startswith("worldFill")]
    assert not left, "还有残留：%s" % left
    assert len(chk["titles"]) == len(chk["titleDetails"])
    print("写盘完成：titles %d / titleDetails %d / 备份 %s"
          % (len(chk["titles"]), len(chk["titleDetails"]), BACKUP))


main()
