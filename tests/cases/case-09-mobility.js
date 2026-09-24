// 测试用例组：09-mobility（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerXpAndMediaAndHop() {
    const g = sim.createCareerGame("测", "programmer", config);
    const squareXp = sim.companyXpValue(g, "square", "genre", "fantasy");
    assert(squareXp > 0, "1995 companies have seeded genre xp");
    const offer = g.career.openingOffers[0];
    let acc = sim.acceptOpeningOffer(g, offer.id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const beforeXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.lastMedia && st.lastMedia.media && st.lastMedia.media.rows.length === 4, "4 media outlets");
    st.lastMedia.media.rows.forEach(function (row) {
      assert(row.quote && typeof row.score === "number", "outlet quote+score " + row.id);
    });
    assert(queue.some(function (q) { return q.type === "media"; }), "player ship queues media");
    assert(typeof st.lastMedia.launchSales === "number", "career media rec has launchSales");
    assert(st.lastMedia.launchSales > 0, "career launchSales > 0");
    (function assertCareerLaunchMatchesFormula() {
      const packed = sim.careerLaunchSales(
        sim.careerTitle("chronoTrigger", config, st),
        st.lastMedia.score,
        config,
        st.lastMedia.liveStats || st.lastMedia.stats
      );
      const y1 = sim.salesFactor(1, st.lastMedia.score, config);
      assert(st.lastMedia.baselineSales === packed.baselineSales, "career baseline from public score coeffs");
      assert(st.lastMedia.launchSales === packed.launchSales, "career launchSales stamped on rec");
      assert(st.lastMedia.launchSales === sim.boxedActualFromY({ baselineSales: packed.baselineSales }, y1), "career launch is baseline×Y(1)");
      const mediaPage = queue.filter(function (q) { return q.type === "media"; })[0];
      assert(mediaPage && mediaPage.rec && mediaPage.rec.launchSales === packed.launchSales, "queued media rec carries launchSales");
    })();
    const afterXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    assert(afterXp > beforeXp, "player ship raises company xp");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    high.companyXp.square = { genreXp: { scifi: 80 }, gameplayXp: { rpg: 80 } };
    const t = sim.careerTitle("ff7", config);
    const liveLow = (function () {
      high.career.companyId = "square";
      return null;
    })();
    void liveLow;
    const bonusSpec = config.careerWorld.companyXp;
    const lowBonus = Math.floor(sim.companyXpValue(low, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(low, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    const highBonus = Math.floor(sim.companyXpValue(high, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(high, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    assert(highBonus > lowBonus, "higher xp gives higher stat bonus");

    let hopSt = sim.createCareerGame("测", "music", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.year = 1995;
    hopSt.month = 12;
    hopSt.career.titleId = null;
    hopSt.career.liveStats = null;
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const offers = hopSt.career.yearEndOffers;
    assert(offers.length >= 1, "year-end offers in december");
    offers.forEach(function (o) {
      const co = sim.careerCompany(o.companyId, config);
      assert(sim.companyJoinable(co, hopSt.year), "offer company joinable");
      if (o.kind === "promotion" || o.kind === "promotionLine") {
        assert(o.roleId === "music", "promo keeps specialty");
      } else {
        assert(["programmer", "art", "design", "music"].indexOf(o.roleId) >= 0, "hop staff role " + o.roleId);
        assert(o.roleId !== "producer", "producer hop locked before line done");
      }
      assert(o.salary === undefined && o.currentSalary === undefined,
        "hop offer carries no salary after P2a " + o.companyId);
    });
    offers[0].successChance = 1;
    const take = sim.acceptYearEndOffer(hopSt, offers[0].id, config);
    assert(take.ok, "accept hop");
    assert(take.state.career.companyId === offers[0].companyId, "company switched");

    hopSt.career.fame = 80;
    hopSt.year = 1995;
    hopSt.month = 2;
    const inv = sim.listCareerInvites(hopSt, config);
    assert(Array.isArray(inv), "invites list");
    if (inv.length) {
      hopSt.career.invites = inv;
      const accInv = sim.acceptCareerInvite(hopSt, inv[0].id, config);
      assert(accInv.ok, "accept invite");
      assert(accInv.state.career.companyId === inv[0].companyId, "invite switches company");
    } else {
      const tweaked = deepClone(config);
      const chrono = (tweaked.careerWorld.titleDetails || []).filter(function (d) { return d.id === "chronoTrigger"; })[0];
      assert(chrono && chrono.inviteEligible, "chrono invite eligible");
      hopSt.career.fame = chrono.inviteMinFame;
      hopSt.career.companyId = "nintendo";
      hopSt.year = chrono.inviteWindow.startYear;
      hopSt.month = chrono.inviteWindow.startMonth;
      const inv2 = sim.listCareerInvites(hopSt, tweaked);
      assert(inv2.length >= 1, "invite appears when fame and window match");
      hopSt.career.invites = inv2;
      const accInv = sim.acceptCareerInvite(hopSt, inv2[0].id, tweaked);
      assert(accInv.ok && accInv.state.career.companyId === "square", "chrono invite to square");
    }
    ok("xp, 5-outlet media, year-end hop, invites");
  })();

  (function careerLateJoinUnsignedAndDecemberShipHop() {
    const lateSpec = config.careerWorld.lateJoin || {};
    const nintendo = sim.careerCompany("nintendo", config);
    const freshCfg = deepClone(config);
    freshCfg.careerWorld = deepClone(config.careerWorld);
    // 清掉 fromsoftware 真实目录：探针 freshProbe 必须是当月唯一在研目录作，
    // 否则《国王密令II》（同样覆盖 1995.01）会按 prestige 排到它前面。
    withoutCatalog(freshCfg, "fromsoftware");
    freshCfg.careerWorld.titles = (freshCfg.careerWorld.titles || []).concat([{
      id: "freshProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "刚开工",
      alias: "刚开工",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    freshCfg.careerWorld.titleDetails = (freshCfg.careerWorld.titleDetails || []).concat([{
      id: "freshProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1995, startMonth: 1, endYear: 1995, endMonth: 11 }
    }]);
    let earlySt = sim.createCareerGame("测", "programmer", freshCfg);
    earlySt = sim.acceptOpeningOffer(earlySt, earlySt.career.openingOffers[0].id, freshCfg).state;
    earlySt.career.companyId = "fromsoftware";
    earlySt.career.studioId = "fromsoftware-main";
    earlySt.year = 1995;
    earlySt.month = 1;
    earlySt.career.titleId = null;
    sim.assignCareerProject(earlySt, freshCfg);
    assert(earlySt.career.titleId === "freshProbe", "just-started catalog assigned");
    const freshCred = (earlySt.career.credits || []).filter(function (c) { return c.titleId === "freshProbe"; })[0];
    assert(freshCred && freshCred.signedEligible !== false, "fresh join can sign");
    assert(!sim.careerTitleIsLate(
      sim.careerTitle("freshProbe", freshCfg),
      sim.careerTitleDetail("freshProbe", freshCfg),
      1995, 1, freshCfg
    ), "progress 0 is not late");

    const lateTitle = {
      id: "lateProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "后期探针",
      alias: "后期探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 8,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 80, fun: 80, expression: 80, immersion: 80 }
    };
    const lateDet = {
      id: "lateProbe",
      devStartYear: 1994,
      devStartMonth: 1,
      devMonths: 23,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1994, startMonth: 3, endYear: 1995, endMonth: 11 },
      inviteRoles: ["programmer", "art", "design", "music"]
    };
    const lateCfg = deepClone(config);
    lateCfg.careerWorld = deepClone(config.careerWorld);
    // 同上：清掉 fromsoftware 真实目录，否则《国王密令II》会把 lateProbe 挤出 1995.06。
    withoutCatalog(lateCfg, "fromsoftware");
    lateCfg.careerWorld.titles = (lateCfg.careerWorld.titles || []).concat([lateTitle]);
    lateCfg.careerWorld.titleDetails = (lateCfg.careerWorld.titleDetails || []).concat([lateDet]);
    assert(sim.careerTitleIsLate(lateTitle, lateDet, 1995, 6, lateCfg), "mid 1995 is late");
    let invSt = sim.createCareerGame("测", "art", lateCfg);
    invSt = sim.acceptOpeningOffer(invSt, invSt.career.openingOffers[0].id, lateCfg).state;
    invSt.career.companyId = "nintendo";
    invSt.career.studioId = nintendo.studios[0].id;
    invSt.career.fame = 99;
    invSt.year = 1995;
    invSt.month = 6;
    const invites = sim.listCareerInvites(invSt, lateCfg);
    assert(!invites.some(function (x) { return x.titleId === "lateProbe"; }), "late not invited");

    invSt.career.companyId = "fromsoftware";
    invSt.career.studioId = "fromsoftware-main";
    invSt.career.titleId = null;
    invSt.career.credits = [];
    sim.assignCareerProject(invSt, lateCfg);
    assert(invSt.career.titleId === "lateProbe", "can still be assigned late catalog");
    const lateCred = (invSt.career.credits || []).filter(function (c) { return c.titleId === "lateProbe"; })[0];
    assert(lateCred && lateCred.signedEligible === false, "late join not sign-eligible");
    invSt.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    invSt.year = 1995;
    invSt.month = 12;
    sim.shipPlayerTitle(invSt, lateCfg, [], []);
    assert(!lateCred.shipped, "late join unsigned at ship");

    lateCfg.careerWorld.companies.forEach(function (c) {
      if (c.id !== "nintendo" && c.id !== "fromsoftware") c.joinable = false;
    });
    let hopSt = sim.createCareerGame("测", "programmer", lateCfg);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, lateCfg).state;
    hopSt.year = 1995;
    hopSt.month = 6;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    const fromCo = sim.careerCompany("fromsoftware", lateCfg);
    const fromStudio = sim.careerStudio("fromsoftware", "fromsoftware-main", lateCfg);
    const assigned = sim.pickCareerAssignment("fromsoftware", 1995, 6, lateCfg, hopSt, "fromsoftware-main");
    assert(assigned && assigned.id === "lateProbe", "fromsoftware assignment is late probe");
    const titledChance = sim.careerHireChance(fromCo, hopSt, lateCfg, fromStudio, assigned);
    const lateOffer = sim.listYearEndOffers(hopSt, lateCfg).filter(function (o) {
      return o.companyId === "fromsoftware" && o.titleId === "lateProbe";
    })[0];
    assert(lateOffer, "fromsoftware late offer present");
    assert(lateOffer.successChance < titledChance, "late hop chance lower");
    assert(Math.abs(lateOffer.successChance - titledChance * lateSpec.hopHireChanceMul) < 1e-6, "uses hopHireChanceMul");

    let shipHop = sim.clone(earlySt);
    shipHop.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    shipHop.year = 1995;
    shipHop.month = 12;
    const decTick = sim.tickCareerMonth(shipHop, freshCfg);
    assert((decTick.queue || []).some(function (p) { return p.type === "hop"; }), "December ship queues hop");
    assert(!sim.careerPostLaunch(decTick.state), "December ship has no postLaunch occupancy");
    ok("late join unsigned, invite skipped, December ship hop");
  })();

  // 进大厂的门槛：公司体量倍率（hireChancePowerMul）、声望斜率、以及邀约「每年只掷一次骰」。
  // 旧实现里邀约是每月独立掷一次，12 次叠加后年内命中率 ≈ 99.8%，而邀约必成 → 进大厂零门槛。
  (function bigPublishersDampedAndInvitesRollYearly() {
    const spec = config.careerWorld.mobility;
    const mul = spec.hireChancePowerMul;
    assert(mul && mul["3"] > 0 && mul["3"] < 1, "hireChancePowerMul[3] is a damping factor");
    assert(mul["1"] === 1 && mul["2"] === 1, "small/mid publishers undamped");
    assert(spec.fameHirePer <= 0.002, "fame hiring bonus is small");
    assert(spec.inviteChance > 0 && spec.inviteChance < 0.5, "inviteChance is a yearly chance");

    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[1].id, config).state;
    const role = sim.careerRole(st.career.roleId, config);
    st.career.fame = 40;
    st.career.stats[role.stat] = 75;
    st.career.jobRank = 5;
    st.career.genreXp = {};
    st.career.gameplayXp = {};

    const bigCo = config.careerWorld.companies.filter(function (c) { return c.power === 3; })[0];
    const midCo = config.careerWorld.companies.filter(function (c) { return c.power === 2; })[0];
    const saved3 = mul["3"];
    let undamped, damped;
    try {
      mul["3"] = 1;
      undamped = sim.careerHireChance(bigCo, st, config, null, null);
    } finally {
      mul["3"] = saved3;
    }
    damped = sim.careerHireChance(bigCo, st, config, null, null);
    assert(damped < undamped, "big publisher chance damped, " + undamped.toFixed(3) + " -> " + damped.toFixed(3));
    assert(Math.abs(damped / undamped - saved3) < 0.02, "damping ratio = hireChancePowerMul, got " + (damped / undamped).toFixed(3));
    assert(damped < sim.careerHireChance(midCo, st, config, null, null), "a big publisher stays harder than a mid one");

    // 声望仍线性，但斜率是砍半后的 fameHirePer。
    // 注意取 0→30 这段：中厂在 fame≈30 以上就会顶到 hireChanceMax，夹取会让差值失真。
    const st2 = sim.clone(st);
    st2.career.fame = 0;
    const fame0 = sim.careerHireChance(midCo, st2, config, null, null);
    st2.career.fame = 30;
    const fame30 = sim.careerHireChance(midCo, st2, config, null, null);
    assert(fame0 < config.careerWorld.mobility.hireChanceMax, "probe point stays below the clamp");
    assert(Math.abs((fame30 - fame0) - 30 * spec.fameHirePer) < 0.005, "fame stays linear at fameHirePer");

    // 造一部别的公司、当年在开发、窗口内的目录作，作为邀约候选
    const invCfg = deepClone(config);
    invCfg.careerWorld = deepClone(config.careerWorld);
    invCfg.careerWorld.titles = (invCfg.careerWorld.titles || []).concat([{
      id: "invProbe", companyId: "fromsoftware", studioId: "fromsoftware-main",
      name: "邀约探针", alias: "邀约探针", releaseYear: 2000, releaseMonth: 12,
      score: 8, platforms: ["pc"], genreId: "fantasy", gameplayId: "rpg",
      releaseType: "boxed", stats: { play: 80, fun: 80, expression: 80, immersion: 80 }
    }]);
    invCfg.careerWorld.titleDetails = (invCfg.careerWorld.titleDetails || []).concat([{
      id: "invProbe", devStartYear: 1999, devStartMonth: 1, devMonths: 23,
      inviteEligible: true, inviteMinFame: 0,
      inviteWindow: { startYear: 1999, startMonth: 1, endYear: 2000, endMonth: 11 }
    }]);
    let ist = sim.createCareerGame("测", "programmer", invCfg);
    ist = sim.acceptOpeningOffer(ist, ist.career.openingOffers[0].id, invCfg).state;
    ist.career.companyId = "nintendo";
    ist.career.studioId = sim.defaultStudioId(sim.careerCompany("nintendo", invCfg));
    ist.career.titleId = null;
    ist.career.invites = [];
    ist.career.fame = 50;
    ist.year = 1999;
    ist.month = 3;
    assert(sim.listCareerInvites(ist, invCfg).some(function (x) { return x.titleId === "invProbe"; }),
      "invite candidate is available inside the window");

    // 未命中的年份：整年都不给，而且年度骰不会在年内被重掷
    let miss = sim.clone(ist);
    miss.career.inviteYearStamp = 1999;
    miss.career.invitesRolledThisYear = 0;
    miss.career.inviteYearHit = false;
    const hitVals = {};
    for (let i = 0; i < 9; i++) {
      miss = sim.tickMonth(miss, invCfg).state;
      hitVals[String(miss.career.inviteYearHit)] = true;
      assert((miss.career.invites || []).length === 0, "a missed year yields no invite");
    }
    assert(Object.keys(hitVals).length === 1 && hitVals["false"] === true,
      "the yearly roll is not re-rolled inside the same year");

    // 命中的年份：给出邀约，且一年最多一条
    let hit = sim.clone(ist);
    hit.career.inviteYearStamp = 1999;
    hit.career.invitesRolledThisYear = 0;
    hit.career.inviteYearHit = true;
    let gotInv = null;
    for (let i = 0; i < 9 && !gotInv; i++) {
      hit = sim.tickMonth(hit, invCfg).state;
      if ((hit.career.invites || []).length) gotInv = hit.career.invites[0];
    }
    assert(gotInv, "a hit year delivers an invite");
    assert(gotInv.companyId && gotInv.companyId !== "nintendo", "invite comes from another publisher");
    assert(gotInv.titleId && gotInv.jobRank >= 1, "invite carries a title and a rank");
    for (let i = 0; i < 3; i++) hit = sim.tickMonth(hit, invCfg).state;
    assert((hit.career.invites || []).length <= 1, "at most inviteMaxPerYear invite per year");

    ok("big publisher hiring damped, invites roll once per year");
  })();

  // 开局 offer 压低大厂 + 通过率 0 的公司不进跳槽选项。
  (function openingShunsBigPublishersAndDropsZeroChanceOffers() {
    const oo = config.careerWorld.openingOffer;
    const wp = oo.weightByPower;
    assert(wp["3"] > 0 && wp["3"] <= 0.25, "opening weight for power3 is damped, got " + wp["3"]);
    assert(wp["3"] < wp["2"] && wp["2"] < wp["1"], "small shops weigh more than studios, then big publishers");

    // 确定性对拍：权重 0 → 大厂绝不进开局池；权重拉到极大 → 必然进（证明这个权重真被读）
    const bigIds = {};
    config.careerWorld.companies.forEach(function (c) { if (c.power === 3) bigIds[c.id] = true; });
    const g = sim.createCareerGame("测", "programmer", config);
    function countOpeningBig(tries) {
      let n = 0;
      for (let i = 0; i < tries; i++) {
        const probe = sim.clone(g);
        probe.rngSeed = 700001 + i * 104729;
        sim.rollOpeningOffers(probe, probe.career.roleId, config).forEach(function (o) {
          if (bigIds[o.companyId]) n += 1;
        });
      }
      return n;
    }
    const saved3 = wp["3"];
    let off, on;
    try {
      wp["3"] = 0;
      off = countOpeningBig(300);
      wp["3"] = 999;
      on = countOpeningBig(300);
    } finally {
      wp["3"] = saved3;
    }
    assert(off === 0, "weight 0 keeps big publishers out of opening offers, got " + off);
    assert(on > 0, "a huge weight does let one through, got " + on);

    // 通过率 0 的 offer 不该占位：前期职级不够大厂（offerMinRankByPower[3] 硬门槛）
    const minRankByPower = config.careerWorld.jobRanks.offerMinRankByPower;
    assert(minRankByPower["3"] > 1, "big publishers carry a rank gate");
    const st = sim.acceptOpeningOffer(sim.clone(g), g.career.openingOffers[0].id, config).state;
    st.year = 1996;
    st.month = 12;
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.jobRank = 1;
    assert(sim.careerHireChance(config.careerWorld.companies.filter(function (c) {
      return c.power === 3;
    })[0], st, config, null, null) === 0, "a gated big publisher really does sit at 0% early");
    const early = sim.listYearEndOffers(st, config);
    assert(early.length >= 1, "early hop table is not empty");
    early.forEach(function (o) {
      const pct = o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100);
      assert(pct > 0, "no zero-chance offer in the hop table: " + o.companyId + " " + pct + "%");
      const co = sim.careerCompany(o.companyId, config);
      assert(!(co && co.power === 3), "gated big publisher stays out of the early hop table");
    });

    // 职级够了以后大厂要能回来（证明过滤只吃掉 0%，不吃掉低概率）
    const late = sim.clone(st);
    late.career.jobRank = minRankByPower["3"];
    let sawBig = false;
    for (let i = 0; i < 60 && !sawBig; i++) {
      const probe = sim.clone(late);
      probe.rngSeed = 900001 + i * 7919;
      sim.listYearEndOffers(probe, config).forEach(function (o) {
        const co = sim.careerCompany(o.companyId, config);
        if (co && co.power === 3) sawBig = true;
      });
    }
    assert(sawBig, "big publishers return once the rank gate is met");

    ok("opening shuns big publishers (w=0 → " + off + ", w=999 → " + on + "), zero-chance hop offers dropped");
  })();

  (function startingAbleSkillsAndHopFit() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ableXp = px.startingAbleXp;
    const gCount = px.startingAbleGenreCount;
    const pCount = px.startingAbleGameplayCount;
    assert(ableXp > 0 && gCount === 2 && pCount === 2, "starting able config");
    const g = sim.createCareerGame("测", "programmer", config);
    const genreIds = Object.keys(g.career.genreXp || {}).filter(function (id) {
      return g.career.genreXp[id] > 0;
    });
    const playIds = Object.keys(g.career.gameplayXp || {}).filter(function (id) {
      return g.career.gameplayXp[id] > 0;
    });
    assert(genreIds.length === gCount, "starting genre count " + genreIds.length);
    assert(playIds.length === pCount, "starting gameplay count " + playIds.length);
    genreIds.forEach(function (id) {
      assert(g.career.genreXp[id] === ableXp, "starting genre xp " + id);
      assert(sim.xpTierFor(g.career.genreXp[id], config).id === "able", "starting genre able " + id);
    });
    playIds.forEach(function (id) {
      assert(g.career.gameplayXp[id] === ableXp, "starting play xp " + id);
      assert(sim.xpTierFor(g.career.gameplayXp[id], config).id === "able", "starting play able " + id);
    });
    const sheet = sim.careerSkillSheet(g, config);
    assert(sheet.genres.length === (config.content.genres || []).length, "sheet all genres");
    assert(sheet.gameplay.length === (config.content.gameplay || []).length, "sheet all gameplay");
    sheet.genres.concat(sheet.gameplay).forEach(function (row) {
      assert(row.xp == null, "sheet hides xp " + row.id);
      assert(row.tier && row.tierId, "sheet has tier " + row.id);
    });
    const ableGenre = genreIds[0];
    const ablePlay = playIds[0];
    const missGenre = (config.content.genres || []).map(function (x) { return x.id; }).filter(function (id) {
      return genreIds.indexOf(id) < 0;
    })[0];
    const missPlay = (config.content.gameplay || []).map(function (x) { return x.id; }).filter(function (id) {
      return playIds.indexOf(id) < 0;
    })[0];
    const co = sim.careerCompany("fromsoftware", config) || sim.careerCompany(g.career.openingOffers[0].companyId, config);
    const chanceFit = sim.careerHireChance(co, g, config, null, { genreId: ableGenre, gameplayId: ablePlay });
    const chanceMiss = sim.careerHireChance(co, g, config, null, { genreId: missGenre, gameplayId: missPlay });
    assert(chanceFit > chanceMiss, "skill fit hireChance " + chanceMiss + " -> " + chanceFit);
    ok("starting able skills, sheet, hop fit");
  })();

  (function careerYearEndOffersStudiosAndHopRules() {
    const nintendo = sim.careerCompany("nintendo", config);
    assert(nintendo && nintendo.studios && nintendo.studios.length >= 2, "nintendo has 2+ studios");
    ["sony", "sega", "square", "squareEnix", "capcom", "ea", "blizzard", "tencent", "netease", "mihoyo", "ubisoft", "rockstar"].forEach(function (id) {
      const co = sim.careerCompany(id, config);
      if (!co || co.joinable === false) return;
      assert(co.studios && co.studios.length >= 2, id + " has 2+ studios");
    });
    const titled = (config.careerWorld.titles || []).filter(function (t) {
      return t.companyId === "nintendo" && t.studioId;
    });
    assert(titled.length >= 1, "nintendo titles hang studioId");

    let st = sim.createCareerGame("测", "programmer", config);
    st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
    st.career.companyId = "nintendo";
    st.career.studioId = nintendo.studios[0].id;
    st.year = 1998;
    st.month = 12;
    const list = sim.listYearEndOffers(st, config);
    const hops = list.filter(function (o) { return o.kind !== "promotion" && o.kind !== "promotionLine"; });
    assert(list.length === 4, "year-end offer count 4, got " + list.length);
    assert(hops.length >= 3 && hops.length <= 4, "year-end hop slots 3–4, got " + hops.length);
    const internals = hops.filter(function (o) { return o.internal; });
    assert(internals.length <= 2, "internal offers <= 2, got " + internals.length);
    internals.forEach(function (o, i) {
      assert(hops[i].internal, "internals come first at " + i);
      assert(o.studioId && o.studioId !== st.career.studioId, "internal is another studio");
    });
    hops.forEach(function (o) {
      assert(typeof o.successChance === "number", "successChance on offer");
      assert(o.studioId, "offer studioId");
    });
    (function hopPageShowsFourLeanCards() {
      const pageSt = sim.clone(st);
      pageSt.career.yearEndOffers = [];
      pageSt.career.titleId = null;
      pageSt.career.liveStats = null;
      const tick = sim.tickCareerMonth(pageSt, config);
      const hopPage = (tick.queue || []).filter(function (p) { return p.type === "hop"; })[0];
      assert(hopPage, "december hop page");
      const hopOpts = (hopPage.options || []).filter(function (o) { return o.id !== "stay"; });
      assert(hopOpts.length === 4, "hop UI shows 4, got " + hopOpts.length);
      hopOpts.forEach(function (opt) {
        assert(opt.label.indexOf("前辈") < 0, "hop label no 前辈");
        assert(opt.label.indexOf("对口") < 0, "hop label no 对口");
        assert(opt.label.indexOf("→") < 0, "hop label no current salary");
        assert(opt.hopView && opt.hopView.title, "hop title");
        assert(opt.hopView.meta, "hop salary/rank");
        assert(/^\d+%$/.test(opt.hopView.pct), "hop pct " + opt.hopView.pct);
      });
    })();

    const failList = sim.listYearEndOffers(st, config);
    failList[0].successChance = 0;
    st.career.yearEndOffers = failList;
    const liveBefore = { play: 91, fun: 88, expression: 84, immersion: 80 };
    st.career.titleId = "oot";
    st.career.liveStats = { play: 91, fun: 88, expression: 84, immersion: 80 };
    st.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "programmer" }];
    const failed = sim.applyYearEndOffer(st, failList[0].id, config);
    assert(failed.ok && failed.hopped === false, "failed apply still ok, not hopped");
    assert(failed.state.career.hopFailedYear === failed.state.year, "hopFailedYear set");
    assert(failed.state.career.companyId === "nintendo", "stay at nintendo on fail");
    const again = sim.applyYearEndOffer(failed.state, failList[1] ? failList[1].id : failList[0].id, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_HOP_WAIT, "same year cannot apply again");
    const nextYear = sim.clone(failed.state);
    nextYear.year = failed.state.year + 1;
    nextYear.career.hopFailedYear = failed.state.career.hopFailedYear;
    nextYear.career.yearEndOffers = sim.listYearEndOffers(nextYear, config);
    nextYear.career.yearEndOffers[0].successChance = 1;
    const retry = sim.applyYearEndOffer(nextYear, nextYear.career.yearEndOffers[0].id, config);
    assert(retry.ok && retry.hopped === true, "next year can apply");
    assert(retry.notice, "hop success notice survives join");
    assert(retry.state.career.hopNotice, "hopNotice kept after joinCompany");
    assert(!(retry.state.career.yearEndOffers || []).length, "hop clears leftover offers");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    hopSt.year = 1998;
    hopSt.month = 6;
    hopSt.career.titleId = "oot";
    hopSt.career.liveStats = { play: 91, fun: 88, expression: 84, immersion: 80 };
    hopSt.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "art" }];
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const hopTarget = (hopSt.career.yearEndOffers || []).filter(function (o) {
      return o.companyId !== "nintendo";
    })[0] || hopSt.career.yearEndOffers[0];
    hopTarget.successChance = 1;
    const mid = sim.applyYearEndOffer(hopSt, hopTarget.id, config);
    assert(mid.ok && mid.hopped, "mid-project hop allowed");
    const left = (mid.state.career.leftProjectLive || {}).oot;
    assert(left && left.play === 91 && left.fun === 88, "left project live unchanged");
    const ootCredit = (mid.state.career.credits || []).filter(function (c) { return c.titleId === "oot"; })[0];
    assert(ootCredit, "resume keeps unsigned participation");
    assert(!ootCredit.shipped, "mid hop not credited at ship");
    assert(ootCredit.leftYear != null, "left dates written");
    assert(mid.state.career.companyId === hopTarget.companyId, "joined new company");
    assert(mid.state.career.studioId, "join writes studioId");

    hopSt.career.yearEndOffers = [{ id: "stale-hop" }];
    hopSt.career.invites = [{
      id: "inv-test",
      titleId: "chronoTrigger",
      companyId: "square",
      studioId: "square-rd3",
      roleId: "art",
      salary: 4000,
      currentSalary: 2000
    }];
    assert((config.careerWorld.mobility || {}).inviteCanCounter === false, "invite counter off");
    assert(!sim.counterCareerInvite(hopSt, "inv-test", config).ok, "counter API disabled");
    const invOptSt = sim.clone(hopSt);
    invOptSt.year = 1995;
    invOptSt.month = 2;
    invOptSt.career.fame = 90;
    invOptSt.career.titleId = null;
    invOptSt.career.companyId = "nintendo";
    const listedInv = sim.listCareerInvites(invOptSt, config);
    assert(listedInv.length >= 1, "invite list for option test");
    invOptSt.career.inviteYearStamp = invOptSt.year;
    invOptSt.career.invitesRolledThisYear = 99;
    invOptSt.career.invites = [listedInv[0]];
    const inviteTick = sim.tickMonth(invOptSt, config);
    const invPage = ((inviteTick && inviteTick.queue) || []).filter(function (p) { return p.type === "invite"; })[0];
    assert(invPage, "invite page queued");
    assert((invPage.options || []).every(function (o) { return o.id !== "counter"; }), "invite has no counter");
    assert((invPage.options || []).some(function (o) { return o.id === "accept"; }), "invite accept remains");
    assert((invPage.options || []).some(function (o) { return o.id === "decline"; }), "invite decline remains");
    const beforeCo = hopSt.career.companyId;
    const inv = sim.acceptCareerInvite(hopSt, "inv-test", config);
    assert(inv.ok, "invite accept ok");
    assert(inv.notice, "invite success notice");
    assert(!(inv.state.career.yearEndOffers || []).length, "invite clears stale hop list");
    assert(inv.state.career.companyId === "square", "invite hops without dice");
    assert(inv.state.career.companyId !== beforeCo || hopSt.career.companyId === "square", "invite company set");
    ok("year-end 4 offers, hop fail cooldown, invite sure, mid hop keeps unsigned credit");
  })();

  (function producerCatalogDirectionAndInviteRoles() {
    function hiredAt(role, rank) {
      let st = sim.createCareerGame("测", role, config);
      // createCareerGame 用 Date.now() 播种，开局 offer 随机 → 固定种子保证可复现
      st.rngSeed = 20240915;
      st.rngCount = 0;
      st.career.openingOffers = sim.rollOpeningOffers(st, st.career.roleId, config);
      st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
      st.career.jobRank = rank;
      st.career.fame = 80;
      st.career.lines = {};
      return st;
    }

    function finishProducerLine(st) {
      let started = sim.startCareerLine(st, "become-producer", config);
      assert(started.ok, "start producer line for invite test");
      let step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
      st = step.state;
      // 试岗拍已并入席位拍：invite → seat，craft 直接带 becomeProducer
      st.career.lines["become-producer"].waitingFor = "shipReady";
      st.career.lines["become-producer"].pending = false;
      sim.processCareerLines(st, config, [], []);
      step = sim.resolveCareerLineChoice(st, "become-producer", "seat", "craft", config);
      assert(step.ok && step.done, "finish producer line");
      return step.state;
    }

    let prod = finishProducerLine(hiredAt("programmer", 4));
    assert(sim.hasCompletedBecomeProducerLine(prod, config), "become-producer done");

    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && !chrono.virtual, "chrono is catalog");
    const snap = {
      name: chrono.name,
      alias: chrono.alias,
      genreId: chrono.genreId,
      gameplayId: chrono.gameplayId
    };
    prod.career.titleId = "chronoTrigger";
    prod.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    prod.career.awaitingProducerPitch = false;
    // 制作人空窗自选企划走的是池作，池默认开着，直接用页面配置即可。
    const prodVirtCfg = deepClone(config);
    const queued = [];
    assert(!sim.queueProducerVirtualPitch(prod, prodVirtCfg, queued), "no pitch while on catalog");
    assert(queued.length === 0, "catalog blocks pitch queue");

    prod.career.titleId = null;
    prod.career.liveStats = null;
    prod.career.idleMonths = 99;
    assert(sim.queueProducerVirtualPitch(prod, prodVirtCfg, queued), "pitch when idle virtual path");
    assert(queued.length === 1 && queued[0].type === "producerPitch", "pitch queued");
    const optId = (prod.career.producerPitchOptions || [])[0].id;
    const pitched = sim.resolveProducerPitch(prod, optId, prodVirtCfg);
    assert(pitched.ok && pitched.virtual, "pitch resolves virtual");
    const virtTitle = sim.careerTitle(pitched.state.career.titleId, config, pitched.state);
    assert(virtTitle && virtTitle.virtual, "assigned virtual");
    assert(virtTitle.genreId && virtTitle.gameplayId, "virtual has genre/gameplay from pitch");
    assert(chrono.name === snap.name && chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId,
      "catalog name/genre/gameplay untouched");

    const rewriteCfg = deepClone(config);
    rewriteCfg.careerWorld = deepClone(config.careerWorld);
    rewriteCfg.careerWorld.producerEvents = deepClone(config.careerWorld.producerEvents || { list: [] });
    rewriteCfg.careerWorld.producerEvents.list = (rewriteCfg.careerWorld.producerEvents.list || []).concat([{
      id: "testCatalogRewrite",
      displayName: "试改目录",
      text: "不该改写目录作。",
      presentation: "choice",
      choices: [{
        id: "rewrite",
        label: "改",
        virtualGenreId: "horror",
        virtualGameplayId: "survival",
        virtualName: "黑客编的假名"
      }]
    }]);
    let onCatalog = sim.clone(pitched.state);
    onCatalog.career.titleId = "chronoTrigger";
    onCatalog.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    const rewrite = sim.resolveCareerEventChoice(onCatalog, "testCatalogRewrite", "rewrite", rewriteCfg);
    assert(rewrite.ok, "rewrite choice resolves");
    assert(chrono.name === snap.name && chrono.alias === snap.alias, "catalog name blocked");
    assert(chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId, "catalog genre/gameplay blocked");

    let beforeDone = hiredAt("design", 4);
    beforeDone.career.roleId = "producer";
    beforeDone.career.growthStage = "producer";
    beforeDone.career.lines = {};
    assert(!sim.hasCompletedBecomeProducerLine(beforeDone, config), "role alone ≠ line done");
    beforeDone.year = 1995;
    beforeDone.month = 2;
    beforeDone.career.companyId = "nintendo";
    const invBefore = sim.listCareerInvites(beforeDone, config);
    invBefore.forEach(function (inv) {
      assert(inv.roleId !== "producer", "no producer dig before line done");
    });
    const hopsBefore = sim.listYearEndOffers(beforeDone, config).filter(function (o) {
      return !o.kind;
    });
    hopsBefore.forEach(function (o) {
      assert(o.roleId !== "producer", "no producer hop before line done");
    });

    let after = finishProducerLine(hiredAt("art", 4));
    after.year = 1995;
    after.month = 2;
    after.career.companyId = "nintendo";
    after.career.fame = 90;
    after.career.titleId = null;
    const weights = deepClone(config);
    weights.careerWorld = deepClone(config.careerWorld);
    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const invProd = sim.listCareerInvites(after, weights);
    assert(invProd.length >= 1, "invites exist after line done");
    assert(invProd.some(function (inv) { return inv.roleId === "producer"; }), "producer dig can appear after line done");

    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const invStaff = sim.listCareerInvites(after, weights);
    assert(invStaff.length >= 1, "staff digs while currently producer");
    assert(invStaff.every(function (inv) { return inv.roleId !== "producer"; }), "producer weight 0 → staff only");
    assert(invStaff.some(function (inv) {
      return ["programmer", "design", "art", "music"].indexOf(inv.roleId) >= 0;
    }), "staff role dig while producer");

    after.career.invites = [invStaff[0]];
    const acc = sim.acceptCareerInvite(after, invStaff[0].id, weights);
    assert(acc.ok, "accept staff dig as producer");
    assert(acc.state.career.roleId === invStaff[0].roleId, "switched to staff role");
    assert(acc.state.career.growthStage === "employee", "growthStage back to employee");
    assert(!sim.isCareerProducer(acc.state), "no longer producer after staff dig");

    after = finishProducerLine(hiredAt("music", 4));
    after.year = 1995;
    after.month = 12;
    after.career.titleId = null;
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const hops = sim.listYearEndOffers(after, weights);
    const hopStaff = hops.filter(function (o) { return !o.kind; });
    assert(hopStaff.length >= 1, "year-end hops");
    hopStaff.forEach(function (o) {
      assert(o.roleId !== "producer", "hop staff when producer weight 0");
    });

    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const hopsProd = sim.listYearEndOffers(after, weights).filter(function (o) { return !o.kind; });
    assert(hopsProd.some(function (o) { return o.roleId === "producer"; }), "producer hop after line done");

    ok("producer catalog locked; invite/hop roles gated by become-producer line");
  })();

};
