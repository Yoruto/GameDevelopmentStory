(function (root) {
  var sim = root.GDS.sim;

  function emptyMonths() {
    var months = {};
    var m;
    for (m = 1; m <= 12; m++) months[m] = [];
    return months;
  }

  function calendarCfg(config) {
    return (config.world && config.world.rivals && config.world.rivals.calendar) || {};
  }

  function eventRivalRelease(ev) {
    if (!ev) return null;
    if (ev.rivalRelease) return ev.rivalRelease;
    if (ev.effects && ev.effects.rivalRelease) return ev.effects.rivalRelease;
    return null;
  }

  function planKey(plan) {
    return (plan.publisherId || "") + "\0" + (plan.title || plan.series || "");
  }

  function monthList(cal, month) {
    if (!cal || !cal.months) return [];
    if (!cal.months[month]) cal.months[month] = [];
    return cal.months[month];
  }

  sim.emptyRivalCalendarMonths = emptyMonths;

  sim.ensureRivals = function (st, config) {
    if (!st.rivalWait) st.rivalWait = {};
    if (!st.rivalSequel) st.rivalSequel = {};
    if (!st.rivalWindow) st.rivalWindow = [];
    if (!st.rivalMonth) st.rivalMonth = [];
    if (!st.rivalLifetimeByPlatform) st.rivalLifetimeByPlatform = {};
    if (!st.rivalForceSeries) st.rivalForceSeries = {};
    if (!st.rivalPlan) st.rivalPlan = {};
    if (!st.rivalReleased) st.rivalReleased = [];
    if (!st.rivalCalendarHold) st.rivalCalendarHold = [];
    (config.content.platforms || []).forEach(function (p) {
      if (st.rivalLifetimeByPlatform[p.id] == null) st.rivalLifetimeByPlatform[p.id] = 0;
    });
    (config.world.rivals.publishers || []).forEach(function (pub) {
      if (st.rivalWait[pub.id] == null) {
        st.rivalWait[pub.id] = 0;
        st.rivalPlan[pub.id] = sim.planFromWait(st, 0);
      }
    });
  };

  sim.pickRivalPlatform = function (st, pub, config) {
    var plats = config.content.platforms || [];
    var weights = (pub && pub.platformWeights) || (config.world.rivals.defaultPlatformWeights) || {};
    var total = 0;
    var i, w;
    for (i = 0; i < plats.length; i++) {
      w = weights[plats[i].id];
      total += w == null ? 1 : Math.max(0, w);
    }
    if (!plats.length) return "pc";
    if (total <= 0) return plats[0].id;
    var r = sim.rand(st) * total;
    var acc = 0;
    for (i = 0; i < plats.length; i++) {
      w = weights[plats[i].id];
      acc += w == null ? 1 : Math.max(0, w);
      if (r < acc) return plats[i].id;
    }
    return plats[plats.length - 1].id;
  };

  sim.planFromWait = function (st, wait) {
    var m = st.month + Math.max(0, wait);
    var y = st.year;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return { year: y, month: m, wait: wait };
  };

  sim.makeRivalCalendarPlan = function (spec) {
    spec = spec || {};
    return {
      id: spec.id || ("rc-" + (spec.plannedYear || 0) + "-" + (spec.plannedMonth || 0) + "-" + (spec.publisherId || "") + "-" + (spec.title || spec.series || "")),
      publisherId: spec.publisherId || "",
      publisher: spec.publisher || spec.publisherName || spec.publisherId || "",
      title: spec.title || spec.series || "",
      series: spec.series || spec.title || "",
      platformId: spec.platformId || "pc",
      genreId: spec.genreId || "",
      gameplayId: spec.gameplayId || "",
      plannedYear: spec.plannedYear,
      plannedMonth: spec.plannedMonth,
      originalYear: spec.originalYear != null ? spec.originalYear : spec.plannedYear,
      originalMonth: spec.originalMonth != null ? spec.originalMonth : spec.plannedMonth,
      status: spec.status || "planned",
      historical: !!spec.historical,
      live: !!spec.live,
      avg: spec.avg,
      sales: spec.sales,
      mau: spec.mau || 0,
      keep: !!spec.keep,
      movedToYear: spec.movedToYear,
      movedToMonth: spec.movedToMonth
    };
  };

  sim.historicalCalendarPlans = function (year, config) {
    var out = [];
    (config.world.historicalEvents || []).forEach(function (ev) {
      var rel = eventRivalRelease(ev);
      if (!rel) return;
      if (ev.year !== year || ev.month == null) return;
      out.push(sim.makeRivalCalendarPlan({
        id: "hist-" + ev.id,
        publisherId: rel.publisherId || "",
        publisher: rel.publisherName || rel.publisherId || "",
        title: rel.title || rel.series || "",
        series: rel.series || rel.title || "",
        platformId: rel.platformId || "pc",
        genreId: rel.genreId || "",
        gameplayId: rel.gameplayId || "",
        plannedYear: year,
        plannedMonth: ev.month,
        status: "planned",
        historical: true,
        live: !!rel.live,
        avg: rel.avg,
        sales: rel.sales,
        mau: rel.mau || 0,
        keep: rel.keep != null ? !!rel.keep : true
      }));
    });
    return out;
  };

  sim.getRivalCalendar = function (st, year) {
    var months = emptyMonths();
    var cal = st && st.rivalCalendar;
    if (cal && cal.year === year && cal.months) {
      var m;
      for (m = 1; m <= 12; m++) {
        months[m] = (cal.months[m] || []).slice();
      }
    }
    return { year: year, months: months };
  };

  sim.syncRivalWaitFromCalendar = function (st, config) {
    sim.ensureRivals(st, config);
    var cal = st.rivalCalendar;
    (config.world.rivals.publishers || []).forEach(function (pub) {
      var wait = 0;
      var found = null;
      if (cal && cal.year === st.year) {
        var m;
        for (m = st.month; m <= 12; m++) {
          var list = cal.months[m] || [];
          var i;
          for (i = 0; i < list.length; i++) {
            if (list[i].publisherId === pub.id && list[i].status === "planned") {
              found = list[i];
              wait = m - st.month;
              break;
            }
          }
          if (found) break;
        }
      }
      (st.rivalCalendarHold || []).forEach(function (hold) {
        if (hold.publisherId !== pub.id) return;
        if (hold.status && hold.status !== "planned") return;
        var delta = (hold.plannedYear - st.year) * 12 + (hold.plannedMonth - st.month);
        if (delta < 0) return;
        if (!found || delta < wait) {
          found = hold;
          wait = delta;
        }
      });
      st.rivalWait[pub.id] = wait;
      st.rivalPlan[pub.id] = sim.planFromWait(st, wait);
    });
  };

  function monthHasKey(list, key) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].status === "moved") continue;
      if (planKey(list[i]) === key) return true;
    }
    return false;
  }

  function takeHoldsForYear(st, year) {
    var kept = [];
    var taken = [];
    (st.rivalCalendarHold || []).forEach(function (hold) {
      if (hold.plannedYear === year) taken.push(hold);
      else kept.push(hold);
    });
    st.rivalCalendarHold = kept;
    return taken;
  }

  sim.generateRivalCalendarYear = function (st, year, config) {
    sim.ensureRivals(st, config);
    var cfg = calendarCfg(config);
    var months = emptyMonths();
    var used = {};
    function place(plan, month) {
      if (!plan || month < 1 || month > 12) return;
      plan.plannedYear = year;
      plan.plannedMonth = month;
      if (plan.originalYear == null) plan.originalYear = year;
      if (plan.originalMonth == null) plan.originalMonth = month;
      if (plan.status !== "moved") plan.status = plan.status || "planned";
      var key = planKey(plan);
      if (plan.status !== "moved") {
        if (used[key]) return;
        used[key] = true;
      }
      months[month].push(plan);
    }

    takeHoldsForYear(st, year).forEach(function (hold) {
      place(hold, hold.plannedMonth);
    });

    sim.historicalCalendarPlans(year, config).forEach(function (plan) {
      place(plan, plan.plannedMonth);
    });

    var pubs = (config.world.rivals.publishers || []).filter(function (p) {
      return p.series && p.series.length;
    });
    var minPer = cfg.minPerMonth == null ? 0 : cfg.minPerMonth;
    var maxPer = cfg.maxPerMonth == null ? 3 : cfg.maxPerMonth;
    var minYear = cfg.minYearTotal == null ? 8 : cfg.minYearTotal;
    var maxYear = cfg.maxYearTotal == null ? 16 : cfg.maxYearTotal;
    if (maxYear < minYear) maxYear = minYear;

    function plannedCount() {
      var n = 0;
      var m, i;
      for (m = 1; m <= 12; m++) {
        for (i = 0; i < months[m].length; i++) {
          if (months[m][i].status !== "moved") n += 1;
        }
      }
      return n;
    }

    var target = sim.irand(st, minYear, maxYear);
    if (target < plannedCount()) target = plannedCount();

    function eligibleMonths() {
      var list = [];
      var m;
      for (m = 1; m <= 12; m++) {
        var n = 0;
        var i;
        for (i = 0; i < months[m].length; i++) {
          if (months[m][i].status !== "moved") n += 1;
        }
        if (n < maxPer) list.push(m);
      }
      return list;
    }

    var guard = 0;
    while (plannedCount() < target && pubs.length) {
      guard += 1;
      if (guard > 96) break;
      var open = eligibleMonths();
      if (!open.length) break;
      var month = sim.pick(st, open);
      var pub = sim.pick(st, pubs);
      var series = sim.pick(st, pub.series);
      var candidate = sim.makeRivalCalendarPlan({
        id: "rc-" + year + "-" + month + "-" + pub.id + "-" + st.rngCount,
        publisherId: pub.id,
        publisher: pub.name,
        title: series.name,
        series: series.name,
        platformId: sim.pickRivalPlatform(st, pub, config),
        genreId: series.genreId || "",
        gameplayId: series.gameplayId || "",
        plannedYear: year,
        plannedMonth: month,
        status: "planned",
        live: !!series.live
      });
      if (used[planKey(candidate)] || monthHasKey(months[month], planKey(candidate))) continue;
      place(candidate, month);
    }

    if (minPer > 0) {
      var m;
      for (m = 1; m <= 12; m++) {
        while (pubs.length) {
          var liveN = 0;
          var i;
          for (i = 0; i < months[m].length; i++) {
            if (months[m][i].status !== "moved") liveN += 1;
          }
          if (liveN >= minPer) break;
          if (liveN >= maxPer) break;
          var pub2 = sim.pick(st, pubs);
          var series2 = sim.pick(st, pub2.series);
          var extra = sim.makeRivalCalendarPlan({
            id: "rc-min-" + year + "-" + m + "-" + pub2.id + "-" + st.rngCount,
            publisherId: pub2.id,
            publisher: pub2.name,
            title: series2.name,
            series: series2.name,
            platformId: sim.pickRivalPlatform(st, pub2, config),
            genreId: series2.genreId || "",
            gameplayId: series2.gameplayId || "",
            plannedYear: year,
            plannedMonth: m,
            status: "planned",
            live: !!series2.live
          });
          if (monthHasKey(months[m], planKey(extra))) break;
          place(extra, m);
        }
      }
    }

    st.rivalCalendar = { year: year, months: months };
    var keep = cfg.keepYears == null ? 1 : cfg.keepYears;
    if (keep <= 1) st.rivalCalendarPrev = null;
    sim.syncRivalWaitFromCalendar(st, config);
    return st.rivalCalendar;
  };

  sim.ensureRivalCalendar = function (st, config) {
    sim.ensureRivals(st, config);
    if (!st.rivalCalendar || st.rivalCalendar.year !== st.year) {
      sim.generateRivalCalendarYear(st, st.year, config);
    }
    return st.rivalCalendar;
  };

  function clonePlan(plan) {
    return sim.makeRivalCalendarPlan(plan);
  }

  function findAdvancePlan(st, publisherId, seriesName) {
    var cal = st.rivalCalendar;
    if (!cal || !cal.months) return null;
    var seriesHit = null;
    var anyHit = null;
    var m, i, plan;
    for (m = st.month; m <= 12; m++) {
      var list = cal.months[m] || [];
      for (i = 0; i < list.length; i++) {
        plan = list[i];
        if (plan.publisherId !== publisherId) continue;
        if (plan.status !== "planned") continue;
        if (!anyHit) anyHit = plan;
        if (seriesName && (plan.series === seriesName || plan.title === seriesName) && !seriesHit) {
          seriesHit = plan;
        }
      }
    }
    return seriesHit || (seriesName ? null : anyHit);
  }

  sim.placeRivalCalendarPlan = function (st, plan, year, month, config) {
    plan.plannedYear = year;
    plan.plannedMonth = month;
    plan.status = "planned";
    if (st.rivalCalendar && st.rivalCalendar.year === year) {
      monthList(st.rivalCalendar, month).push(plan);
      sim.syncRivalWaitFromCalendar(st, config);
      return;
    }
    st.rivalCalendarHold = st.rivalCalendarHold || [];
    st.rivalCalendarHold.push(plan);
    sim.syncRivalWaitFromCalendar(st, config);
  };

  sim.advanceRivalToNextMonth = function (st, spec, config) {
    sim.ensureRivals(st, config);
    sim.ensureRivalCalendar(st, config);
    spec = spec || {};
    var pubs = config.world.rivals.publishers || [];
    var pub = spec.publisherId ? sim.findById(pubs, spec.publisherId) : null;
    if (!pub) {
      var i;
      for (i = 0; i < pubs.length; i++) {
        if ((st.rivalWait[pubs[i].id] || 0) > 1) { pub = pubs[i]; break; }
      }
      if (!pub) pub = pubs[0];
    }
    if (!pub) return;
    st.rivalWait[pub.id] = 1;
    st.rivalPlan[pub.id] = sim.planFromWait(st, 1);
    if (spec.seriesName) st.rivalForceSeries[pub.id] = spec.seriesName;

    var nextM = st.month + 1;
    var nextY = st.year;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }

    var existing = findAdvancePlan(st, pub.id, spec.seriesName);
    var moving = null;
    if (existing) {
      existing.status = "moved";
      existing.movedToYear = nextY;
      existing.movedToMonth = nextM;
      moving = clonePlan(existing);
      moving.status = "planned";
      moving.movedToYear = null;
      moving.movedToMonth = null;
      moving.originalYear = existing.originalYear != null ? existing.originalYear : existing.plannedYear;
      moving.originalMonth = existing.originalMonth != null ? existing.originalMonth : existing.plannedMonth;
      moving.id = existing.id + "-to-" + nextY + "-" + nextM;
    } else {
      var series = null;
      if (spec.seriesName) {
        var s;
        for (s = 0; s < (pub.series || []).length; s++) {
          if (pub.series[s].name === spec.seriesName) series = pub.series[s];
        }
      }
      if (!series) series = sim.pick(st, pub.series) || { name: spec.seriesName || pub.name };
      moving = sim.makeRivalCalendarPlan({
        id: "adv-" + pub.id + "-" + nextY + "-" + nextM + "-" + st.rngCount,
        publisherId: pub.id,
        publisher: pub.name,
        title: series.name,
        series: series.name,
        platformId: sim.pickRivalPlatform(st, pub, config),
        genreId: series.genreId || "",
        gameplayId: series.gameplayId || "",
        plannedYear: nextY,
        plannedMonth: nextM,
        originalYear: st.year,
        originalMonth: st.month,
        status: "planned",
        live: !!series.live
      });
    }
    sim.placeRivalCalendarPlan(st, moving, nextY, nextM, config);
  };

  sim.setRivalMau = function (st, spec) {
    if (!spec || !spec.title) return;
    var rec = sim.findRivalTitle(st, spec.title);
    if (!rec) return;
    rec.mau = spec.mau;
    if (spec.salesDelta) {
      rec.sales = (rec.sales || 0) + spec.salesDelta;
      rec.lifetimeSales = (rec.lifetimeSales || rec.sales);
    }
    sim.keepRivalHit(st, rec);
  };

  function markCalendarShipped(st, rec) {
    var cal = st.rivalCalendar;
    if (!cal || cal.year !== st.year || !rec) return;
    var list = cal.months[st.month] || [];
    var i, p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (p.status === "moved") continue;
      if (p.title === rec.title || p.series === rec.series || p.title === rec.series || p.series === rec.title) {
        p.status = "shipped";
        p.releasedYear = st.year;
        p.releasedMonth = st.month;
      }
    }
  }

  sim.forceRivalRelease = function (st, spec, config) {
    sim.ensureRivals(st, config);
    spec = spec || {};
    var title = spec.title || spec.series || "";
    var existing = title ? sim.findRivalTitle(st, title) : null;
    if (existing && existing.releasedYear === st.year && existing.releasedMonth === st.month) {
      markCalendarShipped(st, existing);
      return existing;
    }
    var ship = config.world.rivals.shipping;
    var avg = spec.avg != null ? spec.avg : ship.avgBase;
    var qsum = spec.qsum != null ? spec.qsum : Math.round(avg * ship.qsumAvgCoeff);
    var sales = spec.sales != null ? spec.sales : ship.salesPower2[0];
    var rec = {
      pubId: spec.publisherId || "",
      pub: spec.publisherName || spec.publisherId || "",
      series: spec.series || spec.title || "",
      title: spec.title || spec.series || "",
      genreId: spec.genreId || "",
      gameplayId: spec.gameplayId || "",
      platformId: spec.platformId || "pc",
      avg: avg,
      qsum: qsum,
      script: spec.script != null ? spec.script : Math.round(avg * 10),
      art: spec.art != null ? spec.art : Math.round(avg * 10),
      sales: sales,
      lifetimeSales: sales,
      baselineSales: spec.live ? 0 : sales,
      launchSales: sales,
      onSale: !spec.live,
      monthSales: spec.live ? 0 : sales,
      monthSalesForYear: spec.live ? null : st.year,
      monthSalesForMonth: spec.live ? null : st.month,
      live: !!spec.live,
      livePeak: spec.livePeak != null ? spec.livePeak : (spec.live ? Math.round(sales * ship.livePeakRateMin) : 0),
      versionMajor: spec.live ? ((config.liveOps && config.liveOps.versions && config.liveOps.versions.startMajor) || 1) : 0,
      versionMinor: spec.live ? 0 : 0,
      mau: spec.mau || 0,
      keep: !!spec.keep,
      releasedYear: st.year,
      releasedMonth: st.month
    };
    st.rivalLifetimeByPlatform[rec.platformId] = (st.rivalLifetimeByPlatform[rec.platformId] || 0) + sales;
    st.rivalMonth.push(rec);
    st.rivalWindow.push(rec);
    if (!rec.live) sim.keepRivalOnSale(st, rec);
    else sim.keepRivalHit(st, rec);
    markCalendarShipped(st, rec);
    return rec;
  };

  sim.pickRivalSeries = function (st, pub) {
    var forced = st.rivalForceSeries && st.rivalForceSeries[pub.id];
    if (forced) {
      var i;
      for (i = 0; i < (pub.series || []).length; i++) {
        if (pub.series[i].name === forced) {
          st.rivalForceSeries[pub.id] = null;
          return pub.series[i];
        }
      }
      st.rivalForceSeries[pub.id] = null;
    }
    return sim.pick(st, pub.series);
  };

  function alreadyOutThisMonth(st, plan) {
    var list = st.rivalMonth || [];
    var i, g;
    for (i = 0; i < list.length; i++) {
      g = list[i];
      if (plan.title && (g.title === plan.title || g.series === plan.title)) return g;
      if (plan.series && (g.series === plan.series || g.title === plan.series)) return g;
    }
    return null;
  }

  function shipFromPlan(st, plan, pub, config) {
    var ship = config.world.rivals.shipping;
    var series = {
      name: plan.series || plan.title,
      genreId: plan.genreId,
      gameplayId: plan.gameplayId,
      live: plan.live
    };
    if (pub) {
      var picked = null;
      var i;
      for (i = 0; i < (pub.series || []).length; i++) {
        if (pub.series[i].name === plan.series || pub.series[i].name === plan.title) {
          picked = pub.series[i];
          break;
        }
      }
      if (picked) series = picked;
    }
    var avg = plan.avg != null
      ? plan.avg
      : Math.round((ship.avgBase + ((pub && pub.power) || 1) * ship.avgPowerCoeff + sim.rand(st) * ship.avgRandSpan) * 10) / 10;
    if (avg > ship.avgMax) avg = ship.avgMax;
    if (avg < ship.avgMin) avg = ship.avgMin;
    var qsum = Math.round(avg * ship.qsumAvgCoeff + sim.irand(st, ship.qsumJitter[0], ship.qsumJitter[1]));
    var power = (pub && pub.power) || 1;
    var band = power >= 3 ? ship.salesPower3 : (power >= 2 ? ship.salesPower2 : ship.salesPower1);
    var base = plan.sales != null ? plan.sales : sim.irand(st, band[0], band[1]);
    var sales = plan.sales != null ? plan.sales : Math.round(base * (avg / ship.salesAvgDivisor));
    if (sim.matchesTrend(series, st.trend) || sim.matchesTrend(plan, st.trend)) {
      sales = Math.round(sales * config.release.trendSalesMultiplier);
    }
    var live = !!series.live || !!plan.live;
    var rec = {
      pubId: plan.publisherId || (pub && pub.id) || "",
      pub: plan.publisher || (pub && pub.name) || "",
      series: plan.series || series.name,
      title: plan.title || series.name,
      genreId: plan.genreId || series.genreId || "",
      gameplayId: plan.gameplayId || series.gameplayId || "",
      platformId: plan.platformId || "pc",
      avg: avg,
      qsum: qsum,
      script: Math.round(avg * 10 + sim.irand(st, ship.statJitter[0], ship.statJitter[1])),
      art: Math.round(avg * 10 + sim.irand(st, ship.statJitter[0], ship.statJitter[1])),
      sales: sales,
      lifetimeSales: sales,
      baselineSales: live ? 0 : sales,
      launchSales: sales,
      onSale: !live,
      monthSales: live ? 0 : sales,
      monthSalesForYear: live ? null : st.year,
      monthSalesForMonth: live ? null : st.month,
      live: live,
      livePeak: live ? Math.round(sales * (ship.livePeakRateMin + sim.rand(st) * ship.livePeakRateSpan)) : 0,
      versionMajor: live ? ((config.liveOps && config.liveOps.versions && config.liveOps.versions.startMajor) || 1) : 0,
      versionMinor: live ? 0 : 0,
      mau: plan.mau || 0,
      keep: !!plan.keep,
      releasedYear: st.year,
      releasedMonth: st.month
    };
    st.rivalLifetimeByPlatform[rec.platformId] = (st.rivalLifetimeByPlatform[rec.platformId] || 0) + sales;
    st.rivalMonth.push(rec);
    st.rivalWindow.push(rec);
    if (!rec.live) sim.keepRivalOnSale(st, rec);
    else sim.keepRivalHit(st, rec);
    if (pub) {
      if (!st.rivalSequel[pub.id]) st.rivalSequel[pub.id] = {};
      st.rivalSequel[pub.id][series.name] = (st.rivalSequel[pub.id][series.name] || 0) + 1;
    }
    return rec;
  }

  sim.shipRivals = function (st, config) {
    sim.ensureRivalCalendar(st, config);
    if (!st.rivalMonth) st.rivalMonth = [];
    var cap = config.world.rivals.monthlyShipCap;
    if (cap == null) cap = 4;
    var plans = ((st.rivalCalendar && st.rivalCalendar.months) || {})[st.month] || [];
    var shipped = [];
    var i, plan, rec, existing, pub;
    for (i = 0; i < plans.length; i++) {
      plan = plans[i];
      if (plan.status !== "planned") continue;
      existing = alreadyOutThisMonth(st, plan);
      if (existing) {
        plan.status = "shipped";
        plan.releasedYear = st.year;
        plan.releasedMonth = st.month;
        continue;
      }
      if (shipped.length >= cap && !plan.historical) continue;
      pub = sim.findById(config.world.rivals.publishers || [], plan.publisherId);
      rec = shipFromPlan(st, plan, pub, config);
      plan.status = "shipped";
      plan.releasedYear = st.year;
      plan.releasedMonth = st.month;
      shipped.push(rec);
    }
    st.rivalWindow = st.rivalWindow.filter(function (g) {
      return g.releasedYear > st.year - 1 || (g.releasedYear === st.year - 1 && g.releasedMonth >= 12) || g.releasedYear === st.year;
    });
    sim.syncRivalWaitFromCalendar(st, config);
    return shipped;
  };

  sim.rivalLabel = function (g) {
    return g.series + " · " + g.pub;
  };

  sim.calendarPlanLabel = function (plan) {
    var pub = plan.publisher || plan.publisherId || "";
    var title = plan.title || plan.series || "";
    return pub + "《" + title + "》";
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
