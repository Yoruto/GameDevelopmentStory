// 测试用例组：10-lines-colleagues（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerEventLinesAndProducer() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const founder = (world.growthStages || []).filter(function (s) { return s.id === "founder"; })[0];
    assert(founder && founder.lockedThisVersion, "founder lockedThisVersion");
    assert(lines.some(function (l) { return l.id === "promo-to-expert"; }), "promo-to-expert line configured");
    assert(lines.some(function (l) { return l.id === "become-producer"; }), "become-producer line configured");
    assert((world.producerCareer || {}).minJobRank === 4, "producer unlock at rank 4");

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    function makePromotable(st, rank) {
      const reqs = ((world.jobRanks.promotion || {}).requirements || [])[rank] || {};
      const role = sim.careerRole(st.career.roleId, config);
      const statKey = (role && role.stat) || "program";
      st.career.jobRank = rank;
      st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
      st.career.stats = st.career.stats || {};
      st.career.stats[statKey] = (reqs.mainStat || 0) + 1;
      st.career.fame = (reqs.fameOrHonor || 0) + 1;
      st.career.honor = 0;
      st.career.promotionsThisYear = 0;
      st.career.lastPromotionYear = null;
      st.career.credits = [];
      const need = reqs.creditedTitles || 0;
      for (let i = 0; i < Math.ceil(need); i++) {
        st.career.credits.push({
          titleId: "cred-" + i,
          shipped: true,
          virtual: false,
          jobRank: rank,
          companyId: st.career.companyId
        });
      }
      return st;
    }

    let st = makePromotable(hired("design"), 4);
    assert(sim.canPromoteCareer(st, config), "rank4 eligible");
    assert(sim.promotionUsesEventLine(st, config), "rank4 uses event line");
    assert(sim.canStartBecomeProducerLine(st, config), "producer unlock at jobRank 4");
    const instant = sim.promoteCareer(st, config);
    assert(instant.ok, "promoteCareer at rank4 starts line");
    assert(instant.state.career.jobRank === 4, "rank unchanged until final beat");
    assert(sim.activeCareerLineId(instant.state) === "promo-to-expert", "promo line active");

    let lineSt = instant.state;
    let step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "offer", "apply", config);
    assert(step.ok && step.state.career.lines["promo-to-expert"].flags.applied, "offer accepted");
    lineSt = step.state;
    // 评审拍已并入决议拍：现在是 offer → decision（onShip），分支收益放在 decision 的选项里
    lineSt.career.lines["promo-to-expert"].waitingFor = "shipReady";
    lineSt.career.lines["promo-to-expert"].pending = false;
    const q = [];
    sim.processCareerLines(lineSt, config, q, []);
    assert(q.length && q[0].beatId === "decision", "onShip fires decision");
    step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "decision", "depth", config);
    assert(step.ok && step.done, "promo line done");
    assert(step.state.career.jobRank === 5, "final beat promotes 4→5");
    assert(step.state.career.lines["promo-to-expert"].status === "done", "line status done");

    let abortSt = makePromotable(hired("art"), 4);
    abortSt.career.lines = {};
    let started = sim.startCareerLine(abortSt, "promo-to-expert", config);
    assert(started.ok, "start promo line");
    const aborted = sim.resolveCareerLineChoice(started.state, "promo-to-expert", "offer", "decline", config);
    assert(aborted.ok && aborted.aborted, "abort ok");
    assert(aborted.state.career.jobRank === 4, "abort keeps rank");
    assert(aborted.state.career.lines["promo-to-expert"].status === "aborted", "aborted status");
    assert(!sim.canStartPromotionLine(aborted.state, config), "no reopen same year");
    aborted.state.year += 1;
    aborted.state.career.promotionsThisYear = 0;
    assert(sim.canStartPromotionLine(aborted.state, config), "reopen next year");

    [4, 5, 6].forEach(function (rank) {
      let p = makePromotable(hired("music"), Math.min(rank, 5));
      p.career.jobRank = rank;
      p.career.lines = {};
      p.career.promotionsThisYear = 0;
      assert(sim.canStartBecomeProducerLine(p, config), "producer unlock at rank " + rank);
    });

    let prod = makePromotable(hired("programmer"), 4);
    prod.career.lines = {};
    started = sim.startCareerLine(prod, "become-producer", config);
    assert(started.ok, "start become-producer");
    assert(!sim.canStartPromotionLine(started.state, config), "mutual exclusion while producer line active");
    step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
    prod = step.state;
    prod.career.lines["become-producer"].waitingFor = "shipReady";
    prod.career.lines["become-producer"].pending = false;
    sim.processCareerLines(prod, config, [], []);
    const keptRank = prod.career.jobRank;
    // 试岗拍已并入席位拍：craft / signal 两个方向直接带 becomeProducer
    step = sim.resolveCareerLineChoice(prod, "become-producer", "seat", "craft", config);
    assert(step.ok && step.done, "producer line done");
    assert(step.state.career.roleId === "producer", "roleId producer");
    assert(step.state.career.growthStage === "producer", "growthStage producer");
    assert(step.state.career.jobRank === keptRank, "kept jobRank after producer");
    assert(sim.careerJobTitleDisplay(step.state, config) === "制作人", "display 制作人");
    assert(sim.isCareerProducer(step.state), "isCareerProducer");
    assert(!sim.canPromoteCareer(step.state, config), "producer cannot promote ladder");

    const virtSt = sim.clone(step.state);
    virtSt.career.titleId = null;
    virtSt.career.liveStats = null;
    virtSt.career.idleMonths = 99;
    virtSt.year = 2024;
    virtSt.month = 1;
    // 制作人自选题材/玩法的路径：池开着就直达，池作按传进来的题材/玩法立。
    const virtCfg = deepClone(config);
    const virt = sim.startPoolProject(virtSt, virtCfg, { genreId: "fantasy", gameplayId: "rpg" });
    assert(virt && virt.virtual && virt.pool && virt.genreId === "fantasy" && virt.gameplayId === "rpg",
      "producer picks genre/gameplay for the pool project");

    let capSt = makePromotable(hired("programmer"), 4);
    capSt.career.lines = {};
    started = sim.startCareerLine(capSt, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 1, "first producer ask counted");
    const no1 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    assert(no1.ok && no1.aborted, "first producer ask declined");
    no1.state.year += 1;
    no1.state.career.promotionsThisYear = 0;
    assert(sim.canStartBecomeProducerLine(no1.state, config), "producer ask can reopen once");
    started = sim.startCareerLine(no1.state, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 2, "second producer ask counted");
    const no2 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    no2.state.year += 1;
    no2.state.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(no2.state, config), "producer ask cap after 2");
    const blocked = sim.startCareerLine(no2.state, "become-producer", config);
    assert(!blocked.ok, "third producer start blocked");

    assert(sim.isGrowthStageLocked("founder", config), "founder still locked helper");
    const stages = world.growthStages || [];
    assert(stages.every(function (s) { return s.id !== "founder" || s.lockedThisVersion; }), "no founder unlock");

    ok("event lines, rank4→5 final beat, producer unlock 4/5/6, founder locked");
  })();

  (function careerScoreTracksColleaguesAndMedia() {
    const world = config.careerWorld;
    const player = world.player || {};
    const dims = ["program", "design", "art", "music"];
    dims.forEach(function (d) {
      assert(player.startingStats[d] >= 16 && player.startingStats[d] <= 20, d + " starting teens");
    });
    assert(player.specialtyBonus >= 6 && player.specialtyBonus <= 8, "specialtyBonus 6-8");
    const craft = world.titlePool.craft || {};
    assert(craft.scoreBase === 1 && craft.statDivisor === 7.5, "craft scale scoreBase/statDivisor");
    assert(Math.abs(sim.careerCraftPublicScore(15, config) - 3) <= 0.1, "open four-dim 15 -> 3");
    assert(Math.abs(sim.careerCraftPublicScore(56, config) - 8.5) <= 0.1, "open four-dim 56 -> 8.5");
    assert(sim.careerCraftPublicScore(150, config) === 10, "craft caps at 10");
    assert(sim.careerCraftPublicScore(0, config) === 1, "craft floors at 1");
    assert(sim.careerCraftPublicScore(22, config) < 8, "weak team cannot grind masterpiece");

    function meanStats(stats) {
      return PDIMS.reduce(function (a, d) { return a + sim.personStatVal(stats, d); }, 0) / PDIMS.length;
    }
    function meanTitleStats(stats) {
      return sim.titleQualityMean(stats, config);
    }
    function hireAt(companyId, role) {
      let st = sim.createCareerGame("测", role || "programmer", config);
      st.career.companyId = companyId;
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(companyId, config));
      st.career.roleId = role || "programmer";
      st.career.jobRank = 1;
      st.rngSeed = 42;
      st.rngCount = 0;
      sim.ensureCareerColleagues(st, config);
      return st;
    }

    const nintendo = hireAt("nintendo", "programmer");
    assert((nintendo.career.colleagues || []).length === 4, "four nintendo colleagues");
    nintendo.career.colleagues.forEach(function (c) {
      assert(c.jobRank != null, "colleague has jobRank");
      if (c.roleId === "producer") {
        assert(c.jobRank >= 5 && c.jobRank <= 6, "power3 producer rank " + c.jobRank);
      } else {
        assert(c.jobRank >= 4 && c.jobRank <= 6, "power3 specialist rank " + c.jobRank);
      }
      const avg = meanStats(c.stats);
      assert(avg >= 80 && avg <= 100, "power3 stats " + avg);
    });

    const atlus = hireAt("atlus", "programmer");
    atlus.career.colleagues.forEach(function (c) {
      assert(c.jobRank >= 1 && c.jobRank <= 3, "power1 rank " + c.jobRank);
      const avg = meanStats(c.stats);
      assert(avg >= 35 && avg <= 58, "power1 stats " + avg);
    });
    const nAvg = meanStats(sim.careerTeamAvgStats(nintendo, config));
    const pAvg = meanStats(sim.careerTeamAvgStats(atlus, config));
    assert(nAvg > pAvg + 15, "power3 team avg exceeds power1");
    const nBase = sim.careerCraftLiveStats(nintendo, 6, 5, config, "fantasy", "rpg");
    const pBase = sim.careerCraftLiveStats(atlus, 6, 5, config, "fantasy", "rpg");
    const nCraft = sim.careerCraftPublicScore(meanTitleStats(nBase), config);
    const pCraft = sim.careerCraftPublicScore(meanTitleStats(pBase), config);
    assert(nCraft >= 5 && nCraft <= 6.6, "nintendo virtual intern craft " + nCraft);
    assert(pCraft >= 3 && pCraft <= 4.4, "power1 virtual intern craft " + pCraft);
    assert(nCraft > pCraft + 1.5, "nintendo virtual beats small-studio virtual");

    const oot = sim.careerTitle("oot", config);
    assert(oot && oot.landmark && oot.prestige === 5, "oot landmark p5");
    nintendo.career.titleId = "oot";
    nintendo.career.liveStats = sim.careerLiveFromTitle(nintendo, oot, config);
    sim.shipPlayerTitle(nintendo, config, [], []);
    const rec = (nintendo.worldReleased || []).filter(function (g) { return g.id === "oot"; })[0];
    assert(rec && rec.score >= 9.5 && rec.score <= 10, "intern landmark public " + (rec && rec.score));
    assert(rec.score >= oot.score - 0.1, "landmark floor catalog-0.1");
    assert(rec.media && rec.media.rows && rec.media.rows.length === 4, "four media rows");
    // 作品的评分 = 面板上那四家的均分：榜单 / 奖项 / 销量曲线 / 履历都读这一个数，
    // 不允许再出现「面板一个数、榜单另一个数」（旧实现把对外口碑写在 rec.avg 上）。
    assert(rec.avg === rec.media.avg && rec.score === rec.media.avg,
      "work score is the media average, got " + rec.avg + " vs " + rec.media.avg);
    assert(rec.launchSales === sim.careerLaunchSales(oot, rec.media.avg, config, rec.liveStats || rec.stats).launchSales,
      "launchSales uses the shown average");
    rec.media.rows.forEach(function (row) {
      assert(Math.abs(row.score - rec.score) <= 0.7, "media tracks public " + row.score + " vs " + rec.score);
    });
    assert(typeof rec.launchSales === "number" && rec.launchSales > 0, "intern landmark launchSales");
    assert(rec.launchSales === sim.careerLaunchSales(oot, rec.score, config, rec.liveStats || rec.stats).launchSales, "landmark launch matches formula");

    const mid = sim.createCareerGame("测", "programmer", config);
    mid.rngSeed = 7;
    mid.rngCount = 0;
    const pub = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7.2, config, mid);
    const around = sim.scoreMediaFromPublic(mid, pub, config, {
      min: world.scoreFromLive.mediaJitterMin,
      max: world.scoreFromLive.mediaJitterMax
    });
    assert(around.rows.every(function (r) { return Math.abs(r.score - pub) <= 0.7; }), "scatter around public");
    assert(around.rows.some(function (r) { return r.score < 9.5; }), "high live stats do not force media 10s");
    const studioMedia = sim.scoreMedia(mid, { play: 90, fun: 90, expression: 90, immersion: 90 }, [], config, null);
    assert(studioMedia.rows.every(function (r) { return r.score >= 9.5; }), "studio divisor 6.5 still maps 90s to ~10");

    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.devEvents.chance = 1;
    tw.careerWorld.devEvents.minGapMonths = 0;
    tw.careerWorld.devEvents.maxPerYear = 99;
    tw.careerWorld.devEvents.list = [{
      id: "ootHistory",
      titleId: "oot",
      displayName: "史实",
      text: "测",
      presentation: "notice",
      qualityDim: "play",
      qualityDelta: 10
    }];
    const hist = hireAt("nintendo", "programmer");
    hist.career.titleId = "oot";
    hist.career.liveStats = { play: 90, fun: 90, expression: 90, immersion: 90 };
    hist.career.jobRank = 1;
    hist.rngSeed = 1;
    hist.rngCount = 0;
    const fired = sim.rollCareerDevEvent(hist, tw, []);
    assert(fired && fired.id === "ootHistory", "titleId notice rolled");
    assert(hist.career.liveStats.play === 100, "landmark titleId notice unscaled, got " + hist.career.liveStats.play);

    ok("starting teens, craft anchors, colleagues-by-power, intern landmark, media around public");
  })();

  (function optionalEventLinesParallelKickOutReturnMentor() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const ids = lines.map(function (l) { return l.id; });
    ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "optional line " + id);
      const def = lines.filter(function (l) { return l.id === id; })[0];
      assert(def.exclusiveGroup !== "careerPath", id + " not in careerPath");
    });
    const kojima = ((sim.careerCompany("konami", config) || {}).seniors || []).filter(function (s) {
      return s.id === "kojima";
    })[0];
    // kojima 前辈已移除：successor 剧情不再强制配置

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }

    let st = hired("programmer");
    st.career.jobRank = 4;
    st.career.fame = 20;
    st.career.honor = 20;
    st.career.jobXp = 99;
    st.career.monthsInRank = 99;
    st.career.promotionsThisYear = 0;
    st.career.credits = [{ titleId: "x", shipped: true, virtual: false, jobRank: 4 }];
    const company0 = st.career.companyId;
    // mentor 由 sim 在建（真实或占位），非 null，不再强制
    const prod = sim.startCareerLine(st, "become-producer", config);
    assert(prod.ok, "start producer while bonds exist");
    let step = sim.resolveCareerLineChoice(prod.state, "become-producer", "invite", "yes", config);
    st = step.state;
    const mentorStart = sim.startCareerLine(st, "bond-mentor", config);
    assert(mentorStart.ok, "mentor starts while producer line active");
    st = mentorStart.state;
    const actives = sim.activeCareerLineIds(st);
    assert(actives.indexOf("become-producer") >= 0 && actives.indexOf("bond-mentor") >= 0, "two lines active");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    // 制作人线压拍后第二拍是 seat（wait onShip），用 waitingFor 让它 ready
    st.career.lines["become-producer"].waitingFor = "shipReady";
    st.career.lines["become-producer"].pending = false;
    st.career.lines["bond-mentor"].waitUntil = sim.monthIndex(st.year, st.month);
    st.career.lines["bond-mentor"].pending = false;
    // 默认单车道：careerPath 赢，一个月只出一条。
    const qPri = [];
    sim.processCareerLines(sim.clone(st), config, qPri, []);
    assert(qPri.length === 1, "single lane: one beat per month, got " + qPri.length);
    assert(qPri[0].lineId === "become-producer", "careerPath beat wins the single lane");
    // bondBeatsPerMonth > 0：bond 线走独立车道，与主线并行（机制须可用，默认关）。
    const cfgBond = JSON.parse(JSON.stringify(config));
    cfgBond.careerWorld.eventLines.bondBeatsPerMonth = 1;
    const qBond = [];
    sim.processCareerLines(sim.clone(st), cfgBond, qBond, []);
    assert(qBond.length === 2, "bond lane on: both lanes fire, got " + qBond.length);
    assert(qBond[0].lineId === "become-producer" && qBond[1].lineId === "bond-mentor",
      "career lead first, bond rides its own lane");
    assert(qPri[0].lineId === "become-producer", "careerPath beat wins priority, got " + (qPri[0] && qPri[0].lineId));

    let kickSt = hired("design");
    const chrono = sim.careerTitle("chronoTrigger", config);
    const worldScore0 = chrono && chrono.score;
    const savings0 = kickSt.career.savings;
    const fame0 = kickSt.career.fame;
    kickSt.career.titleId = "chronoTrigger";
    kickSt.career.companyId = kickSt.career.companyId || "square";
    const epic = sim.startCareerLine(kickSt, "epic-title", config);
    assert(epic.ok, "start epic-title");
    const collapsed = sim.resolveCareerLineChoice(epic.state, "epic-title", "weight", "collapse", config);
    assert(collapsed.ok && collapsed.done, "collapse completes");
    assert(collapsed.state.career.companyId == null, "kicked out of company");
    assert((collapsed.state.career.tenures || []).every(function (t) { return t.endYear != null; }), "tenures closed");
    assert(collapsed.state.career.savings === savings0, "no extra money penalty");
    assert(collapsed.state.career.fame === fame0, "no extra fame penalty");
    assert(sim.careerTitle("chronoTrigger", config).score === worldScore0, "catalog score unchanged");
    assert(sim.canCareerHop(collapsed.state, config), "unemployed can seek work");
    const offers = sim.listYearEndOffers(collapsed.state, config);
    assert(offers.length >= 1, "year-end offers after kick");
    offers[0].successChance = 1;
    collapsed.state.career.yearEndOffers = offers;
    const hopped = sim.applyYearEndOffer(collapsed.state, offers[0].id, config);
    assert(hopped.ok && hopped.hopped, "rehire via existing hop");
    assert(hopped.state.career.companyId, "employed again");

    let ret = hired("art");
    ret.year = 2014;
    ret.month = 3;
    const retStart = sim.startCareerLine(ret, "era-return-china", config);
    assert(retStart.ok, "start return line");
    let retStep = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert(retStep.ok, "read letter");
    const invitePage = (retStep.queue || []).filter(function (p) { return p.beatId === "invite"; })[0];
    assert(invitePage, "chained to return invite");
    const optIds = (invitePage.options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("staff") >= 0, "staff option");
    assert(optIds.indexOf("producer") >= 0, "producer option allowed on this invite");
    const staffJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "staff", config);
    assert(staffJoin.ok, "staff join");
    const cnIds = ["mihoyo", "hypergryph", "paperGames"];
    assert(cnIds.indexOf(staffJoin.state.career.companyId) >= 0, "joined a catalog CN company");
    assert(["programmer", "art", "design", "music"].indexOf(staffJoin.state.career.roleId) >= 0, "staff is one of four roles");
    assert(staffJoin.state.career.growthStage !== "founder", "staff not founder");
    const prodJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "producer", config);
    assert(prodJoin.ok, "producer join");
    assert(prodJoin.state.career.roleId === "producer", "producer role");
    assert(prodJoin.state.career.growthStage === "producer", "producer stage");
    assert(prodJoin.state.career.growthStage !== "founder", "still not founder");
    assert(cnIds.indexOf(prodJoin.state.career.companyId) >= 0, "producer is employee of catalog CN company");
    assert(sim.isGrowthStageLocked("founder", config), "founder still locked");

    let stay = hired("music");
    stay.career.companyId = "konami";
    stay.year = 2015;
    stay.month = 9;
    stay.career.bonds = stay.career.bonds || {};
    stay.career.bonds.mentor = {
      seniorId: "kojima",
      name: "小岛秀夫",
      alias: "小岛秀夫",
      title: "制作人",
      companyId: "konami",
      homeCompanyId: "konami",
      colocated: true,
      departYear: 2015,
      successorCompanyId: "kojimaProductions",
      monthsTogether: 20
    };
    const stayCo = stay.career.companyId;
    const mStart = sim.startCareerLine(stay, "bond-mentor", config);
    const mFollow = sim.resolveCareerLineChoice(mStart.state, "bond-mentor", "take-in", "follow", config);
    stay = mFollow.state;
    const mentorDef = lines.filter(function (l) { return l.id === "bond-mentor"; })[0];
    const leaveIdx = mentorDef.beats.map(function (b) { return b.id; }).indexOf("leave");
    assert(leaveIdx >= 0, "leave beat still present");
    stay.career.lines["bond-mentor"].beat = leaveIdx;
    stay.career.lines["bond-mentor"].pending = false;
    stay.career.lines["bond-mentor"].waitUntil = null;
    stay.career.lines["bond-mentor"].waitingFor = null;
    // 准入（mobility.requireInDevTitle.scripted）：小岛组 2015～2017.10 一部在研目录作都没有
    //（死亡搁浅 2017.11 才开工），这时"跟着走"＝进空窗，过月被塞虚拟作 → 这一拍先不拍。
    const qEarly = [];
    sim.processCareerLines(deepClone(stay), config, qEarly, []);
    assert(!qEarly.some(function (x) { return x.beatId === "leave"; }),
      "leave beat waits while the successor company has nothing in dev");
    stay.year = 2018;
    const qLeave = [];
    sim.processCareerLines(stay, config, qLeave, []);
    assert(qLeave.length && qLeave[0].beatId === "leave", "leave beat ready");
    const stayed = sim.resolveCareerLineChoice(stay, "bond-mentor", "leave", "stay", config);
    assert(stayed.ok && stayed.done, "not following is a legal end");
    assert(stayed.state.career.lines["bond-mentor"].status === "done", "mentor line done");
    assert(stayed.state.career.companyId === stayCo, "still at same company");
    void company0;

    ok("optional lines parallel, kick-out only, return invite roles, mentor stay ends");
  })();

  (function themedBondLinesMergerRemoteStoryPromo() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    function lineDef(id) {
      return lines.filter(function (l) { return l.id === id; })[0];
    }
    function beatIdx(lineId, beatId) {
      const beats = (lineDef(lineId).beats || []);
      let i;
      for (i = 0; i < beats.length; i++) if (beats[i].id === beatId) return i;
      return -1;
    }
    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    // 同 hired，但把东家钉到 capcom —— 一家从 1995 活到 2025 的公司。
    // 开局 offer 是随机抽的，可能落在「已消亡但有接班」的公司（如 interplayFallback，
    // 2004 年后并入 bethesda）：那种公司到点会弹 company-merger 拍，而每月只有一个拍位，
    // 会把需要跨年跳步的用例挤掉。凡是要把 st.year 设到很久以后的用例都用这个。
    function hiredStable(role) {
      const g = hired(role);
      const home = sim.careerCompany("capcom", config);
      g.career.companyId = "capcom";
      g.career.studioId = ((home && home.studios || [])[0] || {}).id;
      return g;
    }
    function pinPeer(st) {
      st.career.bonds = st.career.bonds || {};
      if (!st.career.bonds.peer) {
        st.career.bonds.peer = {
          id: "peer-test",
          name: "同组",
          roleId: "design",
          jobRank: 3,
          companyId: st.career.companyId,
          homeCompanyId: st.career.companyId,
          monthsTogether: 30,
          colocated: true
        };
      } else {
        st.career.bonds.peer.monthsTogether = 30;
        st.career.bonds.peer.jobRank = st.career.bonds.peer.jobRank || 3;
        st.career.bonds.peer.homeCompanyId = st.career.bonds.peer.homeCompanyId || st.career.companyId;
        st.career.bonds.peer.colocated = true;
      }
      return st;
    }
    function jumpBeat(st, lineId, beatId) {
      st.career.lines[lineId].beat = beatIdx(lineId, beatId);
      st.career.lines[lineId].pending = false;
      st.career.lines[lineId].waitUntil = sim.monthIndex(st.year, st.month);
      st.career.lines[lineId].waitingFor = null;
      st.career.lines[lineId].waitUntilYear = null;
    }
    function hopTo(st, companyId) {
      const co = sim.careerCompany(companyId, config);
      const studio = ((co && co.studios) || [])[0];
      st.career.yearEndOffers = [{
        id: "test-hop",
        companyId: companyId,
        studioId: studio && studio.id,
        roleId: st.career.roleId,
        salary: 1200,
        successChance: 1
      }];
      return sim.applyYearEndOffer(st, "test-hop", config);
    }

    assert(lineDef("company-merger") && lineDef("company-merger").exclusiveGroup !== "careerPath", "merger not careerPath");
    assert((world.producerCareer || {}).minJobRank === 4, "producer minRank still 4");

    let st = hired("programmer");
    st.career.jobRank = 2;
    let started = sim.startCareerLine(st, "bond-mentor", config);
    let step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    let q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "nominate", "mentor nominate fires at rank 2");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.ok, "rank2 nominate promote");
    assert(step.state.career.jobRank === 3, "mentor finale rank 2 → +1");
    ok("mentor finale rank 2 promotes +1");

    st = hired("programmer");
    st.career.jobRank = 3;
    st.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(st, config), "rank 3 cannot start producer globally");
    assert(sim.canStartBecomeProducerLine(st, config, { ignoreMinRank: true }), "mentor sponsor ignores minRank");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q[0] && q[0].beatId === "nominate", "nominate at rank 3");
    const optIds = (q[0].options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("sponsor-producer") >= 0, "producer sponsor option visible");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "sponsor-producer", config);
    assert(step.ok, "sponsor producer");
    const act = sim.activeCareerLineIds(step.state);
    assert(act.indexOf("become-producer") >= 0, "mentor rank 3 starts become-producer");
    assert((world.producerCareer || {}).minJobRank === 4, "minRank config unchanged");
    ok("mentor finale rank 3 starts become-producer");

    const tweaked = deepClone(config);
    const peerLine = ((tweaked.careerWorld.eventLines || {}).lines || []).filter(function (l) {
      return l.id === "bond-peer";
    })[0];
    peerLine.startWhen.startChance = 1;
    peerLine.startWhen.minMonthsTogether = { bond: "peer", n: 0 };
    let peerSt = pinPeer(hired("programmer"));
    peerSt.career.jobRank = 2;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(!(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active"), "peer line will not start at jobRank 2");
    peerSt.career.jobRank = 3;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active", "peer starts at jobRank 3");
    ok("peer line gated at minJobRank 3");

    function startPeerFinale(rank) {
      let s = pinPeer(hired("programmer"));
      s.career.jobRank = rank;
      s.career.promotionsThisYear = 0;
      const go = sim.startCareerLine(s, "bond-peer", config);
      const rival = sim.resolveCareerLineChoice(go.state, "bond-peer", "rival", "compete", config);
      s = rival.state;
      jumpBeat(s, "bond-peer", "finale-path");
      const qq = [];
      sim.processCareerLines(s, config, qq, []);
      assert(qq[0] && qq[0].beatId === "finale-path", "peer finale ready");
      return { state: s, page: qq[0] };
    }
    let pack = startPeerFinale(3);
    const promoIds = (pack.page.options || []).map(function (o) { return o.id; });
    assert(promoIds.indexOf("promo") >= 0 && promoIds.indexOf("dual") >= 0 && promoIds.indexOf("role-change") >= 0, "peer finale endings present");
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "promo", config);
    assert(step.state.career.jobRank === 4, "peer promo 3→4");
    pack = startPeerFinale(3);
    const peerRank0 = pack.state.career.bonds.peer.jobRank;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "dual", config);
    assert(step.state.career.jobRank === 4, "dual player +1");
    assert(step.state.career.bonds.peer.jobRank === peerRank0 + 1, "dual peer +1");
    pack = startPeerFinale(3);
    const role0 = pack.state.career.roleId;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "role-change", config);
    assert(step.state.career.roleId !== role0, "role change among staff jobs");
    assert(step.state.career.jobRank === 3, "role change keeps jobRank");
    pack = startPeerFinale(4);
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "promo", config);
    assert(step.state.career.jobRank === 5, "peer promo 4→5");
    assert(step.state.career.lines["promo-to-expert"] && step.state.career.lines["promo-to-expert"].status === "done", "promo-to-expert marked done");
    ok("peer finale promote / dual / role change");

    st = hired("programmer");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    const home0 = st.career.companyId;
    const hopped = hopTo(st, home0 === "nintendo" ? "sega" : "nintendo");
    assert(hopped.ok && hopped.hopped, "mid-line hop");
    st = hopped.state;
    assert(st.career.bonds.mentor.colocated === false, "hop sets colocated false");
    assert(st.career.lines["bond-mentor"].remotePending, "remote beat pending");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "remote", "remote check beat");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "remote", "keep", config);
    assert(step.ok && step.state.career.lines["bond-mentor"].status === "active", "keep in touch continues");
    ok("hop mid-line remote beat");

    st = hired("programmer");
    st.career.companyId = "square";
    st.career.studioId = "square-rd1";
    st.year = 2004;
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].lineId === "company-merger", "merger interrupt queued");
    step = sim.resolveCareerLineChoice(st, "company-merger", "merge", "stay", config);
    assert(step.ok && step.state.career.companyId === "squareEnix", "merger stay joins successor");
    ok("company merger join successor");

    // ── 消亡公司必须有接班（P2-fix-a）────────────────────────────────────────
    // sim.mergerCompanyDue 的门槛是 hireUntilYear != null && successorId != null：
    // 少了后者，玩家在 2004 年后仍留在 interplayFallback 之类「数据里已经不存在」的公司
    // 一直做池作到时间轴结束（pool_coverage_report.py 记的「僵尸月」，曾有 2304 月）。
    // 接班公司还必须活过被并方，否则只是把玩家从一个僵尸公司迁进另一个。
    (function deadCompaniesHaveSuccessor() {
      const cs = config.careerWorld.companies || [];
      const byId = {};
      cs.forEach(function (c) { byId[c.id] = c; });
      const noSucc = cs.filter(function (c) {
        return c.hireUntilYear != null && !c.successorId;
      }).map(function (c) { return c.id; });
      assert(noSucc.length === 0,
        "消亡公司必须有接班，否则在职玩家困在僵尸公司：" + noSucc.join(","));
      const shortLived = cs.filter(function (c) {
        if (c.hireUntilYear == null || !c.successorId) return false;
        const s = byId[c.successorId];
        return !s || (s.hireUntilYear != null && s.hireUntilYear <= c.hireUntilYear);
      }).map(function (c) { return c.id; });
      assert(shortLived.length === 0,
        "接班公司必须活过被并方（否则是连锁僵尸）：" + shortLived.join(","));
      ok("every dead company has a longer-lived successor (" +
        cs.filter(function (c) { return c.hireUntilYear != null; }).length + " 家)");
    })();

    // ── 目录作品的时空与唯一性守卫（P2-fix-a：补了 188 部之后）────────────────
    // 三条都踩过坑：worldFill_* 占位作 blurb 与 companyId 对不上、还越过 hireUntilYear；
    // mw1/cod4 那种「同公司+同名+同发售月」重复会让同一部作在榜单/奖项里被算两遍。
    (function catalogTitlesAreConsistent() {
      const cs = config.careerWorld.companies || [];
      const byId = {};
      cs.forEach(function (c) { byId[c.id] = c; });
      const titles = config.careerWorld.titles || [];
      const placeholders = titles.filter(function (t) {
        return String(t.id).indexOf("worldFill") === 0;
      }).map(function (t) { return t.id; });
      assert(placeholders.length === 0,
        "worldFill_* 占位作必须已清掉（blurb 与 companyId 错配）：" + placeholders.join(","));
      // 窗口判定按「接续链的并集」：P1 把一批小厂并进了活下来的那家（enix → squareEnix、
      // teamIco → sony…），于是那些公司的目录会挂在接续链的另一端 —— 那是**正确的归并结果**，
      // 抄近路只查单一公司的窗口会把 dq6/dq7/lastGuardian 误判成错误。
      // 真正的错误长这样：worldFill_2015_0 挂在 koei（2009 截止）名下却标 2015 年发售，
      // 整条接续链都没人能入职。granTurismo 1997 / mir2 2001 那两例也属于这类，
      // 已通过放开 polyphony(1998→1997) / tencent(2003→2001) 的可入职起点修掉。
      const lineageLo = {}, lineageHi = {};
      function chain(cid) {
        const out = {}, stack = [cid];
        while (stack.length) {
          const id = stack.pop();
          if (!id || out[id]) continue;
          out[id] = true;
          const c = byId[id];
          if (!c) continue;
          if (c.successorId) stack.push(c.successorId);
          cs.forEach(function (o) { if (o.successorId === id) stack.push(o.id); });
        }
        return out;
      }
      cs.forEach(function (c) {
        let lo = Infinity, hi = -Infinity;
        const fam = chain(c.id);
        Object.keys(fam).forEach(function (id) {
          const o = byId[id];
          if (!o) return;
          lo = Math.min(lo, o.hireFromYear || o.foundedYear || 1995);
          hi = Math.max(hi, o.hireUntilYear == null ? 2025 : o.hireUntilYear);
        });
        lineageLo[c.id] = lo;
        lineageHi[c.id] = hi;
      });
      const outOfWindow = titles.filter(function (t) {
        if (!byId[t.companyId]) return true;
        return t.releaseYear < lineageLo[t.companyId] || t.releaseYear > lineageHi[t.companyId];
      }).map(function (t) { return t.id + "(" + t.releaseYear + ")"; });
      assert(outOfWindow.length === 0,
        "作品发售年必须落在公司接续链的可入职窗口内：" + outOfWindow.slice(0, 8).join(","));
      const seen = {};
      const dup = [];
      titles.forEach(function (t) {
        const k = t.companyId + "|" + t.name + "|" + t.releaseYear + "|" + t.releaseMonth;
        if (seen[k]) dup.push(k + " (" + seen[k] + "/" + t.id + ")");
        seen[k] = t.id;
      });
      assert(dup.length === 0, "同公司+同名+同发售月重复：" + dup.slice(0, 5).join("; "));
      ok("catalog titles stay in window and unique (" + titles.length + " 部)");
    })();

    // 新补的接班走同一条线：牛蛙 2001 关停 → 2002 年该弹合并，跟着过去落到 EA。
    st = hired("programmer");
    st.career.companyId = "bullfrog";
    st.career.studioId = "bullfrog-main";
    st.year = 2002;
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].lineId === "company-merger", "bullfrog 关停后弹合并");
    step = sim.resolveCareerLineChoice(st, "company-merger", "merge", "stay", config);
    assert(step.ok && step.state.career.companyId === "ea", "牛蛙并进 EA");
    assert(step.state.career.jobRank === st.career.jobRank, "合并保职级不跳级");
    ok("dead studio merges into its successor (bullfrog -> ea)");

    st = hired("art");
    started = sim.startCareerLine(st, "bond-junior", config);
    assert(started.ok, "junior line starts");
    st = started.state;
    assert(st.career.bonds && st.career.bonds.junior, "ensureBond junior");
    st.year = 2014;
    const retStart = sim.startCareerLine(st, "era-return-china", config);
    step = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert((step.queue || []).some(function (p) { return p.beatId === "reveal"; }) || (step.state.career.bonds.junior && step.state.career.bonds.junior.revealed), "return line reveal still works");
    ok("junior bond + return reveal");

    // ── 三条关系线的选择要有回声：写进去的 flag 必须被后续拍读回 ──────────────
    // 旧状态：option.setFlags 写了 voice / credit / taughtWell / remote，但整份
    // eventLines 只有史诗线用 flagOn/flagOff 读回（held），三条关系线的 flag 全是死链。
    (function themedBondLinesEchoTheirChoices() {
      function echoBeats(lineId) {
        return (lineDef(lineId).beats || []).filter(function (b) {
          return b.skipIf && (b.skipIf.flagOn || b.skipIf.flagOff);
        });
      }
      assert(echoBeats("bond-mentor").length >= 2, "前辈线要有读回 voice 选择的回声拍");
      assert(echoBeats("bond-peer").length >= 2, "同事线要有读回 credit 选择的回声拍");
      assert(echoBeats("bond-junior").length >= 2, "后辈线要有读回 taughtWell 选择的回声拍");

      // 前辈线：选「照着做」只出 mirror 那版回声，own 那版被跳过
      let mEcho = hired("programmer");
      mEcho = sim.startCareerLine(mEcho, "bond-mentor", config).state;
      mEcho = sim.resolveCareerLineChoice(mEcho, "bond-mentor", "take-in", "follow", config).state;
      mEcho = sim.resolveCareerLineChoice(mEcho, "bond-mentor", "own-voice", "mirror", config).state;
      assert(mEcho.career.lines["bond-mentor"].flags.mirrorStyle === true, "选『照着做』记下 mirrorStyle");
      jumpBeat(mEcho, "bond-mentor", "voice-echo-mirror");
      const mq = [];
      sim.processCareerLines(mEcho, config, mq, []);
      assert(mq.length && mq[0].beatId === "voice-echo-mirror", "mirror 分支触发 mirror 回声");
      jumpBeat(mEcho, "bond-mentor", "voice-echo-own");
      const mq2 = [];
      sim.processCareerLines(mEcho, config, mq2, []);
      assert(!mq2.some(function (x) { return x.beatId === "voice-echo-own"; }),
        "mirror 分支不该触发 own 回声");

      // 同事线：结尾拆成「关系收束 -> 职业去向」，散伙后需要关系的选项消失
      let pSplit = pinPeer(hired("programmer"));
      pSplit.career.jobRank = 3;
      pSplit = sim.startCareerLine(pSplit, "bond-peer", config).state;
      pSplit = sim.resolveCareerLineChoice(pSplit, "bond-peer", "rival", "compete", config).state;
      const relIds = (lineDef("bond-peer").beats.filter(function (x) {
        return x.id === "finale-relation";
      })[0].options || []).map(function (o) { return o.id; });
      assert(relIds.indexOf("reconcile") >= 0 && relIds.indexOf("split") >= 0, "同事线要有关系收束拍");
      pSplit = sim.resolveCareerLineChoice(pSplit, "bond-peer", "finale-relation", "split", config).state;
      assert(pSplit.career.lines["bond-peer"].flags.peerSplit === true, "散伙记下 peerSplit");
      jumpBeat(pSplit, "bond-peer", "finale-path");
      const q3 = [];
      sim.processCareerLines(pSplit, config, q3, []);
      const pathIds = (q3[0] && q3[0].options ? q3[0].options : []).map(function (o) { return o.id; });
      assert(pathIds.indexOf("promo") >= 0, "去向拍仍给『你先升一级』");
      assert(pathIds.indexOf("dual") < 0, "散伙后不再给『一起升』");

      // 后辈线：自身收束到揭晓，不再只挂在回国线上
      let jr = hired("art");
      jr = sim.startCareerLine(jr, "bond-junior", config).state;
      assert(jr.career.bonds.junior && !jr.career.bonds.junior.revealed, "后辈初始未揭晓");
      const revealBeat = (lineDef("bond-junior").beats || []).filter(function (b) {
        return b.id === "reveal";
      })[0];
      assert(revealBeat && revealBeat.effects && revealBeat.effects.revealJunior === true,
        "后辈线尾拍要带 revealJunior");
      jumpBeat(jr, "bond-junior", "reveal");
      const jq = [];
      sim.processCareerLines(jr, config, jq, []);
      assert(jr.career.bonds.junior.revealed === true, "揭晓拍触发后 bond.revealed 置真");
      assert(jr.career.bonds.junior.aliasNow, "揭晓后要有真名 aliasNow");
      assert(jq.length && jq[0].beatId === "reveal", "揭晓拍会推上队列");
      // 渲染层面：揭晓拍必须用真名，且不能把 {juniorName} 漏成字面量
      assert(jq[0].body.indexOf("{") < 0, "揭晓拍正文不能漏出占位符");
      assert(jq[0].body.indexOf(jr.career.bonds.junior.aliasNow) >= 0, "揭晓拍正文要出现真名");

      // 收束形态：一通陌生电话。响铃拍不认人、刻意不提名，接起拍才报名字。
      // 拆两拍的意义是让"陌生号码"单独占一屏——紧张感不被叙述句稀释。
      const callBeat = (lineDef("bond-junior").beats || []).filter(function (b) {
        return b.id === "call";
      })[0];
      assert(callBeat, "后辈线收束要写成『陌生电话』，不再是一份摊在桌上的署名文件");
      assert(!(callBeat.effects && callBeat.effects.revealJunior),
        "响铃拍不能带 revealJunior，否则名字提前揭晓、『陌生』白写");
      assert(String(callBeat.body).indexOf("{juniorName}") < 0 &&
        String(callBeat.bodyRemote).indexOf("{juniorName}") < 0,
        "响铃拍要刻意不提名，名字留给接起拍");
      assert((revealBeat.wait || {}).type === "sameMonthChain",
        "接起拍要同月连弹，不额外占月度车道");
      assert((callBeat.wait || {}).n >= 12, "响铃前要留出足够年月，『某天』才成立");
      assert(callBeat.bodyRemote && callBeat.bodyRemote !== callBeat.body,
        "电话拍要按异地/当面分叉：当面那版得先交代他后来走了");

      // 真跑一遍连弹：一个月内应当连续推出『响铃』+『接起』两拍。
      // 电话有准入：他所在的公司得已经成立、且当月确有在研目录作。
      // 2013 + 米哈游（2011 成立，崩坏学园2 在研 2012-09~2014-03）是一个满足点。
      // ⚠️ 用 hiredStable：开局 offer 若落在「已消亡但有接班」的公司，2013 年会先弹
      //    company-merger 拍，每月只有一个拍位，电话就被挤掉——那是正确行为，
      //    但会掩盖这个用例想验的东西。老数据里这些公司没有 successorId、合并永不触发，
      //    所以以前没暴露。
      let jrCall = hiredStable("art");
      jrCall = sim.startCareerLine(jrCall, "bond-junior", config).state;
      jrCall.career.bonds.junior.revealCompanyId = "mihoyo";
      jrCall.year = 2013;
      jumpBeat(jrCall, "bond-junior", "call");
      const jqCallAll = [];
      sim.processCareerLines(jrCall, config, jqCallAll, []);
      const jqCall = jqCallAll.filter(function (x) { return x.lineId === "bond-junior"; });
      assert(jqCall.length === 2 && jqCall[0].beatId === "call" && jqCall[1].beatId === "reveal",
        "响铃与接起要在同一个月连弹（got " + jqCall.map(function (x) { return x.beatId; }).join(",") + "）");
      assert(jqCall[1].body.indexOf(jrCall.career.bonds.junior.aliasNow) >= 0,
        "接起拍要报出真名");
      assert(jqCall[1].body.indexOf("{") < 0, "接起拍不能漏出占位符");

      // 门禁：公司已成立 + 当月有在研目录作，两个条件都满足电话才响。
      // 只按作品窗口判不够——暖暖环游世界开发期从 2012-06 起，叠纸 2013 才成立。
      function callBeatsAt(year, companyId) {
        let s = hiredStable("art");
        s = sim.startCareerLine(s, "bond-junior", config).state;
        s.career.bonds.junior.revealCompanyId = companyId;
        s.year = year;
        jumpBeat(s, "bond-junior", "call");
        const q = [];
        sim.processCareerLines(s, config, q, []);
        // processCareerLines 会处理所有活跃线：P2c 拉长周期后别的线（如 epic-title）可能
        // 同月被触发，所以这里只统计被测的 bond-junior。
        return q.filter(function (x) { return x.lineId === "bond-junior"; })
          .map(function (x) { return x.beatId; }).join(",");
      }
      assert(callBeatsAt(1997, "mihoyo") === "", "公司还没成立时，这通电话不该响");
      assert(callBeatsAt(2013, "hypergryph") === "", "鹰角 2017 才成立，2013 年不该有这通电话");
      assert(callBeatsAt(2013, "mihoyo") === "call,reveal", "公司已成立且在研时，电话要响");

      // 那家公司彻底不出新作了（世界目录里它的窗口已全部过去）→ 这通电话不会来，
      // 线要在 finale 正常收束，不能永久挂在 call 拍上。
      let jrGone = hiredStable("art");
      jrGone = sim.startCareerLine(jrGone, "bond-junior", config).state;
      jrGone.career.bonds.junior.revealCompanyId = "mihoyo";
      jrGone.year = 2035;
      jumpBeat(jrGone, "bond-junior", "call");
      const jqGoneAll = [];
      sim.processCareerLines(jrGone, config, jqGoneAll, []);
      const jqGone = jqGoneAll.filter(function (x) { return x.lineId === "bond-junior"; });
      assert(jqGone.length === 0, "公司已无新作在研时，电话不该来");
      assert(jrGone.career.lines["bond-junior"].status === "done",
        "电话不来的线要在 finale 收束，不能留在挂起状态");

      // juniorLeave 必须持久。旧行为只设 colocated=false，下一回合被
      // refreshCareerBondColocation 按"老家公司 == 现公司"重算回 true —— 人走了又坐回旁边。
      let jrLeft = hired("art");
      jrLeft = sim.startCareerLine(jrLeft, "bond-junior", config).state;
      jrLeft = sim.resolveCareerLineChoice(jrLeft, "bond-junior", "finale", "recommend", config).state;
      assert(jrLeft.career.bonds.junior.colocated === false, "『推荐去别的工作室』当帧即为异地");
      jrLeft = sim.tickMonth(jrLeft, config).state;
      assert(jrLeft.career.bonds.junior.colocated === false, "过月后仍是异地：离队要持久，不能被位置重算拉回");

      // 回国线的揭晓是兜底路径：后辈线自己已经揭晓过，就别再演第二遍反转
      const retReveal = (lineDef("era-return-china").beats || []).filter(function (b) {
        return b.id === "reveal";
      })[0];
      assert(retReveal && retReveal.skipIf && retReveal.skipIf.juniorRevealed === true,
        "回国线揭晓要在已揭晓时跳过");
      let retSkip = hired("programmer");
      retSkip = sim.startCareerLine(retSkip, "bond-junior", config).state;
      retSkip.career.bonds.junior.revealed = true;
      retSkip.year = 2014;
      const retSkipStep = sim.resolveCareerLineChoice(
        sim.startCareerLine(retSkip, "era-return-china", config).state,
        "era-return-china", "letter", "read", config);
      assert(!(retSkipStep.queue || []).some(function (p) { return p.beatId === "reveal"; }),
        "已揭晓时回国线不再重复演揭晓");

      // 揭晓之前，同一段文案应当显示当时的称呼（而不是真名）
      let jrEarly = hired("art");
      jrEarly = sim.startCareerLine(jrEarly, "bond-junior", config).state;
      assert(jrEarly.career.bonds.junior.revealed !== true, "开线时还没揭晓");
      jumpBeat(jrEarly, "bond-junior", "copy");
      const jqEarly = [];
      sim.processCareerLines(jrEarly, config, jqEarly, []);
      assert(jqEarly.length && jqEarly[0].body.indexOf("{") < 0, "早期拍正文不能漏出占位符");
      assert(jqEarly[0].body.indexOf(jrEarly.career.bonds.junior.aliasThen) >= 0,
        "揭晓前要用当时的称呼（aliasThen）");

      // 前辈线兜底：尾拍 leave 被跳过时不能再静默完结（旧行为：leave 是最后一拍，
      // skipIf.noMentorSuccessor 命中 -> advanceSkippedBeats 直接 completeLine）
      const mentorBeats = lineDef("bond-mentor").beats || [];
      const leavePos = mentorBeats.map(function (b) { return b.id; }).indexOf("leave");
      assert(leavePos >= 0 && leavePos < mentorBeats.length - 1, "leave 之后要有兜底拍，不能再当尾拍");
      assert(mentorBeats[mentorBeats.length - 1].skipIf == null, "兜底拍必须无条件可触发");

      ok("bond lines echo their choices, endings split, junior reveals");
    })();

    // ── 回国/跳槽邀约不能把玩家挂到"还没开工"的目录作上 ──────────────────────
    // 旧行为：pickScriptedInviteTitle 找不到当月真在研的作时兜底 nextCatalogTitle（下一档
    // 还没开工的真作），玩家被挂在几年后才开工的作上，过月被判空窗，一两个月后被自动塞
    // 一部虚拟作——表现就是"我在做暖暖环游世界，过月怎么变成另一个虚拟游戏了"。
    (function careerInviteNeverFabricatesATitle() {
      const eraLine = ((world.eventLines || {}).lines || []).filter(function (l) {
        return l.id === "era-return-china";
      })[0];
      assert(eraLine && eraLine.startWhen && eraLine.startWhen.requireInDevTarget === true,
        "回国线 startWhen 必须带 requireInDevTarget");
      function onNikki(year, month) {
        const g = hired("programmer");
        g.year = year;
        g.month = month;
        g.career.companyId = "paperGames";
        g.career.studioId = "paperGames-main";
        g.career.titleId = "nikkiWorld";
        g.career.liveStats = sim.careerLiveFromTitle(g, sim.careerTitle("nikkiWorld", config, g), config);
        g.career.bonds = g.career.bonds || {};
        g.career.bonds.junior = {
          id: "bond-junior", aliasThen: "小T", aliasNow: "海猫络合物",
          revealCompanyId: "hypergryph", revealTitleId: "arknights",
          revealed: true, companyId: "paperGames"
        };
        return g;
      }
      // 2012：鹰角还没有任何在研目录作（明日方舟 2017.5 才开工）→ 邀约落点不成立。
      let early = onNikki(2012, 6);
      assert(!sim.hasCareerReturnTarget(early, config), "2012 年鹰角没有在研目录作");
      const credsBefore = (early.career.credits || []).length;
      sim.applyScriptedCareerInvite(early, "returnStaff", config);
      assert(early.career.companyId === "paperGames", "没有落点就不换东家");
      assert(early.career.titleId === "nikkiWorld", "没有落点就继续做手上的作");
      assert((early.career.credits || []).length === credsBefore, "不给没开工的作发署名");
      // 2017.6：鹰角在研明日方舟了，落点成立，挂的是真在研的那部。
      const late = onNikki(2017, 6);
      assert(sim.hasCareerReturnTarget(late, config), "2017 年鹰角在研明日方舟");
      sim.applyScriptedCareerInvite(late, "returnStaff", config);
      assert(late.career.companyId === "hypergryph" && late.career.titleId === "arknights",
        "落点成立时挂到真在研的明日方舟");
      ok("return invite only lands on an in-dev catalog title");
    })();

    // ── 在研的目录作不被同公司别部（prestige 更高的 landmark）静默顶掉 ──────
    (function careerKeepsTheTitlePlayerIsOn() {
      const st2 = hired("programmer");
      st2.year = 2012;
      st2.month = 6;
      st2.career.companyId = "paperGames";
      st2.career.studioId = "paperGames-main";
      st2.career.titleId = "nikkiWorld";
      st2.career.liveStats = sim.careerLiveFromTitle(st2, sim.careerTitle("nikkiWorld", config, st2), config);
      assert(sim.pickCareerAssignment("paperGames", 2013, 3, config, st2, "paperGames-main").id === "miracleNikki",
        "2013.3 叠纸当月在研的 landmark 是奇迹暖暖");
      st2.year = 2013;
      st2.month = 3;
      sim.assignCareerProject(st2, config);
      assert(st2.career.titleId === "nikkiWorld", "奇迹暖暖开工不抢走在做暖暖环游世界的人");
      // 手上的作发售（2013.12）之后才换档。换到哪一部**不再写死**：preferFresh 会在
      // 「当月同在研的 landmark」里优先挑进度最浅的那部（2014.1 叠纸是恋与制作人 0.11，
      // 而不是已经做到 0.67 的奇迹暖暖）。规则本身见 tests/cases/case-16-dev-pacing.js。
      st2.year = 2014;
      st2.month = 1;
      sim.assignCareerProject(st2, config);
      const nxt = st2.career.titleId;
      const inDev = sim.titlesInDevAt("paperGames", 2014, 1, config, st2, "paperGames-main");
      assert(nxt && nxt !== "nikkiWorld", "手上的作发售之后才换下一档");
      assert(inDev.some(function (t) { return t.id === nxt; }), "换到的必须是当月真在研的目录作");
      ok("assignCareerProject keeps an in-dev catalog title");
    })();

    // ── offer / 邀约准入：企业挖人是为了让人做事情 ──────────────────────────
    // 只挑"当年月真有在研目录作"的东家。挂进当月空着的公司 → 过月判空窗 → 被塞虚拟作。
    (function offersAndInvitesRequireAnInDevTitle() {
      assert(sim.mobilityRequireInDevTitle(config, "offer") === true, "准入默认开：offer");
      assert(sim.mobilityRequireInDevTitle(config, "invite") === true, "准入默认开：invite");
      assert(sim.mobilityRequireInDevTitle(config, "scripted") === true, "准入默认开：scripted");
      function withRequireInDevTitle(spec) {
        return Object.assign({}, config, {
          careerWorld: Object.assign({}, world, {
            mobility: Object.assign({}, world.mobility, { requireInDevTitle: spec })
          })
        });
      }
      const allOff = withRequireInDevTitle(false);
      assert(sim.mobilityRequireInDevTitle(allOff, "offer") === false, "false = 全关");
      assert(sim.mobilityRequireInDevTitle(allOff, "scripted") === false, "false = 全关");
      const offerOff = withRequireInDevTitle({ offer: false });
      assert(sim.mobilityRequireInDevTitle(offerOff, "offer") === false, "分面关：offer");
      assert(sim.mobilityRequireInDevTitle(offerOff, "invite") === true, "分面关不影响其它面");

      // 公司当月"有没有活"：目录作才算，虚拟作不算（虚拟作本身就是空窗的产物）。
      const probe = hired("programmer");
      probe.career.companyId = "kojimaProductions";
      probe.career.studioId = "kojimaProductions-main";
      probe.year = 2015;
      probe.month = 9;
      assert(!sim.companyInDevCatalogTitle("kojimaProductions", probe, config, null),
        "2015.9 小岛组还没有在研目录作（死亡搁浅 2017.11 才开工）");
      probe.year = 2018;
      probe.month = 6;
      assert(sim.companyInDevCatalogTitle("kojimaProductions", probe, config, null).id === "deathStranding",
        "2018 小岛组在研死亡搁浅");
      const virtualOnly = sim.clone(probe);
      virtualOnly.career.companyId = "sega";
      virtualOnly.career.studioId = "sega-am2";
      // 找一个世嘉**确实空着**的月份。别写死 2016.6：P2-fix-a 补了《索尼克狂欢》
      //（2017.08 发售、工期 1.75 倍 → 2014.9 就开工）之后那个月已经有活了。
      let segaEmpty = null;
      for (let y = 1996; y <= 2024 && !segaEmpty; y++) {
        for (let m = 1; m <= 12 && !segaEmpty; m++) {
          virtualOnly.year = y;
          virtualOnly.month = m;
          if (!sim.companyInDevCatalogTitle("sega", virtualOnly, config, null)) segaEmpty = { y: y, m: m };
        }
      }
      assert(segaEmpty, "世嘉存在没有在研目录作的月份");
      virtualOnly.year = segaEmpty.y;
      virtualOnly.month = segaEmpty.m;
      assert(!sim.companyInDevCatalogTitle("sega", virtualOnly, config, null),
        "世嘉 " + segaEmpty.y + "." + segaEmpty.m + " 目录表里没有在研作");
      virtualOnly.career.virtualProjects = [{
        id: "virt-sega-1", companyId: "sega", studioId: "sega-am2", name: "自研作",
        releaseYear: 2017, releaseMonth: 6, landmark: false, prestige: 2, virtual: true
      }];
      virtualOnly.career.virtualDetails = [{
        id: "virt-sega-1", devStartYear: segaEmpty.y, devStartMonth: segaEmpty.m,
        devMonths: 18, virtual: true
      }];
      assert(sim.pickCareerAssignment("sega", segaEmpty.y, segaEmpty.m, config, virtualOnly, "sega-am2").virtual,
        "pickCareerAssignment 认得自家自研作");
      assert(!sim.companyInDevCatalogTitle("sega", virtualOnly, config, null),
        "虚拟作不算『有活干』");

      // 年底 offer：每一格都得说得出"你来做哪部"，且那部当月真在研。
      let named = 0;
      [["konami", 1998], ["sega", 1996], ["konami", 2004], ["sega", 2010],
        ["konami", 2016], ["sega", 2018], ["konami", 2024]].forEach(function (row) {
        const g = hired("programmer");
        g.year = row[1];
        g.month = 12;
        g.career.companyId = row[0];
        g.career.studioId = row[0] === "sega" ? "sega-am2" : "konami-main";
        g.career.fame = 60;
        sim.listYearEndOffers(g, config).forEach(function (o) {
          if (o.kind) return; // 内部晋升格不受准入约束
          named += 1;
          assert(!!o.titleId, "offer 必须带在研的目标作品 " + row[0] + " " + row[1]);
          const t = sim.careerTitle(o.titleId, config, g);
          const d = sim.careerTitleDetail(o.titleId, config, g);
          assert(!!(t && d && sim.titleCoversMonth(t, d, row[1], 12, config)),
            "offer 的目标作品当月必须在研 " + o.titleId +
            " company=" + o.companyId + " studio=" + o.studioId +
            " row=" + row[0] + "@" + row[1] +
            " t=" + (t ? t.releaseYear + "." + (t.releaseMonth || 1) : "null") +
            " d=" + JSON.stringify(d));
        });
      });
      assert(named >= 20, "多年 offer 不该空（有活的东家有的是），实得 " + named);

      // 挖人邀请：邀请挂的作当月必须在研，邀请方公司也必须在研。
      let invited = 0;
      for (let y = 1996; y <= 2024; y += 4) {
        const g = hired("programmer");
        g.year = y;
        g.month = 4;
        g.career.companyId = "konami";
        g.career.studioId = "konami-main";
        g.career.fame = 90;
        sim.listCareerInvites(g, config).forEach(function (inv) {
          invited += 1;
          const t = sim.careerTitle(inv.titleId, config, g);
          const d = sim.careerTitleDetail(inv.titleId, config, g);
          assert(!!(t && d && sim.titleCoversMonth(t, d, y, 4, config)),
            "挖人邀请的目标作品当月必须在研 " + inv.titleId);
          assert(!!sim.companyInDevCatalogTitle(inv.companyId, g, config, null),
            "邀请方当月必须有在研目录作 " + inv.companyId);
        });
      }
      assert(invited > 0, "多年挖人邀请不该空，实得 " + invited);

      // 真接一格 offer 走一遍：入职当场就该挂到 offer 上写的那部，而不是空窗。
      let landed = 0;
      [["konami", 2000], ["sega", 2008], ["konami", 2016], ["sega", 2018]].forEach(function (row) {
        const g = hired("programmer");
        g.year = row[1];
        g.month = 12;
        g.career.companyId = row[0];
        g.career.studioId = row[0] === "sega" ? "sega-am2" : "konami-main";
        g.career.fame = 60;
        const offers = sim.listYearEndOffers(g, config).filter(function (o) { return !o.kind; });
        assert(offers.length > 0, "有 offer 可接 " + row[0] + " " + row[1]);
        g.career.yearEndOffers = offers;
        const take = offers[0];
        take.successChance = 1;
        const res = sim.applyYearEndOffer(g, take.id, config);
        assert(res.ok && res.hopped, "接 offer 成功 " + row[0] + " " + row[1]);
        assert(res.state.career.titleId === take.titleId, "入职就挂到 offer 写的那部");
        assert(!sim.careerProjectView(res.state, config).idle, "接完 offer 不是空窗");
        landed += 1;
      });
      assert(landed === 4, "4 次入职都落到在研作上");

      // 剧情邀约的选项门禁（没有落点时不给选项）与效果兜底（给了也不动人）。
      const peerFinale = (((world.eventLines || {}).lines || []).filter(function (l) {
        return l.id === "bond-peer";
      })[0].beats || []).filter(function (b) { return b.id === "finale-path"; })[0];
      const optOf = function (id) {
        return (peerFinale.options || []).filter(function (o) { return o.id === id; })[0];
      };
      assert(optOf("hop").skipIf && optOf("hop").skipIf.noStrongHopTarget === true,
        "『跳去别家』要挂 noStrongHopTarget 门禁");
      assert(optOf("epic").skipIf && optOf("epic").skipIf.noPeerEpicTarget === true,
        "『搭史诗作』要挂 noPeerEpicTarget 门禁");
      assert(optOf("studio-move").skipIf && optOf("studio-move").skipIf.noOtherStudioInDev === true,
        "『调去另一个工作室』要挂 noOtherStudioInDev 门禁");

      const late = hired("programmer");
      late.year = 2025;
      late.month = 12;
      late.career.companyId = "konami";
      late.career.studioId = "konami-main";
      assert(!sim.hasPeerEpicTarget(late, config), "2025.12 没有别家在研的史诗作 → 不给这个选项");
      const soleWork = hired("programmer");
      soleWork.year = 2025;
      soleWork.month = 12;
      soleWork.career.companyId = "netease";
      assert(sim.hasStrongHopTarget(soleWork, config) === false,
        "2025.12 只剩自家在研 → 没有『别家』可跳");
      const noEpicCfg = Object.assign({}, config, {
        careerWorld: Object.assign({}, world, {
          eventLines: Object.assign({}, world.eventLines, {
            bonds: Object.assign({}, world.eventLines.bonds, {
              peerEpic: Object.assign({}, world.eventLines.bonds.peerEpic, { minPrestige: 99 })
            })
          })
        })
      });
      assert(!sim.hasPeerEpicTarget(hired("programmer"), noEpicCfg), "门槛抬到 99 就没有候选");
      const withRolls = hired("programmer");
      const rngBefore = withRolls.rngCount;
      sim.hasStrongHopTarget(withRolls, config);
      sim.hasPeerEpicTarget(withRolls, config);
      assert(withRolls.rngCount === rngBefore, "选项判定不能掷骰（否则每帧评估都会搅乱随机流）");

      // 前辈线「跟着走」：新东家没活就原地不动，有活才走。
      function atKonami(year) {
        const s = hired("programmer");
        s.year = year;
        s.month = 6;
        s.career.companyId = "konami";
        s.career.studioId = "konami-main";
        s.career.titleId = null;
        s.career.bonds = s.career.bonds || {};
        s.career.bonds.mentor = {
          seniorId: "kojima", name: "小岛秀夫", alias: "小岛秀夫", title: "制作人",
          companyId: "konami", homeCompanyId: "konami", colocated: true,
          departYear: 2015, successorCompanyId: "kojimaProductions"
        };
        return s;
      }
      const stuck = atKonami(2015);
      sim.applyScriptedCareerInvite(stuck, "mentorSuccessor", config);
      assert(stuck.career.companyId === "konami", "小岛组 2015 没活 → 跟着走不成立，原地不动");
      const moved = atKonami(2018);
      sim.applyScriptedCareerInvite(moved, "mentorSuccessor", config);
      assert(moved.career.companyId === "kojimaProductions", "新东家有活 → 跟着走成立");
      assert(moved.career.titleId === "deathStranding", "落点是真在研的死亡搁浅");
      ok("offers and invites only land on an in-dev catalog title");
    })();

    st = hired("programmer");
    st.career.jobRank = 1;
    st.career.promotionsThisYear = 0;
    const reqs = ((world.jobRanks.promotion || {}).requirements || [])[1] || {};
    const progRole = sim.careerRole(st.career.roleId, config);
    const progKey = (progRole && progRole.stat) || "program";
    st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
    st.career.stats = st.career.stats || {};
    st.career.stats[progKey] = (reqs.mainStat || 0) + 1;
    st.career.fame = (reqs.fameOrHonor || 0) + 1;
    st.career.credits = [{ titleId: "c0", shipped: true, virtual: false, jobRank: 1 }];
    const first = sim.promoteCareer(st, config);
    assert(first.ok && first.state.career.jobRank === 2, "click promo 1→2");
    st = first.state;
    assert(st.career.promotionsThisYear >= 1, "year cap used");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.state.career.jobRank === 2, "second story promo same year delayed");
    assert(step.state.career.pendingStoryPromos >= 1, "pending story promo queued");
    st = step.state;
    st.month = 1;
    st.year += 1;
    st.career.promotionsThisYear = 0;
    sim.applyPendingStoryPromos(st, config);
    assert(st.career.jobRank === 3, "delayed story promo settles in January");
    ok("year promo cap delays second story promo");
  })();

};
