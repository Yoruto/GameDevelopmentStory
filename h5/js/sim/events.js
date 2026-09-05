(function (root) {
  var sim = root.GDS.sim;
  var DIMS = ["program", "script", "art", "music"];

  function inDevProjects(st) {
    return (st.projects || []).filter(function (p) { return p.monthsLeft > 0; });
  }

  function monthsBetween(y1, m1, y2, m2) {
    return (y2 * 12 + m2) - (y1 * 12 + m1);
  }

  sim.findEventDef = function (config, eventId) {
    var lists = [config.world.events, config.world.historicalEvents];
    var i, j, list;
    for (i = 0; i < lists.length; i++) {
      list = lists[i] || [];
      for (j = 0; j < list.length; j++) if (list[j].id === eventId) return list[j];
    }
    return null;
  };

  sim.eventEffects = function (src) {
    if (!src) return {};
    var e = {};
    var nested = src.effects || {};
    var keys = [
      "fansDelta", "fundsDelta", "qualityDelta", "qualityDimDelta", "qualitySumDelta",
      "devMonthsDelta", "setTrend", "rivalAdvance", "rivalRelease", "setRivalMau",
      "monthSalesMult", "monthSalesDelta", "baselineSalesMult", "baselineSalesDelta",
      "salesTarget", "targetTitle"
    ];
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (nested[k] != null) e[k] = nested[k];
      else if (src[k] != null) e[k] = src[k];
    }
    return e;
  };

  sim.effectBits = function (fx) {
    var bits = [];
    if (fx.fundsDelta) bits.push("资金 " + (fx.fundsDelta > 0 ? "+" : "") + fx.fundsDelta);
    if (fx.fansDelta) bits.push("粉丝 " + (fx.fansDelta > 0 ? "+" : "") + fx.fansDelta);
    var q = fx.qualityDelta != null ? fx.qualityDelta : fx.qualityDimDelta;
    if (q) bits.push("在研质量 " + (q > 0 ? "+" : "") + q);
    if (fx.qualitySumDelta) bits.push("在研质量合计 " + (fx.qualitySumDelta > 0 ? "+" : "") + fx.qualitySumDelta);
    if (fx.devMonthsDelta) bits.push("在研周期 " + (fx.devMonthsDelta > 0 ? "+" : "") + fx.devMonthsDelta + " 月");
    if (fx.setTrend) bits.push("潮流转向");
    if (fx.rivalAdvance) bits.push("对手提前到下月");
    if (fx.rivalRelease) bits.push("对手上线《" + (fx.rivalRelease.title || fx.rivalRelease.series || "") + "》");
    if (fx.setRivalMau) bits.push("月活刷新");
    if (fx.monthSalesMult != null && fx.monthSalesMult !== 1) {
      bits.push("本月实销 ×" + fx.monthSalesMult + "（不改基准）");
    }
    if (fx.monthSalesDelta) {
      bits.push("本月实销 " + (fx.monthSalesDelta > 0 ? "+" : "") + fx.monthSalesDelta + "（不改基准）");
    }
    if (fx.baselineSalesMult != null && fx.baselineSalesMult !== 1) {
      bits.push("基准销量 ×" + fx.baselineSalesMult + "（之后每月都按新基准）");
    }
    if (fx.baselineSalesDelta) {
      bits.push("基准销量 " + (fx.baselineSalesDelta > 0 ? "+" : "") + fx.baselineSalesDelta + "（之后每月都按新基准）");
    }
    return bits.join(" · ");
  };

  sim.findRivalTitle = function (st, title) {
    var lists = [st.rivalReleased, st.rivalMonth, st.rivalWindow];
    var i, j, list;
    for (i = 0; i < lists.length; i++) {
      list = lists[i] || [];
      for (j = 0; j < list.length; j++) {
        if (list[j].title === title || list[j].series === title) return list[j];
      }
    }
    return null;
  };

  sim.keepRivalHit = function (st, rec) {
    if (!rec) return;
    st.rivalReleased = st.rivalReleased || [];
    st.rivalReleased = st.rivalReleased.filter(function (g) {
      return g.title !== rec.title;
    });
    st.rivalReleased.push(rec);
  };

  sim.applyQualityDelta = function (st, delta, allDims) {
    var list = inDevProjects(st);
    if (!list.length || !delta) return;
    list.forEach(function (p) {
      if (allDims) {
        DIMS.forEach(function (d) { p.stats[d] += delta; });
        return;
      }
      var d = sim.pick(st, DIMS);
      p.stats[d] += delta;
    });
  };

  sim.applyDevMonthsDelta = function (st, delta) {
    if (!delta) return;
    inDevProjects(st).forEach(function (p) {
      p.monthsLeft = Math.max(0, p.monthsLeft + delta);
    });
  };

  sim.applySetTrend = function (st, spec, config) {
    if (!spec) return;
    var dur = spec.monthsLeft != null ? spec.monthsLeft : (sim.trendCfg(config).durationMonths || 3);
    st.trend = {
      genreId: spec.genreId || null,
      gameplayId: spec.gameplayId || null,
      monthsLeft: dur
    };
    st.trendWait = 0;
  };

  function hasBoxedSalesFx(fx) {
    return fx && (
      fx.monthSalesMult != null || fx.monthSalesDelta ||
      fx.baselineSalesMult != null || fx.baselineSalesDelta
    );
  }

  sim.boxedSalesTargets = function (st, fx, config) {
    fx = fx || {};
    if (!hasBoxedSalesFx(fx)) return [];
    var target = fx.salesTarget || "playerOnSale";
    var out = [];
    function consider(g) {
      if (!g || !sim.usesBoxedLifecycle(g)) return;
      sim.migrateBoxedLifecycle(st, g, config);
      if (g.onSale === false) return;
      if (fx.targetTitle && g.title !== fx.targetTitle && g.series !== fx.targetTitle) return;
      if (target === "playerJustReleased" && sim.lifecycleMonth(st, g) !== 1) return;
      out.push(g);
    }
    if (target === "playerOnSale" || target === "playerJustReleased" || target === "allOnSale") {
      (st.released || []).forEach(consider);
    }
    if (target === "allOnSale" || target === "rivalOnSale") {
      (st.rivalReleased || []).forEach(consider);
    }
    return out;
  };

  sim.restrikeBookedMonthSales = function (st, g, config) {
    if (!g || !sim.usesBoxedLifecycle(g) || g.onSale === false) return 0;
    var old = g.monthSales || 0;
    var neu = Math.max(0, Math.round(
      old * (g.monthSalesMult == null ? 1 : Number(g.monthSalesMult)) + (g.monthSalesDelta || 0)
    ));
    var diff = neu - old;
    g.monthSales = neu;
    if (g.lifetimeSales === g.launchSales) g.launchSales = neu;
    g.lifetimeSales = (g.lifetimeSales || 0) + diff;
    var player = (st.released || []).indexOf(g) >= 0;
    if (player) {
      st.company.funds += diff;
      st.monthSales += diff;
    } else {
      g.sales = (g.sales || 0) + diff;
      var plat = sim.platformFamilyId(g.platformId, config);
      if (!st.rivalLifetimeByPlatform) st.rivalLifetimeByPlatform = {};
      st.rivalLifetimeByPlatform[plat] = (st.rivalLifetimeByPlatform[plat] || 0) + diff;
    }
    sim.clearMonthSalesMods(g);
    return diff;
  };

  sim.applyBoxedSalesEffects = function (st, fx, config, notes, opts) {
    fx = fx || {};
    opts = opts || {};
    if (!hasBoxedSalesFx(fx)) return;
    var targets = sim.boxedSalesTargets(st, fx, config);
    var consumeNow = !opts.duringTick;
    targets.forEach(function (g) {
      if (fx.baselineSalesMult != null) {
        g.baselineSales = Math.max(0, Math.round(sim.boxedBaselineOf(g) * Number(fx.baselineSalesMult)));
      }
      if (fx.baselineSalesDelta) {
        g.baselineSales = Math.max(0, Math.round(sim.boxedBaselineOf(g) + Number(fx.baselineSalesDelta)));
      }
      if (fx.monthSalesMult != null) {
        g.monthSalesMult = (g.monthSalesMult == null ? 1 : Number(g.monthSalesMult)) * Number(fx.monthSalesMult);
      }
      if (fx.monthSalesDelta) {
        g.monthSalesDelta = (g.monthSalesDelta || 0) + Number(fx.monthSalesDelta);
      }
      if (consumeNow && (fx.monthSalesMult != null || fx.monthSalesDelta)) {
        sim.restrikeBookedMonthSales(st, g, config);
      }
    });
    if (notes && targets.length) {
      if (fx.baselineSalesMult != null || fx.baselineSalesDelta) notes.push("在售基准已改");
      if (fx.monthSalesMult != null || fx.monthSalesDelta) notes.push("本月实销已改");
    }
  };

  sim.applyEventEffects = function (st, fx, config, notes, opts) {
    fx = fx || {};
    if (fx.fundsDelta) st.company.funds += fx.fundsDelta;
    if (fx.fansDelta) st.company.fans = Math.max(0, st.company.fans + fx.fansDelta);
    var q = fx.qualityDelta != null ? fx.qualityDelta : fx.qualityDimDelta;
    if (q) sim.applyQualityDelta(st, q, false);
    if (fx.qualitySumDelta) sim.applyQualityDelta(st, fx.qualitySumDelta, false);
    if (fx.devMonthsDelta) sim.applyDevMonthsDelta(st, fx.devMonthsDelta);
    if (fx.setTrend) {
      sim.applySetTrend(st, fx.setTrend, config);
      if (notes) notes.push("潮流：" + sim.trendName(st.trend, config));
    }
    if (fx.rivalAdvance) sim.advanceRivalToNextMonth(st, fx.rivalAdvance, config);
    var ship = null;
    if (fx.rivalRelease) ship = sim.forceRivalRelease(st, fx.rivalRelease, config);
    if (fx.setRivalMau) sim.setRivalMau(st, fx.setRivalMau);
    sim.applyBoxedSalesEffects(st, fx, config, notes, opts);
    return ship;
  };

  function historicalDue(ev, st) {
    if ((st.firedEventIds || []).indexOf(ev.id) >= 0) return false;
    if (ev.year != null && ev.month != null) {
      if (st.year !== ev.year || st.month !== ev.month) return false;
    }
    var after = ev.after;
    if (after) {
      if (after.prevEventId && (st.firedEventIds || []).indexOf(after.prevEventId) < 0) return false;
      if (after.releaseTitle) {
        var rec = sim.findRivalTitle(st, after.releaseTitle);
        if (!rec || rec.releasedYear == null) return false;
        if (after.monthDelay != null) {
          if (monthsBetween(rec.releasedYear, rec.releasedMonth, st.year, st.month) !== after.monthDelay) return false;
        }
      }
      if (after.year != null && after.month != null) {
        if (st.year !== after.year || st.month !== after.month) return false;
      }
    }
    if (ev.year == null && ev.month == null && !after) return false;
    if (ev.chance != null && sim.rand(st) >= ev.chance) return false;
    return true;
  }

  function markFired(st, ev) {
    if (ev.source === "historical" || ev.year != null || ev.after) {
      st.firedEventIds = st.firedEventIds || [];
      if (st.firedEventIds.indexOf(ev.id) < 0) st.firedEventIds.push(ev.id);
    }
  }

  function randomPool(config) {
    return (config.world.events || []).filter(function (ev) {
      return (ev.source || "random") !== "historical";
    });
  }

  sim.pickWeighted = function (st, items) {
    if (!items || !items.length) return null;
    var total = 0;
    var i, w;
    for (i = 0; i < items.length; i++) {
      w = items[i].weight == null ? 1 : items[i].weight;
      total += Math.max(0, w);
    }
    if (total <= 0) return items[0];
    var r = sim.rand(st) * total;
    var acc = 0;
    for (i = 0; i < items.length; i++) {
      acc += items[i].weight == null ? 1 : Math.max(0, items[i].weight);
      if (r < acc) return items[i];
    }
    return items[items.length - 1];
  };

  sim.eventQueueItem = function (ev, appliedFx, config) {
    var fx = appliedFx || sim.eventEffects(ev);
    var pres = ev.presentation || "notice";
    return {
      type: "event",
      kind: "event",
      presentation: pres,
      eventId: ev.id,
      kicker: (ev.source === "historical" ? "历史事件" : "本月事件"),
      title: ev.displayName,
      body: ev.text || ("发生了「" + ev.displayName + "」。"),
      bits: pres === "choice" ? "" : sim.effectBits(fx),
      options: pres === "choice" ? (ev.options || []).map(function (o) {
        return { id: o.id, label: o.label };
      }) : null
    };
  };

  sim.runMonthEvents = function (st, config, notes) {
    sim.ensureGameExtras(st);
    var fired = [];
    var ships = [];
    var hist = config.world.historicalEvents || [];
    hist.forEach(function (ev) {
      if (!historicalDue(ev, st)) return;
      var fx = sim.eventEffects(ev);
      var ship = null;
      if ((ev.presentation || "notice") !== "choice") {
        ship = sim.applyEventEffects(st, fx, config, notes, { duringTick: true });
      }
      markFired(st, ev);
      if (ship) ships.push(ship);
      fired.push({ ev: ev, fx: fx });
      notes.push(ev.displayName);
    });
    var chance = config.world.monthlyEventChance;
    if (chance && sim.rand(st) < chance) {
      var pool = randomPool(config);
      var ev = sim.pickWeighted(st, pool);
      if (ev) {
        var fx = sim.eventEffects(ev);
        var ship = null;
        if ((ev.presentation || "notice") !== "choice") {
          ship = sim.applyEventEffects(st, fx, config, notes, { duringTick: true });
        }
        if (ship) ships.push(ship);
        fired.push({ ev: ev, fx: fx });
        notes.push(ev.displayName);
      }
    }
    return { fired: fired, ships: ships };
  };

  sim.resolveEventChoice = function (state, eventId, optionId, config) {
    var ev = sim.findEventDef(config, eventId);
    if (!ev) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    if ((ev.presentation || "notice") !== "choice") return sim.fail(state, sim.ERR.EVENT_NOT_CHOICE);
    var opt = null;
    (ev.options || []).forEach(function (o) {
      if (o.id === optionId) opt = o;
    });
    if (!opt) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    var st = sim.clone(state);
    sim.ensureGameExtras(st);
    var notes = [];
    var fx = sim.eventEffects(opt);
    sim.applyEventEffects(st, fx, config, notes);
    return {
      ok: true,
      state: st,
      bits: sim.effectBits(fx),
      optionId: optionId
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
