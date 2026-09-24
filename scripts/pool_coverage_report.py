# -*- coding: utf-8 -*-
"""游戏池覆盖报告：每家公司从成立（或 1995 开局）到它能被入职的最后一年，有没有活可干。

公司可玩区间 = [max(1995.01, hireFromYear.01), min(2025.12, hireUntilYear.12)]。
  ⚠️ hireUntilYear 是 sim 侧 companyJoinable 的硬门槛（career.js:1354），
     不做这一步会把已消亡公司（sierra 2008 关、bullfrog 2001 关…）死后的月份
     算成「空窗」，把池作占比严重高估。hireUntilYear == None 表示活到时间轴结束。
判定（与 sim 同口径，见 h5/js/sim/career-world-sim.js 的 poolCandidateAt）：
  某公司某月「可做」= 有目录真作在研
                    ∪ 到下一档目录真作的空窗 >= titlePool.coverage.minFillMonths（可抽池作）
                    ∪ 该公司已无下一档真作（gap == None，池作可以一直顶）
「允许的空窗」= minFillMonths − 1 个月。

周期换算：开工月 = 发售月 − round((发售月 − 原始开工月) × development.cycleMult)。

另报「僵尸月」：公司在 hireUntilYear 之后但仍被算进去的月份数（只统计 ≥1 月的），
用于暴露「公司在数据里已消亡、玩家却还在里面做池作」的问题——其根因是
sim.mergerCompanyDue 要求 successorId != null，无接班的消亡公司没有人把玩家迁走。

用法：python scripts/pool_coverage_report.py [--top N] [--only-joinable] [--zombie]
"""
import json
import sys
from collections import defaultdict

PATH = "activity/career-world.json"


def mi(y, m):
    return y * 12 + (m or 1)


def ml(idx):
    y = (idx - 1) // 12
    return y, idx - y * 12


def main():
    argv = sys.argv[1:]
    top = 12
    if "--top" in argv:
        top = int(argv[argv.index("--top") + 1])
    only_joinable = "--only-joinable" in argv
    show_zombie = "--zombie" in argv

    d = json.load(open(PATH, encoding="utf-8"))
    tl = d["timeline"]
    mult = (d.get("development") or {}).get("cycleMult") or 1
    pool = d.get("titlePool") or {}
    min_fill = int(((pool.get("coverage") or {}).get("minFillMonths")) or 6)
    enabled = pool.get("enabled") is True and (
        (pool.get("coverage") or {}).get("enabled") is True
        or (pool.get("fallback") or {}).get("enabled") is True
    )

    start = mi(tl["startYear"], tl["startMonth"])
    end = mi(tl["endYear"], tl["endMonth"])
    det = {x["id"]: x for x in d["titleDetails"]}

    by_co = defaultdict(list)
    for t in d["titles"]:
        dt = det.get(t["id"])
        if not dt:
            continue
        raw = mi(dt["devStartYear"], dt["devStartMonth"])
        rel = mi(t["releaseYear"], t["releaseMonth"])
        st = raw if (mult == 1 or rel <= raw) else rel - round((rel - raw) * mult)
        by_co[t["companyId"]].append((st, rel))

    print("游戏池 enabled=%s  minFillMonths=%d（允许空窗 ≤ %d 月）  cycleMult=%s"
          % (enabled, min_fill, min_fill - 1, mult))
    print()

    rows = []
    zombie_rows = []
    for c in d["companies"]:
        if only_joinable and c.get("joinable") is False:
            continue
        anchor = max(start, mi(c.get("hireFromYear") or c.get("foundedYear") or tl["startYear"], 1))
        hu = c.get("hireUntilYear")
        co_end = end if hu is None else min(end, mi(hu, 12))
        if co_end < anchor:            # 公司还没到开局年就没了，整段不算
            continue
        n = co_end - anchor + 1
        cov = bytearray(n)
        starts = []
        for (a, b) in by_co.get(c["id"], []):
            starts.append(a)
            for i in range(max(a, anchor), min(b, co_end) + 1):
                cov[i - anchor] = 1
        starts.sort()
        si = 0
        cat_m, pool_m, dead_m, run, worst, worst_at = 0, 0, 0, 0, 0, None
        for idx in range(anchor, co_end + 1):
            if cov[idx - anchor]:
                cat_m += 1
                run = 0
                continue
            while si < len(starts) and starts[si] <= idx:
                si += 1
            fillable = enabled and (si >= len(starts) or (starts[si] - idx) >= min_fill)
            if fillable:
                pool_m += 1
                run = 0
            else:
                dead_m += 1
                run += 1
                if run > worst:
                    worst = run
                    worst_at = ml(idx)
        rows.append({
            "id": c["id"], "name": c["name"], "joinable": c.get("joinable") is not False,
            "span": n, "cat": cat_m, "pool": pool_m, "dead": dead_m, "worst": worst,
            "worst_at": "%d.%d" % worst_at if worst_at else "-",
            "cover": 100.0 * (cat_m + pool_m) / n if n else 100.0,
            "until": hu,
        })
        if hu is not None and co_end < end and c.get("successorId") is None:
            zombie_rows.append({"id": c["id"], "name": c["name"], "until": hu,
                                "months": end - co_end, "power": c.get("power")})

    rows.sort(key=lambda r: (r["worst"], r["dead"], r["cat"] / max(1, r["span"])), reverse=True)
    print("%-18s %-6s %-6s %-6s %-8s %-7s %-6s %s" %
          ("company", "months", "真作", "池作", "空窗月", "最长空窗", "真作率", "最长空窗起点"))
    for r in rows[:top]:
        print("%-18s %-6d %-6d %-6d %-8d %-7d %5.1f%% %s" %
              (r["id"], r["span"], r["cat"], r["pool"], r["dead"], r["worst"],
               100.0 * r["cat"] / max(1, r["span"]), r["worst_at"]))

    tot = sum(r["span"] for r in rows)
    print()
    print("公司 %d 家 / 月 %d" % (len(rows), tot))
    print("  真作覆盖 %.1f%%   池作补全 %.1f%%   仍空窗 %.1f%%"
          % (100.0 * sum(r["cat"] for r in rows) / tot,
             100.0 * sum(r["pool"] for r in rows) / tot,
             100.0 * sum(r["dead"] for r in rows) / tot))
    print("  全场最长空窗 %d 月（上限 %d）；有 >%d 月空窗的公司 %d 家"
          % (max(r["worst"] for r in rows), min_fill - 1, min_fill - 1,
             sum(1 for r in rows if r["worst"] > min_fill - 1)))
    print("  可入职公司里带 hireUntilYear 的 %d 家（可玩区间已按其截止年收窄）"
          % sum(1 for r in rows if r["until"] is not None))

    if zombie_rows:
        zombie_rows.sort(key=lambda r: r["months"], reverse=True)
        print()
        print("⚠️ 无接班的消亡公司 %d 家：hireUntilYear 到了但 successorId 为空 →"
              % len(zombie_rows))
        print("   sim.mergerCompanyDue 不会触发，玩家留在里面会一直做池作到时间轴结束。")
        print("   %-18s %-8s %-10s %s" % ("company", "until", "僵尸月", "power"))
        for r in (zombie_rows if show_zombie else zombie_rows[:8]):
            print("   %-18s %-8d %-10d %s" % (r["id"], r["until"], r["months"], r["power"]))
        if not show_zombie and len(zombie_rows) > 8:
            print("   …共 %d 家（--zombie 看全部），僵尸月合计 %d 月"
                  % (len(zombie_rows), sum(r["months"] for r in zombie_rows)))


main()
