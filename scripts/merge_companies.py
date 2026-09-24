# -*- coding: utf-8 -*-
"""P1 厂商温和合并（128 → 约 70）。

规则见 REDESIGN-TASKS.md §P1：
  砍掉条件（全部满足才砍）
    1. 作品数（按 title.companyId 计数）≤ 1
    2. 作品数 == 2 且 无 landmark 作品 且 未被 openingOffer 引用 且 未被事件线引用
  保护条件（命中则强制保留）
    - 被 eventLines 以 companyId/companyIds 显式引用

  归并路径（对被砍公司的每部作品，按优先级）
    1. successorId / mergedYear → 指向的保留公司（沿链传递闭包）
    2. 同 publisherId 的保留公司
    3. 同 seriesId 其它作品所在保留公司
    4. 兜底：同 region 且 hireFromYear 区间重叠、power 最接近的保留公司

用法：
  python scripts/merge_companies.py --dry-run      # 只出报告
  python scripts/merge_companies.py                # 落盘（自动备份）
"""
from __future__ import print_function

import argparse
import collections
import io
import json
import os
import re
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW_PATH = os.path.join(ROOT, "activity", "career-world.json")

# 六个年代章（start, end, label）
CHAPTERS = [
    (1995, 1999, "ch1 1995-1999"),
    (2000, 2004, "ch2 2000-2004"),
    (2005, 2009, "ch3 2005-2009"),
    (2010, 2014, "ch4 2010-2014"),
    (2015, 2019, "ch5 2015-2019"),
    (2020, 2025, "ch6 2020-2025"),
]
CHAPTER_MIN = 5


def load():
    with io.open(CW_PATH, encoding="utf-8") as f:
        return json.load(f)


def dump(cw):
    return json.dumps(cw, ensure_ascii=False, indent=2) + "\n"


def title_count(cw):
    n = collections.Counter(t["companyId"] for t in cw["titles"])
    for c in cw["companies"]:
        n.setdefault(c["id"], 0)
    return n


def event_referenced_ids(cw):
    """事件容器里显式引用（且语义上确实是公司 id）的集合。

    只认白名单字段，避免 'epic' 这类「选项 id / kind 值恰好等于公司 id」的误报。
    """
    out = set()
    el = cw.get("eventLines") or {}
    bonds = el.get("bonds") or {}
    for item in (bonds.get("juniorRevealPool") or []):
        if isinstance(item, dict) and item.get("companyId"):
            out.add(item["companyId"])
    for cid in ((bonds.get("returnInvite") or {}).get("companyIds") or []):
        out.add(cid)
    return out


def overlaps(ci, cj):
    """两家公司的可入职年份区间是否重叠。"""
    a0, a1 = ci.get("hireFromYear") or 0, ci.get("hireUntilYear") or 9999
    b0, b1 = cj.get("hireFromYear") or 0, cj.get("hireUntilYear") or 9999
    return a0 <= b1 and b0 <= a1


def successor_targets(cw):
    """必须保留的「接住方」公司集合：

    1. 别的公司 successorId 指向它（公司合并事件的落点，company-merger 线在这里收束）；
    2. 前辈的 successorCompanyId 指向它（导师跳槽后「跟着走」的去处，bond-mentor 线要用）。

    这两类都被叙事线硬引用——砍掉会让线拍找不到公司而断掉。
    """
    out = set()
    for c in cw["companies"]:
        sid = c.get("successorId")
        if sid:
            out.add(sid)
        for s in (c.get("seniors") or []):
            sid = s.get("successorCompanyId")
            if sid:
                out.add(sid)
    return out


def plan_cut(cw, landmark_min_score=None):
    """→ (cut:set, keep:set, why:dict)

    landmark_min_score: None 表示用 title.landmark 布尔值；
                        给定分值时，只有 landmark 且 score ≥ 该值才算「有 landmark 作品」。
    """
    counts = title_count(cw)
    by_id = dict((c["id"], c) for c in cw["companies"])
    offer_ids = set(cw["openingOffer"].get("companyIds") or [])
    ev_ids = event_referenced_ids(cw)
    succ_ids = successor_targets(cw)
    if landmark_min_score is None:
        landmark_owners = set(t["companyId"] for t in cw["titles"] if t.get("landmark"))
    else:
        landmark_owners = set(t["companyId"] for t in cw["titles"]
                              if t.get("landmark") and float(t.get("score") or 0) >= landmark_min_score)

    cut, why = set(), {}
    for c in cw["companies"]:
        cid = c["id"]
        n = counts.get(cid, 0)
        if cid in ev_ids:
            why[cid] = ("keep", "被事件线显式引用")
            continue
        if cid in succ_ids:
            why[cid] = ("keep", "是别家 successorId 的落点（合并事件收束处）")
            continue
        if n <= 1:
            cut.add(cid)
            why[cid] = ("cut", "作品数 %d ≤ 1" % n)
            continue
        if n == 2:
            if cid in landmark_owners:
                why[cid] = ("keep", "有 landmark 作品")
            elif cid in offer_ids:
                why[cid] = ("keep", "被 openingOffer 引用")
            else:
                cut.add(cid)
                why[cid] = ("cut", "作品数 2 且无 landmark / 未被引用")
            continue
        why[cid] = ("keep", "作品数 %d ≥ 3" % n)
    keep = set(by_id) - cut
    return cut, keep, why


def ability_match(dest, title):
    """目标公司有多少「能吃下这部作品」的产能。

    信号两路（取最大，再叠加标签）：
      1. 制作组能力 — studios[].genreIds（题材 +2）/ gameplayIds（玩法 +1）
      2. 公司标签   — tags 里同名题材 +2 / 同名玩法 +1（覆盖没有专门组但整体擅长的公司）
    """
    g = title.get("genreId")
    gp = title.get("gameplayId")
    tags = set(dest.get("tags") or [])
    best = 0
    for st in (dest.get("studios") or []):
        s = 0
        if g and g in (st.get("genreIds") or []):
            s += 2
        if gp and gp in (st.get("gameplayIds") or []):
            s += 1
        if s > best:
            best = s
    if g and g in tags:
        best += 2
    if gp and gp in tags:
        best += 1
    return best


def resolve_targets(cw, cut, keep, why):
    """为每个被砍公司求归并目标。→ (target:dict, reason:dict)

    优先级：successorId 链 → 同 publisher → 同 seriesId → 能力匹配（同 region）
            → 同 region 兜底。
    按「整家公司搬迁」处理（而非逐部作品），这样 seniors 与作品一起走。
    """
    by_id = dict((c["id"], c) for c in cw["companies"])
    counts = title_count(cw)
    titles = cw["titles"]
    my_titles = collections.defaultdict(list)
    for t in titles:
        my_titles[t["companyId"]].append(t)

    pub_titles = collections.Counter()
    for t in titles:
        pub_titles[t.get("publisherId")] += 1
    series_owners = collections.defaultdict(collections.Counter)
    for t in titles:
        sid = t.get("seriesId")
        if sid:
            series_owners[sid][t["companyId"]] += 1
    comp_pub = collections.defaultdict(collections.Counter)
    for t in titles:
        comp_pub[t["companyId"]][t.get("publisherId")] += 1

    target, reason = {}, {}

    def pick(cid):
        """同区有产能 → 跨区有产能；同分时大厂优先（更符合 IP 归属直觉）。"""
        src, src_titles = by_id[cid], my_titles[cid]
        best, best_key = None, None
        for kid in keep:
            k = by_id[kid]
            if not overlaps(src, k):
                continue
            ab = sum(ability_match(k, t) for t in src_titles)
            if ab <= 0:
                continue          # 没有任何产能接得上 → 不算候选
            same = 0 if k.get("region") == src.get("region") else 1
            key = (same, -ab, -(k.get("power") or 1), counts.get(kid, 0), kid)
            if best_key is None or key < best_key:
                best, best_key = kid, key
        return best

    def pick_fallback(cid):
        """实在没有能力匹配时的兜底：同 region、体量相近、作品数少的保留公司。"""
        src = by_id[cid]
        best, best_key = None, None
        for kid in keep:
            k = by_id[kid]
            if k.get("region") != src.get("region"):
                continue
            if not overlaps(src, k):
                continue
            key = (abs((k.get("power") or 1) - (src.get("power") or 1)), counts.get(kid, 0), kid)
            if best_key is None or key < best_key:
                best, best_key = kid, key
        return best

    # 先处理有 successorId 的（可能形成链）
    for cid in sorted(cut):
        c = by_id[cid]
        sid = c.get("successorId")
        if sid and sid in keep:
            target[cid] = sid
            reason[cid] = "successorId → %s" % sid
    # 沿链解到保留集
    for cid in sorted(cut):
        if cid in target:
            continue
        seen, cur = set(), by_id[cid].get("successorId")
        while cur and cur in cut and cur not in seen:
            seen.add(cur)
            cur = by_id[cur].get("successorId")
        if cur and cur in keep:
            target[cid] = cur
            reason[cid] = "successorId 链 → %s" % cur

    for cid in sorted(cut):
        if cid in target:
            continue
        # 2. 同 publisherId 的保留公司
        score = collections.Counter()
        for pid, n in comp_pub[cid].items():
            if pid in keep and pid != cid:
                score[pid] += n
            else:
                # publisher 指向别家 → 用别家的 publisher 再找一次
                for pid2, n2 in comp_pub.get(pid, {}).items():
                    if pid2 in keep and pid2 != cid:
                        score[pid2] += n2 * 0.5
        if score:
            best = max(sorted(score.items()), key=lambda kv: (kv[1], kv[0]))[0]
            target[cid] = best
            reason[cid] = "同 publisher 合作最密 → %s" % best
            continue
        # 3. 同 seriesId
        score = collections.Counter()
        for sid in set(t.get("seriesId") for t in titles if t["companyId"] == cid and t.get("seriesId")):
            for owner, n in series_owners[sid].items():
                if owner in keep and owner != cid:
                    score[owner] += n
        if score:
            best = max(sorted(score.items()), key=lambda kv: (kv[1], kv[0]))[0]
            target[cid] = best
            reason[cid] = "同 seriesId → %s" % best
            continue
        # 4. 能力匹配：谁的制作组真能吃下这家的题材 / 玩法（全局候选，同 region 优先）
        best = pick(cid)
        if best:
            ab = sum(ability_match(by_id[best], t) for t in my_titles[cid])
            same = "同区" if by_id[best].get("region") == by_id[cid].get("region") else "跨区"
            target[cid] = best
            reason[cid] = "能力匹配(分%d,%s) → %s" % (ab, same, best)
            continue
        # 5. 兜底：同 region、体量相近
        best = pick_fallback(cid)
        if best:
            target[cid] = best
            reason[cid] = "同 region(%s) 兜底 → %s" % (by_id[cid].get("region"), best)
        else:
            reason[cid] = "!! 无可用目标（留待人工）"
    return target, reason


def pick_studio(dest_company, title):
    """为目标公司挑一个 studio：genreId 命中优先，其次 gameplayId 命中，再退第一个。"""
    studios = dest_company.get("studios") or []
    if not studios:
        return None
    for s in studios:
        if title.get("genreId") in (s.get("genreIds") or []):
            return s["id"]
    for s in studios:
        if title.get("gameplayId") in (s.get("gameplayIds") or []):
            return s["id"]
    return studios[0]["id"]


def apply_merge(cw, cut, keep, target):
    by_id = dict((c["id"], c) for c in cw["companies"])
    stats = collections.Counter()

    def dest(cid):
        """被砍公司 → 目标保留公司 id；否则原样返回。"""
        return target.get(cid, cid)

    for t in cw["titles"]:
        old_c, old_p = t["companyId"], t.get("publisherId")
        new_c = dest(old_c)
        if new_c != old_c:
            t["companyId"] = new_c
            stats["title.companyId"] += 1
            # companyId 变了 → studioId 必须跟着换（studio 属于 company）
            ns = pick_studio(by_id[new_c], t)
            if ns and ns != t.get("studioId"):
                t["studioId"] = ns
                stats["title.studioId"] += 1
        if old_p and dest(old_p) != old_p:
            t["publisherId"] = dest(old_p)
            stats["title.publisherId"] += 1

    # 事件线显式引用
    el = cw.get("eventLines") or {}
    bonds = el.get("bonds") or {}
    for item in (bonds.get("juniorRevealPool") or []):
        if isinstance(item, dict) and item.get("companyId") in cut:
            item["companyId"] = dest(item["companyId"])
            stats["eventLines.juniorRevealPool"] += 1
    ri = bonds.get("returnInvite") or {}
    if ri.get("companyIds"):
        new_list = [dest(x) for x in ri["companyIds"]]
        if new_list != ri["companyIds"]:
            ri["companyIds"] = new_list
            stats["eventLines.returnInvite"] += 1

    # openingOffer 名单
    oo = cw["openingOffer"]
    old_list = list(oo.get("companyIds") or [])
    new_list = [dest(x) for x in old_list]
    # 去重保序
    seen, dedup = set(), []
    for x in new_list:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    oo["companyIds"] = dedup
    stats["openingOffer.companyIds"] = len(old_list) - len(dedup)

    # 前辈人物：追加到目标公司末尾（不动目标现有 seniors[0]，导师位不受影响）
    for cid in sorted(cut):
        tgt = target.get(cid)
        if not tgt:
            continue
        extra = by_id[cid].get("seniors") or []
        if not extra:
            continue
        dest = by_id[tgt]
        dest.setdefault("seniors", [])
        have = set(s.get("id") for s in dest["seniors"])
        for s in extra:
            if s.get("id") in have:
                continue
            dest["seniors"].append(s)
            have.add(s.get("id"))
            stats["seniors.moved"] += 1

    # 公司表：删被砍
    before = len(cw["companies"])
    cw["companies"] = [c for c in cw["companies"] if c["id"] not in cut]
    stats["companies.removed"] = before - len(cw["companies"])
    return stats


def chapter_coverage(cw):
    rows = []
    for y0, y1, label in CHAPTERS:
        n = 0
        for c in cw["companies"]:
            a = c.get("hireFromYear") or 0
            b = c.get("hireUntilYear") or 9999
            if a <= y0 and b >= y1 and c.get("joinable"):
                n += 1
        rows.append((label, n))
    return rows


def audit(cw):
    """孤儿引用检查 → [(kind, detail)]"""
    ids = set(c["id"] for c in cw["companies"])
    studios = set()
    for c in cw["companies"]:
        for s in (c.get("studios") or []):
            studios.add(s["id"])
    bad = []
    for t in cw["titles"]:
        if t["companyId"] not in ids:
            bad.append(("title.companyId 孤儿", "%s → %s" % (t["id"], t["companyId"])))
        if t.get("publisherId") not in ids:
            bad.append(("title.publisherId 孤儿", "%s → %s" % (t["id"], t.get("publisherId"))))
        if t.get("studioId") not in studios:
            bad.append(("title.studioId 孤儿", "%s → %s" % (t["id"], t.get("studioId"))))
    for cid in cw["openingOffer"].get("companyIds") or []:
        if cid not in ids:
            bad.append(("openingOffer 孤儿", cid))
    el = cw.get("eventLines") or {}
    bonds = el.get("bonds") or {}
    for item in (bonds.get("juniorRevealPool") or []):
        if isinstance(item, dict) and item.get("companyId") not in ids:
            bad.append(("juniorRevealPool 孤儿", str(item.get("companyId"))))
    for cid in ((bonds.get("returnInvite") or {}).get("companyIds") or []):
        if cid not in ids:
            bad.append(("returnInvite 孤儿", cid))
    # 公司内部：successorId 与前辈跳槽落点（叙事线的硬引用）
    for c in cw["companies"]:
        sid = c.get("successorId")
        if sid and sid not in ids:
            bad.append(("successorId 孤儿", "%s → %s" % (c["id"], sid)))
        for s in (c.get("seniors") or []):
            ds = s.get("successorCompanyId")
            if ds and ds not in ids:
                bad.append(("senior.successorCompanyId 孤儿", "%s.%s → %s" % (c["id"], s.get("id"), ds)))
    return bad


def report(cw, cut, keep, why, target, reason, stats=None):
    counts = title_count(cw)
    by_id = dict((c["id"], c) for c in cw["companies"])
    print("=" * 74)
    print("P1 厂商合并报告")
    print("=" * 74)
    print("公司 %d 家 → 保留 %d 家，砍掉 %d 家" % (len(cw["companies"]), len(keep), len(cut)))
    print()
    print("── 砍掉名单（按作品数）" + "─" * 40)
    for cid in sorted(cut, key=lambda x: (counts.get(x, 0), x)):
        c = by_id.get(cid)
        nm = c["name"] if c else "?"
        print("  %-20s %-12s 作品 %2d  → %-20s [%s]" % (
            cid, nm, counts.get(cid, 0), target.get(cid, "-"), reason.get(cid, "")))
    print()
    print("── 保留但作品数 ≤2 的（规则判定为 keep）" + "─" * 26)
    for cid in sorted(keep, key=lambda x: (counts.get(x, 0), x)):
        if counts.get(cid, 0) <= 2:
            print("  %-20s %-12s 作品 %2d  (%s)" % (cid, by_id[cid]["name"], counts.get(cid, 0), why.get(cid, ("", ""))[1]))
    print()
    if stats:
        print("── 落盘改动统计" + "─" * 48)
        for k, v in sorted(stats.items()):
            print("  %-30s %d" % (k, v))
        print()
    print("── 六章可入职公司数（下限 %d）" % CHAPTER_MIN + "─" * 34)
    for label, n in chapter_coverage(cw):
        flag = "✅" if n >= CHAPTER_MIN else "❌ 不足"
        print("  %-16s %3d 家 %s" % (label, n, flag))
    print()
    bad = audit(cw)
    print("── 孤儿引用检查" + "─" * 48)
    if not bad:
        print("  ✅ 无孤儿（作品→公司 / 工作室 / offer / 事件线全通）")
    else:
        for k, d in bad[:40]:
            print("  ❌ %-22s %s" % (k, d))
        print("  共 %d 处" % len(bad))
    print()
    # 未找到目标的
    lost = [c for c in cut if c not in target]
    if lost:
        print("⚠ 无归并目标（需人工）：%s" % ", ".join(sorted(lost)))
    print()


def verify(cw):
    """落盘后的复核对账（不重算 cut —— 数据已变）。"""
    counts = collections.Counter(t["companyId"] for t in cw["titles"])
    dist = collections.Counter()
    for c in cw["companies"]:
        dist[min(counts.get(c["id"], 0), 3)] += 1
    n = len(cw["companies"])
    print("公司数：%d  %s" % (n, "✅ 在 65~75 区间" if 65 <= n <= 75 else "⚠ 超出 65~75 区间"))
    print("作品数：%d" % len(cw["titles"]))
    print("作品数分布：0-1 家 %d / =2 家 %d / ≥3 家 %d（末档含 ≥3 聚合）"
          % (dist.get(0, 0) + dist.get(1, 0), dist.get(2, 0), dist.get(3, 0)))
    tiers = collections.Counter(c.get("starterTier") for c in cw["companies"] if c.get("openingOffer"))
    print("开局 offer 池：%d 家（small %d / stable %d / wild %d）"
          % (sum(tiers.values()), tiers.get("small", 0), tiers.get("stable", 0), tiers.get("wild", 0)))
    junior = sum(len(c.get("seniors") or []) for c in cw["companies"])
    print("前辈人物：%d 位，分布于 %d 家公司" %
          (junior, sum(1 for c in cw["companies"] if c.get("seniors"))))
    print()
    print("六章可入职公司数（下限 %d）：" % CHAPTER_MIN)
    for label, k in chapter_coverage(cw):
        print("  %-16s %3d 家 %s" % (label, k, "✅" if k >= CHAPTER_MIN else "❌ 不足"))
    print()
    bad = audit(cw)
    print("孤儿引用检查：%s" % ("✅ 无孤儿（作品 / 工作室 / offer / 事件线 / successorId / 前辈落点全通）"
                                if not bad else "❌ %d 处" % len(bad)))
    for k, d in bad[:30]:
        print("  ❌ %-28s %s" % (k, d))
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--landmark-min-score", type=float, default=9.4,
                    help="只有 landmark 且 score ≥ 该值才算「有 landmark 作品」（默认 9.4）")
    args = ap.parse_args()

    cw = load()
    why = {}
    cut, keep, why = plan_cut(cw, args.landmark_min_score)
    target, reason = resolve_targets(cw, cut, keep, why)

    if args.dry_run:
        report(cw, cut, keep, why, target, reason)
        print("dry-run 结束（未落盘）。")
        return

    backup = os.path.join(ROOT, "scripts", "_cw_before_p1.json")
    shutil.copyfile(CW_PATH, backup)
    print("已备份 → %s" % os.path.relpath(backup, ROOT))

    stats = apply_merge(cw, cut, keep, target)
    out = dump(cw)
    with io.open(CW_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    print("已写入 %s（%d 字节）" % (os.path.relpath(CW_PATH, ROOT), len(out.encode("utf-8"))))
    print()
    print("── 落盘改动统计 ──")
    for k, v in sorted(stats.items()):
        print("  %-30s %d" % (k, v))
    print()
    verify(load())


if __name__ == "__main__":
    main()
