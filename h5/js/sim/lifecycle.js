(function (root) {
  var sim = root.GDS.sim;

  // 只保留生涯档还在用的盒装生命周期部件：
  // Y 曲线（salesFactor / boxedActualFromY）与本月榜单（monthlyChart）。
  // 「待发售→发布→逐月结算→掉榜停售」这条经营局链路已随公司档一并移除。

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

  // 带长线标记的作品和盒装走同一条曲线：这里只排除外包。
  sim.usesBoxedLifecycle = function (g) {
    if (!g) return false;
    if (g.releaseType === "outsource") return false;
    if (g.releaseType && g.releaseType !== "boxed" && g.releaseType !== "liveops") return false;
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

  // 评分归一化到 0..1（scoreMin→0，scoreMax→1）。Y 与首周份额共用，别再各写一遍。
  function scoreUnit(score, lc) {
    var smin = lc.scoreMin;
    var smax = lc.scoreMax;
    var s = Number(score);
    var span;
    if (smin != null && s < smin) s = smin;
    if (smax != null && s > smax) s = smax;
    span = (smax != null && smin != null) ? (smax - smin) : 0;
    return span ? (s - smin) / span : 0;
  }

  // Y(m) = T + (1−T)·e^(−λ·(m−1))，指数长尾。Y(1) 恒为 1，所以 baselineSales 就是首月参照。
  // λ = lambda0 + u·lambdaSpan（lambdaSpan 为负 → 高口碑衰减更慢），T = tMin + u·tSpan 是长尾高度。
  sim.salesFactor = function (m, score, config, g) {
    var lc = sim.lifecycleCfg(config);
    var fresh = g && g.salesModelVersion === 2;
    var curve = fresh ? (lc.v2 || lc) : lc;
    var maxM = curve.maxMonths;
    var u, lambda, t, x, strategy;
    if (m < 1 || (maxM != null && m > maxM)) return 0;
    if (score == null || score === "" || isNaN(Number(score))) return 0;
    u = scoreUnit(score, lc);
    lambda = curve.lambda0 + u * curve.lambdaSpan;
    if (!(lambda > 0)) lambda = 0;
    t = curve.tMin + u * curve.tSpan;
    if (fresh) {
      strategy = g.releaseStrategy || "standard";
      lambda *= Number((curve.strategyLambdaMult || {})[strategy]) || 1;
    }
    x = m - 1;
    if (fresh && m > Number(curve.tailDecayAfterMonth || 12)) {
      return (t + (1 - t) * Math.exp(-lambda * x)) *
        Math.exp(-Number(curve.tailDecay || 0) * (m - Number(curve.tailDecayAfterMonth || 12)));
    }
    return t + (1 - t) * Math.exp(-lambda * x);
  };

  // Historical titles with a cumulative sales anchor distribute remaining units over the target horizon.
  // Rounding cumulative weights keeps the unmodified monthly sum equal to that anchor.
  function anchoredMonthUnits(g, m, config) {
    var target = Number(g.salesTargetUnits);
    var horizon = Number(g.salesTargetMonths);
    var remaining = target - Number(g.launchSales);
    var v2 = (sim.lifecycleCfg(config).v2 || {});
    var lambda = Number(v2.anchorLambda || 0.3);
    var tail = Number(v2.anchorTail || 0.22);
    var total = 0, before = 0, through = 0, i, weight;
    if (!(target > 0 && horizon >= 2 && remaining >= 0)) return null;
    if (m < 1) return 0;
    if (m === 1) return Number(g.launchSales);
    for (i = 2; i <= horizon; i++) {
      weight = Math.exp(-lambda * (i - 2)) + tail;
      total += weight;
      if (i < m) before += weight;
      if (i <= m) through += weight;
    }
    if (m > horizon) {
      weight = Math.exp(-lambda * (horizon - 2)) + tail;
      return Math.round(remaining * weight / total * Math.exp(-Number(v2.anchorAfterDecay || 0.22) * (m - horizon)));
    }
    return Math.round(remaining * through / total) - Math.round(remaining * before / total);
  }

  // 首周份额（salesWeek1Share / boxedWeek1Units）随「揭晓面板不再显示首周销量」于
  // 2026-09-18 删除。面板只显示月销量 = rec.launchSales（发售当月实销）。

  sim.boxedMonthUnits = function (g, st, config) {
    if (!sim.usesBoxedLifecycle(g) || !sim.boxedBaselineOf(g)) return 0;
    if (g.onSale === false) return 0;
    var score = sim.lifecycleScoreOf(g);
    if (score == null || !(score > 0)) return 0;
    if (sim.monthSalesStampMatches(g, st) && g.monthSales != null) return g.monthSales;
    var m = sim.lifecycleMonth(st, g);
    var anchored = g.salesModelVersion === 2 ? anchoredMonthUnits(g, m, config) : null;
    if (anchored != null) {
      var mult = g.monthSalesMult != null ? Number(g.monthSalesMult) : 1;
      var delta = g.monthSalesDelta ? Number(g.monthSalesDelta) : 0;
      return Math.max(0, Math.round(anchored * mult + delta));
    }
    var y = sim.salesFactor(m, score, config, g);
    return sim.boxedActualFromY(g, y);
  };

  // Count new units once per month. Release month is initialized at launch; old saves continue from this month.
  sim.settleCareerSalesMonth = function (st, config) {
    ((st && st.worldReleased) || []).forEach(function (g) {
      var month, units;
      if (!g || sim.monthSalesStampMatches(g, st)) return;
      month = sim.lifecycleMonth(st, g);
      if (month < 1) return;
      if (month === 1) {
        units = Number(g.launchSales) || 0;
        g.lifetimeSales = units;
      } else {
        units = sim.boxedMonthUnits(g, st, config);
        g.lifetimeSales = (Number(g.lifetimeSales) || Number(g.launchSales) || 0) + units;
      }
      g.monthSales = units;
      sim.stampMonthSales(g, st);
    });
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

  sim.chartEntryKey = function (source, g) {
    if (!g) return source + "\0\0";
    return source + "\0" + (g.id || "") + "\0" + (g.title || g.series || "");
  };

  sim.chartMonthUnits = function (g, st, config) {
    if (!g) return 0;
    return sim.boxedMonthUnits(g, st, config);
  };

  function chartRow(g, st, config) {
    var units = sim.chartMonthUnits(g, st, config);
    if (!units) return null;
    var pub = g.pub || "";
    if (!pub && g.companyId && sim.careerCompany) {
      var co = sim.careerCompany(g.companyId, config);
      if (co) pub = sim.worldLabel ? sim.worldLabel(co, config) : (co.name || co.alias || "");
    }
    return {
      source: "world",
      id: g.id || "",
      title: g.title || g.series || g.name || "",
      pub: pub,
      platformId: g.platformId || "",
      avg: sim.lifecycleScoreOf(g),
      monthSales: units,
      live: !!(sim.isLiveOpsTitle && sim.isLiveOpsTitle(g))
    };
  }

  // 生涯档榜单 = 本月世界发售（worldReleased）按当月实销排。
  sim.monthlyChart = function (st, config) {
    var lc = sim.lifecycleCfg(config);
    var size = lc.chartSize;
    var rows = [];
    ((st && st.worldReleased) || []).forEach(function (g) {
      var row = chartRow(g, st, config);
      if (row) rows.push(row);
    });
    var ranked = sim.sortChartEntries(rows);
    if (size != null && size >= 0) ranked = ranked.slice(0, size);
    return ranked.map(function (row, i) {
      row.rank = i + 1;
      return row;
    });
  };

  sim.monthlySalesRanking = function (st, config) {
    return sim.monthlyChart(st, config);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
