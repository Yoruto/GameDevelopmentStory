"use strict";

// One hand-calculated ledger drives monthly sales, chart, award-window and poster checks.
// The test changes the curve to three flat months, so expectations do not copy the
// production decay formula. All four views still use the real simulation functions.
module.exports = function (ctx) {
  const fs = ctx.fs;
  const path = ctx.path;
  const sim = ctx.sim;
  const assert = ctx.assert;
  const fixture = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, "tests", "fixtures", "sales-consistency.json"), "utf8"));
  const config = ctx.deepClone(ctx.config);
  const companyId = config.careerWorld.companies[0].id;
  const ids = fixture.games.map(function (g) { return g.id; });

  // A constant, three-month curve makes each expected number independently checkable.
  config.lifecycle.maxMonths = 3;
  config.lifecycle.lambda0 = 0;
  config.lifecycle.lambdaSpan = 0;
  config.lifecycle.tMin = 1;
  config.lifecycle.tSpan = 0;
  config.lifecycle.chartSize = 15;
  fixture.games.forEach(function (g) {
    config.careerWorld.titles.push({
      id: g.id, name: g.name, alias: g.name, companyId: companyId,
      releaseYear: g.releaseYear, releaseMonth: g.releaseMonth,
      releaseType: g.releaseType
    });
  });

  const state = sim.createCareerGame("口径回归", "programmer", config);
  state.worldReleased = fixture.games.map(function (g) {
    return {
      id: g.id, name: g.name, alias: g.name, companyId: companyId,
      releaseYear: g.releaseYear, releaseMonth: g.releaseMonth,
      releasedYear: g.releaseYear, releasedMonth: g.releaseMonth,
      releaseType: g.releaseType, live: g.releaseType === "liveops",
      avg: 8, score: 8, prestige: 3,
      stats: { play: 80, fun: 80, expression: 80, immersion: 80 },
      baselineSales: g.baselineSales == null ? g.launchSales : g.baselineSales,
      launchSales: g.launchSales
    };
  });
  state.career.credits = fixture.games.map(function (g) {
    return {
      titleId: g.id, companyId: companyId, roleId: "programmer",
      joinYear: g.releaseYear, joinMonth: g.releaseMonth,
      leftYear: g.releaseYear, leftMonth: g.releaseMonth,
      shipped: g.signed, virtual: false, score: 8
    };
  });
  // A second credit for the same work must not add its sales twice on the poster.
  state.career.credits.push(Object.assign({}, state.career.credits[0]));

  function equal(actual, expected, label) {
    assert(JSON.stringify(actual) === JSON.stringify(expected),
      label + " got " + JSON.stringify(actual) + " expected " + JSON.stringify(expected));
  }
  function at(year, month) { return year + "-" + String(month).padStart(2, "0"); }
  const checkpoints = {};
  fixture.checkpoints.forEach(function (row) { checkpoints[at(row.year, row.month)] = row; });

  for (let year = 2023; year <= 2024; year += 1) {
    const start = year === 2023 ? 11 : 1;
    for (let month = start; month <= 12; month += 1) {
      state.year = year;
      state.month = month;
      sim.settleCareerSalesMonth(state, config);
      const checkpoint = checkpoints[at(year, month)];
      if (checkpoint) {
        const records = state.worldReleased;
        equal(records.map(function (g) { return g.monthSales || 0; }), checkpoint.monthly,
          at(year, month) + " new sales");
        equal(records.map(function (g) { return g.lifetimeSales == null ? null : g.lifetimeSales; }),
          checkpoint.cumulative, at(year, month) + " cumulative sales");
        const chart = sim.monthlyChart(state, config);
        equal(chart.map(function (r) { return r.id; }), checkpoint.chart,
          at(year, month) + " ranking by this month's new sales");
        equal(chart.map(function (r) { return r.monthSales; }),
          checkpoint.chart.map(function (id) { return checkpoint.monthly[ids.indexOf(id)]; }),
          at(year, month) + " ranking row amounts");
        assert(chart.every(function (r) { return r.live === (r.id === "ledger-b"); }),
          "long-line identity is a chart tag, not a sales multiplier");
        assert(chart.every(function (r, i) { return r.rank === i + 1; }), "chart ranks are consecutive");
        if (month === 12) {
          const before = records.map(function (g) { return g.lifetimeSales; });
          sim.settleCareerSalesMonth(state, config);
          equal(records.map(function (g) { return g.lifetimeSales; }), before,
            at(year, month) + " repeated settlement leaves totals unchanged");
        }
      }
      if (year === 2024 && month === 11) {
        const award = fixture.awards2024;
        equal(state.worldReleased.filter(function (g) {
          return sim.inAwardWindow(g, year, config);
        }).map(function (g) { return g.id; }), award.inWindow, "award window includes December through November");
        award.outside.forEach(function (id) {
          assert(!sim.inAwardWindow(state.worldReleased[ids.indexOf(id)], year, config),
            id + " stays outside the 2024 award window");
        });
        const pack = sim.runCareerAwards(state, config, []);
        const goty = pack.filter(function (a) { return a.id === "goty"; })[0];
        const live = pack.filter(function (a) { return a.id === "bestLiveOps"; })[0];
        equal(goty.nominees.map(function (n) { return n.titleId; }).sort(), award.inWindow.slice().sort(),
          "career awards use the same release window");
        equal(live.nominees.map(function (n) { return n.titleId; }), award.liveOps,
          "live-ops award uses the same window and tag");
      }
    }
  }
  ctx.ok("one ledger keeps monthly new sales, cumulative sales and ranking consistent");
  ctx.ok("the same ledger gives the December-November career award window");

  const resume = sim.careerResumeView(state, config);
  equal(ids.slice(0, 3).map(function (id) {
    return resume.credits.filter(function (credit) { return credit.titleId === id; })[0].sales;
  }), fixture.poster2024.signedWorkSales, "resume displays the same cumulative sales as the ledger");
  const poster = sim.careerPosterView(state, config);
  assert(poster.totalSales === fixture.poster2024.signedTotalSales,
    "poster sums each signed work's cumulative sales once: " + poster.totalSales);
  const incomplete = state.worldReleased[2];
  const savedTotal = incomplete.lifetimeSales;
  delete incomplete.lifetimeSales;
  assert(sim.careerPosterView(state, config).totalSales === null,
    "poster does not substitute launch sales when one signed work lacks its cumulative total");
  incomplete.lifetimeSales = savedTotal;
  ctx.ok("the same ledger drives deduplicated poster sales and rejects incomplete totals");
};
