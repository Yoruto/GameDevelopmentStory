# -*- coding: utf-8 -*-
"""career.js 分域拆分执行器。

背景：career.js（5546 行 / 161 导出 / 147 私有）依赖高度交织——全文件不存在
「零跨文件依赖」的物理切点。因此采用**叶子域摘除**策略：

  1. 先建共享基座 `sim._`（被多域共用的纯工具，如 num/cloneStats/clampJobRank）；
  2. 把「种子导出 + 只被域内引用的私有闭包」整段剪到新文件；
  3. 新文件顶部用 `var x = sim._.x;` 取基座工具（调用时解析，与加载顺序无关）；
  4. career.js 内部对这些导出的调用已是 `sim.xxx()` 门面形式，故零改动。

域定义见 DOMAINS；`--dry-run` 只报告不落盘。

用法：
    python scripts/split_career.py --dry-run
    python scripts/split_career.py --domain colleagues
    python scripts/split_career.py --domain awards,colleagues
"""
from __future__ import print_function

import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIM_DIR = os.path.join(ROOT, "h5", "js", "sim")
TARGET = os.path.join(SIM_DIR, "career.js")

PAT_FUNC = re.compile(r"^  function ([A-Za-z0-9_]+)\s*\(")
PAT_SIM = re.compile(r"^  sim\.([A-Za-z0-9_]+)\s*=")
PAT_VAR = re.compile(r"^  var ([A-Za-z0-9_]+)\s*=")

# ── 共享基座：被多域共用的纯工具，导出到 sim._（名字 → 定义所在符号名）──
SHARED_TOOLS = [
    "num", "isArr", "cloneStats", "DIMS", "PLAYABLE",
    "clampJobRank", "jobRankSpec", "rankTableVal", "mainStatValue",
    "findCredit", "creditIsSigned", "cloneXpMap", "mergeXpMap",
    "scoreFromLiveSpec", "idleGapSpec", "virtualList",
    "careerTraits", "findWorldReleased", "attrRefOf", "tableMult",
    "requireInDevTitle", "scaleQualityAmount", "promotionReq", "promotionGaps",
    "fillPaceTemplate", "dateLabel",
    # 被多个域共用的核心动作（留在基座，mobility/bonds 等域借用）
    "applyPromotion", "detachFromProject", "joinCompany", "closeTenure",
    "lateJoinSpec", "producerOfferUnlocked",
    # 招聘/offer 计算
    "domesticBoostMul", "skillHireSpec", "skillHireWeight", "pickMobilityRole",
    # bond 相关
    "bondHomeCompanyId", "bondRoleForLine", "peerEpicPool", "pickReturnInviteTarget",
    # 世界推进 / 虚拟池
    "canStartCareerVirtual", "virtualMinDevMonths", "liveFromTitle", "pushWorldReleased",
    # 成长 / 项目（pace 主循环借用）
    "grantMainStatAndXp", "persistProjectLive", "grantPlayerTitleXp",
]

# 共享基座清单落盘位置（测试据此断言 sim._ 完整，避免「工具迁走后基座静默失效」）
SHARED_TOOLS_JSON = os.path.join(ROOT, "tests", "sim-shared-tools.json")

# ── 域定义：域 → 种子 sim.* 导出。私有闭包自动推导。──
DOMAINS = {
    "colleagues": {
        "file": "career-colleagues.js",
        "seeds": ["ensureCareerColleagues"],
        "note": "制作组同事生成（5 个符号，全独占，最小验证域）",
    },
    "awards": {
        "file": "career-awards.js",
        "seeds": ["runCareerAwards", "collectCareerAwardStory"],
        "note": "年度颁奖评选与剧情页",
    },
    "events": {
        "file": "career-events.js",
        "seeds": ["findCareerEventDef", "rollCareerDevEvent", "rollPostLaunchEvent",
                  "resolveCareerEventChoice"],
        "note": "开发事件 / 发售后期事件 / 选项结算（P4 req 门禁落点）",
    },
    "mobility": {
        "file": "career-mobility.js",
        "seeds": ["careerSkillHireBonus", "careerHireChance", "mobilityRequireInDevTitle",
                  "listYearEndOffers", "listCompanyStudioViews", "ensureYearEndOffers",
                  "listCareerInvites", "applyYearEndOffer", "acceptYearEndOffer",
                  "declineYearEndOffers", "acceptCareerInvite", "counterCareerInvite",
                  "declineCareerInvite", "careerYearReleases"],
        "note": "跳槽 / 邀约 / offer（P4c 声望反哺落点）",
    },
    "bonds": {
        "file": "career-bonds.js",
        "seeds": ["refreshCareerBondColocation", "pinCareerBonds", "tickCareerBonds",
                  "ensureCareerJuniorBond", "revealCareerJunior", "kickOutOfCareerCompany",
                  "hasPeerEpicTarget", "hasCareerReturnTarget", "applyCareerPromotePeer",
                  "applyCareerInvitePeer", "applyCareerJuniorLeave"],
        "note": "人物 bond 同址/远程、junior 入场与离队",
    },
    "world-sim": {
        "file": "career-world-sim.js",
        "seeds": ["startVirtualProject", "queueProducerVirtualPitch", "resolveProducerPitch",
                  "shipWorldTitlesThisMonth", "liveStatsForMedia"],
        "note": "虚拟作品池 + 世界作品月度推进（P1 数据归并 / P2b 虚拟池开关落点）",
    },
    "pace": {
        "file": "career-pace.js",
        "seeds": ["tickCareerMonth", "careerQueueNeedsDecision", "tickCareerToDecision"],
        "note": "节奏层：月度主循环 / 决策点判定 → P3 节点推进（skipToNextNode）主战场",
    },
}


def parse_syms(lines):
    marks = []
    for i, l in enumerate(lines, 1):
        m = PAT_FUNC.match(l)
        if m:
            marks.append(("func", m.group(1), i))
            continue
        m = PAT_SIM.match(l)
        if m:
            marks.append(("sim", m.group(1), i))
            continue
        m = PAT_VAR.match(l)
        if m:
            marks.append(("var", m.group(1), i))
    syms = []
    for idx, (kind, name, start) in enumerate(marks):
        end = marks[idx + 1][2] - 1 if idx + 1 < len(marks) else len(lines)
        syms.append((kind, name, start, end))
    return syms


def build(lines, syms):
    names = set(n for _, n, _, _ in syms)
    body = dict((n, "\n".join(lines[a - 1:b])) for _, n, a, b in syms)
    kind = dict((n, k) for k, n, _, _ in syms)
    deps = {}
    for name, txt in body.items():
        found = set()
        for other in names:
            if other == name or len(other) < 3:
                continue
            if re.search(r"\b" + re.escape(other) + r"\b", txt):
                found.add(other)
        deps[name] = found
    rdeps = dict((n, set()) for n in names)
    for a, ds in deps.items():
        for b in ds:
            rdeps[b].add(a)
    return body, kind, deps, rdeps


class AlreadyCut(Exception):
    """域的种子已不在 career.js 中 —— 说明该域此前已切出。"""


def plan_domain(dom, spec, body, kind, deps, rdeps, names):
    seeds = spec["seeds"]
    missing = [s for s in seeds if s not in names]
    if missing:
        raise AlreadyCut("种子已不在 career.js：%s" % ", ".join(missing))

    shared = set(SHARED_TOOLS)

    # 闭包：纳入「只被域内引用」的私有函数；共享基座工具不纳入（走 borrow）
    inside = set(seeds)
    changed = True
    while changed:
        changed = False
        for n in list(inside):
            for d in deps[n]:
                if d in inside or kind.get(d) != "func" or d in shared:
                    continue
                if rdeps[d] <= inside:      # 只被域内引用 → 安全带入
                    inside.add(d)
                    changed = True

    # 域内私有符号（函数 / 变量）仍被域外引用 → 本刀不安全，必须先人工处理
    leaks = []
    for n in sorted(inside):
        if kind.get(n) == "sim":
            continue                      # sim.* 导出被外部以门面调用，属正常
        out = rdeps[n] - inside
        if out:
            leaks.append((n, sorted(out)))

    # 域内符号本身属于共享基座 → 迁出后必须由本文件重新挂到 sim._，
    # 否则 career.js 末尾的 `if (typeof X !== 'undefined')` 会静默跳过，域间调用变 undefined。
    expose_shared = sorted(n for n in inside if n in SHARED_TOOLS)

    # 从基座借用：只用「裸调用」的符号（sim.xxx / .xxx 形式不需要顶部声明）
    borrow = sorted(bare_calls(inside, body, names) - inside)
    return inside, leaks, borrow, expose_shared


def bare_calls(inside, body, names):
    """域内函数体里以裸标识符形式调用的外部符号（排除 sim 与 .foo 成员访问）。"""
    used = set()
    txt = "\n".join(body[n] for n in inside)
    for other in names:
        if len(other) < 3:
            continue
        if re.search(r"(?<![\w.$])" + re.escape(other) + r"\b", txt):
            used.add(other)
    used.discard("sim")
    return used


def render_domain_file(dom, spec, inside, leaks, borrow, body, kind, deps, expose_shared=()):
    """生成新文件内容：顶置共享工具绑定 + 原样粘贴迁出符号 + 外泄/共享符号挂基座。"""
    out = io.StringIO()
    out.write("/* %s —— 自 career.js 迁出的独立域（%s）。\n"
              "   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */\n"
              % (spec["file"], spec["note"]))
    out.write("(function (root) {\n")
    out.write("  var sim = root.GDS.sim;\n")
    if borrow:
        out.write("\n  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）\n")
        out.write("  var " + ", ".join(borrow) + ";\n")
        out.write("  (function bindShared() {\n")
        out.write("    var _ = sim._ || (sim._ = {});\n")
        out.write("    var missing = [];\n")
        for b in borrow:
            out.write("    %s = _.%s; if (typeof %s === 'undefined') missing.push('%s');\n"
                      % (b, b, b, b))
        out.write("    // 绑定发生在加载期，若某个工具所属文件排在本文件之后，会拿到 undefined。\n")
        out.write("    // 这里出声，免得变成运行到某分支才炸的静默故障。\n")
        out.write("    if (missing.length && root.console && console.warn) {\n")
        out.write("      console.warn('[GDS] %s: 基座工具绑定失败（检查加载顺序）:', missing.join(', '));\n"
                  % spec["file"])
        out.write("    }\n")
        out.write("  })();\n")

    out.write("\n  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────\n")
    for n in spec["_ordered_inside"]:
        out.write("\n")
        out.write(body[n])
        out.write("\n")

    # 本域迁出的符号若属共享基座，或仍被域外引用，都要挂到 sim._ 上供其它文件取用
    to_expose = [(n, "共享基座") for n in expose_shared]
    to_expose += [(n, "被 " + ", ".join(users[:4]) + " 引用") for n, users in leaks]
    if to_expose:
        out.write("\n  // 迁出符号回挂共享基座（career.js 末尾的同名导出对已迁移者不生效，必须在此补齐）\n")
        out.write("  (function exposeShared() {\n")
        out.write("    var _ = sim._ || (sim._ = {});\n")
        for n, why in to_expose:
            out.write("    _.%s = %s;   // %s\n" % (n, n, why))
        out.write("  })();\n")
    out.write("})(typeof globalThis !== \"undefined\" ? globalThis : this);\n")
    return out.getvalue()


MARKER = "共享基座 sim._（供拆分出去的域文件取用"


def strip_shared_blocks(lines):
    """移除历史遗留的基座导出块（每次落盘都会重新生成一份，必须先清旧再插新）。"""
    out = []
    i = 0
    removed = 0
    while i < len(lines):
        if MARKER in lines[i]:
            j = i
            while j < len(lines) and lines[j].strip() != "})();":
                j += 1
            if j >= len(lines):
                raise SystemExit("基座导出块未闭合，已中断")
            removed += 1
            i = j + 1
            if i < len(lines) and lines[i].strip() == "":
                i += 1
            continue
        out.append(lines[i])
        i += 1
    while out and out[-1].strip() == "":
        out.pop()
    return out, removed


def shared_exports_block():
    lines = ["  // ── 共享基座 sim._（供拆分出去的域文件取用，勿在别处重复定义）──",
             "  sim._ = sim._ || {};",
             "  (function exposeShared() {",
             "    var _ = sim._;"]
    for t in SHARED_TOOLS:
        lines.append("    if (typeof %s !== 'undefined') _.%s = %s;" % (t, t, t))
    lines.append("  })();")
    return "\n".join(lines) + "\n"


def sync_loaders():
    """把已存在的域文件同步进 index.html 与 tests/run-sim-tests.js 的加载列表（幂等）。

    加载顺序：career.js（基座）→ 各域文件 → careerLines.js。
    域文件必须在 career.js 之后加载（要取 sim._），但在运行时才被调用，故次序安全。
    """
    order = [DOMAINS[d]["file"] for d in DOMAINS]
    present = [f for f in order if os.path.isfile(os.path.join(SIM_DIR, f))]
    changed = []

    p = os.path.join(ROOT, "h5", "index.html")
    txt = io.open(p, encoding="utf-8", newline="").read()
    add = "".join('  <script src="js/sim/%s"></script>\n' % f
                  for f in present if ('js/sim/%s"' % f) not in txt)
    if add:
        anchor = '  <script src="js/sim/careerLines.js"></script>'
        if anchor not in txt:
            raise SystemExit("index.html 找不到 careerLines.js 锚点")
        io.open(p, "w", encoding="utf-8", newline="\n").write(txt.replace(anchor, add + anchor, 1))
        changed.append("index.html")

    p = os.path.join(ROOT, "tests", "run-sim-tests.js")
    txt = io.open(p, encoding="utf-8", newline="").read()
    add = "".join('  "%s",\n' % f for f in present if ('"%s"' % f) not in txt)
    if add:
        anchor = '  "careerLines.js",'
        if anchor not in txt:
            raise SystemExit("run-sim-tests.js 找不到 careerLines.js 锚点")
        io.open(p, "w", encoding="utf-8", newline="\n").write(txt.replace(anchor, add + anchor, 1))
        changed.append("run-sim-tests.js")

    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--allow-leaks", action="store_true",
                    help="允许「域内符号仍被域外引用」的不安全切割（默认中止）")
    args = ap.parse_args()

    with io.open(TARGET, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    lines = src.split("\n")
    syms = parse_syms(lines)
    body, kind, deps, rdeps = build(lines, syms)
    names = set(n for _, n, _, _ in syms)
    line_of = dict((n, (a, b)) for _, n, a, b in syms)

    targets = [d.strip() for d in args.domain.split(",") if d.strip()] or list(DOMAINS)
    print("career.js %d 行 / %d 符号\n" % (len(lines), len(syms)))

    for dom in targets:
        if dom not in DOMAINS:
            print("未知域:", dom)
            continue
        spec = DOMAINS[dom]
        try:
            inside, leaks, borrow, expose_shared = plan_domain(
                dom, spec, body, kind, deps, rdeps, names)
        except AlreadyCut as e:
            note = "" if not os.path.isfile(os.path.join(SIM_DIR, spec["file"])) \
                else "（%s 已存在）" % spec["file"]
            print("=== %s：已切出，跳过 %s\n  %s\n" % (dom, note, e))
            continue
        spec["_ordered_inside"] = sorted(inside, key=lambda n: line_of[n][0])
        code_lines = sum(line_of[n][1] - line_of[n][0] + 1 for n in inside)
        rows = [line_of[n][0] for n in inside]
        print("=== %s → %s ===" % (dom, spec["file"]))
        print("  %s" % spec["note"])
        print("  符号 %d（导出 %d / 私有 %d），代码 %d 行，原行 %d-%d"
              % (len(inside), len([1 for n in inside if kind[n] == "sim"]),
                 len([1 for n in inside if kind[n] == "func"]), code_lines,
                 min(rows), max(rows)))
        print("  从基座借用 %d: %s" % (len(borrow), ", ".join(borrow) or "-"))
        if expose_shared:
            print("  → 迁出符号本身属共享基座，将在新文件回挂 sim._: %s"
                  % ", ".join(expose_shared))
        if leaks:
            for n, users in leaks:
                print("  ⚠ 私有外泄 %s ← %s（需挂 sim._）" % (n, ",".join(users[:5])))
        print("  切出符号: %s" % ", ".join(n for n in spec["_ordered_inside"]))
        print()

        if args.dry_run:
            continue

        if leaks and not args.allow_leaks:
            print("  ✗ 中止：以上符号迁出后域外仍以裸名调用，会 ReferenceError。")
            print("    处理方式：把该符号加入 SHARED_TOOLS，或把调用方一并纳入本域；"
                  "确认无碍再用 --allow-leaks。")
            continue

        newfile = os.path.join(SIM_DIR, spec["file"])
        content = render_domain_file(dom, spec, inside, leaks, borrow, body, kind, deps,
                                    expose_shared)
        with io.open(newfile, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print("  写出:", newfile)

        # 从 career.js 删除这些符号的行段（从后往前删，保持行号）
        spans = sorted((line_of[n][0], line_of[n][1]) for n in inside)
        merged = []
        for a, b in spans:
            if merged and a <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(merged[-1][1], b))
            else:
                merged.append((a, b))
        for a, b in reversed(merged):
            del lines[a - 1:b]
        # 先清掉旧的基座导出块（脚本多次落盘会重复插入），再统一生成一份新的
        lines, stale = strip_shared_blocks(lines)
        if stale:
            print("  清理历史基座导出块 %d 份" % stale)
        # 基座导出块插到 IIFE 结束前（此时所有 var/function 均已可用）
        anchor = None
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].startswith("})(typeof globalThis"):
                anchor = i
                break
        if anchor is None:
            raise SystemExit("找不到 career.js 的 IIFE 结尾，已中断（文件未被破坏前请检查）")
        block = [""] + shared_exports_block().rstrip("\n").split("\n")
        lines[anchor:anchor] = block
        with io.open(TARGET, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(lines))
        print("  已从 career.js 删除 %d 段，剩余 %d 行" % (len(merged), len(lines)))

    if args.dry_run:
        print("dry-run 结束（未落盘）。")
    else:
        touched = sync_loaders()
        print("加载列表已同步: %s" % (", ".join(touched) or "无需改动"))

        # 共享基座清单落盘：测试据此断言 sim._ 完整（防止工具迁走后基座静默失效）
        io.open(SHARED_TOOLS_JSON, "w", encoding="utf-8", newline="\n").write(
            json.dumps(sorted(SHARED_TOOLS), indent=2, ensure_ascii=False) + "\n")
        print("共享基座清单已写出: tests/sim-shared-tools.json（%d 项）" % len(SHARED_TOOLS))

        # 报告基座符号的当前归属：还在 career.js 还是已随之迁入某域文件
        with io.open(TARGET, "r", encoding="utf-8", newline="") as f:
            left = set(n for _, n, _, _ in parse_syms(f.read().split("\n")))
        moved = [t for t in SHARED_TOOLS if t not in left]
        print("基座符号归属：career.js 内 %d / 已迁入域文件 %d%s"
              % (len(SHARED_TOOLS) - len(moved), len(moved),
                 ("（" + ", ".join(moved) + "）") if moved else ""))
        print("下一步：node tests/run-sim-tests.js（含 sim API 面 + sim._ 完整性守卫）")


if __name__ == "__main__":
    main()
