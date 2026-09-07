(function (root) {
  var sim = root.GDS.sim;

  sim.avgStat = function (s) {
    return (s.program + s.script + s.art + s.music) / 4;
  };

  sim.calcSalary = function (s, config) {
    var pay = config.staff.salary;
    var raw = (pay.base + s.level * pay.perLevel + sim.avgStat(s) * pay.perAvgStat) *
      (1 + (s.honor || 0) * pay.honorBonusPerPoint);
    var mult = 1;
    (s.traits || []).forEach(function (id) {
      var t = sim.traitDef(id, config);
      if (t && t.salaryMult != null) mult *= t.salaryMult;
    });
    return Math.round(raw * mult);
  };

  sim.traitDef = function (id, config) {
    return (config && config.traits && config.traits[id]) || null;
  };

  sim.traitIds = function (config) {
    var out = [];
    var traits = (config && config.traits) || {};
    var k;
    for (k in traits) {
      if (!Object.prototype.hasOwnProperty.call(traits, k)) continue;
      if (k === "comment") continue;
      if (traits[k] && traits[k].displayName) out.push(k);
    }
    return out;
  };

  sim.hasTrait = function (s, id) {
    return !!(s && (s.traits || []).indexOf(id) >= 0);
  };

  sim.bestTraitValue = function (st, memberIds, producerId, traitId, producerKey, memberKey, config) {
    var best = 0;
    var t = sim.traitDef(traitId, config);
    if (!t) return 0;
    (memberIds || []).forEach(function (id) {
      var s = sim.findStaff(st, id);
      if (!s || !sim.hasTrait(s, traitId)) return;
      var isP = producerId && s.id === producerId;
      var v = isP ? (t[producerKey] || 0) : (t[memberKey] || 0);
      if (v > best) best = v;
    });
    return best;
  };

  sim.drawTraits = function (st, config) {
    var ids = sim.traitIds(config);
    var m = (config.staff && config.staff.talentMarket) || {};
    var maxN = m.maxTraits != null ? m.maxTraits : 2;
    var weights = m.traitCountWeights || {};
    var countItems = [];
    var n;
    for (n = 0; n <= maxN; n++) {
      countItems.push({
        n: n,
        weight: weights[String(n)] != null ? weights[String(n)] : (n === 0 ? 1 : 0)
      });
    }
    var picked = sim.pickWeighted(st, countItems);
    var count = picked ? picked.n : 0;
    if (count > ids.length) count = ids.length;
    var pool = ids.map(function (id) {
      var t = config.traits[id];
      return { id: id, weight: t && t.hireWeight != null ? t.hireWeight : 1 };
    });
    var out = [];
    var i, choice;
    for (i = 0; i < count; i++) {
      if (!pool.length) break;
      choice = sim.pickWeighted(st, pool);
      if (!choice) break;
      out.push(choice.id);
      pool = pool.filter(function (x) { return x.id !== choice.id; });
    }
    return out;
  };

  sim.traitName = function (id, config) {
    var t = sim.traitDef(id, config);
    if (t && t.displayName) return t.displayName;
    return id === "sparkOfInspiration" ? "灵光一闪" : (id === "meticulous" ? "一丝不苟" : id);
  };

  sim.traitSummaryLine = function (s, config) {
    return (s.traits || []).map(function (id) {
      var t = sim.traitDef(id, config);
      if (!t) return "";
      return t.summary ? (t.displayName + "：" + t.summary) : t.displayName;
    }).filter(Boolean).join(" ");
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
