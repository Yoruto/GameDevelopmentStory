(function (root) {
  var sim = root.GDS.sim;
  var DIMS = ["program", "script", "art", "music"];

  sim.advanceProjectMonth = function (st, p, config, notes) {
    var spark = config.traits.sparkOfInspiration;
    var meti = config.traits.meticulous;
    var team = p.memberIds.map(function (id) { return sim.findStaff(st, id); }).filter(Boolean);
    DIMS.forEach(function (dim) {
      team.forEach(function (s) {
        var isP = s.id === p.producerId;
        var minR = 1;
        if ((s.traits || []).indexOf("meticulous") >= 0) minR += isP ? meti.producerMinRollBonus : meti.memberMinRollBonus;
        var hi = Math.max(minR, s[dim] || 1);
        var roll = sim.irand(st, Math.min(minR, hi), hi);
        p.stats[dim] += Math.ceil(roll / p.totalMonths);
        if ((s.traits || []).indexOf("sparkOfInspiration") >= 0) {
          if (sim.rand(st) < (isP ? spark.producerTriggerRate : spark.memberTriggerRate)) {
            p.stats[dim] += isP ? spark.producerDimBonus : spark.memberDimBonus;
            notes.push(s.n + "灵感月，" + dim + "多跳一截");
          }
        }
      });
    });
    var expAmt = config.staff.experience.expPerDevelopmentMonth;
    if (p.releaseType === "outsource" && config.outsource && config.outsource.expPerDevelopmentMonth != null) {
      expAmt = config.outsource.expPerDevelopmentMonth;
    }
    team.forEach(function (s) { sim.addExp(st, s, expAmt, config); });
    p.monthsLeft -= 1;
  };

  sim.outsourceFee = function (stats, config) {
    var o = config.outsource || {};
    var q = (stats.program || 0) + (stats.script || 0) + (stats.art || 0) + (stats.music || 0);
    var fee = Math.round((o.feeBase || 0) + q * (o.feePerQualitySum || 0));
    if (o.feeMin != null && fee < o.feeMin) fee = o.feeMin;
    if (o.feeMax != null && fee > o.feeMax) fee = o.feeMax;
    return fee;
  };

  sim.releaseOutsource = function (st, p, config, notes) {
    var fee = sim.outsourceFee(p.stats, config);
    st.company.funds += fee;
    var rec = {
      id: p.id,
      title: p.title,
      genreId: p.genreId,
      gameplayId: p.gameplayId,
      platformId: p.platformId,
      releaseType: "outsource",
      producerId: p.producerId,
      memberIds: p.memberIds.slice(),
      releasedYear: st.year,
      releasedMonth: st.month,
      stats: p.stats,
      media: null,
      avg: 0,
      baselineSales: 0,
      launchSales: 0,
      lifetimeSales: 0,
      outsourceFee: fee,
      onSale: false,
      monthSales: 0,
      tailLeft: 0,
      seriesId: null,
      liveOps: null
    };
    st.released.push(rec);
    p.memberIds.forEach(function (id) {
      var s = sim.findStaff(st, id);
      if (s) { s.status = "idle"; s.assignmentId = null; }
    });
    notes.push(p.title + "外包交付 经验已入账 外包费 +" + fee);
    return rec;
  };

  sim.releaseProject = function (st, p, config, notes) {
    if (p.releaseType === "outsource") return sim.releaseOutsource(st, p, config, notes);
    var team = p.memberIds.map(function (id) { return sim.findStaff(st, id); }).filter(Boolean);
    var media = sim.scoreMedia(st, p.stats, team, config);
    var formula = sim.boxedBaselineFormula(st, p, config, true);
    var boxed = p.releaseType === "boxed";
    var baseline = boxed ? formula : 0;
    var y1 = boxed ? sim.salesFactor(1, media.avg, config) : 1;
    var sales = boxed ? sim.boxedActualFromY({ baselineSales: baseline }, y1) : formula;
    st.company.funds += sales;
    st.monthSales += sales;
    if (media.avg >= config.staff.honor.highScoreThreshold) {
      team.forEach(function (s) {
        s.honor = (s.honor || 0) + config.staff.honor.fromHighScore;
        s.salary = sim.calcSalary(s, config);
      });
    }
    var rec = {
      id: p.id,
      title: p.title,
      genreId: p.genreId,
      gameplayId: p.gameplayId,
      platformId: p.platformId,
      releaseType: p.releaseType,
      producerId: p.producerId,
      memberIds: p.memberIds.slice(),
      releasedYear: st.year,
      releasedMonth: st.month,
      stats: p.stats,
      media: media,
      avg: media.avg,
      baselineSales: boxed ? baseline : 0,
      launchSales: sales,
      lifetimeSales: sales,
      onSale: boxed,
      monthSales: boxed ? sales : 0,
      monthSalesForYear: boxed ? st.year : null,
      monthSalesForMonth: boxed ? st.month : null,
      tailLeft: 0,
      seriesId: p.seriesId || null,
      liveOps: p.releaseType === "liveops"
        ? { active: true, maintainerIds: p.memberIds.slice(), monthsLive: 0, peak: 0 }
        : null
    };
    sim.maybeOpenSeries(st, rec, config, notes);
    st.released.push(rec);
    if (p.releaseType === "liveops") {
      var keepers = [];
      p.memberIds.forEach(function (id) {
        var person = sim.findStaff(st, id);
        if (person && (person.status === "idle" || person.assignmentId === rec.id || person.assignmentId === p.id)) {
          person.status = "liveops";
          person.assignmentId = rec.id;
          keepers.push(id);
        }
      });
      rec.liveOps.maintainerIds = keepers;
      notes.push(p.title + "转入长线维护");
    } else {
      p.memberIds.forEach(function (id) {
        var s = sim.findStaff(st, id);
        if (s) { s.status = "idle"; s.assignmentId = null; }
      });
    }
    notes.push(p.title + "发售 均分" + media.avg +
      (boxed ? (" 基准" + baseline + " 实销" + sales) : (" 首发" + sales)));
    return rec;
  };

  sim.parkReadyToShip = function (st, p, config, notes) {
    sim.ensureGameExtras(st);
    (p.memberIds || []).forEach(function (id) {
      var s = sim.findStaff(st, id);
      if (s) { s.status = "idle"; s.assignmentId = null; }
    });
    p.monthsLeft = 0;
    p.readyYear = st.year;
    p.readyMonth = st.month;
    st.readyToShip.push(p);
    var copy = config.copy || {};
    notes.push("《" + p.title + "》" + (copy.readyQueueBody || "制作完成，尚未发布"));
    return p;
  };

  sim.releaseGame = function (state, gameId, config) {
    if (!state || state.phase !== "PLAYING") return sim.fail(state, sim.ERR.RELEASE_NOT_PLAYING);
    var found = sim.findById(state.readyToShip || [], gameId);
    if (!found) return sim.fail(state, sim.ERR.RELEASE_NOT_FOUND);
    var st = sim.clone(state);
    sim.ensureGameExtras(st);
    var p = sim.findById(st.readyToShip, gameId);
    if (!p) return sim.fail(state, sim.ERR.RELEASE_NOT_FOUND);
    st.readyToShip = st.readyToShip.filter(function (x) { return x.id !== gameId; });
    var notes = [];
    var rec = sim.releaseProject(st, p, config, notes);
    st.lastMedia = rec;
    st = sim.syncOwnConsole(st, config);
    return { ok: true, state: st, rec: rec };
  };

  sim.applyLongTail = function (st, g, config) {
    return sim.tickLifecycle(st, g, config);
  };

  sim.pitchProject = function (state, input, config) {
    input = input || {};
    if (!state.staff.length) return sim.fail(state, sim.ERR.PITCH_NO_STAFF);
    var memberIds = (input.memberIds || []).slice();
    if (!memberIds.length) return sim.fail(state, sim.ERR.PITCH_NO_PRODUCER);
    var maxTeam = config.development.maxTeamSize || 5;
    if (memberIds.length > maxTeam) return sim.fail(state, sim.ERR.PITCH_TEAM_SIZE);
    var scale = config.company.scales[state.company.scale] || {};
    if (input.releaseType === "liveops" && !scale.unlockLiveOps) return sim.fail(state, sim.ERR.PITCH_LIVEOPS_SCALE);
    if (input.releaseType === "outsource") {
      var cap = (config.outsource && config.outsource.maxConcurrent) || 1;
      var running = 0;
      (state.projects || []).forEach(function (proj) {
        if (proj.releaseType === "outsource") running += 1;
      });
      if (running >= cap) return sim.fail(state, sim.ERR.PITCH_OUTSOURCE_CAP);
    }
    var i, s;
    for (i = 0; i < memberIds.length; i++) {
      s = sim.findStaff(state, memberIds[i]);
      if (!s || s.status !== "idle") return sim.fail(state, sim.ERR.PITCH_BUSY);
    }
    var plats = sim.platformsNow(state, config);
    if (!input.platformId || !sim.findById(plats, input.platformId)) return sim.fail(state, sim.ERR.PITCH_PLATFORM);
    var producerId = input.producerId || memberIds[0];
    if (memberIds.indexOf(producerId) < 0) producerId = memberIds[0];
    var producer = sim.findStaff(state, producerId);
    if (!producer) return sim.fail(state, sim.ERR.PITCH_NO_PRODUCER);
    var months = sim.cycleMonths(input.cycle || "medium", config, input.releaseType);
    var st = sim.clone(state);
    var proj = {
      id: "p" + st.rngCount,
      title: (input.title && String(input.title).replace(/^\s+|\s+$/g, "")) || "未命名游戏",
      genreId: input.genreId,
      gameplayId: input.gameplayId,
      platformId: input.platformId,
      releaseType: input.releaseType || "boxed",
      cycle: input.cycle || "medium",
      totalMonths: months,
      monthsLeft: months,
      producerId: producerId,
      memberIds: memberIds.slice(),
      studioId: input.studioId || (st.studios[0] && st.studios[0].id) || null,
      seriesId: input.releaseType === "outsource" ? null : (input.seriesId || null),
      stats: {
        program: producer.program,
        script: producer.script,
        art: producer.art,
        music: producer.music
      }
    };
    if (st.studios[0] && st.studios[0].leadId && memberIds.indexOf(st.studios[0].leadId) >= 0) {
      proj.producerId = st.studios[0].leadId;
      producer = sim.findStaff(st, proj.producerId);
      if (producer) {
        proj.stats = {
          program: producer.program,
          script: producer.script,
          art: producer.art,
          music: producer.music
        };
      }
    }
    memberIds.forEach(function (id) {
      var person = sim.findStaff(st, id);
      if (person) { person.status = "dev"; person.assignmentId = proj.id; }
    });
    st.projects.push(proj);
    return sim.ok(st);
  };

  sim.pitchOutsource = function (state, input, config) {
    input = input || {};
    return sim.pitchProject(state, {
      title: input.title,
      genreId: input.genreId,
      gameplayId: input.gameplayId,
      platformId: input.platformId,
      releaseType: "outsource",
      cycle: input.cycle,
      producerId: input.producerId,
      memberIds: input.memberIds,
      studioId: input.studioId
    }, config);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
