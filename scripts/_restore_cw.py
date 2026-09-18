# -*- coding: utf-8 -*-
"""一次性恢复脚本：以 git HEAD 为基底重建 career-world.json。

背景：重跑 build_career_world.py 把未提交的手改冲回了脚本模板值。
策略：不逐字段修补生成结果，而是 HEAD 原样打底，只从当前文件叠加本轮有意新增：

  1. titles / titleDetails：HEAD 全量打底
     - 叠加 CUR 独有的版本条目（全部带 versionOf）
     - 叠加共有条目上本轮补填的 versionName
  2. proficiency / quality.eraStatScale / virtualPool.teamStatShare：
     之前未提交会话的手改，当前 sim 代码在读，保留
  3. 其余所有块一律 HEAD 值（companies/mobility/player/save/devEvents/...）

写盘前把当前文件备份到 scripts/_cw_cur_backup.json。
"""
import json, io, shutil, sys

sys.stdout.reconfigure(encoding="utf-8")

OUT = "activity/career-world.json"
HEAD_FILE = "scripts/_cw_head.json"

with io.open(HEAD_FILE, encoding="utf-8") as f:
    base = json.load(f)
with io.open(OUT, encoding="utf-8") as f:
    cur = json.load(f)

# 备份当前（生成版）文件
shutil.copyfile(OUT, "scripts/_cw_cur_backup.json")

# ---- 1. titles / titleDetails ----
h_ids = [t["id"] for t in base["titles"]]
c_by = {t["id"]: t for t in cur["titles"]}

added_titles, added_details, ver_filled = [], [], []
for t in cur["titles"]:
    tid = t["id"]
    if tid in h_ids:
        # 共有条目：只补本轮有意的 versionName
        if t.get("versionName") and not any(x["id"] == tid and x.get("versionName") for x in base["titles"]):
            for x in base["titles"]:
                if x["id"] == tid:
                    x["versionName"] = t["versionName"]
                    ver_filled.append(tid)
        continue
    if not t.get("versionOf"):
        raise SystemExit("异常：CUR 独有条目 %s 没有 versionOf，拒绝盲目合并" % tid)
    added_titles.append(t)

h_detail_ids = {d["id"] for d in base["titleDetails"]}
c_detail_by = {d["id"]: d for d in cur["titleDetails"]}
for t in added_titles:
    d = c_detail_by.get(t["id"])
    if not d:
        raise SystemExit("异常：新条目 %s 缺 titleDetails" % t["id"])
    added_details.append(d)

base["titles"].extend(added_titles)
base["titleDetails"].extend(added_details)

# ---- 2. 手改保留块 ----
base["proficiency"] = cur["proficiency"]
if "eraStatScale" in cur.get("quality", {}):
    base["quality"]["eraStatScale"] = cur["quality"]["eraStatScale"]
if "teamStatShare" in cur.get("virtualPool", {}):
    base["virtualPool"]["teamStatShare"] = cur["virtualPool"]["teamStatShare"]

# ---- 写盘 ----
with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(base, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("titles: %d -> %d (+%d 版本条目)" % (len(h_ids), len(base["titles"]), len(added_titles)))
print("versionName 补填:", ver_filled)
print("保留块: proficiency / quality.eraStatScale / virtualPool.teamStatShare")
print("备份: scripts/_cw_cur_backup.json")
