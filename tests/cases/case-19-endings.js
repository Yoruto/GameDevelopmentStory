"use strict";

module.exports = function (t) {
  const { sim, config, assert, deepClone, ok } = t;
  function base() {
    const st = deepClone(sim.createCareerGame("结局测试", "programmer", config));
    st.phase = "SETTLED";
    st.year = 2026;
    st.month = 1;
    st.career.growthStage = "employee";
    st.career.honor = 0;
    st.career.health = 4;
    st.career.credits = [];
    st.career.lines = {};
    return st;
  }
  const cases = [
    ["producer", function (s) { s.career.growthStage = "producer"; }],
    ["relationships", function (s) {
      s.career.lines["bond-mentor"] = { status: "done" };
      s.career.lines["bond-peer"] = { status: "done" };
    }],
    ["awards", function (s) { s.career.honor = 4; }],
    ["prolific", function (s) {
      s.career.credits = Array.from({ length: 8 }, function () { return { shipped: true, virtual: false }; });
    }],
    ["health", function (s) { s.career.health = 2; }],
    ["ordinary", function () {}]
  ];
  cases.forEach(function (item) {
    const st = base();
    item[1](st);
    const view = sim.careerEndingView(st, config);
    assert(view.id === item[0], item[0] + " ending reachable");
    assert(view.title && view.body, item[0] + " ending has card copy");
    ok("ending reachable: " + item[0]);
  });
  const priority = base();
  cases.slice(0, 5).forEach(function (item) { item[1](priority); });
  assert(sim.careerEndingView(priority, config).id === "producer", "ending priority first match");
  priority.career.growthStage = "employee";
  assert(sim.careerEndingView(priority, config).id === "relationships", "relationship priority above awards");
  priority.career.lines["bond-junior"] = { flags: { taughtWell: true } };
  assert(sim.careerEndingView(priority, config).echo.indexOf("后辈") >= 0, "bond choice echoed");
  ok("ending priority and character echo");
};
