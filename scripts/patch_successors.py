# -*- coding: utf-8 -*-
"""给「已消亡但没有接班公司」的公司补 successorId / mergedYear。

背景（P2-fix-a）：sim.mergerCompanyDue（h5/js/sim/career.js:1033）的触发条件是
    co.hireUntilYear != null && co.successorId != null && st.year > co.hireUntilYear
所以 successorId 为空的消亡公司会让在职玩家一直留在「数据里已经不存在」的公司里做池作
到时间轴结束（scripts/pool_coverage_report.py 把这些叫作「僵尸月」，共 2304 月）。
补上 successorId 后，company-merger 线会正常触发，玩家可以选择跟着过去或另寻出路。

选点依据（史实优先，史实不明确时按「同 region + 同能力 + power 最小跳变」）：
    bullfrog          → ea        史实：EA 收购并关闭
    origin            → ea        史实：EA 收购并关闭
    lucasarts         → ea        史实：Disney 关闭，星战游戏授权 EA
    hudson            → konami    史实：并入 Konami
    teamIco           → sony      史实：索尼 Japan Studio 旗下
    nwc               → ubisoft   史实：《魔法门》IP 售予 Ubisoft
    interplayFallback → bethesda  史实：《辐射》IP 归 Bethesda
    sierra            → ea        近似：Sierra 品牌归 Vivendi→Activision，表内无 activision
    ensemble          → firaxis   能力匹配：同为美国策略/RTS 公司，power 2→2 不跳变
    irrational        → rockstar  Take-Two 同集团（2K 已并入 rockstar）
    pioneer           → kingsoft  同区同 tags（pc/cnStudio），前导团队史实上流向金山系

幂等：已是目标值则跳过。写盘前备份 scripts/_cw_before_successors.json，写完 json.loads 复核。
用法：python scripts/patch_successors.py [--dry-run]
"""
import json
import shutil
import sys

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_successors.json"

MAP = {
    "bullfrog": "ea",
    "origin": "ea",
    "lucasarts": "ea",
    "hudson": "konami",
    "teamIco": "sony",
    "nwc": "ubisoft",
    "interplayFallback": "bethesda",
    "sierra": "ea",
    "ensemble": "firaxis",
    "irrational": "rockstar",
    "pioneer": "kingsoft",
}


def main():
    dry = "--dry-run" in sys.argv
    with open(PATH, encoding="utf-8") as f:
        raw = f.read()
    d = json.loads(raw)
    co = {c["id"]: c for c in d["companies"]}

    changed = []
    for cid, succ in MAP.items():
        c = co.get(cid)
        if c is None:
            raise SystemExit("公司不存在: %s" % cid)
        if succ not in co:
            raise SystemExit("接班公司不存在: %s -> %s" % (cid, succ))
        if c.get("successorId") == succ:
            continue
        if c.get("successorId"):
            print("  跳过 %s：已有 successorId=%s（手工设定优先）" % (cid, c["successorId"]))
            continue
        sc = co[succ]
        hu = c.get("hireUntilYear")
        # 接班公司必须活过合并年，否则玩家会被迁进另一家已消亡的公司（连锁僵尸）。
        if sc.get("hireUntilYear") is not None and hu is not None and sc["hireUntilYear"] <= hu:
            raise SystemExit("接班公司 %s 的 hireUntilYear(%s) 不晚于 %s(%s)"
                             % (succ, sc["hireUntilYear"], cid, hu))
        c["successorId"] = succ
        if c.get("mergedYear") is None:
            c["mergedYear"] = hu
        changed.append((cid, succ, hu, c.get("power"), sc.get("power")))

    if not changed:
        print("无改动（已是最新）")
        return

    print("%-18s → %-14s until  power" % ("company", "successor"))
    for cid, succ, hu, p0, p1 in changed:
        print("%-18s → %-14s %-6s %s→%s" % (cid, succ, hu, p0, p1))

    if dry:
        print("\n[dry-run] 未写盘")
        return

    shutil.copyfile(PATH, BACKUP)
    out = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    chk = json.loads(open(PATH, encoding="utf-8").read())
    m = {c["id"]: c for c in chk["companies"]}
    for cid, succ, *_ in changed:
        assert m[cid]["successorId"] == succ, cid
    assert len(chk["titles"]) == 530, len(chk["titles"])
    assert len(chk["companies"]) == 75, len(chk["companies"])
    print("\n写盘完成：%d 家补接班，备份 %s" % (len(changed), BACKUP))
    print("  titles=%d companies=%d titleDetails=%d"
          % (len(chk["titles"]), len(chk["companies"]), len(chk["titleDetails"])))


main()
