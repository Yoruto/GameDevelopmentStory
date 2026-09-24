// 测试用例组：07-dev-events（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerEventSpecifiedDimCanExceed100() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [{
      id: "testBurst",
      displayName: "测试突破",
      text: "指定程序维",
      presentation: "notice",
      qualityDim: "play",
      qualityDelta: 20
    }];
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const squareOffer = (g.career.openingOffers || []).filter(function (o) {
      return o.companyId === "square";
    })[0] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, squareOffer.id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.jobRank = 6;
    st.career.stats.program = 90;
    st.career.liveStats = { play: 95, fun: 90, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.rngSeed = 1;
    st.rngCount = 0;
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "testBurst", "burst event rolled");
    assert(st.career.liveStats.play > 100, "live can exceed 100, got " + st.career.liveStats.play);
    ok("career event uses specified dim and live can exceed 100");
  })();

  (function careerDevEventRoleAndPhaseFilter() {
    function choiceEv(id, extra) {
      const row = {
        id: id,
        displayName: id,
        text: "测",
        presentation: "choice",
        choices: [{ id: "a", label: "按期", qualityDim: ["play"], qualityDelta: [2] }]
      };
      Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
      return row;
    }
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [
      choiceEv("artOnlyChoice", { role: "art" }),
      choiceEv("genericChoice"),
      choiceEv("progPreproChoice", { role: "programmer", phase: "prepro" }),
      choiceEv("progProdChoice", { role: "programmer", phase: "production" })
    ];
    fixCycle(tweaked);
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "phaseProbe",
      companyId: "square",
      publisherId: "square",
      name: "探针",
      alias: "探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "phaseProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11
    }]);
    function primed(roleId, year, month) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "phaseProbe";
      st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
      st.career.credits = [{ titleId: "phaseProbe", companyId: "square", roleId: roleId }];
      st.career.postLaunch = null;
      return st;
    }
    function rollIds(roleId, year, month, n) {
      const ids = {};
      let i;
      for (i = 0; i < n; i++) {
        const st = primed(roleId, year, month);
        st.rngSeed = 1000 + i;
        st.rngCount = 0;
        const ev = sim.rollCareerDevEvent(st, tweaked, []);
        assert(ev, "chance 1 always rolls " + roleId + " " + year + "." + month);
        ids[ev.id] = true;
      }
      return ids;
    }
    const progJan = rollIds("programmer", 1995, 1, 24);
    assert(!progJan.artOnlyChoice, "programmer cannot roll art choice");
    assert(progJan.genericChoice, "role-less generic still rolls");
    assert(progJan.progPreproChoice, "programmer prepro choice rolls in prepro");
    assert(!progJan.progProdChoice, "production choice stays out of prepro");
    const progJun = rollIds("programmer", 1995, 6, 24);
    assert(progJun.progProdChoice, "programmer production choice rolls in production");
    assert(!progJun.progPreproChoice, "prepro choice stays out of production");
    assert(!progJun.artOnlyChoice, "programmer still cannot roll art in production");
    const artJan = rollIds("art", 1995, 1, 24);
    assert(artJan.artOnlyChoice, "art player can roll art choice");
    assert(artJan.genericChoice, "art player can still roll generic");
    assert(!artJan.progPreproChoice, "art player cannot roll programmer choice");
    ok("career devEvents hard-filter role and phase");
  })();

  (function careerPostLaunchRoleFilterAndChoiceReplay() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.postLaunch.eventChance = 1;
    tweaked.careerWorld.postLaunch.events = [
      {
        id: "artPostChoice",
        displayName: "破图",
        text: "测",
        presentation: "choice",
        role: "art",
        choices: [
          { id: "fix", label: "立刻补", qualityDim: ["expression"], qualityDelta: [5] },
          { id: "wait", label: "等大更新", qualityDim: ["expression"], qualityDelta: [-2] }
        ]
      },
      {
        id: "allNotice",
        displayName: "补丁说明",
        text: "测",
        presentation: "notice",
        qualityDim: "play",
        qualityDelta: 1
      }
    ];
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [{
      id: "genericReplay",
      displayName: "通用抉择",
      text: "测",
      presentation: "choice",
      choices: [
        { id: "push", label: "加钱赶工", qualityDim: ["play", "expression"], qualityDelta: [7, -4] },
        { id: "hold", label: "按期", qualityDim: ["play"], qualityDelta: [0] }
      ]
    }];
    function supportState(roleId) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
      st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: roleId }];
      st.career.postLaunch = { titleId: "chronoTrigger", monthsLeft: 2 };
      return st;
    }
    const progSeen = {};
    let i;
    for (i = 0; i < 20; i++) {
      const st = supportState("programmer");
      st.rngSeed = 50 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      assert(ev, "postLaunch chance 1 rolls");
      progSeen[ev.id] = true;
    }
    assert(!progSeen.artPostChoice, "programmer cannot roll art postLaunch choice");
    assert(progSeen.allNotice, "role-less postLaunch notice still rolls");
    const artSeen = {};
    for (i = 0; i < 20; i++) {
      const st = supportState("art");
      st.rngSeed = 80 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      if (ev) artSeen[ev.id] = true;
    }
    assert(artSeen.artPostChoice, "art player can roll art postLaunch choice");

    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let base = acc.state;
    base.career.companyId = "square";
    base.career.titleId = "chronoTrigger";
    base.career.liveStats = { play: 90, fun: 88, expression: 86, immersion: 84 };
    base.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    base.career.postLaunch = null;
    base.year = 1995;
    base.month = 1;
    base.rngSeed = 424242;
    base.rngCount = 0;
    const snap = JSON.stringify(base);
    const t1 = sim.tickMonth(JSON.parse(snap), tweaked);
    const t2 = sim.tickMonth(JSON.parse(snap), tweaked);
    assert(JSON.stringify(t1.state) === JSON.stringify(t2.state), "career choice tick replays before pick");
    const choicePage = (t1.queue || []).filter(function (q) {
      return q.presentation === "choice" && q.eventId === "genericReplay";
    })[0];
    assert(choicePage, "career generic choice queued");
    const artBefore = t1.state.career.liveStats.expression;
    const a = sim.resolveEventChoice(t1.state, "genericReplay", "push", tweaked);
    const b = sim.resolveEventChoice(t2.state, "genericReplay", "push", tweaked);
    assert(a.ok && b.ok, "career resolve ok");
    assert(JSON.stringify(a.state) === JSON.stringify(b.state), "career same seed same choice");
    const f = sim.careerPlayerImpactFactor(t1.state, tweaked);
    assert(a.state.career.liveStats.play === t1.state.career.liveStats.play + 7 * f, "push raises play by scaled delta");
    assert(a.state.career.liveStats.expression === artBefore - 4 * f, "push drops expression by scaled delta");
    ok("postLaunch role filter and career choice replay same seed");
  })();

  (function skillEventsGrantCurrentTitleXp() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ids = ((config.careerWorld.devEvents && config.careerWorld.devEvents.list) || []).map(function (e) { return e.id; });
    ["genreRefBoard", "playRefClear", "genrePlayClinic", "alphaPlaytestNotes", "goldGenrePass",
      "progFeelLab", "artMoodBoard", "designComps", "musicGenreListen", "polishPlayTune",
      "polishGenreLock", "goldPlayFaq", "artPolishPass", "designPlayPass", "musicThemeLock"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "skill event " + id);
    });
    const prodIds = ((config.careerWorld.producerEvents && config.careerWorld.producerEvents.list) || []).map(function (e) { return e.id; });
    assert(prodIds.indexOf("prodSkillClinic") >= 0, "producer skill clinic");
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = (config.careerWorld.devEvents.list || []).filter(function (e) {
      return e.id === "genreRefBoard";
    }).map(function (e) {
      const row = deepClone(e);
      delete row.phase;
      delete row.role;
      return row;
    });
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    st.rngSeed = 1;
    st.rngCount = 0;
    const beforeG = sim.playerXpValue(st, "genre", chrono.genreId);
    const beforeP = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "genreRefBoard", "rolled genreRefBoard");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) === beforeG + px.eventGenreXp, "notice genre xp");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) === beforeP, "notice play xp unchanged");

    const g2 = sim.createCareerGame("测", "design", config);
    let st2 = sim.acceptOpeningOffer(g2, g2.career.openingOffers[0].id, config).state;
    st2.career.companyId = "square";
    st2.career.titleId = "chronoTrigger";
    st2.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    const g0 = sim.playerXpValue(st2, "genre", chrono.genreId);
    const p0 = sim.playerXpValue(st2, "gameplay", chrono.gameplayId);
    const picked = sim.resolveCareerEventChoice(st2, "genrePlayClinic", "play", config);
    assert(picked.ok, "clinic choice ok");
    assert(sim.playerXpValue(picked.state, "gameplay", chrono.gameplayId) === p0 + px.eventFocusXp, "choice play focus xp");
    assert(sim.playerXpValue(picked.state, "genre", chrono.genreId) === g0, "choice genre unchanged");
    const prod = sim.resolveCareerEventChoice(st2, "prodSkillClinic", "genreClass", config);
    assert(prod.ok, "producer clinic ok");
    assert(sim.playerXpValue(prod.state, "genre", chrono.genreId) === g0 + px.eventFocusXp, "producer genre class xp");
    ok("skill events grant current title xp");
  })();

  (function careerPostLaunchAndPlayerSkill() {
    const pl = (config.careerWorld || {}).postLaunch || {};
    const px = (config.careerWorld || {}).playerXp || {};
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const g = sim.createCareerGame("测", "programmer", config);
    assert(g.career.genreXp && typeof g.career.genreXp === "object", "genreXp default");
    assert(g.career.gameplayXp && typeof g.career.gameplayXp === "object", "gameplayXp default");
    assert(!sim.careerPostLaunch(g), "new game no postLaunch");
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.studioId = (sim.careerCompany("square", config).studios || [])[0] && sim.careerCompany("square", config).studios[0].id;
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const gxp0 = sim.playerXpValue(st, "genre", chrono.genreId);
    const pxp0 = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.career.titleId === "chronoTrigger", "player title stays during ship call");
    assert(st.career.liveStats, "live still present at ship");
    assert(!sim.careerPostLaunch(st), "ship does not occupy postLaunch");
    const view = sim.careerProjectView(st, config);
    assert(!view.postLaunch, "view is not postLaunch after ship");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) > gxp0, "genreXp up on ship");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) > pxp0, "gameplayXp up on ship");
    const shippedId = st.career.titleId;
    st.month = 4;
    sim.assignCareerProject(st, config);
    assert(!sim.careerPostLaunch(st), "still no postLaunch after unload");
    assert(st.career.titleId !== shippedId, "cleared shipped title after month ends");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "square";
    hopSt.career.titleId = "chronoTrigger";
    hopSt.career.liveStats = { play: 80, fun: 80, expression: 90, immersion: 80 };
    hopSt.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "art" }];
    hopSt.career.yearEndOffers = [{
      id: "ye-hop-pl",
      companyId: "nintendo",
      studioId: (sim.careerCompany("nintendo", config).studios || [])[0].id,
      roleId: "art",
      salary: 4000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hopSt, "ye-hop-pl", config);
    assert(hopped.ok && hopped.hopped, "hopped off before ship");
    const chronoCredit = (hopped.state.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(chronoCredit && !chronoCredit.shipped, "unsigned resume remains");
    hopSt = hopped.state;
    hopSt.year = 1995;
    hopSt.month = 3;
    hopSt.career.postLaunch = null;
    sim.shipWorldTitlesThisMonth(hopSt, config);
    assert(!sim.careerPostLaunch(hopSt), "hopped player does not enter postLaunch");
    const rec = (hopSt.worldReleased || []).filter(function (g) { return g.id === "chronoTrigger"; })[0];
    assert(rec && !rec.player, "world ship without player credit");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    const t = sim.careerTitle("ff7", config);
    low.career.companyId = "square";
    high.career.companyId = "square";
    high.career.genreXp[t.genreId] = 80;
    high.career.gameplayXp[t.gameplayId] = 80;
    const liveLow = sim.careerLiveFromTitle(low, t, config);
    const liveHigh = sim.careerLiveFromTitle(high, t, config);
    const artStat = (sim.careerRole("art", config) || {}).stat || "art";
    assert(liveHigh[artStat] === liveLow[artStat], "player skill never lifts live base");
    assert(liveHigh.play === liveLow.play, "player skill does not lift other dims");
    low.career.titleId = "ff7";
    high.career.titleId = "ff7";
    assert(sim.careerMonthlyContribution(high, config) > sim.careerMonthlyContribution(low, config), "high skill raises contrib");
    assert(px.xpPerDevMonth != null && px.xpPerRelease != null && px.xpPerPostLaunchMonth != null, "player xp amounts in config");
    assert(pl.monthsMin === 0 && pl.monthsMax === 0, "postLaunch months occupancy 0");
    ok("ship unloads after month, hop skip unsigned, player skill live/contrib");
  })();

  (function careerDevEventCadence() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 2;
    tweaked.careerWorld.devEvents.pityMonths = 6;
    tweaked.careerWorld.devEvents.maxPerYear = 5;
    tweaked.careerWorld.devEvents.list = [{
      id: "cadenceProbe",
      displayName: "节奏探针",
      text: "测",
      presentation: "notice",
      qualityDim: "program",
      qualityDelta: 1
    }];
    function primed(year, month) {
      const g = sim.createCareerGame("测", "programmer", tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
      st.career.postLaunch = null;
      st.career.lastDevEventYm = null;
      st.career.devEventYear = year;
      st.career.devEventsThisYear = 0;
      st.rngSeed = 1;
      st.rngCount = 0;
      return st;
    }
    const jan = primed(1995, 1);
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "first month can fire");
    assert(jan.career.devEventsThisYear === 1, "year count 1");
    jan.month = 2;
    assert(!sim.rollCareerDevEvent(jan, tweaked, []), "min gap blocks next month");
    jan.month = 3;
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "fires after min gap");

    const pity = primed(1995, 7);
    pity.career.lastDevEventYm = sim.monthIndex(1995, 1);
    pity.career.devEventsThisYear = 1;
    tweaked.careerWorld.devEvents.chance = 0;
    assert(sim.rollCareerDevEvent(pity, tweaked, []), "pity fires at 6 months");

    tweaked.careerWorld.devEvents.chance = 1;
    const cap = primed(1995, 11);
    cap.career.lastDevEventYm = sim.monthIndex(1995, 1);
    cap.career.devEventsThisYear = 5;
    assert(!sim.rollCareerDevEvent(cap, tweaked, []), "max 5 per year");
    cap.year = 1996;
    cap.month = 1;
    cap.career.lastDevEventYm = sim.monthIndex(1995, 11);
    assert(sim.rollCareerDevEvent(cap, tweaked, []), "new year resets cap");

    const lineSkip = primed(1995, 6);
    lineSkip.career.lastDevEventYm = null;
    const q = [];
    const notes = [];
    if (sim.processCareerLines) sim.processCareerLines(lineSkip, tweaked, q, notes);
    const rolled = sim.rollCareerDevEvent(lineSkip, tweaked, notes);
    assert(rolled, "line-free month still rolls random");
    ok("career dev event cadence 4 months / 3-5 year");
  })();

};
