(function (root) {
  var sim = root.GDS.sim;

  sim.clone = function (st) {
    return JSON.parse(JSON.stringify(st));
  };

  sim.ensureGameExtras = function (st) {
    if (!st.readyToShip) st.readyToShip = [];
    if (!st.firedEventIds) st.firedEventIds = [];
    if (!st.rivalReleased) st.rivalReleased = [];
    if (!st.rivalForceSeries) st.rivalForceSeries = {};
    if (!st.rivalPlan) st.rivalPlan = {};
    if (!st.rivalCalendarHold) st.rivalCalendarHold = [];
    if (!st.monthChart) st.monthChart = [];
    return st;
  };

  sim.trendCfg = function (config) {
    return (config.world && (config.world.trend || config.world.genreTrend)) || {};
  };

  sim.matchesTrend = function (item, trend) {
    if (!item || !trend) return false;
    if (trend.genreId && item.genreId === trend.genreId) return true;
    if (trend.gameplayId && item.gameplayId === trend.gameplayId) return true;
    return false;
  };

  sim.trendName = function (trend, config) {
    if (!trend) return "";
    if (trend.gameplayId) return sim.contentName(config.content.gameplay, trend.gameplayId);
    if (trend.genreId) return sim.contentName(config.content.genres, trend.genreId);
    return "";
  };

  sim.trendText = function (trend, config) {
    if (!trend || trend.monthsLeft <= 0) return "潮流：无";
    var prefix = (config.copy && config.copy.trendLikePrefix) || "玩家开始喜欢";
    var name = sim.trendName(trend, config);
    return prefix + name + "（" + trend.monthsLeft + "月）";
  };

  sim.formatMau = function (n) {
    n = n || 0;
    if (n >= 100000000) return (Math.round(n / 10000000) / 10) + "亿";
    if (n >= 10000) return Math.round(n / 10000) + "万";
    return String(n);
  };

  sim.fail = function (state, error) {
    return { ok: false, error: error, state: state };
  };

  sim.ok = function (st) {
    return { ok: true, state: st };
  };

  sim.unlockYear = function (item) {
    return item.unlockYear != null ? item.unlockYear : item.y;
  };

  sim.displayName = function (item) {
    return item.displayName || item.n || item.name || "";
  };

  sim.unlocked = function (list, year) {
    return (list || []).filter(function (x) {
      return sim.unlockYear(x) <= year;
    });
  };

  sim.contentName = function (list, id) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return sim.displayName(list[i]);
    return id;
  };

  sim.findById = function (list, id) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  sim.findStaff = function (st, id) {
    return sim.findById(st.staff || [], id);
  };

  sim.scaleLabel = function (scale, config) {
    var labels = (config.copy && config.copy.scaleLabels) || {};
    return labels[scale] || scale;
  };

  sim.cycleMonths = function (cycle, config, releaseType) {
    var o = config.outsource;
    if (releaseType === "outsource" && o && o.cycleMonths && o.cycleMonths[cycle] != null) {
      return o.cycleMonths[cycle];
    }
    var d = config.development;
    if (cycle === "short") return d.shortMonths;
    if (cycle === "long") return d.longMonths;
    return d.mediumMonths;
  };

  sim.releaseTypeLabel = function (type, config) {
    var labels = (config.copy && config.copy.releaseTypes) || {};
    if (labels[type]) return labels[type];
    if (type === "liveops") return "长线运营";
    if (type === "outsource") return "外包接活";
    return "普通发售";
  };

  sim.platformFamilyId = function (platformId, config) {
    var plats = (config.content && config.content.platforms) || [];
    if (platformId && sim.findById(plats, platformId)) return platformId;
    var fold = config.company.ownConsoleFoldIntoPlatformId || "console";
    var own = sim.ownConsoleItem(config);
    if (platformId === own.id || platformId === "ownConsole") return fold;
    if (platformId === "mobile") return "mobile";
    if (platformId === "pc") return "pc";
    return fold;
  };

  sim.releaseShareWeight = function (g, config) {
    if (!g) return 0;
    var allowed = (config.marketShare && config.marketShare.includeReleaseTypes) || ["boxed", "liveops"];
    if (g.releaseType === "outsource") {
      var w = config.outsource && config.outsource.shareWeight;
      return w == null ? 0 : w;
    }
    return allowed.indexOf(g.releaseType) >= 0 ? 1 : 0;
  };

  sim.marketShares = function (st, config) {
    var plats = (config.content && config.content.platforms) || [];
    var rivalLife = st.rivalLifetimeByPlatform || {};
    return plats.map(function (p) {
      var player = 0;
      (st.released || []).forEach(function (g) {
        if (sim.platformFamilyId(g.platformId, config) !== p.id) return;
        player += Math.round((g.lifetimeSales || 0) * sim.releaseShareWeight(g, config));
      });
      var rival = rivalLife[p.id] || 0;
      var denom = player + rival;
      return {
        id: p.id,
        displayName: sim.displayName(p),
        playerSales: player,
        rivalSales: rival,
        share: denom > 0 ? player / denom : 0
      };
    });
  };

  sim.formatSharePercent = function (share, config) {
    var d = config.marketShare && config.marketShare.percentDecimals;
    if (d == null) d = 1;
    var f = Math.pow(10, d);
    return Math.round(share * 100 * f) / f + "%";
  };

  sim.maxStaff = function (st, config) {
    var scale = config.company.scales[st.company.scale];
    return (scale && scale.maxStaff) || 4;
  };

  sim.ownConsoleItem = function (config) {
    return (config.copy && config.copy.ownConsolePlatform) || { id: "ownConsole", displayName: "自研主机" };
  };

  sim.canUnlockOwnConsole = function (st, config) {
    var scale = config.company.scales[st.company.scale] || {};
    return !!(scale.unlockOwnConsole && st.company.fans >= config.company.unlockOwnConsoleMinFans);
  };

  sim.syncOwnConsole = function (state, config) {
    if (state.company.ownConsole || !sim.canUnlockOwnConsole(state, config)) return state;
    var st = sim.clone(state);
    st.company.ownConsole = true;
    return st;
  };

  sim.platformsNow = function (st, config) {
    var own = sim.ownConsoleItem(config);
    return sim.unlocked(config.content.platforms, st.year).filter(function (p) {
      return p.id !== own.id;
    });
  };

  sim.padMonth = function (m) {
    return m < 10 ? "0" + m : String(m);
  };

  sim.dateText = function (st) {
    return st.year + "." + sim.padMonth(st.month);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
