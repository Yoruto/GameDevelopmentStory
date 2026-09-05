(function (root) {
  var sim = root.GDS.sim;

  sim.createNewGame = function (companyName, config) {
    var name = companyName && String(companyName).replace(/^\s+|\s+$/g, "");
    if (!name) name = config.company.defaultName;
    var cal = config.calendar;
    var st = {
      saveVersion: 4,
      phase: "PLAYING",
      rngSeed: (Date.now() % 100000) + 17,
      rngCount: 0,
      year: cal.startYear,
      month: cal.startMonth,
      company: {
        name: name,
        funds: config.economy.startingFunds,
        scale: config.company.startingScale,
        fans: config.company.startingFans,
        adOn: false,
        ownConsole: false
      },
      staff: [],
      studios: [],
      projects: [],
      readyToShip: [],
      released: [],
      series: [],
      talentMarket: [],
      trend: null,
      trendWait: 0,
      firedEventIds: [],
      rivalWait: {},
      rivalSequel: {},
      rivalWindow: [],
      rivalMonth: [],
      rivalReleased: [],
      rivalForceSeries: {},
      rivalPlan: {},
      rivalLifetimeByPlatform: {},
      monthSales: 0,
      monthChart: [],
      lastMedia: null,
      lastAwards: null,
      talentStamp: cal.startYear + "-" + cal.startMonth
    };
    sim.refreshMarket(st, config, true);
    sim.ensureRivalCalendar(st, config);
    return sim.syncOwnConsole(st, config);
  };

  sim.relocate = function (state, config) {
    if (state.company.scale === "large") return sim.fail(state, sim.ERR.RELOCATE_MAX);
    var cost = state.company.scale === "small"
      ? config.economy.relocateSmallToMedium
      : config.economy.relocateMediumToLarge;
    if (state.company.funds < cost) return sim.fail(state, sim.ERR.RELOCATE_FUNDS);
    var st = sim.clone(state);
    st.company.funds -= cost;
    st.company.scale = st.company.scale === "small" ? "medium" : "large";
    return sim.ok(sim.syncOwnConsole(st, config));
  };

  sim.buyAd = function (state, config) {
    var ad = config.economy.advertising;
    if (state.company.funds < ad.cost) return sim.fail(state, sim.ERR.AD_FUNDS);
    var st = sim.clone(state);
    st.company.funds -= ad.cost;
    st.company.fans += ad.fansGain;
    st.company.adOn = true;
    return sim.ok(sim.syncOwnConsole(st, config));
  };

  sim.foundStudio = function (state, name, leadId, config) {
    var scale = config.company.scales[state.company.scale] || {};
    if (!scale.canFoundStudios) return sim.fail(state, sim.ERR.STUDIO_SCALE);
    var lead = sim.findStaff(state, leadId);
    if (!lead) return sim.fail(state, sim.ERR.STUDIO_NO_LEAD);
    var st = sim.clone(state);
    var found = sim.findStaff(st, leadId);
    if (found) found.isStudioLead = true;
    var nm = name && String(name).replace(/^\s+|\s+$/g, "");
    st.studios.push({ id: "st" + st.rngCount, name: nm || "夜猫组", leadId: leadId });
    return sim.ok(st);
  };

  sim.startNewRun = function (companyName, config) {
    return sim.createNewGame(companyName, config);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
