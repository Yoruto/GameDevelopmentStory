# -*- coding: utf-8 -*-
"""career-world.json 数据校验器。

定位：命令链的一环——改完 activity/*.json 后跑，先于 sync_config.py / 单测发现问题。
      P1（厂商合并 128→约 70）的验收工具，此后常态化守护。

检查项：
  1. JSON 可解析、关键容器齐备；
  2. 孤儿引用：作品→公司（companyId/publisherId/studioId）、公司→后继（successorId）、
     事件容器→公司（键名匹配 company/studio/publisher 的字符串引用）；
  3. 六个年代章各自「可入职公司 >= 5 家」（章界为 P5 前的硬编码，P5 落地后改读 chapters）；
  4. 报告：公司数、作品数、线 × 章覆盖表、作品数分布。

退出码：有 ERROR 则 1，否则 0（WARN 不影响）。

用法：
    python scripts/validate_career_world.py
    python scripts/validate_career_world.py --quiet     # 只输出问题
"""
from __future__ import print_function

import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD = os.path.join(ROOT, "activity", "career-world.json")
H5_JSON = os.path.join(ROOT, "h5", "config.json")

# 与模拟器 timeline 对齐；P5 起优先读 careerWorld.chapters（硬编码仅作缺省兜底）
_CHAPTER_DEFAULTS = [
    ("ch1", 1995, 1999),
    ("ch2", 2000, 2004),
    ("ch3", 2005, 2009),
    ("ch4", 2010, 2014),
    ("ch5", 2015, 2019),
    ("ch6", 2020, 2025),
]


def load_chapters(world):
    spec = (world.get("chapters") or {}).get("list") or []
    if not spec:
        return list(_CHAPTER_DEFAULTS), False
    out = []
    for ch in spec:
        years = ch.get("years") or []
        if len(years) != 2:
            err("chapters.list[%s] years 形状非法: %r" % (ch.get("id"), years))
            continue
        out.append((ch.get("id"), int(years[0]), int(years[1])))
    return out, True


MIN_HIRABLE_PER_CHAPTER = 5

REF_KEY = re.compile(r"(?i)(companyid|publisherid|studioid|successorid|^company$|^studio$|^publisher$)")

errors = []
warns = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def walk_refs(node, path, out):
    """收集「键名像公司/工作室引用」的字符串值。"""
    if isinstance(node, dict):
        for k, v in node.items():
            p = "%s.%s" % (path, k)
            if isinstance(v, str) and REF_KEY.search(k):
                out.append((p, v))
            elif isinstance(v, dict) and REF_KEY.search(k):
                # {companyId: {…}} 形式：键就是 id
                out.append((p + " (key)", v.get("id", "")))
            walk_refs(v, p, out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk_refs(v, "%s[%d]" % (path, i), out)


def walk_years(node, out):
    """收集对象树里所有「键名含 year」的年份值（事件线的起止靠 startWhen / beat.wait 等
    多处以不同写法表达，故用通用扫描而非固定字段名）。"""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, int) and not isinstance(v, bool) and "year" in k.lower() and 1990 <= v <= 2030:
                out.append(v)
            else:
                walk_years(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_years(v, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    # ── 1. 解析 ─────────────────────────────────────────────────────────────
    try:
        with io.open(WORLD, "r", encoding="utf-8") as f:
            world = json.loads(f.read())
    except Exception as e:
        print("FATAL: career-world.json 无法解析: %s" % e)
        return 1

    companies = world.get("companies") or []
    titles = world.get("titles") or []
    CHAPTERS, chapters_from_data = load_chapters(world)
    if not companies:
        err("companies 为空")
    if not titles:
        err("titles 为空")

    co_ids = set(c.get("id") for c in companies)
    title_ids = set(t.get("id") for t in titles)
    studio_ids = set()
    for c in companies:
        for s in (c.get("studios") or []):
            if s.get("id"):
                studio_ids.add(s["id"])

    # ── 1b. 规模区间（P1 厂商合并后常态 65~75 家） ───────────────────────────
    if not (60 <= len(companies) <= 80):
        warn("公司数 %d 超出预期区间 60~80（P1 合并后常态 65~75）" % len(companies))
    # P2-fix-a 分两批补真实历史作品：第一批 138 部（523 → 661）填「大洞」，
    # 第二批 +50 部专补补过之后仍靠池作顶的公司（dice/sierra/lucasarts/irrational/bullfrog…），
    # 并删掉 6 条 worldFill_* 占位作 → 975 部，真作覆盖率 42% → 80%。
    # 上限随之从 720 放宽到 1100（下限仍是 480：低于它说明目录被大面积删过）。
    if not (480 <= len(titles) <= 1100):
        warn("作品数 %d 超出预期区间 480~1100" % len(titles))

    # ── 2. 孤儿引用 ─────────────────────────────────────────────────────────
    for t in titles:
        tid = t.get("id", "?")
        for key in ("companyId", "publisherId"):
            v = t.get(key)
            if v and v not in co_ids:
                err("作品 %s 的 %s=%s 不在 companies 里" % (tid, key, v))
        v = t.get("studioId")
        if v and v not in studio_ids and v not in co_ids:
            err("作品 %s 的 studioId=%s 既不在 studios 也不在 companies 里" % (tid, v))

    for c in companies:
        v = c.get("successorId")
        if v and v not in co_ids:
            err("公司 %s 的 successorId=%s 不在 companies 里" % (c.get("id"), v))
        # 前辈跳槽后的落脚公司：bond-mentor 线「跟着走」要用，砍掉会让线拍断掉
        for s in (c.get("seniors") or []):
            v = s.get("successorCompanyId")
            if v and v not in co_ids:
                err("公司 %s 的前辈 %s 的 successorCompanyId=%s 不在 companies 里"
                    % (c.get("id"), s.get("id"), v))

    for key in ("devEvents", "postLaunch", "producerEvents", "eventLines", "idleGap"):
        node = world.get(key)
        if not node:
            continue
        refs = []
        walk_refs(node, key, refs)
        for path, v in refs:
            if not v:
                continue
            if v in co_ids or v in studio_ids or v in title_ids:
                continue
            if "successor" in path.lower() or "company" in path.lower() or "studio" in path.lower() or "publisher" in path.lower():
                err("事件引用 %s = %s 找不到对应公司/作品" % (path, v))

    for cid in ((world.get("openingOffer") or {}).get("companyIds") or []):
        if cid not in co_ids:
            err("openingOffer.companyIds 含未知公司 %s" % cid)

    for pid, v in ({} or {}).items():
        pass

    # ── 3. 每章可入职公司数 ──────────────────────────────────────────────────
    chapter_rows = []
    for cid, y0, y1 in CHAPTERS:
        n = 0
        for c in companies:
            hf = c.get("hireFromYear")
            hu = c.get("hireUntilYear")
            if hf is None:
                continue
            if hu is None:
                hu = 9999
            if hf <= y0 and hu >= y1:
                n += 1
        chapter_rows.append((cid, y0, y1, n))
        if n < MIN_HIRABLE_PER_CHAPTER:
            err("章 %s(%d-%d) 可入职公司仅 %d 家，低于 %d 家下限" % (cid, y0, y1, n, MIN_HIRABLE_PER_CHAPTER))

    # ── 4. 报告 ─────────────────────────────────────────────────────────────
    lines_list = (world.get("eventLines") or {}).get("lines") or []
    cover = []
    for ln in lines_list:
        years = []
        walk_years(ln, years)
        y0 = min(years) if years else None
        y1 = max(years) if years else None
        hit = []
        for cid, cy0, cy1 in CHAPTERS:
            if y0 is None:
                hit.append(True)          # 无年份条件的线视为全程可见
            else:
                hit.append(not (y1 < cy0 or y0 > cy1))
        cover.append((ln.get("id", "?"), y0, y1, hit))

    if not args.quiet:
        print("== career-world.json ==")
        print("公司 %d / 作品 %d / 工作室 %d" % (len(companies), len(titles), len(studio_ids)))
        dist = {}
        for c in companies:
            dist[c.get("id")] = 0
        for t in titles:
            cid = t.get("companyId")
            if cid in dist:
                dist[cid] += 1
        buckets = {"<=1": 0, "=2": 0, ">=3": 0}
        for v in dist.values():
            buckets["<=1" if v <= 1 else ("=2" if v == 2 else ">=3")] += 1
        print("作品数分布: 0-1 家 %d / =2 家 %d / >=3 家 %d"
              % (buckets["<=1"], buckets["=2"], buckets[">=3"]))
        print("\n每章可入职公司数（下限 %d）：" % MIN_HIRABLE_PER_CHAPTER)
        for cid, y0, y1, n in chapter_rows:
            print("  %s %d-%d: %d 家 %s" % (cid, y0, y1, n, "" if n >= MIN_HIRABLE_PER_CHAPTER else "  ← 不足"))
        print("\n线 × 章覆盖（行 = 线，列 = ch1..ch6）：")
        for lid, y0, y1, hit in cover:
            span = "%s-%s" % (y0 if y0 else "?", y1 if y1 else "?")
            print("  %-16s %-11s %s" % (lid, span, " ".join("●" if h else "·" for h in hit)))
        for lid, y0, y1, hit in cover:
            blanks = [CHAPTERS[i][0] for i, h in enumerate(hit) if not h]
            if blanks:
                warn("线 %s 在 %s 章无出没点" % (lid, ",".join(blanks)))

    print("")
    for w in warns:
        print("WARN  " + w)
    for e in errors:
        print("ERROR " + e)
    print("\n%d error(s), %d warning(s)" % (len(errors), len(warns)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
