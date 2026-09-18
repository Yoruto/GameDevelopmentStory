(function (root) {
  var sim = root.GDS.sim;

  function num(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    return fallback;
  }

  sim.fillAwardYear = function (tpl, year, fallback) {
    var s = tpl || fallback || "";
    if (year == null || year === "") return s;
    return String(s).replace(/\{year\}/g, String(year));
  };

  sim.inAwardWindow = function (g, year, config) {
    var startMonth = config.awards.windowStartMonth || 12;
    var endMonth = config.awards.month || 11;
    var y = g.releasedYear != null ? g.releasedYear : g.releaseYear;
    var m = g.releasedMonth != null ? g.releasedMonth : g.releaseMonth;
    if (y === year && m <= endMonth) return true;
    if (y === year - 1 && m >= startMonth) return true;
    return false;
  };

  sim.isLiveOpsTitle = function (g) {
    if (!g) return false;
    if (g.releaseType === "liveops") return true;
    if (g.liveOps) return true;
    if (g.live) return true;
    if (g.liveAfterRelease) return true;
    return false;
  };

  sim.releasedOnOrBeforeAward = function (g, year, config) {
    var endMonth = (config && config.awards && config.awards.month) || 11;
    var y = g && (g.releasedYear != null ? g.releasedYear : g.releaseYear);
    var m = g && (g.releasedMonth != null ? g.releasedMonth : g.releaseMonth);
    if (y == null) return false;
    if (y < year) return true;
    if (y === year && (m == null || m <= endMonth)) return true;
    return false;
  };

  // 最佳长线运营的候选：带长线标记 + 颁奖窗口内发售（去年 12 月～今年 11 月）。
  // 没有「仍在运营 / 关服」这回事，也不再跨年参评——版本就是一次独立发售。
  sim.liveOpsAwardEligible = function (g, year, config) {
    if (!g) return false;
    if (!sim.isLiveOpsTitle(g)) return false;
    if (g.releaseType === "outsource") return false;
    return sim.inAwardWindow(g, year, config);
  };

  sim.pickAward = function (cands, scoreFn) {
    var ranked = sim.rankAwardCandidates(cands, scoreFn);
    return ranked[0] || null;
  };

  sim.rankAwardCandidates = function (cands, scoreFn) {
    return (cands || []).slice().sort(function (a, b) {
      var ds = scoreFn(b) - scoreFn(a);
      if (ds) return ds;
      return String(a.label || a.title || "").localeCompare(String(b.label || b.title || ""));
    });
  };

  sim.pickAwardNominees = function (cands, scoreFn, count) {
    var ranked = sim.rankAwardCandidates(cands, scoreFn);
    if (count == null || count < 1) count = 1;
    return ranked.slice(0, count);
  };

  // 奖项的 stat 一律是作品维（play/fun/expression/immersion），只有一个规范名。
  // aliases 仅供将来按需传入，别再在人物维（design/script）之间互推。
  sim.readAwardStat = function (title, dim, aliases) {
    var stats = (title && title.stats) || null;
    var names = [dim];
    var i, key, src;
    if (aliases && aliases.length) {
      for (i = 0; i < aliases.length; i++) names.push(aliases[i]);
    }
    for (i = 0; i < names.length; i++) {
      key = names[i];
      if (stats && stats[key] != null) return num(stats[key], 0);
      if (title && title[key] != null) return num(title[key], 0);
    }
    src = title || {};
    if (src.qsum != null) return num(src.qsum, 0) / 4;
    if (src.avg != null) return num(src.avg, 0) * 10;
    if (src.score != null) return num(src.score, 0) * 10;
    return 0;
  };

  sim.scoreAwardCategory = function (title, awardDef, config) {
    var from, fallback, sales;
    if (!title || !awardDef) return 0;
    from = awardDef.scoreFrom;
    if (!from && awardDef.stat) from = "stat";
    if (from === "avg" || from === "score") {
      if (title.avg != null) return num(title.avg, 0);
      if (title.score != null) return num(title.score, 0);
      return 0;
    }
    if (from === "sales") {
      sales = title.sales != null ? title.sales : title.launchSales;
      if (sales != null) return num(sales, 0);
      fallback = awardDef.fallback;
      if (fallback === "prestige") return num(title.prestige, 0);
      if (fallback === "avg" || fallback === "score") {
        return title.avg != null ? num(title.avg, 0) : num(title.score, 0);
      }
      return 0;
    }
    if (from === "qsum") {
      if (title.qsum != null) return num(title.qsum, 0);
      return sim.titleQualitySum(title.stats, config);
    }
    if (from === "stat" || awardDef.stat) {
      return sim.readAwardStat(title, awardDef.stat, awardDef.statAliases);
    }
    return 0;
  };

  // 候选的 stats 一律是作品维；顶层再摊开一份，供 readAwardStat 的 title[dim] 回退读取。
  function spreadTitleStats(out, stats, config) {
    sim.titleDims(config).forEach(function (d) { out[d] = num(stats[d], 0); });
    return out;
  }

  function candidateFromPlayer(g, config) {
    var stats = sim.cloneTitleStats(g && g.stats, config);
    var qsum = sim.titleQualitySum(stats, config);
    var out = {
      player: true,
      title: g.title,
      label: g.title,
      avg: num(g.avg, 0),
      score: num(g.avg, num(g.score, 0)),
      qsum: g.qsum != null ? num(g.qsum, 0) : qsum,
      stats: stats,
      sales: num(g.launchSales, 0),
      prestige: num(g.prestige, 0),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType
    };
    return spreadTitleStats(out, stats, config);
  }

  // 公司档 TGA（runAwards / candidateFromRival）已随经营局移除；
  // 生涯档评奖走 career.js 的 runCareerAwards，共用本文件的窗口/评分/提名工具。
  sim.recordAwardsHistory = function (st, pack) {
    var y = st.year;
    var i;
    if (!st.awardsHistory) st.awardsHistory = [];
    for (i = 0; i < st.awardsHistory.length; i++) {
      if (st.awardsHistory[i].year === y) {
        st.awardsHistory[i] = { year: y, awards: pack };
        st.lastAwards = pack;
        return pack;
      }
    }
    st.awardsHistory.push({ year: y, awards: pack });
    st.lastAwards = pack;
    return pack;
  };

  sim.listAwardsHistory = function (st, config) {
    var hist = ((st && st.awardsHistory) || []).slice();
    var month, y;
    if (hist.length) {
      hist.sort(function (a, b) { return b.year - a.year; });
      return hist;
    }
    if (st && st.lastAwards && st.lastAwards.length) {
      month = (config && config.awards && config.awards.month) || 11;
      y = st.month <= month ? st.year - 1 : st.year;
      return [{ year: y, awards: st.lastAwards }];
    }
    return [];
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
