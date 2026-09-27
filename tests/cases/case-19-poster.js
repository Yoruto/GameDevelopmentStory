"use strict";

module.exports = function (ctx) {
  const sim = ctx.sim;
  const config = ctx.config;
  const assert = ctx.assert;
  const titles = (config.careerWorld.titles || [])
    .filter(function (title) { return !title.virtual && title.releaseYear != null; })
    .sort(function (a, b) {
      return a.releaseYear - b.releaseYear || (a.releaseMonth || 1) - (b.releaseMonth || 1);
    }).slice(0, 3);
  assert(titles.length === 3, "poster fixture has three catalog works");
  const state = sim.createCareerGame("海报测试", "programmer", config);
  state.career.credits = titles.map(function (title, i) {
    return {
      titleId: title.id, companyId: title.companyId, roleId: "programmer",
      joinYear: title.releaseYear, joinMonth: title.releaseMonth || 1,
      leftYear: title.releaseYear, leftMonth: title.releaseMonth || 1,
      shipped: true, virtual: false, score: [7.2, 9.5, 8.1][i]
    };
  });
  state.career.credits.push({
    titleId: "transition-test", shipped: true, virtual: true,
    joinYear: 2000, joinMonth: 1, score: 10
  });
  state.worldReleased = titles.map(function (title, i) {
    return { id: title.id, lifetimeSales: [100, 250, 400][i] };
  });
  state.worldReleased.push({ id: "transition-test", lifetimeSales: 10000 });
  const first = sim.careerPosterView(state, config);
  const second = sim.careerPosterView(state, config);
  assert(JSON.stringify(first) === JSON.stringify(second), "poster is stable for the same save");
  assert(first.signedCount === 3 && first.transitionCount === 1, "poster separates signed works and transition projects");
  assert(first.best.titleId === titles[1].id && first.topScore === 9.5, "poster chooses highest scored signed work");
  assert(first.totalSales === 750, "poster adds lifetime sales of signed catalog works only");
  assert(first.moments.length === 3, "poster uses three distinct career moments");
  assert(first.moments[0].item.titleId === titles[0].id &&
    first.moments[2].item.titleId === titles[2].id, "poster keeps first and final works in date order");
  ctx.ok("career poster uses real signed work data, excludes transitions, and is deterministic");

  state.career.credits.push(Object.assign({}, state.career.credits[1]));
  assert(sim.careerPosterView(state, config).totalSales === 750,
    "multiple credits on the same work do not double count its sales");
  state.career.credits.pop();
  state.worldReleased[2] = { id: titles[2].id, launchSales: 999 };
  assert(sim.careerPosterView(state, config).totalSales === null,
    "launch sales are not presented as complete career total");
  state.worldReleased[2].lifetimeSales = 400;
  ctx.ok("career total sales deduplicates works and rejects incomplete totals");

  state.career.credits = state.career.credits.slice(0, 2);
  const shortCareer = sim.careerPosterView(state, config);
  assert(shortCareer.moments.length === 2 &&
    shortCareer.moments[0].label === "first" && shortCareer.moments[1].label === "last",
    "two-work career has distinct first and final moments");
  ctx.ok("career poster avoids duplicate milestones in a short career");

  state.career.credits = [];
  const empty = sim.careerPosterView(state, config);
  assert(empty.moments.length === 0 && empty.best === null && empty.topScore === null,
    "empty career poster does not invent a representative work");
  assert(empty.totalSales === 0, "empty career has zero career sales");
  ctx.ok("career poster handles a career with no released signed work");
};
