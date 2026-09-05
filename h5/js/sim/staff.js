(function (root) {
  var sim = root.GDS.sim;

  sim.avgStat = function (s) {
    return (s.program + s.script + s.art + s.music) / 4;
  };

  sim.calcSalary = function (s, config) {
    var pay = config.staff.salary;
    var raw = (pay.base + s.level * pay.perLevel + sim.avgStat(s) * pay.perAvgStat) *
      (1 + (s.honor || 0) * pay.honorBonusPerPoint);
    return Math.round(raw);
  };

  sim.drawTraits = function (st, config) {
    var m = config.staff.talentMarket;
    var r = sim.rand(st);
    var both = m.traitChanceBoth;
    var spark = m.traitChanceSpark;
    var meti = m.traitChanceMeticulous;
    if (r < both) return ["sparkOfInspiration", "meticulous"];
    if (r < both + spark) return ["sparkOfInspiration"];
    if (r < both + spark + meti) return ["meticulous"];
    return [];
  };

  sim.traitName = function (id, config) {
    var t = config.traits[id];
    if (t && t.displayName) return t.displayName;
    return id === "sparkOfInspiration" ? "灵光一闪" : (id === "meticulous" ? "一丝不苟" : id);
  };

  sim.staffLine = function (s, config) {
    var job = s.status === "dev" ? "开发中" : (s.status === "liveops" ? "长线维护" : (s.isStudioLead ? "工作室负责人" : "空闲"));
    var t = (s.traits || []).map(function (id) { return sim.traitName(id, config); }).join("/");
    return "Lv" + s.level + " · " + job + (t ? " · " + t : "") + " · 月薪 " + s.salary;
  };

  sim.refreshMarket = function (st, config, force) {
    var stamp = st.year + "-" + st.month;
    if (!force && st.talentStamp === stamp && st.talentMarket && st.talentMarket.length) return;
    st.talentStamp = stamp;
    st.talentMarket = [];
    var m = config.staff.talentMarket;
    var names = (config.copy && config.copy.staffNamePool) || ["员工"];
    var i, cand;
    for (i = 0; i < m.refreshCount; i++) {
      cand = {
        id: "c" + st.rngCount + i,
        n: sim.pick(st, names) + (i + 1),
        level: sim.irand(st, m.levelMin, m.levelMax),
        program: sim.irand(st, m.statMin, m.statMax),
        script: sim.irand(st, m.statMin, m.statMax),
        art: sim.irand(st, m.statMin, m.statMax),
        music: sim.irand(st, m.statMin, m.statMax),
        honor: 0,
        exp: 0,
        traits: sim.drawTraits(st, config),
        status: "idle",
        assignmentId: null
      };
      cand.salary = sim.calcSalary(cand, config);
      st.talentMarket.push(cand);
    }
  };

  sim.addExp = function (st, s, amt, config) {
    var exp = config.staff.experience;
    s.exp = (s.exp || 0) + amt;
    var need = exp.expRequiredBase + s.level * exp.expRequiredPerLevel;
    if (s.exp >= need) {
      s.exp -= need;
      s.level += 1;
      s.program += sim.irand(st, exp.statGainPerLevelMin, exp.statGainPerLevelMax);
      s.script += sim.irand(st, exp.statGainPerLevelMin, exp.statGainPerLevelMax);
      s.art += sim.irand(st, exp.statGainPerLevelMin, exp.statGainPerLevelMax);
      s.music += sim.irand(st, exp.statGainPerLevelMin, exp.statGainPerLevelMax);
      s.salary = sim.calcSalary(s, config);
    }
  };

  sim.hire = function (state, candidateId, config) {
    if (state.staff.length >= sim.maxStaff(state, config)) return sim.fail(state, sim.ERR.HIRE_CAP_FULL);
    var cand = sim.findById(state.talentMarket || [], candidateId);
    if (!cand) return sim.fail(state, sim.ERR.HIRE_NOT_FOUND);
    var st = sim.clone(state);
    cand = sim.findById(st.talentMarket, candidateId);
    st.staff.push({
      id: cand.id,
      n: cand.n,
      level: cand.level,
      exp: 0,
      honor: 0,
      program: cand.program,
      script: cand.script,
      art: cand.art,
      music: cand.music,
      salary: cand.salary,
      traits: cand.traits,
      status: "idle",
      assignmentId: null,
      monthsEmployed: 0
    });
    st.talentMarket = st.talentMarket.filter(function (c) { return c.id !== candidateId; });
    return sim.ok(st);
  };

  sim.fire = function (state, staffId, config) {
    var s = sim.findStaff(state, staffId);
    if (!s) return sim.fail(state, sim.ERR.FIRE_NOT_FOUND);
    if (s.status !== "idle") return sim.fail(state, sim.ERR.FIRE_BUSY);
    var st = sim.clone(state);
    st.staff = st.staff.filter(function (x) { return x.id !== staffId; });
    return sim.ok(st);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
