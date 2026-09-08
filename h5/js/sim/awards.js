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

  sim.liveOpsAwardEligible = function (g, year, config) {
    var startMonth, endMonth, cy, cm;
    if (!sim.isLiveOpsTitle(g)) return false;
    if (!sim.releasedOnOrBeforeAward(g, year, config)) return false;
    if (g.liveOps && g.liveOps.active === false) {
      cy = g.liveOps.closedYear;
      cm = g.liveOps.closedMonth;
      if (cy == null) return sim.inAwardWindow(g, year, config);
      startMonth = (config && config.awards && config.awards.windowStartMonth) || 12;
      endMonth = (config && config.awards && config.awards.month) || 11;
      if (cy === year && cm <= endMonth) return true;
      if (cy === year - 1 && cm >= startMonth) return true;
      return false;
    }
    return true;
  };

  sim.careerLivePeak = function (title, config) {
    var stats, qsum, rate;
    if (!sim.isLiveOpsTitle(title)) return 0;
    if (title.livePeak) return num(title.livePeak, 0);
    if (title.liveOps && title.liveOps.peak) return num(title.liveOps.peak, 0);
    stats = title.stats || {};
    qsum = num(stats.program, 0) + num(stats.design, num(stats.script, 0)) +
      num(stats.art, 0) + num(stats.music, 0);
    rate = (config && config.liveOps && config.liveOps.monthlyRevenuePerQualitySum) || 0;
    return Math.round(qsum * rate);
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

  sim.readAwardStat = function (title, dim, aliases) {
    var stats = (title && title.stats) || null;
    var names = [dim];
    var i, key, src;
    if (dim === "design") names.push("script");
    if (dim === "script") names.push("design");
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

  sim.scoreAwardCategory = function (title, awardDef) {
    var from, fallback, sales, peak;
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
    if (from === "livePeak") {
      peak = title.livePeak != null ? num(title.livePeak, 0) : 0;
      if (!peak && title.liveOps && title.liveOps.peak) peak = num(title.liveOps.peak, 0);
      if (peak) return peak;
      fallback = awardDef.fallback;
      if (fallback === "qsum") {
        if (title.qsum != null) return num(title.qsum, 0);
        return sim.readAwardStat(title, "program") +
          sim.readAwardStat(title, "design", ["script"]) +
          sim.readAwardStat(title, "art") +
          sim.readAwardStat(title, "music");
      }
      if (fallback === "prestige") return num(title.prestige, 0);
      if (fallback === "avg" || fallback === "score") {
        return title.avg != null ? num(title.avg, 0) : num(title.score, 0);
      }
      return 0;
    }
    if (from === "qsum") {
      if (title.qsum != null) return num(title.qsum, 0);
      return sim.readAwardStat(title, "program") +
        sim.readAwardStat(title, "design", ["script"]) +
        sim.readAwardStat(title, "art") +
        sim.readAwardStat(title, "music");
    }
    if (from === "stat" || awardDef.stat) {
      return sim.readAwardStat(title, awardDef.stat, awardDef.statAliases);
    }
    return 0;
  };

  function candidateFromPlayer(g) {
    var st = g.stats || {};
    var program = num(st.program, 0);
    var script = num(st.script, num(st.design, 0));
    var art = num(st.art, 0);
    var music = num(st.music, 0);
    return {
      player: true,
      title: g.title,
      label: g.title,
      avg: num(g.avg, 0),
      score: num(g.avg, num(g.score, 0)),
      qsum: program + script + art + music,
      stats: { program: program, design: script, script: script, art: art, music: music },
      program: program,
      design: script,
      script: script,
      art: art,
      music: music,
      sales: num(g.launchSales, 0),
      prestige: num(g.prestige, 0),
      livePeak: (g.liveOps && g.liveOps.peak) || num(g.livePeak, 0),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType
    };
  }

  function candidateFromRival(g) {
    var avg = num(g.avg, 0);
    var share = g.qsum != null ? num(g.qsum, 0) / 4 : avg * 10;
    var program = g.program != null ? num(g.program, share) : share;
    var script = g.script != null ? num(g.script, share) : (g.design != null ? num(g.design, share) : share);
    var art = g.art != null ? num(g.art, share) : share;
    var music = g.music != null ? num(g.music, share) : share;
    return {
      player: false,
      title: g.title,
      label: sim.rivalLabel(g),
      avg: avg,
      score: avg,
      qsum: g.qsum != null ? num(g.qsum, 0) : (program + script + art + music),
      stats: { program: program, design: script, script: script, art: art, music: music },
      program: program,
      design: script,
      script: script,
      art: art,
      music: music,
      sales: num(g.sales, 0),
      prestige: num(g.prestige, 0),
      livePeak: num(g.livePeak, 0),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType
    };
  }

  sim.runAwards = function (st, config, notes) {
    var windowGames = st.released.filter(function (g) {
      return g.releaseType !== "outsource" && sim.inAwardWindow(g, st.year, config);
    });
    var rivalGames = (st.rivalWindow || []).filter(function (g) { return sim.inAwardWindow(g, st.year, config); });
    var pool = [];
    var livePool = [];
    var liveSeen = {};
    windowGames.forEach(function (g) { pool.push(candidateFromPlayer(g)); });
    rivalGames.forEach(function (g) { pool.push(candidateFromRival(g)); });
    function addLivePlayer(g) {
      var key;
      if (!g || g.releaseType === "outsource") return;
      if (!sim.liveOpsAwardEligible(g, st.year, config)) return;
      key = "p\0" + (g.id || g.title || "");
      if (liveSeen[key]) return;
      liveSeen[key] = true;
      livePool.push(candidateFromPlayer(g));
    }
    function addLiveRival(g) {
      var key;
      if (!sim.liveOpsAwardEligible(g, st.year, config)) return;
      key = "r\0" + (g.title || "") + "\0" + (g.pub || "") + "\0" + (g.series || "");
      if (liveSeen[key]) return;
      liveSeen[key] = true;
      livePool.push(candidateFromRival(g));
    }
    (st.released || []).forEach(addLivePlayer);
    (st.rivalReleased || []).forEach(addLiveRival);
    (st.rivalWindow || []).forEach(addLiveRival);
    (st.rivalMonth || []).forEach(addLiveRival);
    function packAward(awardDef) {
      var list = awardDef.liveOnly ? livePool : pool;
      var noms, hit, count;
      count = awardDef.nomineeCount || config.awards.nomineeCount || 5;
      noms = sim.pickAwardNominees(list, function (c) {
        return sim.scoreAwardCategory(c, awardDef);
      }, count);
      hit = noms[0] || null;
      return {
        id: awardDef.id,
        n: awardDef.displayName,
        year: st.year,
        w: hit ? hit.label : "—",
        titleId: hit && hit.titleId,
        playerWon: !!(hit && hit.player),
        nominees: noms.map(function (c) {
          return { label: c.label, titleId: c.titleId, player: !!c.player };
        })
      };
    }
    var awardPack = (config.awards.list || []).map(packAward);
    var won = 0;
    awardPack.forEach(function (a) {
      var def = (config.awards.list || []).filter(function (x) { return x.id === a.id; })[0] || {};
      var hit = (st.released || []).filter(function (g) {
        if (g.releaseType === "outsource" || g.title !== a.w) return false;
        return def.liveOnly ? sim.liveOpsAwardEligible(g, st.year, config) : sim.inAwardWindow(g, st.year, config);
      })[0];
      if (hit) {
        won += 1;
        (hit.memberIds || []).forEach(function (id) {
          var s = sim.findStaff(st, id);
          if (s) {
            s.honor = (s.honor || 0) + config.staff.honor.fromAward;
            s.salary = sim.calcSalary(s, config);
          }
        });
      }
    });
    if (won) {
      st.company.fans += config.awards.fanBonusWinner * won;
      notes.push("年度盛典：咱拿了 " + won + " 项，粉丝 +" + (config.awards.fanBonusWinner * won));
    } else {
      var houses = [];
      awardPack.forEach(function (a) {
        var part = String(a.w).split(" · ");
        var house = part.length > 1 ? part[part.length - 1] : a.w;
        if (house && houses.indexOf(house) < 0) houses.push(house);
      });
      notes.push("年度盛典：奖杯多在 " + (houses.slice(0, 3).join("、") || "大厂") + " 手里");
    }
    sim.recordAwardsHistory(st, awardPack);
    return awardPack;
  };

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
