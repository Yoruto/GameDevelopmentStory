// 测试用例组：14-resume（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerJobRankResumeAndPromotion() {
    const world = config.careerWorld;
    const ranks = world.jobRanks || {};
    const nintendo = sim.careerCompany("nintendo", config);
    let g = sim.createCareerGame("测", "design", config);
    assert(g.career.jobRank === 1, "design starts Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "策划实习生", "design intern title");
    assert(sim.formatCareerRankLabel("design", 1, config) === "策划实习生 (D-0)", "design intern code");
    g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    assert(g.career.growthStage === "employee", "still employee after hire");
    assert((g.career.tenures || []).length === 1, "opening tenure written");
    assert(g.career.tenures[0].source === "opening", "tenure source opening");
    assert(g.career.tenures[0].jobRank === 1, "tenure rank 1");
    assert(!sim.canPromoteCareer(g, config), "fresh hire cannot promote yet");

    const base = Number((world.player && world.player.monthlyContribution) != null ? world.player.monthlyContribution : 2);
    const low = sim.createCareerGame("测", "programmer", config);
    const high = sim.clone(low);
    high.career.jobRank = 6;
    high.career.stats = { program: 90, design: 17, art: 17, music: 17 };
    const c1 = sim.careerMonthlyContribution(low, config);
    const c6 = sim.careerMonthlyContribution(high, config);
    assert(c1 < c6, "higher rank+stat contrib " + c1 + " -> " + c6);
    assert(c1 < base, "Lv.1 contrib below old 2, got " + c1);
    assert(c6 > base, "Lv.6 high-stat contrib above 2, got " + c6);

    // P2a：薪资阶梯（jobRanks.salaryFloor / careerSalaryFor）已随货币体系整体移除

    const wLow = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, low);
    const wHigh = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, high);
    assert(wHigh > wLow, "higher rank weighs player more in score " + wLow + " -> " + wHigh);

    const attrLow = sim.clone(low);
    const attrHigh = sim.clone(low);
    attrLow.career.jobRank = 4;
    attrHigh.career.jobRank = 4;
    attrLow.career.stats = { program: 30, design: 17, art: 17, music: 17 };
    attrHigh.career.stats = { program: 80, design: 17, art: 17, music: 17 };
    const aLow = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, attrLow);
    const aHigh = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, attrHigh);
    assert(aHigh > aLow, "higher mainStat weighs player more at same rank " + aLow + " -> " + aHigh);

    const chanceLow = sim.careerHireChance(nintendo, low, config);
    const chanceHigh = sim.careerHireChance(nintendo, high, config);
    assert(chanceHigh > chanceLow, "high rank hireChance higher");
    assert(chanceLow === 0, "nintendo power3 minRank blocks Lv.1, got " + chanceLow);

    function makePromotable(st, rank) {
      const reqs = ((ranks.promotion || {}).requirements || [])[rank] || {};
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
      let n = 0;
      const need = reqs.creditedTitles || 0;
      while (n < need) {
        n += 1;
        st.career.credits.push({
          titleId: "cred-" + n,
          companyId: st.career.companyId,
          roleId: st.career.roleId,
          jobRank: rank,
          shipped: true,
          virtual: false
        });
      }
      return st;
    }

    let st = sim.clone(g);
    st = makePromotable(st, 1);
    assert(sim.canPromoteCareer(st, config), "eligible after meeting gates");
    const lowStat = sim.clone(st);
    const designKey = (sim.careerRole(lowStat.career.roleId, config) || {}).stat || "design";
    lowStat.career.stats[designKey] = 20;
    assert(!sim.canPromoteCareer(lowStat, config), "low mainStat blocks even with jobXp");
    const blocked = sim.promoteCareer(lowStat, config);
    assert(!blocked.ok && blocked.error === sim.ERR.CAREER_PROMOTE_LOCKED, "click promo blocked by mainStat");
    sim.applyCareerPromotion(lowStat, config, { story: true });
    assert(lowStat.career.jobRank === 2, "story promo skips mainStat gate");
    const before = st.career.jobRank;
    const silent = sim.clone(st);
    const ticked = sim.tickMonth(silent, config).state;
    assert(ticked.career.jobRank === before, "tick does not auto promote");
    const promo = sim.promoteCareer(st, config);
    assert(promo.ok, "promote ok");
    assert(promo.state.career.jobRank === 2, "clicked up to Lv.2");
    assert(promo.state.career.growthStage === "employee", "promotion does not change growthStage");
    assert(sim.careerJobTitleLabel(promo.state, config) === "初级策划", "design junior title");
    assert(sim.formatCareerRankLabel("design", 2, config) === "初级策划 (D-1)", "design junior code");
    assert((promo.state.career.tenures || []).filter(function (t) { return t.source === "promotion"; }).length === 1, "promotion tenure");
    assert(!sim.canPromoteCareer(promo.state, config), "one promo per year");
    const again = sim.promoteCareer(promo.state, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_PROMOTE_LOCKED, "second promo blocked");

    let hop = sim.clone(promo.state);
    hop.career.yearEndOffers = [{
      id: "ye-rank-hop",
      companyId: "square",
      studioId: ((sim.careerCompany("square", config).studios || [])[0] || {}).id,
      roleId: "design",
      jobRank: hop.career.jobRank,
      salary: 8000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hop, "ye-rank-hop", config);
    assert(hopped.ok && hopped.hopped, "hop ok");
    assert(hopped.state.career.jobRank === 2, "hop keeps rank");
    assert(hopped.state.career.growthStage === "employee", "hop still employee");

    let top = sim.clone(g);
    top.career.jobRank = 6;
    top.career.jobTitleId = "des-director";
    top.career.monthsInRank = 99;
    top.career.jobXp = 999;
    top.career.fame = 99;
    top.career.credits = [{ titleId: "x", shipped: true, virtual: false }];
    top.career.promotionsThisYear = 0;
    assert(!sim.canPromoteCareer(top, config), "Lv.6 cannot promote");
    const fake = sim.promoteCareer(top, config);
    assert(!fake.ok, "Lv.6 promote fails");
    assert(top.career.growthStage === "employee", "Lv.6 still employee");

    const resume = sim.careerResumeView(promo.state, config);
    assert(resume.tenures.length >= 1, "resume tenures");
    const settle = sim.careerSettlementView(hopped.state, config);
    assert(settle.jobLabel, "settlement job label");
    assert(settle.growthStage === "employee", "settlement employee");
    assert(settle.creditedCount >= 0, "settlement credited count");

    const shipSt = sim.clone(g);
    shipSt.career.titleId = "chronoTrigger";
    shipSt.career.companyId = "square";
    shipSt.career.liveStats = { program: 90, design: 90, art: 80, music: 80 };
    shipSt.career.credits = [];
    sim.shipPlayerTitle(shipSt, config, [], []);
    const shipped = (shipSt.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(shipped && shipped.shipped, "ship writes signed credit");
    assert(shipped.score != null, "ship writes score on credit");
    assert(shipSt.career.stats.design > g.career.stats.design, "main stat grows on ship");

    const evLow = { id: "fatalBug", minRank: undefined, maxRank: 3, qualityDelta: -6 };
    const evHigh = { id: "engineBreakthrough", minRank: 4, qualityDelta: 8 };
    const fatal = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "fatalBug"; })[0];
    const engine = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "engineBreakthrough"; })[0];
    assert(fatal && fatal.maxRank === 3, "junior negative event maxRank");
    assert(engine && engine.minRank === 4, "senior event minRank");
    void evLow; void evHigh;

    ok("job rank, click promotion, resume, hop keeps rank, one promo/year, Lv.6 employee");
  })();

  (function careerResumeSalesAndFirstTgaStory() {
    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.worldReleased = [{
      id: "chronoTrigger", name: "时空之轮", alias: "时空之轮", companyId: st.career.companyId,
      releaseYear: 1995, releaseMonth: 12, releasedYear: 1995, releasedMonth: 12,
      score: 8.8, avg: 8.8, stats: { play: 80, fun: 80, expression: 80, immersion: 80 },
      launchSales: 1200000, lifetimeSales: 1200000
    }];
    st.career.credits = [
      { titleId: "chronoTrigger", companyId: st.career.companyId, studioId: st.career.studioId,
        roleId: "programmer", jobRank: 2, joinYear: 1995, joinMonth: 6, shipped: true, score: 8.8 },
      { titleId: "ghostTitle", companyId: st.career.companyId, studioId: st.career.studioId,
        roleId: "programmer", jobRank: 2, joinYear: 1995, joinMonth: 6, shipped: true, score: 7 }
    ];
    const creditOf = function (state, id) {
      return sim.careerResumeView(state, config).credits.filter(function (c) { return c.titleId === id; })[0];
    };
    assert(creditOf(st, "chronoTrigger").sales === 1200000, "resume carries the title's total sales");
    assert(creditOf(st, "ghostTitle").sales === null, "a credit with no release record shows no sales");
    // 目录作 / 后期加入的作品只盖 launchSales，也要读得到
    st.worldReleased.push({ id: "ghostTitle", name: "未记总销量", launchSales: 345000,
      releasedYear: 1995, releasedMonth: 12 });
    assert(creditOf(st, "ghostTitle").sales === 345000,
      "launchSales is the fallback when lifetimeSales is absent, got " + creditOf(st, "ghostTitle").sales);

    function freshState() {
      const gg = sim.createCareerGame("测", "programmer", config);
      return sim.acceptOpeningOffer(gg, gg.career.openingOffers[0].id, config).state;
    }
    const nomOnly = [{ id: "bestVisual", n: "最佳视觉", year: 1997, w: "别的作", playerWon: false,
      playerNominated: true,
      nominees: [{ label: "我的作", player: true }, { label: "别的作", player: false }] }];
    const gotyOnly = function (year) {
      return [{ id: "goty", n: "年度游戏", year: year, w: "我的作", playerWon: true, playerNominated: true,
        nominees: [{ label: "我的作", player: true }] }];
    };

    const s1 = freshState();
    const snap = JSON.stringify({ fame: s1.career.fame, honor: s1.career.honor,
      stats: s1.career.stats, savings: s1.career.savings });
    let pages = sim.collectCareerAwardStory(s1, config, nomOnly);
    assert(pages.length === 1 && pages[0].type === "story", "first nomination queues one story page");
    assert(pages[0].body.indexOf("我的作") >= 0 && pages[0].body.indexOf("最佳视觉") >= 0,
      "nomination story names the title and the award");
    assert(pages[0].body.length <= 100, "nomination story under 100 chars, got " + pages[0].body.length);
    assert(JSON.stringify({ fame: s1.career.fame, honor: s1.career.honor,
      stats: s1.career.stats, savings: s1.career.savings }) === snap, "story changes no stat");
    assert(sim.collectCareerAwardStory(s1, config, nomOnly).length === 0, "nomination story fires only once");

    // 同一届既有提名又拿了年度游戏 → 只出大奖那一条，提名剧情不再补播
    const s2 = freshState();
    const both = nomOnly.concat(gotyOnly(1997));
    pages = sim.collectCareerAwardStory(s2, config, both);
    assert(pages.length === 1 && pages[0].body.indexOf("年度游戏") >= 0,
      "same year keeps only the grand award story");
    assert(pages[0].body.length <= 100, "grand award story under 100 chars, got " + pages[0].body.length);
    assert(s2.career.awardStory && s2.career.awardStory.goty && s2.career.awardStory.nominated,
      "grand award marks both flags");
    assert(sim.collectCareerAwardStory(s2, config, both).length === 0, "grand award story fires only once");
    assert(sim.collectCareerAwardStory(freshState(), config, []).length === 0, "no awards, no story");
    // 世界作品得奖与玩家无关时不触发
    assert(sim.collectCareerAwardStory(freshState(), config, [{ id: "goty", n: "年度游戏", w: "别的作",
      playerWon: false, playerNominated: false, nominees: [{ label: "别的作", player: false }] }]).length === 0,
      "awards the player is not part of queue nothing");

    // 先提名、后获奖：两条各触发一次
    const s3 = freshState();
    assert(sim.collectCareerAwardStory(s3, config, nomOnly).length === 1, "earlier nomination fires once");
    assert(sim.collectCareerAwardStory(s3, config, gotyOnly(1999)).length === 1,
      "later grand award fires after an earlier nomination");
    assert(sim.collectCareerAwardStory(s3, config, gotyOnly(1999)).length === 0, "grand award fires only once");
    ok("resume shows total sales; first TGA nomination and first grand award each tell a story once");
  })();

};
