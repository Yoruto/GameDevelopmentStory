(function (root) {
  var sim = root.GDS.sim;

  sim.liveOpsRevenue = function (g, config) {
    var keepers = (g.liveOps && g.liveOps.maintainerIds) || [];
    var qsum = g.stats.program + g.stats.script + g.stats.art + g.stats.music;
    var live = config.liveOps;
    return Math.round(qsum * live.monthlyRevenuePerQualitySum * (1 + Math.max(0, keepers.length - 1) * live.extraStaffRevenueRate));
  };

  sim.shutdownLive = function (st, g, config, notes) {
    if (!g.liveOps || !g.liveOps.active) return;
    g.liveOps.active = false;
    g.liveOps.closedYear = st.year;
    g.liveOps.closedMonth = st.month;
    st.company.funds -= config.liveOps.shutdownPenalty;
    (g.liveOps.maintainerIds || []).forEach(function (id) {
      var s = sim.findStaff(st, id);
      if (s) { s.status = "idle"; s.assignmentId = null; }
    });
    g.liveOps.maintainerIds = [];
    notes.push(g.title + "关服，开支罚金 -" + config.liveOps.shutdownPenalty);
  };

  sim.findReleased = function (st, gameId) {
    return sim.findById(st.released || [], gameId);
  };

  sim.assignLiveOps = function (state, gameId, staffIds, config) {
    var g = sim.findReleased(state, gameId);
    if (!g || !g.liveOps) return sim.fail(state, sim.ERR.LIVEOPS_NOT_FOUND);
    if (!g.liveOps.active) return sim.fail(state, sim.ERR.LIVEOPS_INACTIVE);
    var ids = staffIds || [];
    var i, s;
    for (i = 0; i < ids.length; i++) {
      s = sim.findStaff(state, ids[i]);
      if (!s) return sim.fail(state, sim.ERR.LIVEOPS_STAFF_BUSY);
      if (s.status !== "idle" && s.assignmentId !== gameId) return sim.fail(state, sim.ERR.LIVEOPS_STAFF_BUSY);
    }
    var st = sim.clone(state);
    var rec = sim.findReleased(st, gameId);
    var prev = rec.liveOps.maintainerIds || [];
    prev.forEach(function (id) {
      if (ids.indexOf(id) < 0) {
        var old = sim.findStaff(st, id);
        if (old) { old.status = "idle"; old.assignmentId = null; }
      }
    });
    ids.forEach(function (id) {
      var person = sim.findStaff(st, id);
      if (person) { person.status = "liveops"; person.assignmentId = gameId; }
    });
    rec.liveOps.maintainerIds = ids.slice();
    return sim.ok(st);
  };

  sim.shutdownLiveOps = function (state, gameId, config) {
    var g = sim.findReleased(state, gameId);
    if (!g || !g.liveOps) return sim.fail(state, sim.ERR.LIVEOPS_NOT_FOUND);
    if (!g.liveOps.active) return sim.fail(state, sim.ERR.LIVEOPS_INACTIVE);
    var st = sim.clone(state);
    var rec = sim.findReleased(st, gameId);
    var notes = [];
    sim.shutdownLive(st, rec, config, notes);
    return sim.ok(st);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
