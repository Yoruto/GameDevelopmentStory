# -*- coding: utf-8 -*-
"""P2-fix-a 收尾：把两部「发售年早/晚于公司可入职窗口」的作品接回窗口内。

起因：新加的守卫（tests/run-sim-tests.js::catalogTitlesAreConsistent）要求「作品发售年
必须落在公司可入职窗口内」。跑出 6 条越窗，其中 4 条是 **P1 归并的正确结果**，不该动：

  · dq6(1995) / dq7(2001) → companyId=squareEnix（2003 起）。blurb 写的是「由 enix 发行」，
    说明它们是 enix 的目录，P1 把 enix 并进了 squareEnix（square → squareEnix 的接续链）。
  · lastGuardian(2016) → companyId=teamIco（1997~2011）。blurb 写「由 Team Ico 发行」，
    teamIco 的 successorId 就是 sony（2011 合并，游戏由 SIE 发行）。
  守卫因此改成「发售年落在该公司**接续链**窗口的并集内」，这 4 条自然通过。

剩下 2 条是真正的错配，都靠「公司从哪一年开始能被玩家入职」这一个旋钮修：

  · granTurismo(1997.12) → polyphony。Polyphony Digital 1998.04 才法人化，但 GT1 是
    它的前身团队（Sony 内部 Polys Entertainment）做的，且 1997 全年公司还没有可入职起点
    → 这部招牌作在数据里根本进不去。把 hireFromYear 1998 → 1997。
  · mir2(2001.07) / qinSang(2002.12) → tencent。blurb 分别写「由盛大网络运营」「由目标软件发行」：
    tencent 在这份数据里是「中国网游发行商」的合并落点，而中国网游从 2001 年《热血传奇》算起。
    把 hireFromYear 2003 → 2001。

幂等。写盘前备份 scripts/_cw_before_hirewin.json。
用法：python scripts/patch_fix_hirewindows.py [--dry-run]
"""
import json
import shutil
import sys

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_hirewin.json"

# companyId -> (旧 hireFromYear, 新 hireFromYear, 理由)
FIX = {
    "polyphony": (1998, 1997, "GT1 发售于 1997.12，早于 Polyphony Digital 1998.04 的法人化一年；"
                              "不放开这一年，《GT赛车》就是进不去的死数据"),
    "tencent": (2003, 2001, "tencent 是这份数据里「中国网游发行商」的合并落点"
                            "（mir2 blurb 写盛大网络、qinSang blurb 写目标软件）；"
                            "中国网游从 2001 年《热血传奇》起算，可入职起点提前到 2001"),
}


def main():
    dry = "--dry-run" in sys.argv
    d = json.load(open(PATH, encoding="utf-8"))
    comp = {c["id"]: c for c in d["companies"]}
    changed = []
    for cid, (old, new, why) in FIX.items():
        c = comp.get(cid)
        if not c:
            raise SystemExit("公司不存在: %s" % cid)
        cur = c.get("hireFromYear")
        if cur == new:
            print("  %-12s 已是 %s，跳过" % (cid, new))
            continue
        if cur != old:
            raise SystemExit("%s 的 hireFromYear 是 %s，预期 %s（数据已被人改过）" % (cid, cur, old))
        c["hireFromYear"] = new
        changed.append(cid)
        print("  %-12s hireFromYear %s -> %s" % (cid, old, new))

    if not changed:
        print("无需修改")
        return
    if dry:
        print("[dry-run] 未写盘")
        return

    shutil.copyfile(PATH, BACKUP)
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    chk = json.loads(open(PATH, encoding="utf-8").read())
    cm = {c["id"]: c for c in chk["companies"]}
    for cid, (_, new, _) in FIX.items():
        assert cm[cid]["hireFromYear"] == new, cid
    print("写盘完成：改了 %s / 备份 %s" % (",".join(changed), BACKUP))


main()
