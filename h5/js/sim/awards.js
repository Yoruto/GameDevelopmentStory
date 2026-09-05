(function (root) {
  var sim = root.GDS.sim;

  sim.inAwardWindow = function (g, year, config) {
    var startMonth = config.awards.windowStartMonth || 12;
    var endMonth = config.awards.month || 11;
    var y = g.releasedYear;
    var m = g.releasedMonth;
    if (y === year && m <= endMonth) return true;
    if (y === year - 1 && m >= startMonth) return true;
    return false;
  };

  sim.pickAward = function (cands, scoreFn) {
    var best = null, bestS = -Infinity;
    cands.forEach(function (c) {
      var s = scoreFn(c);
      if (s > bestS) { bestS = s; best = c; }
    });
    return best;
  };

  sim.runAwards = function (st, config, notes) {
    var windowGames = st.released.filter(function (g) {
      return g.releaseType !== "outsource" && sim.inAwardWindow(g, st.year, config);
    });
    var rivalGames = (st.rivalWindow || []).filter(function (g) { return sim.inAwardWindow(g, st.year, config); });
    var pool = [];
    windowGames.forEach(function (g) {
      pool.push({
        player: true, title: g.title, label: g.title, avg: g.avg || 0,
        qsum: (g.stats.program + g.stats.script + g.stats.art + g.stats.music),
        script: g.stats.script, art: g.stats.art, sales: g.launchSales || 0,
        livePeak: (g.liveOps && g.liveOps.peak) || 0, live: !!(g.liveOps)
      });
    });
    rivalGames.forEach(function (g) {
      pool.push({
        player: false, title: g.title, label: sim.rivalLabel(g), avg: g.avg || 0,
        qsum: g.qsum || 0, script: g.script || 0, art: g.art || 0,
        sales: g.sales || 0, livePeak: g.livePeak || 0, live: !!g.live
      });
    });
    function win(fn, liveOnly) {
      var list = liveOnly ? pool.filter(function (c) { return c.live || c.livePeak > 0; }) : pool;
      var hit = sim.pickAward(list, fn);
      return hit ? hit.label : "—";
    }
    var awardPack = (config.awards.list || []).map(function (a) {
      var w = "—";
      if (a.id === "goty") w = win(function (c) { return c.avg; });
      else if (a.id === "bestProduction") w = win(function (c) { return c.qsum; });
      else if (a.id === "bestLiveOps") w = win(function (c) { return c.livePeak; }, true);
      else if (a.id === "bestNarrative") w = win(function (c) { return c.script; });
      else if (a.id === "bestVisual") w = win(function (c) { return c.art; });
      else if (a.id === "playersChoice") w = win(function (c) { return c.sales; });
      return { id: a.id, n: a.displayName, w: w };
    });
    var won = 0;
    awardPack.forEach(function (a) {
      var hit = windowGames.filter(function (g) { return g.title === a.w; })[0];
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
    st.lastAwards = awardPack;
    return awardPack;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
