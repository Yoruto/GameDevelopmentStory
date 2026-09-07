(function (root) {
  var sim = root.GDS.sim;
  var DIMS = ["program", "script", "art", "music"];

  function refreshTrend(st, config, notes) {
    var trend = sim.trendCfg(config);
    st.trendWait = (st.trendWait || 0) + 1;
    if (st.trend && st.trend.monthsLeft > 0) st.trend.monthsLeft -= 1;
    if (!st.trend || st.trend.monthsLeft <= 0) {
      if (st.trendWait >= trend.refreshIntervalMonths) {
        var ug = sim.unlocked(config.content.genres, st.year);
        st.trend = { genreId: sim.pick(st, ug).id, gameplayId: null, monthsLeft: trend.durationMonths };
        st.trendWait = 0;
        notes.push("潮流：" + sim.trendName(st.trend, config));
      } else st.trend = null;
    }
  }

  function settleLiveOpsMonth(st, g, config, notes, mediaPacks) {
    var ms = (g.liveOps.maintainerIds || []).filter(function (id) { return !!sim.findStaff(st, id); });
    var rev, shipped;
    g.liveOps.maintainerIds = ms;
    if (ms.length < (config.liveOps.minMaintainStaff || 1)) {
      sim.shutdownLive(st, g, config, notes);
      return;
    }
    rev = sim.liveOpsRevenue(g, config, st);
    if (sim.applyLiveOpsVersion) {
      shipped = sim.applyLiveOpsVersion(st, g, config, notes, mediaPacks, rev);
      if (shipped && shipped.rev != null) rev = shipped.rev;
    }
    st.company.funds += rev;
    st.company.funds -= config.liveOps.monthlyCost;
    st.monthSales += rev;
    g.monthSales = rev;
    sim.stampMonthSales(g, st);
    g.liveOps.monthsLive += 1;
    if (rev > (g.liveOps.peak || 0)) g.liveOps.peak = rev;
    notes.push(g.title + "长线 +" + rev + " / 开支 -" + config.liveOps.monthlyCost);
  }

  sim.tickMonth = function (state, config) {
    if (state && state.mode === "career") return sim.tickCareerMonth(state, config);
    var st = sim.clone(state);
    sim.ensureGameExtras(st);
    var notes = [];
    var mediaPacks = [];
    var awardPack = null;
    var queue = [];
    st.monthSales = 0;
    st.rivalMonth = [];
    sim.ensureRivalCalendar(st, config);

    st.projects.forEach(function (p) {
      sim.advanceProjectMonth(st, p, config, notes);
    });
    st.released.forEach(function (g) {
      if (g.liveOps && g.liveOps.active) {
        var keepers = (g.liveOps.maintainerIds || []).map(function (id) { return sim.findStaff(st, id); }).filter(Boolean);
        keepers.forEach(function (s) {
          var extra = 0;
          (s.traits || []).forEach(function (id) {
            var t = sim.traitDef(id, config);
            if (t && t.expBonusLive) extra += t.expBonusLive;
          });
          sim.addExp(st, s, config.staff.experience.expPerLiveOpsMonth + extra, config);
          var dim = sim.pick(st, DIMS);
          g.stats[dim] += 1;
        });
      }
    });

    refreshTrend(st, config, notes);
    var monthEvents = sim.runMonthEvents(st, config, notes);
    var rivalShips = sim.shipRivals(st, config);
    (monthEvents.ships || []).forEach(function (g) {
      var dup = rivalShips.some(function (x) {
        return x.title === g.title && x.pubId === g.pubId;
      });
      if (!dup) rivalShips.push(g);
    });
    if (rivalShips.length) {
      notes.push("对手上线 " + rivalShips.length + " 部：" + rivalShips.slice(0, 2).map(function (g) {
        return g.pub + "《" + g.series + "》";
      }).join("、") + (rivalShips.length > 2 ? "等" : ""));
    }

    var finished = st.projects.filter(function (p) { return p.monthsLeft <= 0; });
    st.projects = st.projects.filter(function (p) { return p.monthsLeft > 0; });
    var outsourcePacks = [];
    var readyPacks = [];
    finished.forEach(function (p) {
      if (p.releaseType === "outsource") {
        outsourcePacks.push(sim.releaseProject(st, p, config, notes));
      } else {
        readyPacks.push(sim.parkReadyToShip(st, p, config, notes));
      }
    });

    st.released.forEach(function (g) {
      sim.tickLifecycle(st, g, config);
      if (g.liveOps && g.liveOps.active) settleLiveOpsMonth(st, g, config, notes, mediaPacks);
    });
    (st.rivalReleased || []).forEach(function (g) {
      sim.tickRivalLifecycle(st, g, config);
      if (sim.applyLiveOpsVersion) sim.applyLiveOpsVersion(st, g, config, notes, null);
    });
    sim.applyChartDropOff(st, config, notes);

    var pay = 0;
    st.staff.forEach(function (s) {
      s.monthsEmployed = (s.monthsEmployed || 0) + 1;
      pay += s.salary;
    });
    st.company.funds -= pay;
    notes.push("发薪 -" + pay);
    if (st.company.funds < 0) {
      st.phase = "BANKRUPT";
      notes.push("资金为负，破产");
    }

    if (st.phase === "PLAYING" && st.month === (config.awards.month || 11)) {
      awardPack = sim.runAwards(st, config, notes);
    }

    sim.refreshMarket(st, config, true);

    st.month += 1;
    if (st.month > 12) {
      st.month = 1;
      st.year += 1;
      st.staff.forEach(function (s) {
        s.salary = Math.round(s.salary * (1 + config.staff.salary.annualRaiseRate));
      });
      notes.push("新年，全员调薪");
    }
    sim.ensureRivalCalendar(st, config);
    var cal = config.calendar;
    if (st.phase === "PLAYING" && (st.year > cal.endYear || (st.year === cal.endYear && st.month > cal.endMonth))) {
      st.phase = "SETTLED";
    }
    st.lastMedia = mediaPacks[mediaPacks.length - 1] || st.lastMedia;
    st = sim.syncOwnConsole(st, config);

    queue.push({
      type: "notes",
      kind: "info",
      kicker: "过月",
      title: "日历翻了一页",
      body: notes.join("；") || "这个月没有额外动静。"
    });
    (monthEvents.fired || []).forEach(function (item) {
      queue.push(sim.eventQueueItem(item.ev, item.fx, config));
    });
    if (rivalShips.length) {
      queue.push({
        type: "rivals",
        kind: "info",
        kicker: "对手",
        title: "本月大厂上线",
        body: rivalShips.map(function (g) {
          return g.pub + "《" + g.series + "》" +
            (g.platformId ? sim.contentName(config.content.platforms, g.platformId) + " · " : "") +
            (g.genreId ? sim.contentName(config.content.genres, g.genreId) : "") + "/" +
            (g.gameplayId ? sim.contentName(config.content.gameplay, g.gameplayId) : "") + " " + g.avg;
        }).join("；")
      });
    }
    readyPacks.forEach(function (p) {
      var copy = config.copy || {};
      queue.push({
        type: "ready",
        kind: "info",
        kicker: copy.readyQueueKicker || "制作完成",
        title: p.title,
        body: "《" + p.title + "》" + (copy.readyQueueBody || "制作完成，尚未发布")
      });
    });
    outsourcePacks.forEach(function (rec) {
      var copy = config.copy || {};
      queue.push({
        type: "outsource",
        kind: "info",
        kicker: copy.outsourceQueueKicker || "外包交付",
        title: rec.title,
        body: (copy.outsourceQueueBody || "外包交付 +经验 +外包费") + " " + rec.outsourceFee,
        rec: rec
      });
    });
    mediaPacks.forEach(function (rec) {
      queue.push({
        type: "media",
        kind: "info",
        kicker: "发售",
        title: "媒体评分 · " + rec.title,
        body: "均分 " + rec.avg + "，基准 " + (rec.baselineSales || 0) + "，本月实销 " + (rec.monthSales || rec.launchSales),
        rec: rec
      });
    });
    if (awardPack) {
      queue.push({
        type: "awards",
        kind: "event",
        kicker: "年度盛典",
        title: "颁奖夜",
        body: "参选窗口：去年 12 月～今年 11 月。奖杯抬粉丝和荣誉，不发真奖品。",
        awards: awardPack
      });
    }

    return { state: st, queue: queue };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
