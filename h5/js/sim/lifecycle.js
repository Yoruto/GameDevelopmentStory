(function (root) {
  var sim = root.GDS.sim;

  sim.lifecycleCfg = function (config) {
    return (config && config.lifecycle) || {};
  };

  sim.lifecycleScoreOf = function (g) {
    if (!g) return null;
    if (g.avg != null && g.avg !== "") return Number(g.avg);
    if (g.mediaAverage != null && g.mediaAverage !== "") return Number(g.mediaAverage);
    if (g.media && g.media.avg != null) return Number(g.media.avg);
    return null;
  };

  sim.usesBoxedLifecycle = function (g) {
    if (!g) return false;
    if (g.releaseType === "outsource" || g.releaseType === "liveops") return false;
    if (g.live) return false;
    if (g.releaseType && g.releaseType !== "boxed") return false;
    return true;
  };

  sim.lifecycleMonth = function (st, g) {
    if (!st || !g || g.releasedYear == null || g.releasedMonth == null) return 0;
    return (st.year - g.releasedYear) * 12 + (st.month - g.releasedMonth) + 1;
  };

  sim.boxedBaselineOf = function (g) {
    if (!g) return 0;
    if (g.baselineSales != null && g.baselineSales !== "") return Number(g.baselineSales);
    if (g.launchSales != null && g.launchSales !== "") return Number(g.launchSales);
    if (g.sales != null && g.sales !== "") return Number(g.sales);
    return 0;
  };

  sim.boxedBaselineFormula = function (st, p, config, consumeAd) {
    if (!st || !p || !config) return 0;
    var q = (p.stats && p.stats.program || 0) + (p.stats && p.stats.script || 0) +
      (p.stats && p.stats.art || 0) + (p.stats && p.stats.music || 0);
    var rel = config.release || {};
    var sales = Math.round(st.company.fans * (rel.fanSalesCoeff || 0) + q * (rel.qualitySumSalesCoeff || 0));
    if (st.company.adOn) {
      var ad = (config.economy && config.economy.advertising) || {};
      sales = Math.round(sales * (ad.nextReleaseSalesMultiplier || 1));
      if (consumeAd) st.company.adOn = false;
    }
    if (sim.matchesTrend(p, st.trend)) sales = Math.round(sales * (rel.trendSalesMultiplier || 1));
    if (p.seriesId && config.series) {
      sales = Math.round(sales * (1 + (config.series.guaranteedSalesInheritRate || 0)));
    }
    var fold = (config.company && config.company.ownConsoleFoldIntoPlatformId) || "console";
    if (st.company.ownConsole && sim.platformFamilyId(p.platformId, config) === fold) {
      sales = Math.round(sales * (config.company.ownConsoleSalesMultiplier || 1));
    }
    return sales;
  };

  sim.clearMonthSalesMods = function (g) {
    if (!g) return;
    delete g.monthSalesMult;
    delete g.monthSalesDelta;
  };

  sim.stampMonthSales = function (g, st) {
    if (!g || !st) return;
    g.monthSalesForYear = st.year;
    g.monthSalesForMonth = st.month;
  };

  sim.monthSalesStampMatches = function (g, st) {
    return !!(g && st && g.monthSalesForYear === st.year && g.monthSalesForMonth === st.month);
  };

  sim.boxedActualFromY = function (g, y) {
    var base = sim.boxedBaselineOf(g);
    var mult = g && g.monthSalesMult != null && g.monthSalesMult !== "" ? Number(g.monthSalesMult) : 1;
    var delta = g && g.monthSalesDelta ? Number(g.monthSalesDelta) : 0;
    var amt = Math.round(base * y * mult + delta);
    if (amt < 0) amt = 0;
    return amt;
  };

  sim.salesFactor = function (m, score, config) {
    var lc = sim.lifecycleCfg(config);
    var smin = lc.scoreMin;
    var smax = lc.scoreMax;
    var tMin = lc.tMin;
    var tSpan = lc.tSpan;
    var x0Min = lc.x0Min;
    var x0Span = lc.x0Span;
    var k = lc.k;
    var maxM = lc.maxMonths;
    if (m < 1 || (maxM != null && m > maxM)) return 0;
    if (score == null || score === "" || isNaN(Number(score))) return 0;
    var s = Number(score);
    if (smin != null && s < smin) s = smin;
    if (smax != null && s > smax) s = smax;
    var span = (smax != null && smin != null) ? (smax - smin) : 0;
    var u = span ? (s - smin) / span : 0;
    var t = tMin + u * tSpan;
    var x0 = x0Min + u * x0Span;
    var x = m - 1;
    return t + (1 - t) / (1 + Math.exp(k * (x - x0)));
  };

  sim.lifecycleDropsOff = function (m, y, config) {
    var lc = sim.lifecycleCfg(config);
    if (lc.maxMonths != null && m > lc.maxMonths) return true;
    if (m < 1) return true;
    return y < lc.dropOffY;
  };

  sim.migrateBoxedLifecycle = function (st, g, config) {
    if (!g || !sim.usesBoxedLifecycle(g)) {
      if (g && g.onSale == null && (g.releaseType === "outsource" || g.releaseType === "liveops" || g.live)) {
        g.onSale = false;
      }
      return g;
    }
    if (g.launchSales == null && g.sales != null) g.launchSales = g.sales;
    if (g.baselineSales == null) {
      g.baselineSales = g.launchSales != null ? g.launchSales : (g.sales || 0);
    }
    if (g.onSale != null) return g;
    var score = sim.lifecycleScoreOf(g);
    var m = sim.lifecycleMonth(st, g);
    var base = sim.boxedBaselineOf(g);
    if (score == null || !(score > 0) || !base) {
      g.onSale = m === 1 && !!base;
      return g;
    }
    var y = sim.salesFactor(m, score, config);
    g.onSale = !sim.lifecycleDropsOff(m, y, config) && !!base;
    return g;
  };

  sim.boxedMonthUnits = function (g, st, config) {
    sim.migrateBoxedLifecycle(st, g, config);
    if (!sim.usesBoxedLifecycle(g) || !sim.boxedBaselineOf(g)) return 0;
    if (g.onSale === false) return 0;
    var score = sim.lifecycleScoreOf(g);
    if (score == null || !(score > 0)) return 0;
    var m = sim.lifecycleMonth(st, g);
    var y = sim.salesFactor(m, score, config);
    if (sim.lifecycleDropsOff(m, y, config)) return 0;
    if (sim.monthSalesStampMatches(g, st) && g.monthSales != null) return g.monthSales;
    return sim.boxedActualFromY(g, y);
  };

  sim.endBoxedSales = function (g) {
    g.onSale = false;
    g.monthSales = 0;
    g.tailLeft = 0;
    sim.clearMonthSalesMods(g);
  };

  function settleBoxedMonth(st, g, config, asRival) {
    sim.migrateBoxedLifecycle(st, g, config);
    if (!sim.usesBoxedLifecycle(g)) return 0;
    if (!sim.boxedBaselineOf(g)) {
      sim.endBoxedSales(g);
      return 0;
    }
    var score = sim.lifecycleScoreOf(g);
    var m = sim.lifecycleMonth(st, g);
    if (score == null || !(score > 0)) {
      if (m > 1) sim.endBoxedSales(g);
      else {
        g.onSale = true;
        g.monthSales = sim.boxedActualFromY(g, 1);
        sim.stampMonthSales(g, st);
      }
      sim.clearMonthSalesMods(g);
      return 0;
    }
    var y = sim.salesFactor(m, score, config);
    if (sim.lifecycleDropsOff(m, y, config)) {
      sim.endBoxedSales(g);
      return 0;
    }
    var amt = sim.boxedActualFromY(g, y);
    g.onSale = true;
    if (m <= 1) {
      var hasMods = g.monthSalesMult != null || g.monthSalesDelta;
      if (!hasMods) {
        g.monthSales = g.monthSales != null ? g.monthSales : (g.launchSales || 0);
        sim.stampMonthSales(g, st);
        sim.clearMonthSalesMods(g);
        return 0;
      }
      var prev = g.monthSales != null ? g.monthSales : (g.launchSales || 0);
      var diff = amt - prev;
      g.monthSales = amt;
      g.launchSales = amt;
      sim.stampMonthSales(g, st);
      if (diff) {
        g.lifetimeSales = (g.lifetimeSales || 0) + diff;
        if (asRival) {
          g.sales = (g.sales || 0) + diff;
          var plat0 = sim.platformFamilyId(g.platformId, config);
          if (!st.rivalLifetimeByPlatform) st.rivalLifetimeByPlatform = {};
          st.rivalLifetimeByPlatform[plat0] = (st.rivalLifetimeByPlatform[plat0] || 0) + diff;
        } else {
          st.company.funds += diff;
          st.monthSales += diff;
        }
      }
      sim.clearMonthSalesMods(g);
      return diff;
    }
    g.monthSales = amt;
    sim.stampMonthSales(g, st);
    g.lifetimeSales = (g.lifetimeSales || 0) + amt;
    if (asRival) {
      g.sales = (g.sales || 0) + amt;
      var plat = sim.platformFamilyId(g.platformId, config);
      if (!st.rivalLifetimeByPlatform) st.rivalLifetimeByPlatform = {};
      st.rivalLifetimeByPlatform[plat] = (st.rivalLifetimeByPlatform[plat] || 0) + amt;
    } else {
      st.company.funds += amt;
      st.monthSales += amt;
    }
    sim.clearMonthSalesMods(g);
    return amt;
  }

  sim.tickLifecycle = function (st, g, config) {
    return settleBoxedMonth(st, g, config, false);
  };

  sim.tickRivalLifecycle = function (st, g, config) {
    return settleBoxedMonth(st, g, config, true);
  };

  sim.keepRivalOnSale = function (st, rec) {
    if (!rec || !sim.usesBoxedLifecycle(rec)) return;
    rec.launchSales = rec.launchSales != null ? rec.launchSales : rec.sales;
    if (rec.baselineSales == null) rec.baselineSales = rec.launchSales != null ? rec.launchSales : rec.sales;
    rec.onSale = rec.onSale !== false;
    sim.keepRivalHit(st, rec);
  };

  sim.sortChartEntries = function (entries) {
    return (entries || []).slice().sort(function (a, b) {
      if ((b.monthSales || 0) !== (a.monthSales || 0)) return (b.monthSales || 0) - (a.monthSales || 0);
      var at = a.title || "";
      var bt = b.title || "";
      if (at < bt) return -1;
      if (at > bt) return 1;
      return 0;
    });
  };

  function chartRow(g, st, config, source) {
    var units = sim.boxedMonthUnits(g, st, config);
    if (!units) return null;
    return {
      source: source,
      id: g.id || "",
      title: g.title || g.series || "",
      pub: g.pub || "",
      platformId: g.platformId || "",
      avg: sim.lifecycleScoreOf(g),
      monthSales: units
    };
  }

  sim.chartEntries = function (st, config) {
    var rows = [];
    var seen = {};
    function add(g, source) {
      if (!g) return;
      var key = source + "\0" + (g.id || "") + "\0" + (g.title || g.series || "");
      if (seen[key]) return;
      seen[key] = true;
      var row = chartRow(g, st, config, source);
      if (row) rows.push(row);
    }
    (st.released || []).forEach(function (g) { add(g, "player"); });
    (st.rivalReleased || []).forEach(function (g) { add(g, "rival"); });
    (st.rivalMonth || []).forEach(function (g) { add(g, "rival"); });
    (st.rivalWindow || []).forEach(function (g) { add(g, "rival"); });
    return rows;
  };

  sim.monthlyChart = function (st, config) {
    var lc = sim.lifecycleCfg(config);
    var size = lc.chartSize;
    var ranked = sim.sortChartEntries(sim.chartEntries(st, config));
    if (size != null && size >= 0) ranked = ranked.slice(0, size);
    return ranked.map(function (row, i) {
      row.rank = i + 1;
      return row;
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
