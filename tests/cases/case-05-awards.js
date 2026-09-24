// 测试用例组：05-awards（由 scripts/split_tests.py 机械拆分，块内容未改）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok, PDIMS = ctx.PDIMS, TDIMS = ctx.TDIMS,
      fs = ctx.fs, path = ctx.path, ROOT = ctx.ROOT, SIM_FILES = ctx.SIM_FILES,
      __dirname = ctx.__dirname,
      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,
      fixCycle = ctx.fixCycle, withoutTitlePool = ctx.withoutTitlePool,
      withoutCatalog = ctx.withoutCatalog, withTitlePool = ctx.withTitlePool,
      tsum = ctx.tsum, hireOne = ctx.hireOne, firstIds = ctx.firstIds,
      pitchArgs = ctx.pitchArgs, quietWorld = ctx.quietWorld, fillerLadder = ctx.fillerLadder;
  (function awardsListUsesStatsFields() {
    const list = config.awards.list || [];
    const ids = list.map(function (a) { return a.id; });
    assert(ids.indexOf("bestAudio") >= 0, "bestAudio present");
    assert(ids.indexOf("bestGameplay") >= 0, "bestGameplay present");
    assert(ids.indexOf("bestProduction") < 0, "bestProduction removed");
    list.forEach(function (a) {
      assert(a.scoreFrom || a.stat, "award scoring field " + a.id);
    });
    const audio = list.filter(function (a) { return a.id === "bestAudio"; })[0];
    assert(audio && audio.stat === "immersion", "bestAudio reads immersion");
    ok("awards list is stat/scoreFrom driven");
  })();

  (function scoreAwardCategoryReadsStats() {
    const world = config.careerWorld;
    const ff7 = (world.titles || []).filter(function (t) { return t.id === "ff7"; })[0];
    const even = { stats: { play: 85, fun: 85, expression: 85, immersion: 85 }, score: 9.0 };
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    assert(ff7 && defs.bestVisual && defs.bestAudio, "ff7 and award defs");
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "ff7 visual > even");
    assert(sim.scoreAwardCategory(ff7, defs.bestAudio) > sim.scoreAwardCategory(even, defs.bestAudio), "ff7 audio > even");
    const portal = (world.titles || []).filter(function (t) { return t.id === "portal"; })[0];
    assert(portal && sim.scoreAwardCategory(portal, defs.bestNarrative) > sim.scoreAwardCategory(even, defs.bestNarrative), "portal design > even");
    const missingAudio = { avg: 8.2, qsum: 320, fun: 80, expression: 78 };
    assert(typeof sim.scoreAwardCategory(missingAudio, defs.bestAudio) === "number", "rival missing immersion still scores");
    ok("scoreAwardCategory compares stats without historical winners");
  })();

  (function careerNominationHonor() {
    const g = sim.createCareerGame("测", "design", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "design" }];
    const rec = (st.worldReleased || []).filter(function (t) { return t.id === "chronoTrigger"; })[0];
    if (!rec) {
      st.worldReleased.push({
        id: "chronoTrigger",
        name: "时空之轮",
        companyId: "square",
        releaseYear: 1995,
        releaseMonth: 3,
        releasedYear: 1995,
        releasedMonth: 3,
        score: 9.5,
        avg: 9.5,
        stats: { play: 82, fun: 94, expression: 88, immersion: 92 },
        prestige: 5,
        player: true
      });
    } else rec.player = true;
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseYear !== 1995) return;
      if ((st.worldReleased || []).some(function (g) { return g.id === t.id; })) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        player: false
      });
    });
    st.year = 1995;
    st.month = 11;
    const honor0 = st.career.honor || 0;
    const fame0 = st.career.fame || 0;
    const pack = sim.runCareerAwards(st, config, []);
    const nom = pack.filter(function (a) { return a.playerNominated; }).length;
    const win = pack.filter(function (a) { return a.playerWon; }).length;
    if (nom) {
      assert(st.career.honor > honor0 || st.career.fame > fame0, "nomination grants honor/fame");
    }
    void win;
    pack.forEach(function (a) {
      if (a.id === "bestLiveOps") {
        assert(!a.nominees || a.nominees.length === 0, "1995 bestLiveOps still empty before liveops era");
        return;
      }
      assert(a.nominees && a.nominees.length === 5, "career tga 5 noms " + a.id);
    });
    ok("player nomination honor and 5 nominees");
  })();

  (function liveOpsIdentityAndAwardWindow() {
    const boxed = { releaseType: "boxed" };
    const live = { releaseType: "liveops", stats: { play: 80, fun: 82, expression: 70, immersion: 68 } };
    assert(!sim.isLiveOpsTitle(boxed), "boxed is not liveops");
    assert(sim.isLiveOpsTitle(live), "releaseType liveops counts");
    assert(sim.isLiveOpsTitle({ live: true }), "live flag counts");
    assert(sim.isLiveOpsTitle({ liveOps: { active: true } }), "legacy liveOps object still counts");
    const inYear = Object.assign({ releasedYear: 2004, releasedMonth: 8 }, live);
    assert(sim.liveOpsAwardEligible(inYear, 2004, config), "same-year live release is eligible");
    const early = Object.assign({ releasedYear: 2002, releasedMonth: 8 }, live);
    assert(!sim.liveOpsAwardEligible(early, 2004, config), "no cross-year carry-over any more");
    assert(!sim.liveOpsAwardEligible({ releaseType: "boxed", releasedYear: 2004, releasedMonth: 8 }, 2004, config), "boxed not in liveops award");
    assert(!sim.liveOpsAwardEligible({ releaseType: "outsource", live: true, releasedYear: 2004, releasedMonth: 8 }, 2004, config), "outsource not in liveops award");
    ok("liveops identity is a tag; award only looks at this year's window");
  })();

  (function careerBestLiveOpsComparesQualitySum() {
    const g = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const st = acc.state;
    const year = 2024;
    st.year = year;
    st.month = 11;
    st.worldReleased = [];
    // 当年窗口（去年 12 月～今年 11 月）里发售的全部长线版本，外加一部更早的（不该参评）。
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseType !== "liveops") return;
      const inWindow = t.releaseYear === year ||
        (t.releaseYear === year - 1 && t.releaseMonth === 12);
      if (!inWindow) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        studioId: t.studioId || null,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        releaseType: t.releaseType,
        live: true,
        versionName: t.versionName || "",
        player: false
      });
    });
    assert(st.worldReleased.length >= 3, "several same-year live releases to compare, got " + st.worldReleased.length);
    const qsum = function (row) {
      const s = row.stats || {};
      return sim.titleQualitySum(s, config);
    };
    const best = st.worldReleased.slice().sort(function (a, b) { return qsum(b) - qsum(a); })[0];
    // 评审抖动开启时得主带随机性（前二咬得紧就摇号），要断言排序语义必须先关抖动。
    const tw = deepClone(config);
    tw.awards = deepClone(config.awards);
    tw.awards.score.juryJitter = 0;
    const pack = sim.runCareerAwards(st, tw, []);
    const live = pack.filter(function (a) { return a.id === "bestLiveOps"; })[0];
    assert(live && live.nominees && live.nominees.length === (config.awards.nomineeCount || 5), "career bestLiveOps 5 noms got " + (live && live.nominees && live.nominees.length));
    assert(live.w && live.w !== "—", "career bestLiveOps has a winner");
    assert(live.nominees[0] && live.nominees[0].label === live.w, "career liveops winner from nominees");
    assert(live.w === sim.worldLabel(best, config), "winner is the highest quality-sum live release, got " + live.w + " want " + sim.worldLabel(best, config));
    // 颁奖窗口外的老长线不再参评
    const outside = sim.liveOpsAwardEligible({ releaseType: "liveops", releasedYear: year - 3, releasedMonth: 6 }, year, config);
    assert(!outside, "older live release is out of the window");
    ok("career bestLiveOps picks the highest quality-sum live release of the year");
  })();

  // 评奖门槛（绝对+相对取严）、评审抖动、保底，以及「玩家之选」真的读销量。
  (function careerAwardGateJuryAndSales() {
    function probeState(rows, seed) {
      const g = sim.createCareerGame("测", "music", config);
      const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      st.rngSeed = seed == null ? 7 : seed;
      st.year = 1997;
      st.month = 11;
      st.worldReleased = rows.map(function (r, i) {
        return {
          id: "probe" + i,
          name: "探针" + i,
          alias: "探针" + i,
          companyId: "square",
          score: r.score,
          avg: r.score,
          stats: r.stats,
          prestige: r.prestige == null ? 3 : r.prestige,
          releaseType: "boxed",
          releasedYear: 1997,
          releasedMonth: 6,
          launchSales: r.sales == null ? 100000 : r.sales
        };
      });
      return st;
    }
    function gotyOf(st, cfg) {
      return sim.runCareerAwards(st, cfg || config, []).filter(function (a) { return a.id === "goty"; })[0];
    }
    const stats = function (v) { return { play: v, fun: v, expression: v, immersion: v }; };
    const elite = { score: 9.5, stats: stats(95) };   // awardScore ≈ 95
    const mid = { score: 6.5, stats: stats(57) };     // awardScore ≈ 58.6
    const fodder = { score: 6, stats: stats(50) };    // awardScore ≈ 52，低于绝对线 55

    // 4 精锐 + 4 中庸：中位数 76.8 把门槛抬到 76.8，只有精锐进提名 → 4 部
    const mixed = [elite, elite, elite, elite, mid, mid, mid, mid];
    assert(gotyOf(probeState(mixed)).nominees.length === 4, "median line trims the ballot to the elite");
    // 放开相对线 → 门槛落回绝对线 55 → 全池达标 → 提名补满
    const loose = deepClone(config);
    loose.awards.score.gate.medianMul = 0.5;
    assert(gotyOf(probeState(mixed), loose).nominees.length === (config.awards.nomineeCount || 5), "loosening the relative line fills the ballot");
    // 全池都够不上绝对线 → 保底取全池，奖项不空缺
    const weak = gotyOf(probeState([fodder, fodder, fodder, fodder, fodder, fodder]));
    assert(weak.nominees.length > 0 && weak.w && weak.w !== "—", "all-fodder year still crowns someone");
    // 分差大 → 强者稳定胜出，换种子也不翻
    let stable = true;
    for (let seed = 1; seed <= 10; seed++) {
      if (gotyOf(probeState([elite, mid], seed)).nominees[0].titleId !== "probe0") stable = false;
    }
    assert(stable, "a wide awardScore gap survives jury jitter");
    // 玩家之选按销量排：高销量低 prestige 必须压过高 prestige 低销量
    const choice = sim.runCareerAwards(probeState([
      { score: 8, stats: stats(80), prestige: 5, sales: 1000 },
      { score: 8, stats: stats(80), prestige: 2, sales: 5000000 }
    ]), config, []).filter(function (a) { return a.id === "playersChoice"; })[0];
    assert(choice.nominees[0].titleId === "probe1", "players choice follows sales, not prestige");
    ok("award gate takes the stricter line, wide gaps survive jitter, sales drives players choice");
  })();

  (function careerAwards1997LiveCompare() {
    const g = sim.createCareerGame("测", "music", config);
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[1].id, config);
    let st = acc.state;
    st.rngSeed = 11;
    let guard = 0;
    while (!(st.year === 1997 && st.month === 11) && guard < 80) {
      st = sim.tickMonth(st, config).state;
      guard += 1;
    }
    assert(st.year === 1997 && st.month === 11, "reached 1997.11 in " + guard);
    const r = sim.tickMonth(st, config);
    const pack = r.state.lastAwards;
    // 剧情页必须和「这一年玩家首次被卷进奖项」对齐：首次 → 恰好一页，重复年 → 一页都没有。
    const involved = pack.some(function (a) { return a.playerNominated || a.playerWon; });
    const hadFlag = !!(st.career.awardStory && st.career.awardStory.nominated);
    const storyPages = (r.queue || []).filter(function (p) { return p.type === "story"; });
    assert(storyPages.length <= 1, "at most one award story page per tick, got " + storyPages.length);
    assert(storyPages.length === ((involved && !hadFlag) ? 1 : 0),
      "story page queued exactly on first involvement, involved=" + involved + " had=" + hadFlag);
    if (storyPages.length) {
      assert(r.state.career.awardStory && r.state.career.awardStory.nominated, "story flag persisted on state");
      assert(storyPages[0].kicker && storyPages[0].title && storyPages[0].body, "story page carries copy");
    }
    assert(pack && pack.length === config.awards.list.length, "awardPack size");
    pack.forEach(function (a) {
      assert(a.id && a.n && a.w, "award row " + a.id);
      assert(Array.isArray(a.nominees), "nominees array " + a.id);
      assert(a.nominees.length <= (config.awards.nomineeCount || 5), "nominee cap " + a.id);
      if (a.id !== "bestLiveOps") {
        assert(a.nominees.length === (config.awards.nomineeCount || 5), "5 nominees " + a.id + " got " + a.nominees.length);
        assert(a.nominees[0] && a.nominees[0].label === a.w, "winner from nominees " + a.id);
      } else {
        assert(a.nominees.length === 0 || a.nominees[0].label === a.w, "liveops winner from nominees or empty");
      }
    });
    const ff7 = (r.state.worldReleased || []).filter(function (t) { return t.id === "ff7"; })[0];
    assert(ff7, "ff7 shipped into window");
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    const even = { stats: { play: 40, fun: 40, expression: 40, immersion: 40 } };
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "compare still uses stats");
    assert(r.state.phase !== "BANKRUPT", "1997 tick no bankrupt");
    const hist = r.state.awardsHistory;
    assert(Array.isArray(hist) && hist.length >= 3, "awardsHistory years " + (hist && hist.length));
    const years = hist.map(function (h) { return h.year; });
    assert(years.indexOf(1995) >= 0 && years.indexOf(1996) >= 0 && years.indexOf(1997) >= 0, "history has 95-97");
    const listed = sim.listAwardsHistory(r.state, config);
    assert(listed[0] && listed[0].year === 1997, "listAwardsHistory newest first");
    pack.forEach(function (a) {
      assert(typeof a.playerWon === "boolean", "playerWon flag " + a.id);
      assert(a.year === 1997, "award year stamped " + a.id);
      assert(a.n.indexOf("1997") < 0, "category name has no year " + a.n);
    });
    const night = r.queue.filter(function (p) { return p.type === "awards"; })[0];
    // P5c 双档制：完整颁奖夜只在玩家被卷入时入队；快讯档在跨年「年度快讯」页。
    if (involved) {
      assert(night, "full night page only when player involved");
      assert(night.title === "1997年颁奖夜", "night title has year");
      assert(night.kicker === "1997年度游戏大赏", "night kicker classic era");
    } else {
      assert(!night, "no full night page for non-player years (award news at year banner)");
    }
    ok("career 1997.11 awardPack live compare, no historical winner assert");
  })();

};
