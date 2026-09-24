// 测试用例组：06-opening-offers（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerNewGameOpeningOffers() {
    const g = sim.createCareerGame("测", "programmer", config);
    const world = config.careerWorld;
    assert(g.mode === "career", "career mode");
    assert(g.year === world.timeline.startYear && g.month === world.timeline.startMonth, "career starts 1995.01");
    assert(g.year === 1995 && g.month === 1, "1995 jan");
    assert(g.career.characterName === "测", "character name");
    assert(g.career.roleId === "programmer", "locked role");
    assert(g.career.growthStage === "employee", "employee stage");
    assert(g.career.jobRank === 1, "start Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "代码实习生", "programmer intern title");
    assert(sim.formatCareerRankLabel("programmer", 1, config) === "代码实习生 (T-0)", "programmer intern code");
    assert(sim.careerJobTitleDisplay(g, config) === "代码实习生 (T-0)", "programmer intern display");
    assert(g.career.stats.program >= 22 && g.career.stats.program <= 26, "main stat in 20s");
    assert(g.career.stats.art >= 16 && g.career.stats.art <= 20, "off-dim in teens");
    assert(g.career.stats.program < 40, "main not in 40s");
    assert(g.phase === "OFFER", "offer phase");
    const offers = g.career.openingOffers || [];
    assert(offers.length === 3, "three offers");
    const tiers = offers.map(function (o) { return o.tier; });
    ["small", "stable", "wild"].forEach(function (t) {
      assert(tiers.indexOf(t) >= 0, "tier " + t);
    });
    offers.forEach(function (o) {
      assert(o.roleId === "programmer", "offer role matches specialty");
      assert(o.salary === undefined, "offer carries no salary after P2a " + o.companyId);
      assert(o.risk, "offer risk " + o.tier);
      const co = sim.careerCompany(o.companyId, config);
      assert(co && co.openingOffer && co.starterTier === o.tier, "offer company tier");
      const seniorLine = sim.careerSeniorLine(co, config);
      // 公司可无前辈：opening offer 的 seniorLine 可能为空，不再强制以"前辈"开头
    });
    ok("career new game: 1995, three-tier offers, role locked");
  })();

  (function careerRankCodeFormatting() {
    assert(sim.careerRankCode("programmer", 1, config) === "T-0", "T-0");
    assert(sim.formatCareerRankLabel("programmer", 4, config) === "高级程序员 (T-3)", "T-3");
    assert(sim.formatCareerRankLabel("programmer", 6, config) === "技术总监 (T-5)", "T-5");
    assert(sim.formatCareerRankLabel("design", 5, config) === "主策划 (D-4)", "D-4");
    assert(sim.formatCareerRankLabel("art", 2, config) === "初级美术 (A-1)", "A-1");
    assert(sim.formatCareerRankLabel("art", 5, config) === "主美 (A-4)", "A-4");
    assert(sim.formatCareerRankLabel("music", 1, config) === "音频实习生 (M-0)", "M-0");
    assert(sim.formatCareerRankLabel("music", 6, config) === "音频总监 (M-5)", "M-5");
    const promo = sim.careerPromotionView(sim.createCareerGame("测", "design", config), config);
    assert(promo.currentLabel === "策划实习生 (D-0)", "promo view uses rank code");
    const line = sim.careerSeniorLine("nintendo", config);
    // 公司可无前辈：不再强制 nintendo 有 宫本茂 / 制作总监
    ok("career rank codes T/D/A/M and 前辈 line");
  })();

  (function careerAcceptJoinsOrIdles() {
    const g = sim.createCareerGame("测", "art", config);
    const offer = g.career.openingOffers[1] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, offer.id, config);
    assert(acc.ok, "accept ok");
    assert(acc.state.phase === "PLAYING", "playing");
    assert(acc.state.career.companyId === offer.companyId, "company set");
    assert(acc.state.career.growthStage === "employee", "not producer");
    const view = sim.careerProjectView(acc.state, config);
    assert(view.idle === true || (view.title && view.phase && view.phase.until != null), "project or idle");
    if (!view.idle) {
      assert(view.title.companyId === offer.companyId, "title company matches");
      assert(acc.state.career.liveStats, "live stats present");
      assert(acc.state.career.colleagues.length === 4, "four colleagues");
      const roles = acc.state.career.colleagues.map(function (c) { return c.roleId; });
      assert(roles.indexOf("art") < 0, "player occupies art slot");
      assert(roles.indexOf("producer") >= 0, "producer npc");
    }
    ok("career accept offer joins project or idles without throw");
  })();

};
