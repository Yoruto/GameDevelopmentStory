// 测试用例组：01-lifecycle-sales（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function salesFactorMonth1IsBase() {
    const y = sim.salesFactor(1, 10, config);
    assert(Math.abs(y - 1) < 0.02, "Y(1,10)≈1 got " + y);
    const yNoScore = sim.salesFactor(2, null, config);
    assert(yNoScore === 0, "no score is not treated as 10");
    ok("salesFactor(1,10)≈1 and missing score is not 10");
  })();

  (function salesFactorFollowsExponentialFormula() {
    const lc = config.lifecycle;
    function expected(m, S) {
      const u = (S - lc.scoreMin) / (lc.scoreMax - lc.scoreMin);
      const lambda = lc.lambda0 + u * lc.lambdaSpan;
      const T = lc.tMin + u * lc.tSpan;
      const x = m - 1;
      return T + (1 - T) * Math.exp(-lambda * x);
    }
    // S=10 的查表对照：λ=0.55、T=0.34，第 2 月掉到 0.72，此后贴着长尾。
    const table10 = [1.00, 0.72, 0.56, 0.47, 0.41, 0.38, 0.36, 0.35, 0.35, 0.34, 0.34, 0.34];
    let m;
    for (m = 1; m <= lc.maxMonths; m++) {
      const y = sim.salesFactor(m, 10, config);
      const exp = expected(m, 10);
      assert(Math.abs(y - exp) < 1e-9, "formula m=" + m + " " + y);
      const tab = table10[m - 1];
      const rel = Math.abs(y - tab) / tab;
      assert(rel < 0.05, "table对照 m=" + m + " y=" + y + " tab=" + tab + " rel=" + rel);
    }
    assert(sim.salesFactor(lc.maxMonths + 1, 10, config) === 0, "past maxMonths");
    ok("salesFactor matches exponential decay from lifecycle config");
  })();

  (function salesFactorDecaysFastThenFlattens() {
    // 第 2 月就该掉到六成上下——旧 logistic 在第 2 月还有 0.99，前 3 个月几乎不衰减。
    const y2high = sim.salesFactor(2, 10, config);
    const y2low = sim.salesFactor(2, 6, config);
    let m, prev, cur;
    assert(y2high > 0.6 && y2high < 0.8, "Y(2,10) in 0.6~0.8 got " + y2high);
    assert(y2low > 0.5 && y2low < 0.72, "Y(2,6) in 0.5~0.72 got " + y2low);
    assert(y2high > y2low, "high score decays slower");
    prev = sim.salesFactor(1, 8, config);
    for (m = 2; m <= config.lifecycle.maxMonths; m++) {
      cur = sim.salesFactor(m, 8, config);
      assert(cur < prev, "monotonic decay at m=" + m);
      assert(cur >= config.lifecycle.tMin, "never below long tail at m=" + m);
      prev = cur;
    }
    ok("salesFactor drops ~30% by month 2 and decays monotonically into the tail");
  })();

  (function noWeek1SalesAnyMore() {
    // 揭晓面板不再显示首周销量：sim 层的切分函数与配置项都已删除。
    assert(typeof sim.salesWeek1Share === "undefined", "salesWeek1Share removed");
    assert(typeof sim.boxedWeek1Units === "undefined", "boxedWeek1Units removed");
    assert(config.lifecycle.week1ShareMin === undefined && config.lifecycle.week1ShareSpan === undefined,
      "lifecycle week1Share keys removed");
    assert(config.copy.week1SalesLabel === undefined, "week1SalesLabel removed");
    assert(config.copy.launchSalesReveal === "本月实销", "sales row names this month's new units");
    ok("first-week sales display is gone, monthly sales remains");
  })();

  (function launchSalesRisesWithScoreWithoutDominatingDemand() {
    const mid = { prestige: 3, power: 2, stats: { play: 75, fun: 75, expression: 75, immersion: 75 } };
    const lo = sim.careerLaunchSales(mid, 7, config).launchSales;
    const hi = sim.careerLaunchSales(mid, 9, config).launchSales;
    const ratio = hi / lo;
    const expRatio = Math.exp(config.careerWorld.launchSales.scoreExp * 2);
    assert(Math.abs(lo - 15000) / 15000 < 0.02, "7 分中性作 ≈ 15000，got " + lo);
    assert(Math.abs(ratio - expRatio) / expRatio < 0.02, "9/7 ratio follows scoreExp got " + ratio);
    assert(ratio > 5 && ratio < 7, "评分推动销量，但不能独占市场触达，got " + ratio);
    ok("launchSales score curve gives 9分/7分 ≈ ×" + ratio.toFixed(1));
  })();

  (function launchSalesSpansRealisticMagnitude() {
    const spec = config.careerWorld.launchSales;
    const top = sim.careerLaunchSales(
      { prestige: 5, power: 3, stats: { play: 100, fun: 100, expression: 100, immersion: 100 } }, 9.9, config
    ).launchSales;
    const mid = sim.careerLaunchSales(
      { prestige: 3, power: 2, stats: { play: 75, fun: 75, expression: 75, immersion: 75 } }, 7, config
    ).launchSales;
    const flop = sim.careerLaunchSales(
      { prestige: 2, power: 1, stats: { play: 40, fun: 40, expression: 40, immersion: 40 } }, 6, config
    ).launchSales;
    assert(top > 450000 && top < 600000, "无系列知名度的顶配 9.9 分首月应为几十万级，got " + top);
    assert(Math.abs(mid - 15000) / 15000 < 0.02, "7 分合格作首月锚点，got " + mid);
    assert(flop > 2000 && flop < 6000, "6 分小厂作落在数千档，got " + flop);
    assert(top / flop > 80 && top / flop < 150, "作品档位应有数量级差异，got " + Math.round(top / flop));
    assert(spec.baseUnit > 0 && spec.scoreExp > 0, "launchSales spec present");
    ok("launchSales spans flop(" + flop + ") → mid(" + mid + ") → landmark(" + top + ")");
  })();

  // 低分作品不能塌到个位数：真实市场里再烂的作品也有基础曝光。
  // 实现是「拐点换斜率」——scoreRef 以下走更缓的 scoreExpBelow，以上走 scoreExp，中高段一个数不动。
  (function launchSalesLiftsTheLowScoreTail() {
    const spec = config.careerWorld.launchSales;
    const bad = { prestige: 2, power: 1, stats: { play: 40, fun: 40, expression: 40, immersion: 40 } };
    const at = function (s) { return sim.careerLaunchSales(bad, s, config).launchSales; };
    const s1 = at(1), s3 = at(3), s5 = at(5), s7 = at(7);
    assert(s1 > 100, "1 分小厂作也不该归零，got " + s1);
    assert(s3 > 300, "3 分小厂作首月应为数百量级，got " + s3);
    assert(s1 < s3 && s3 < s5 && s5 < s7, "低分段仍须单调递增 " + [s1, s3, s5, s7].join("/"));
    assert(spec.scoreExpBelow != null && spec.scoreExpBelow > 0 && spec.scoreExpBelow < spec.scoreExp,
      "scoreExpBelow 必须是比 scoreExp 更缓的斜率，got " + spec.scoreExpBelow);
    // 斜率切换真的发生在拐点上：跨 7 分那一步的涨幅要大于拐点以下同宽的一步
    const stepBelow = at(6.5) / at(5.5);
    const stepCross = at(7.5) / at(6.5);
    assert(stepBelow < stepCross, "7 分以下每分涨幅应更小，got below=" + stepBelow.toFixed(2) + " cross=" + stepCross.toFixed(2));
    ok("低分作品首月有底（1 分 " + s1 + " / 3 分 " + s3 + " / 5 分 " + s5 + " / 7 分 " + s7 + "）");
  })();

  (function launchSalesGivesBigPublishersAnEdge() {
    const spec = config.careerWorld.launchSales;
    const t = { prestige: 4, stats: { play: 85, fun: 85, expression: 85, immersion: 85 } };
    const small = sim.careerLaunchSales(Object.assign({}, t, { power: 1 }), 8.5, config).launchSales;
    const big = sim.careerLaunchSales(Object.assign({}, t, { power: 3 }), 8.5, config).launchSales;
    const exp = spec.powerMult["3"] / spec.powerMult["1"] *
      spec.strategyMult.wide / spec.strategyMult.targeted;
    assert(Math.abs(big / small - exp) / exp < 0.02, "power ratio follows config got " + (big / small));
    assert(big > small, "同分作品大厂发行卖得更多");
    ok("publisher power shifts sales ×" + (big / small).toFixed(2) + " at equal score");
  })();

  (function daggerfallLaunchAndCumulativeSalesAreCalibrated() {
    const title = config.careerWorld.titles.find(function (t) { return t.id === "daggerfall96"; });
    const packed = sim.careerLaunchSales(title, 7.9, config, title.stats);
    const unknown = Object.assign({}, title, {
      id: "unknown-rpg", seriesId: null, seriesFameSeed: 1,
      launchSalesFloor: 0, salesTargetUnits: 0, salesTargetMonths: 0
    });
    const unknownSales = sim.careerLaunchSales(unknown, 7.9, config, unknown.stats).launchSales;
    const rec = {
      releasedYear: 1996, releasedMonth: 9, avg: 7.9,
      baselineSales: packed.baselineSales, launchSales: packed.launchSales,
      salesModelVersion: packed.salesModelVersion,
      releaseStrategy: packed.releaseStrategy,
      salesTargetUnits: packed.salesTargetUnits,
      salesTargetMonths: packed.salesTargetMonths
    };
    let cumulative = 0;
    assert(packed.launchSales >= 110000 && packed.launchSales < 200000,
      "匕首雨首月应在十余万份档，got " + packed.launchSales);
    assert(packed.launchSales > unknownSales * 2,
      "同分系列作靠知名度拉开发售触达，got " + packed.launchSales + "/" + unknownSales);
    for (let m = 1; m <= 46; m++) {
      const year = 1996 + Math.floor((8 + m - 1) / 12);
      const month = (8 + m - 1) % 12 + 1;
      cumulative += sim.boxedMonthUnits(rec, { year: year, month: month }, config);
    }
    assert(cumulative === 700000, "46 个月累计锚点为 70 万份，got " + cumulative);
    assert(sim.boxedMonthUnits(rec, { year: 2000, month: 7 }, config) > 0,
      "累计锚点后仍有小规模长尾销售");
    ok("Daggerfall launch " + packed.launchSales + " and 46-month total " + cumulative);
  })();

  (function companyStrategyAndReputationAffectReach() {
    const t = {
      id: "new-series-game", companyId: "test-publisher", seriesId: "test-series",
      releaseYear: 2005, releaseMonth: 2, prestige: 4, power: 3,
      stats: { play: 80, fun: 80, expression: 80, immersion: 80 }
    };
    const previous = {
      id: "old-series-game", companyId: t.companyId, seriesId: t.seriesId,
      releasedYear: 2004, releasedMonth: 2, avg: 8, launchSales: 60000
    };
    const first = sim.careerLaunchSales(t, 8, config, t.stats);
    const known = sim.careerLaunchSales(t, 8, config, t.stats, { worldReleased: [previous] });
    const targeted = sim.careerLaunchSales(Object.assign({}, t, { power: 1 }), 8, config, t.stats);
    assert(first.releaseStrategy === "wide" && targeted.releaseStrategy === "targeted",
      "公司规模决定自动发行档位");
    assert(known.launchSales > first.launchSales * 1.5,
      "公司与系列的过往佳作带来首发知名度");
    assert(first.launchSales > targeted.launchSales * 2,
      "同分作品广泛发行比定向发行触达更高");
    ok("company release strategy and earned fame affect launch reach");
  })();

  (function monthlySalesAccrueOnce() {
    const g = {
      id: "test-release", releasedYear: 2000, releasedMonth: 1,
      avg: 8, baselineSales: 20000, launchSales: 20000,
      salesModelVersion: 2, releaseStrategy: "standard", lifetimeSales: 20000
    };
    const st = { year: 2000, month: 1, worldReleased: [g] };
    sim.settleCareerSalesMonth(st, config);
    assert(g.lifetimeSales === 20000 && g.monthSales === 20000,
      "首月累计从首月新增开始");
    st.month = 2;
    const second = sim.boxedMonthUnits(g, st, config);
    sim.settleCareerSalesMonth(st, config);
    assert(g.monthSales === second && g.lifetimeSales === 20000 + second,
      "次月只增加次月实销");
    sim.settleCareerSalesMonth(st, config);
    assert(g.lifetimeSales === 20000 + second, "同月重复结算不能重复增加累计");
    ok("monthly units accrue to lifetime sales exactly once");
  })();

  (function careerLaunchSalesZeroWhenBaseUnitIsZero() {
    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.launchSales = { baseUnit: 0 };
    const packed = sim.careerLaunchSales(
      { prestige: 5, stats: { play: 90, fun: 90, expression: 90, immersion: 90 } },
      10,
      tw,
      { play: 90, fun: 90, expression: 90, immersion: 90 }
    );
    assert(packed.baselineSales === 0 && packed.launchSales === 0, "zero coeffs → 0 launch");
    const g = sim.createCareerGame("测", "programmer", tw);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tw).state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    sim.shipPlayerTitle(st, tw, [], []);
    assert(st.lastMedia.launchSales === 0, "ship writes 0 when formula says so");
    assert(st.lastMedia.media && st.lastMedia.media.rows.length === 4, "media rec still present");
    ok("career launchSales is 0 only when coeffs say so");
  })();

};
