# -*- coding: utf-8 -*-
"""
精简前辈阵容：删除游戏内置的 ~111 位前辈（无 stats），只保留
  (A) 我上一轮按 Master 要求归位真实公司新增的 39 位（带 stats）
  (B) 被师徒事件线 juniorRevealPool 引用的 3 位国产真实人物
        dawei(大伟哥@米哈游) / haimao(海猫络合物@鹰角) / yao-runhao(YY@叠纸)
      这 3 位虽是内置、无 stats，但被 eventLines 引用，删了会悬空，故保留并补 stats。

目标：全游戏前辈从 150 降到约 42，无悬空引用、不破坏剧情。

幂等：按 senior id 白名单过滤；已补 stats 的不会重复补。
"""
import json

PATH = "activity/career-world.json"
d = json.load(open(PATH, encoding="utf-8"))

# 被事件线引用的 3 位内置前辈 -> 补固定四维（不成长）
KEEP_REF = {"dawei", "haimao", "yao-runhao"}
STATS = {
    "dawei":     {"program": 70, "design": 88, "art": 60, "music": 62},  # 蔡浩宇/米哈游：制作人向
    "haimao":    {"program": 55, "design": 85, "art": 92, "music": 60},  # 鹰角创始人：世界观/美术向
    "yao-runhao": {"program": 50, "design": 90, "art": 88, "music": 58}, # 叠纸：女性向/美术向
}

# 我上一轮新增的（带 stats）即为保留集之一
added_ids = {s["id"] for c in d["companies"] for s in (c.get("seniors") or []) if "stats" in s}
keep_ids = added_ids | KEEP_REF

before = sum(len(c.get("seniors") or []) for c in d["companies"])
removed = 0
kept_ref = 0
for c in d["companies"]:
    if not c.get("seniors"):
        continue
    new = []
    for s in c["seniors"]:
        if s["id"] in keep_ids:
            if s["id"] in STATS and "stats" not in s:
                s["stats"] = STATS[s["id"]]
                kept_ref += 1
            new.append(s)
        else:
            removed += 1
    c["seniors"] = new

after = sum(len(c.get("seniors") or []) for c in d["companies"])
print(f"删除内置前辈: {removed}")
print(f"保留前辈: {after}  (我新增归位 {len(added_ids)} + 被引用内置 {len(keep_ids - added_ids)}，其中补stats {kept_ref})")

# 校验事件线引用仍有效
refs = []
for item in d.get("eventLines", {}).get("bonds", {}).get("juniorRevealPool", []):
    refs.append(item.get("seniorId"))
alive = [r for r in refs if r in keep_ids]
print(f"事件线 juniorRevealPool 引用: {refs} -> 全部存活: {len(alive) == len(refs)}")

# 写回（保留原换行风格）
json.dump(d, open(PATH, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
open(PATH, "a").write("\n")
