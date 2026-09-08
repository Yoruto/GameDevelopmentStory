(function (root) {
  var sim = root.GDS.sim;

  sim.liveOpsRevenue = function (g, config, st) {
    var keepers = (g.liveOps && g.liveOps.maintainerIds) || [];
    var qsum = g.stats.program + g.stats.script + g.stats.art + g.stats.music;
    var live = config.liveOps;
    var ace = 0;
    if (st) {
      keepers.forEach(function (id) {
        var s = sim.findStaff(st, id);
        if (!s) return;
        (s.traits || []).forEach(function (tid) {
          var t = sim.traitDef(tid, config);
          if (t && t.liveRevenueMult) ace += t.liveRevenueMult;
        });
      });
    }
    return Math.round(qsum * live.monthlyRevenuePerQualitySum * (1 + Math.max(0, keepers.length - 1) * live.extraStaffRevenueRate) * (1 + ace));
  };

  sim.shutdownLive = function (st, g, config, notes) {
    if (!g.liveOps || !g.liveOps.active) return;
    g.liveOps.active = false;
    g.liveOps.closedYear = st.year;
    g.liveOps.closedMonth = st.month;
    st.company.funds -= config.liveOps.shutdownPenalty;
    (g.liveOps.maintainerIds || []).forEach(function (id) {
      var s = sim.findStaff(st, id);
      if (s) { s.status = "idle"; s.assignmentId = null; }
    });
    g.liveOps.maintainerIds = [];
    notes.push(g.title + "关服，开支罚金 -" + config.liveOps.shutdownPenalty);
  };

  sim.findReleased = function (st, gameId) {
    return sim.findById(st.released || [], gameId);
  };

  sim.assignLiveOps = function (state, gameId, staffIds, config) {
    var g = sim.findReleased(state, gameId);
    if (!g || !g.liveOps) return sim.fail(state, sim.ERR.LIVEOPS_NOT_FOUND);
    if (!g.liveOps.active) return sim.fail(state, sim.ERR.LIVEOPS_INACTIVE);
    var ids = staffIds || [];
    var i, s;
    for (i = 0; i < ids.length; i++) {
      s = sim.findStaff(state, ids[i]);
      if (!s) return sim.fail(state, sim.ERR.LIVEOPS_STAFF_BUSY);
      if (s.status !== "idle" && s.assignmentId !== gameId) return sim.fail(state, sim.ERR.LIVEOPS_STAFF_BUSY);
    }
    var st = sim.clone(state);
    var rec = sim.findReleased(st, gameId);
    var prev = rec.liveOps.maintainerIds || [];
    prev.forEach(function (id) {
      if (ids.indexOf(id) < 0) {
        var old = sim.findStaff(st, id);
        if (old) { old.status = "idle"; old.assignmentId = null; }
      }
    });
    ids.forEach(function (id) {
      var person = sim.findStaff(st, id);
      if (person) { person.status = "liveops"; person.assignmentId = gameId; }
    });
    rec.liveOps.maintainerIds = ids.slice();
    return sim.ok(st);
  };

  sim.liveOpsVersionSpec = function (config) {
    return (config && config.liveOps && config.liveOps.versions) || {};
  };

  sim.liveOpsHasMobile = function (g) {
    var plats, i;
    if (!g) return false;
    if (g.platformId === "mobile") return true;
    plats = g.platforms;
    if (!plats) return false;
    for (i = 0; i < plats.length; i++) {
      if (plats[i] === "mobile") return true;
    }
    return false;
  };

  sim.liveOpsUsesVersions = function (g, config) {
    var spec = sim.liveOpsVersionSpec(config);
    if (!g || spec.enabled === false) return false;
    if (sim.isLiveOpsTitle && !sim.isLiveOpsTitle(g)) return false;
    if (!sim.isLiveOpsTitle && g.releaseType !== "liveops" && !g.liveOps && !g.live && !g.liveAfterRelease) return false;
    if (g.liveOps && g.liveOps.active === false) return false;
    if (spec.requiresMobile !== false && !sim.liveOpsHasMobile(g)) return false;
    return true;
  };

  sim.liveOpsMaxVersionsPerYear = function (config) {
    var spec = sim.liveOpsVersionSpec(config);
    var n = spec.maxVersionsPerYear;
    if (n == null || n === "") return 0;
    n = Math.floor(Number(n));
    return n > 0 ? n : 0;
  };

  sim.liveOpsVersionInterval = function (g, config) {
    var spec = sim.liveOpsVersionSpec(config);
    var base = spec.mobileIntervalMonths || spec.intervalMonths || 2;
    var maxPer = sim.liveOpsMaxVersionsPerYear(config);
    var minGap;
    if (maxPer > 0) {
      minGap = Math.ceil(12 / maxPer);
      if (minGap > base) base = minGap;
    }
    if (!base || base < 1) base = 1;
    return base;
  };

  function capYearVersionSlots(slots, maxN) {
    var picked, used, i, idx;
    if (!maxN || maxN < 1 || slots.length <= maxN) return slots;
    picked = [];
    used = {};
    for (i = 0; i < maxN; i++) {
      idx = Math.floor(i * slots.length / maxN);
      while (used[idx] && idx < slots.length - 1) idx += 1;
      if (used[idx]) continue;
      used[idx] = true;
      picked.push(slots[idx]);
    }
    return picked;
  }

  sim.liveOpsYearVersionSlots = function (g, year, config) {
    var slots = [];
    var m, idx;
    if (!sim.liveOpsUsesVersions(g, config)) return [];
    for (m = 1; m <= 12; m++) {
      idx = sim.liveOpsVersionIndexAt(g, year, m, config);
      if (idx < 1) continue;
      slots.push({ month: m, index: idx });
    }
    return capYearVersionSlots(slots, sim.liveOpsMaxVersionsPerYear(config));
  };

  sim.liveOpsVersionFromIndex = function (index, config) {
    var spec = sim.liveOpsVersionSpec(config);
    var per = spec.minorPerMajor || 6;
    var start = spec.startMajor || 1;
    if (index < 0) index = 0;
    if (per < 1) per = 1;
    return { major: start + Math.floor(index / per), minor: index % per };
  };

  sim.liveOpsCurrentVersion = function (g, config) {
    var spec = sim.liveOpsVersionSpec(config);
    var start = spec.startMajor || 1;
    if (g && g.liveOps && g.liveOps.versionMajor != null) {
      return { major: g.liveOps.versionMajor, minor: g.liveOps.versionMinor || 0 };
    }
    if (g && g.versionMajor != null) {
      return { major: g.versionMajor, minor: g.versionMinor || 0 };
    }
    return { major: start, minor: 0 };
  };

  sim.liveOpsVersionLabel = function (title, ver, config) {
    var spec = sim.liveOpsVersionSpec(config);
    var copy = (config && config.copy) || {};
    var pat = spec.labelPattern || copy.liveopsVersionPattern || "{title}.{major}.{minor}";
    var name = title || "";
    if (title && typeof title === "object") {
      name = title.title || title.name || title.alias || "";
    }
    ver = ver || { major: 1, minor: 0 };
    return String(pat)
      .replace("{title}", name)
      .replace("{major}", String(ver.major))
      .replace("{minor}", String(ver.minor));
  };

  sim.liveOpsVersionIndexAt = function (g, year, month, config) {
    var interval = sim.liveOpsVersionInterval(g, config);
    var y = g && (g.releasedYear != null ? g.releasedYear : g.releaseYear);
    var m = g && (g.releasedMonth != null ? g.releasedMonth : g.releaseMonth);
    var delta;
    if (y == null || month == null || !interval) return -1;
    delta = (year - y) * 12 + (month - m);
    if (delta < 0) return -1;
    if (delta % interval !== 0) return -1;
    return delta / interval;
  };

  sim.liveOpsVersionDueAt = function (g, year, month, config) {
    var slots, i;
    if (!sim.liveOpsUsesVersions(g, config)) return null;
    slots = sim.liveOpsYearVersionSlots(g, year, config);
    for (i = 0; i < slots.length; i++) {
      if (slots[i].month === month) return sim.liveOpsVersionFromIndex(slots[i].index, config);
    }
    return null;
  };

  function bumpLiveOpsStat(g, st, amt) {
    var stats = g && g.stats;
    var dim, dims, idx;
    if (!stats || !amt) return;
    dims = ["program", "script", "art", "music"];
    idx = (((st && st.year) || 0) * 12 + ((st && st.month) || 0)) % dims.length;
    dim = dims[idx];
    if (stats[dim] == null) {
      if (dim === "script" && stats.design != null) dim = "design";
      else if (dim === "design" && stats.script != null) dim = "script";
      else dim = stats.program != null ? "program" : (stats.design != null ? "design" : dim);
    }
    if (stats[dim] == null) stats[dim] = 0;
    stats[dim] += amt;
  }

  sim.applyLiveOpsVersion = function (st, g, config, notes, mediaOut, currentRev) {
    var spec = sim.liveOpsVersionSpec(config);
    var copy = (config && config.copy) || {};
    var ver, title, label, rate, media, stats, rec;
    if (!st || !g) return null;
    if (g.lastVersionYear === st.year && g.lastVersionMonth === st.month) return null;
    ver = sim.liveOpsVersionDueAt(g, st.year, st.month, config);
    if (!ver) return null;
    if (g.liveOps) {
      g.liveOps.versionMajor = ver.major;
      g.liveOps.versionMinor = ver.minor;
    }
    g.versionMajor = ver.major;
    g.versionMinor = ver.minor;
    g.lastVersionYear = st.year;
    g.lastVersionMonth = st.month;
    title = g.title || g.name || "";
    if (sim.isCareerMode && sim.isCareerMode(st) && sim.worldLabel) {
      title = sim.worldLabel(g, config) || title;
    }
    label = sim.liveOpsVersionLabel(title, ver, config);
    bumpLiveOpsStat(g, st, spec.qualityBump || 0);
    rate = spec.revenueBumpRate || 0;
    if (currentRev != null) {
      currentRev = Math.round(currentRev * (1 + rate));
    } else if (g.livePeak) {
      g.livePeak = Math.round(g.livePeak * (1 + rate));
    }
    if (notes) notes.push(label + (copy.liveopsVersionNote ? (" " + copy.liveopsVersionNote) : ""));
    stats = g.stats;
    if (ver.minor === 0 && spec.mediaOnMajor && stats && mediaOut && sim.scoreMedia) {
      if (sim.isCareerMode && sim.isCareerMode(st) && sim.scoreMediaFromPublic) {
        media = sim.scoreMediaFromPublic(st, g.score != null ? g.score : g.avg, config, (function () {
          var m = (sim.careerWorld && sim.careerWorld(config).scoreFromLive) || {};
          return { min: m.mediaJitterMin, max: m.mediaJitterMax };
        })());
        g.media = media;
      } else {
        media = sim.scoreMedia(st, stats, [], config, g.producerId || null);
        g.media = media;
        g.avg = media.avg;
        g.score = media.avg;
      }
      rec = {
        title: label,
        avg: media.avg,
        media: media,
        monthSales: currentRev != null ? currentRev : g.monthSales,
        launchSales: g.launchSales != null ? g.launchSales : null,
        baselineSales: 0
      };
      mediaOut.push(rec);
    }
    return { label: label, ver: ver, rev: currentRev };
  };

  sim.listLiveOpsVersionDrops = function (st, year, config) {
    var drops = [];
    var seen = {};
    function addGame(g, source) {
      var m, ver, key, title, label;
      if (!sim.liveOpsUsesVersions(g, config)) return;
      title = g.title || g.name || "";
      if (source === "world" && sim.worldLabel) title = sim.worldLabel(g, config) || title;
      for (m = 1; m <= 12; m++) {
        ver = sim.liveOpsVersionDueAt(g, year, m, config);
        if (!ver) continue;
        key = (g.id || title) + "\0" + ver.major + "." + ver.minor;
        if (seen[key]) continue;
        seen[key] = true;
        label = sim.liveOpsVersionLabel(title, ver, config);
        drops.push({
          month: m,
          year: year,
          source: source,
          id: (g.id || title) + "-v" + ver.major + "-" + ver.minor,
          title: title,
          name: title,
          alias: g.alias,
          companyId: g.companyId,
          pub: g.pub || "",
          series: g.series || title,
          label: label,
          isVersion: true,
          versionMajor: ver.major,
          versionMinor: ver.minor,
          releaseType: "liveops",
          live: true,
          platforms: g.platforms,
          platformId: g.platformId || "",
          publisherId: g.pubId || g.companyId || "",
          publisher: g.pub || ""
        });
      }
    }
    if (st && st.mode === "career") {
      (sim.allCareerTitles ? sim.allCareerTitles(config, st) : []).forEach(function (t) {
        addGame(t, "world");
      });
    } else if (st) {
      (st.released || []).forEach(function (g) { addGame(g, "player"); });
      (st.rivalReleased || []).forEach(function (g) { addGame(g, "rival"); });
    }
    return drops;
  };

  sim.shutdownLiveOps = function (state, gameId, config) {
    var g = sim.findReleased(state, gameId);
    if (!g || !g.liveOps) return sim.fail(state, sim.ERR.LIVEOPS_NOT_FOUND);
    if (!g.liveOps.active) return sim.fail(state, sim.ERR.LIVEOPS_INACTIVE);
    var st = sim.clone(state);
    var rec = sim.findReleased(st, gameId);
    var notes = [];
    sim.shutdownLive(st, rec, config, notes);
    return sim.ok(st);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
