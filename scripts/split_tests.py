# -*- coding: utf-8 -*-
"""把 tests/run-sim-tests.js 拆成 tests/_harness.js + tests/cases/case-*.js。

纪律：块内容一字不改——IIFE 原文逐行搬进 case 文件，只在外面包一层
`module.exports = function (ctx) { ... }` 并注入 ctx 符号。
⚠ 一次性脚本：源文件 = scripts/_tests_before_split.js（拆分前的原测试文件）。
已经拆分过（tests/_harness.js 存在）就拒绝再跑，防止把 runner 当源文件吃掉。
"""
import io, os, re, sys

ROOT = r"E:\GameDevelopmentStory"
SRC = os.path.join(ROOT, "scripts", "_tests_before_split.js")
CASES = os.path.join(ROOT, "tests", "cases")
assert os.path.isfile(SRC), "source backup missing: " + SRC
assert not os.path.isfile(os.path.join(ROOT, "tests", "_harness.js")), \
    "already split (tests/_harness.js exists); refusing to re-run"

lines = io.open(SRC, encoding="utf-8").read().split("\n")

# ── 定位 main() 作用域 ──────────────────────────────────────────────
main_start = next(i for i, l in enumerate(lines) if l == "function main() {")
main_end = next(i for i in range(main_start + 1, len(lines)) if lines[i] == "}")
body = lines[main_start + 1 : main_end]

# ── 找 IIFE 测试块 ─────────────────────────────────────────────────
start_re = re.compile(r"^  \(function (\w+)\(\) \{$")
end_re = re.compile(r"^  \}\)\(\);$")
blocks = []  # (name, start_idx_in_body, end_idx_in_body)
for i, l in enumerate(body):
    m = start_re.match(l)
    if m:
        j = next(k for k in range(i + 1, len(body)) if end_re.match(body[k]))
        blocks.append((m.group(1), i, j))
        assert j == next((k for k in range(i + 1, len(body)) if end_re.match(body[k])), None)

names = [b[0] for b in blocks]
assert len(names) == len(set(names)), "duplicate block names"
assert len(names) == 79, "expect 79 blocks, got %d" % len(names)

# ── 分类非块行 ─────────────────────────────────────────────────────
first_block = blocks[0][1]
second_block = blocks[1][1]
# 前导区（main 开头到第一个块之前）：PDIMS/TDIMS + 维度断言 → harness
preamble = [l for l in body[:first_block]]
# helper 区（第一个块结束到第二个块开始之间）：13 个 helper + passed/ok → harness
helper_region = body[blocks[0][2] + 1 : second_block]
# 安全检查：helper 区不得包含块标记
for l in helper_region:
    assert not start_re.match(l) and not end_re.match(l), "helper region contains block marker: " + l
assert any("function ok(" in l for l in helper_region), "ok() must be in helper region"
# 其余 gap：只许注释/空行，附着到下一个块（bi=1 的 gap 就是 helper 区，已单独处理）
gaps = {}
for bi in range(2, len(blocks)):
    prev_end, next_start = blocks[bi - 1][2] + 1, blocks[bi][1]
    gap = body[prev_end:next_start]
    for l in gap:
        s = l.strip()
        assert s == "" or s.startswith("//"), "unexpected code in gap before %s: %r" % (blocks[bi][0], l)
    gaps[bi] = gap
# 末尾（最后一个块之后）→ runner 的总结行
tail = body[blocks[-1][2] + 1 :]
for l in tail:
    s = l.strip()
    assert s == "" or "tests passed" in l, "unexpected tail line: %r" % l

# ── 域分组映射（79 块全覆盖，手工核对过）──────────────────────────
GROUPS = {
    "00-core-dims": ["assertPersonToTitleMatrix"],
    "01-lifecycle-sales": [
        "salesFactorMonth1IsBase", "salesFactorFollowsExponentialFormula",
        "salesFactorDecaysFastThenFlattens", "noWeek1SalesAnyMore",
        "launchSalesRisesSuperlinearlyWithScore", "launchSalesSpansRealisticMagnitude",
        "launchSalesLiftsTheLowScoreTail", "launchSalesGivesBigPublishersAnEdge",
        "careerLaunchSalesZeroWhenBaseUnitIsZero",
    ],
    "02-media": ["mediaOutletsCarryFullQuotePools", "mediaAvgIsMeanOfOutlets"],
    "03-traits": [
        "careerTraitDrawIsThreeDistinct", "careerTraitPicksOnceAndLocks",
        "careerTraitEffectsBothSides", "careerTraitInspirationTradesGrowth",
        "careerTraitSecondBatchEffects", "careerTrendSkillMultSplitsOnTrend",
        "hardChargerStreakThenBurnout", "careerTraitsStayOnLiveKeys",
        "eventQualityTraitsScaleBothWays",
    ],
    "04-catalog": [
        "catalogStatJitterIsIntegerPctCeil", "careerWorldCatalog",
        "worldLabelAliasSwitch", "careerCalendarListsSeriesVersions",
        "flagshipSeriesShipOneVersionPerYear",
    ],
    "05-awards": [
        "awardsListUsesStatsFields", "scoreAwardCategoryReadsStats",
        "careerNominationHonor", "liveOpsIdentityAndAwardWindow",
        "careerBestLiveOpsComparesQualitySum", "careerAwardGateJuryAndSales",
        "careerAwards1997LiveCompare",
    ],
    "06-opening-offers": [
        "careerNewGameOpeningOffers", "careerRankCodeFormatting", "careerAcceptJoinsOrIdles",
    ],
    "07-dev-events": [
        "careerEventSpecifiedDimCanExceed100", "careerDevEventRoleAndPhaseFilter",
        "careerPostLaunchRoleFilterAndChoiceReplay", "skillEventsGrantCurrentTitleXp",
        "careerPostLaunchAndPlayerSkill", "careerDevEventCadence",
    ],
    "08-titlepool": [
        "titlePoolCoversCompanyWithoutCatalogWork", "titlePoolOffFallsBackToIdleGap",
        "titlePoolDurationClampedToNextCatalog", "titlePoolCoversEveryCompanyLifespan",
        "poolTitlesComeFromGenreBankAndNeverRepeat", "transitionProjectsPayOffInsteadOfPunishing",
        "careerCycleMultLengthensDevWindow", "careerVirtualInitialStatsFollowTeamShareAndStudioSkill",
        "careerIdleGapChoiceOnceAndHop",
    ],
    "09-mobility": [
        "careerXpAndMediaAndHop", "careerLateJoinUnsignedAndDecemberShipHop",
        "bigPublishersDampedAndInvitesRollYearly", "openingShunsBigPublishersAndDropsZeroChanceOffers",
        "startingAbleSkillsAndHopFit", "careerYearEndOffersStudiosAndHopRules",
        "producerCatalogDirectionAndInviteRoles",
    ],
    "10-lines-colleagues": [
        "careerScoreTracksColleaguesAndMedia", "careerEventLinesAndProducer",
        "optionalEventLinesParallelKickOutReturnMentor", "themedBondLinesMergerRemoteStoryPromo",
    ],
    "11-tick-nodes": [
        "careerTickAdvancesAndPhaseUntil", "careerTickTo1996Stable",
        "careerNodeDetectorRegistry", "creditedWorldShipIsNode", "careerNodeSkipMatchesMonthByMonth",
    ],
    "12-growth-health": [
        "careerStatSoftCapAndDualDimGrowth", "careerDevPhaseAndPowerWeighting",
        "careerEconomyFullyRemoved", "careerRenownTiers", "careerHealthOnlyMovesOnEvents",
        "careerOptionReqGate",
    ],
    "13-chapters": ["careerChaptersAndAwardEras", "careerP6Feedback"],
    "14-resume": ["careerJobRankResumeAndPromotion", "careerResumeSalesAndFirstTgaStory"],
    "99-guards": ["loaderOrderInSync", "apiSurface"],
}
name_to_group = {}
for g, ns in GROUPS.items():
    for n in ns:
        assert n in names, "mapped block missing in file: " + n
        assert n not in name_to_group, "block mapped twice: " + n
        name_to_group[n] = g
unmapped = [n for n in names if n not in name_to_group]
assert not unmapped, "unmapped blocks: %s" % unmapped

# ── 生成 harness ───────────────────────────────────────────────────
def clean(ls_):
    while ls_ and ls_[-1].strip() == "":
        ls_ = ls_[:-1]
    return ls_

preamble_c = clean(preamble)
helper_c = clean(helper_region)

harness = []
harness.append("#!/usr/bin/env node")
harness.append('"use strict";')
harness.append("//")
harness.append("// 测试沙箱 + 共享 helper（2026-09-22 由 run-sim-tests.js 拆分而来，")
harness.append("// 函数体一字不改；用例在 tests/cases/，本文件只负责加载与注入）。")
harness.append("//")
harness.append('const fs = require("fs");')
harness.append('const path = require("path");')
harness.append('const vm = require("vm");')
harness.append("")
harness.append("const ROOT = path.resolve(__dirname, \"..\");")
harness.append("const CONFIG_PATH = path.join(ROOT, \"activity\", \"config.json\");")
harness.append("const SIM_DIR = path.join(ROOT, \"h5\", \"js\", \"sim\");")
# SIM_FILES 原文在旧文件 11-30 行，直接从原文件抓
sim_files_lines = []
for i, l in enumerate(lines):
    if l == "const SIM_FILES = [":
        j = i
        while lines[j] != "];":
            sim_files_lines.append(lines[j])
            j += 1
        sim_files_lines.append("];")
        break
harness.extend(sim_files_lines)
# TestDate / loadSim / deepClone / assert / loadConfig 原文（main 之前的顶层定义）
top_defs = []
for i in range(0, main_start):
    top_defs.append(lines[i])
# 去掉 require/ROOT/CONFIG_PATH/SIM_DIR/SIM_FILES 与 shebang/use strict（已重写）
out = []
skip_prefixes = ("#!/usr/bin/env node", '"use strict";', 'const fs = require("fs");',
                 'const path = require("path");', 'const vm = require("vm");',
                 "const ROOT = path.resolve", "const CONFIG_PATH = path.join",
                 "const SIM_DIR = path.join")
in_sim_files = False
for l in top_defs:
    if in_sim_files:
        if l.startswith("];"):
            in_sim_files = False
        continue
    if l.startswith("const SIM_FILES = ["):
        in_sim_files = True
        continue
    if l.strip() == "" and (not out or out[-1].strip() == ""):
        continue
    if any(l.startswith(p) for p in skip_prefixes):
        continue
    out.append(l)
harness.extend(out)
harness.append("")
harness.append("function createContext() {")
harness.extend(preamble_c)
harness.extend(helper_c)
harness.append("  return {")
harness.append("    GDS: GDS, sim: sim, config: config, assert: assert, deepClone: deepClone,")
harness.append("    ok: ok, PDIMS: PDIMS, TDIMS: TDIMS,")
harness.append("    __passed: function () { return passed; },")
harness.append("    fs: fs, path: path, ROOT: ROOT, SIM_FILES: SIM_FILES, __dirname: __dirname,")
helper_names = re.findall(r"^  (?:function (\w+)|let (\w+) = 0)", "\n".join(helper_c), re.M)
helper_names = [a or b for a, b in helper_names]
for h in helper_names:
    if h in ("ok", "passed"):
        continue
    harness.append("    %s: %s," % (h, h))
harness.append("  };")
harness.append("}")
harness.append("")
harness.append("module.exports = { createContext: createContext, SIM_FILES: SIM_FILES, ROOT: ROOT };")
harness.append("")
io.open(os.path.join(ROOT, "tests", "_harness.js"), "w", encoding="utf-8", newline="\n").write("\n".join(harness))

# ── 生成 case 文件 ─────────────────────────────────────────────────
if not os.path.isdir(CASES):
    os.makedirs(CASES)
group_blocks = {g: [] for g in GROUPS}
for bi, (name, s, e) in enumerate(blocks):
    g = name_to_group[name]
    gap = gaps.get(bi, [])
    group_blocks[g].append((bi, name, s, e, gap))

CTX_BIND = (
    "  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,\n"
    "      deepClone = ctx.deepClone, ok = ctx.ok, PDIMS = ctx.PDIMS, TDIMS = ctx.TDIMS,\n"
    "      fs = ctx.fs, path = ctx.path, ROOT = ctx.ROOT, SIM_FILES = ctx.SIM_FILES,\n"
    "      __dirname = ctx.__dirname,\n"
    "      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,\n"
    "      fixCycle = ctx.fixCycle, withoutTitlePool = ctx.withoutTitlePool,\n"
    "      withoutCatalog = ctx.withoutCatalog, withTitlePool = ctx.withTitlePool,\n"
    "      tsum = ctx.tsum, hireOne = ctx.hireOne, firstIds = ctx.firstIds,\n"
    "      pitchArgs = ctx.pitchArgs, quietWorld = ctx.quietWorld, fillerLadder = ctx.fillerLadder;\n"
)

for g, items in sorted(group_blocks.items()):
    path_g = os.path.join(CASES, "case-%s.js" % g)
    buf = []
    buf.append("// 测试用例组：%s（由 scripts/split_tests.py 机械拆分，块内容未改）" % g)
    buf.append('"use strict";')
    buf.append("")
    buf.append("module.exports = function runGroup(ctx) {")
    buf.append(CTX_BIND.rstrip("\n"))
    for bi, name, s, e, gap in items:
        comments = [l for l in gap if l.strip()]
        if comments:
            buf.extend(comments)
        buf.extend(body[s : e + 1])
        buf.append("")
    buf.append("};")
    io.open(path_g, "w", encoding="utf-8", newline="\n").write("\n".join(buf).rstrip("\n") + "\n")

# ── 新 runner ──────────────────────────────────────────────────────
runner = []
runner.append("#!/usr/bin/env node")
runner.append('"use strict";')
runner.append("//")
runner.append("// 测试入口：收集 tests/cases/case-*.js 顺序执行（文件名排序即执行序，99-guards 殿后）。")
runner.append("// 沙箱加载 / 共享 helper 在 tests/_harness.js；用例按域分文件，改哪个域看哪个文件。")
runner.append("// 用法：node tests/run-sim-tests.js [--only <关键字>]   # --only 按文件名过滤")
runner.append("//")
runner.append('const fs = require("fs");')
runner.append('const path = require("path");')
runner.append("const HARNESS = require(\"./_harness.js\");")
runner.append("")
runner.append("function main() {")
runner.append("  const ctx = HARNESS.createContext();")
runner.append("  const casesDir = path.join(__dirname, \"cases\");")
runner.append("  const files = fs.readdirSync(casesDir)")
runner.append("    .filter(function (f) { return /^case-[\\w\\-]+\\.js$/.test(f); })")
runner.append("    .sort();")
runner.append("  const onlyIdx = process.argv.indexOf(\"--only\");")
runner.append("  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;")
runner.append("  const picked = only ? files.filter(function (f) { return f.indexOf(only) >= 0; }) : files;")
runner.append("  if (only && !picked.length) {")
runner.append('    console.error("--only " + only + " matched no case file");')
runner.append("    process.exit(1);")
runner.append("  }")
runner.append("  picked.forEach(function (f) {")
runner.append("    if (only) console.log(\"== \" + f + \" ==\");")
runner.append("    require(path.join(casesDir, f))(ctx);")
runner.append("  });")
runner.append("  console.log(\"\\n\" + ctx.__passed() + \" tests passed\");")
runner.append("}")
runner.append("")
runner.append("try {")
runner.append("  main();")
runner.append("} catch (e) {")
runner.append("  console.error(e && e.stack ? e.stack : e);")
runner.append("  process.exit(1);")
runner.append("}")

# ok/passed 计数器要从 harness 暴露给 runner：改用导出计数函数
io.open(os.path.join(ROOT, "tests", "run-sim-tests.js"), "w", encoding="utf-8", newline="\n").write("\n".join(runner) + "\n")

print("harness helpers:", helper_names)
print("groups:", {g: len(v) for g, v in sorted(group_blocks.items())})
print("total blocks:", sum(len(v) for v in group_blocks.values()))
