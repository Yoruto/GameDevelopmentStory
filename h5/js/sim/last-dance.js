(function (root) {
  var sim = root.GDS.sim;

  function index(y, m) { return sim.monthIndex(y, m); }
  function copy(config) { return ((config || {}).copy || {}).lastDance || {}; }
  function fill(template, values) {
    return String(template || "").replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] == null ? "" : values[key];
    });
  }
  function dance(st) {
    if (!st.career.lastDance) st.career.lastDance = { stage: "pending" };
    return st.career.lastDance;
  }
  function virtualProject(st, config, kind, releaseMonth) {
    var d = dance(st);
    var sourceId = st.career.titleId || d.penultimateId;
    var current = sourceId && sim.careerTitle(sourceId, config, st);
    var genres = (config.content && config.content.genres) || [];
    var gameplays = (config.content && config.content.gameplay) || [];
    var genre = current && current.genreId || (genres[0] && genres[0].id);
    var gameplay = current && current.gameplayId || (gameplays[0] && gameplays[0].id);
    var id = "last-dance-" + kind + "-" + st.career.companyId;
    var start = index(st.year, st.month);
    var end = index(2025, releaseMonth);
    var stats = sim.cloneTitleStats(st.career.liveStats ||
      (st.career.leftProjectLive && st.career.leftProjectLive[sourceId]) ||
      (current && current.stats) || {}, config);
    var pickedName = sim.lastDanceProjectName(st, config, genre,
      ["last-dance", kind, st.career.companyId, st.career.studioId,
        sourceId, st.career.characterName, st.rngSeed].join("|"));
    var title = {
      id: id, companyId: st.career.companyId, publisherId: st.career.companyId,
      studioId: st.career.studioId || null,
      name: pickedName.name,
      alias: pickedName.alias,
      releaseYear: 2025, releaseMonth: releaseMonth, score: 7,
      platforms: ["pc"], genreId: genre, gameplayId: gameplay,
      releaseType: "boxed", landmark: false, prestige: 2,
      stats: stats, virtual: true, lastDance: kind
    };
    var detail = {
      id: id, blurb: "", careerNote: "", devStartYear: st.year,
      devStartMonth: st.month, devMonths: Math.max(1, end - start),
      inviteEligible: false, inviteRoles: [], teamSize: 5,
      awards: [], liveAfterRelease: false, virtual: true, lastDance: kind
    };
    st.career.virtualProjects.push(title);
    st.career.virtualDetails.push(detail);
    d[kind + "Id"] = id;
    return title;
  }

  // January plans the handoff once. Real catalogue release dates remain untouched.
  sim.planLastDance = function (st, config) {
    var d, title, end, detail;
    if (!st || st.mode !== "career" || st.phase !== "PLAYING" ||
        st.year !== 2025 || st.month > 11) return;
    d = dance(st);
    if (!d.linesClosed) {
      if (sim.closeEndgameCareerLines) sim.closeEndgameCareerLines(st, config);
      st.career.awaitingProducerPitch = false;
      st.career.producerPitchOptions = null;
      d.linesClosed = true;
    }
    if (d.stage !== "pending") return;
    if (st.month >= 7) {
      d.stage = "opening";
      if (st.month <= 9 && st.career.companyId) {
        virtualProject(st, config, "final", 10);
        st.career.titleId = null;
        st.career.liveStats = null;
        st.career.postLaunch = null;
        d.stage = "final";
      }
      return;
    }
    d.stage = "penultimate";
    title = st.career.titleId && sim.careerTitle(st.career.titleId, config, st);
    end = title && index(title.releaseYear, title.releaseMonth);
    if (title && end <= index(2025, 6)) {
      d.penultimateId = title.id;
      if (end > index(2025, 2)) {
        if (title.virtual) {
          title.releaseYear = 2025;
          title.releaseMonth = 6;
          detail = sim.careerTitleDetail(title.id, config, st);
          if (detail) detail.devMonths = Math.max(1, index(2025, 6) -
            index(detail.devStartYear, detail.devStartMonth));
        } else {
          // A real title ships on its historical date; the player's handoff lasts to June.
          d.handoffThroughJune = true;
        }
      }
      return;
    }
    if (!st.career.companyId) {
      d.stage = "opening";
      return;
    }
    // A later project cannot be delayed *to* June. Hand it to the team and take
    // a separate fictional short assignment with a June completion date.
    if (st.career.titleId) {
      var oldCredit = (st.career.credits || []).filter(function (c) {
        return c.titleId === st.career.titleId && !c.shipped;
      })[0];
      if (oldCredit) { oldCredit.leftYear = 2025; oldCredit.leftMonth = 1; }
    }
    virtualProject(st, config, "penultimate", 6);
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
  };

  sim.lastDanceForcedTitle = function (st, config) {
    var d = st && st.career && st.career.lastDance;
    if (!d) return null;
    if (d.stage === "penultimate" && d.penultimateId) {
      var penultimate = sim.careerTitle(d.penultimateId, config, st);
      return penultimate && penultimate.companyId === st.career.companyId ? penultimate : null;
    }
    if ((d.stage === "final" || d.stage === "opening") && d.finalId &&
        index(st.year, st.month) <= index(2025, 10) &&
        !(st.worldReleased || []).some(function (g) { return g.id === d.finalId; }))
      var finalTitle = sim.careerTitle(d.finalId, config, st);
      return finalTitle && finalTitle.companyId === st.career.companyId ? finalTitle : null;
    return null;
  };

  sim.lastDanceWorkComplete = function (st) {
    var d = st && st.career && st.career.lastDance;
    return !!(d && d.finalId && (st.worldReleased || []).some(function (g) {
      return g.id === d.finalId && g.player;
    }));
  };

  sim.lastDanceAfterShip = function (st) {
    var d = st.career && st.career.lastDance;
    if (!d || !d.handoffThroughJune || st.career.titleId !== d.penultimateId) return;
    if (!st.career.postLaunch) st.career.postLaunch = {
      titleId: d.penultimateId, monthsLeft: 0
    };
    st.career.postLaunch.monthsLeft = Math.max(st.career.postLaunch.monthsLeft || 0,
      7 - st.month);
  };

  sim.prepareLastDanceAssignment = function (st, config) {
    var d = st.career && st.career.lastDance;
    var previous, finalMonth;
    if (!d || d.stage !== "penultimate" || st.year !== 2025) return;
    if (d.handoffThroughJune && st.career.postLaunch &&
        st.career.postLaunch.titleId === d.penultimateId) {
      st.career.postLaunch.monthsLeft = Math.max(st.career.postLaunch.monthsLeft || 0,
        7 - st.month);
    }
    if (st.month > 6 && d.penultimateId) {
      st.career.postLaunch = null;
      if (st.career.titleId === d.penultimateId) {
        st.career.titleId = null;
        st.career.liveStats = null;
      }
    }
    previous = d.penultimateId && (st.worldReleased || []).some(function (g) {
      return g.id === d.penultimateId;
    });
    if (!previous && st.month <= 6) return;
    if (st.career.postLaunch && st.career.postLaunch.titleId === d.penultimateId) return;
    if (!st.career.companyId) { d.stage = "opening"; return; }
    finalMonth = Math.min(10, st.month + 4);
    if (finalMonth <= st.month || st.month > 9) { d.stage = "opening"; return; }
    virtualProject(st, config, "final", finalMonth);
    st.career.titleId = null;
    st.career.liveStats = null;
    d.stage = "final";
  };

  sim.lastDanceOpening = function (st, config, queue) {
    var d = st.career && st.career.lastDance;
    var c = copy(config), body, title;
    if (!d || d.opened || (d.stage !== "final" && d.stage !== "opening")) return;
    d.opened = true;
    title = d.finalId && sim.careerTitle(d.finalId, config, st);
    body = st.career.health <= 2 || st.career.healthHospitalizedEver ||
      st.career.lastLowHealthEventYm != null
      ? c.openingLow : c.openingHigh;
    body += title
      ? fill(c.openingWithProject, { title: sim.worldLabel(title, config) })
      : c.openingWithoutProject;
    queue.push({ type: "lastDance", id: "lastDanceOpening", kind: "event",
      presentation: "choice", kicker: c.kicker,
      title: c.openingTitle, body: body,
      options: [
        { id: "work", label: c.choices[0] },
        { id: "team", label: c.choices[1] },
        { id: "past", label: c.choices[2] }
      ] });
  };

  sim.resolveLastDanceChoice = function (st, optionId) {
    var d = st.career && st.career.lastDance;
    if (!d || ["work", "team", "past"].indexOf(optionId) < 0)
      return { ok: false, state: st };
    d.choice = optionId;
    return { ok: true, state: st };
  };

  sim.lastDanceAwardNight = function (st, config, queue) {
    var d = st.career && st.career.lastDance;
    var c = copy(config);
    if (!d || d.awardNight || st.year !== 2025 || st.month !== 11) return;
    d.awardNight = true;
    queue.push({ type: "lastDance", id: "lastDanceAwardNight", kind: "event",
      kicker: c.kicker, title: c.awardNightTitle, body: c.awardNightBody });
  };

  sim.lastDanceFinale = function (st, config) {
    var d = dance(st), signed = {}, rec, titleId, hist, awards, won, nom;
    var c = copy(config);
    (st.career.credits || []).forEach(function (c) {
      if (c.shipped && c.signedEligible !== false) signed[c.titleId] = true;
    });
    rec = (st.worldReleased || []).filter(function (g) {
      return signed[g.id] && g.releasedYear === 2025;
    }).sort(function (a, b) { return index(b.releasedYear, b.releasedMonth) -
      index(a.releasedYear, a.releasedMonth); })[0];
    if (d.finalId && signed[d.finalId]) {
      var intended = (st.worldReleased || []).filter(function (g) { return g.id === d.finalId; })[0];
      if (intended) rec = intended;
    }
    titleId = rec && rec.id;
    hist = (st.awardsHistory || []).filter(function (h) { return h.year === 2025; })[0];
    awards = hist && hist.awards || [];
    won = awards.filter(function (a) { return a.titleId === titleId; });
    nom = awards.filter(function (a) {
      return (a.nominees || []).some(function (n) { return n.titleId === titleId; });
    });
    var name = rec && (rec.title || rec.name || rec.alias) || "";
    var body;
    if (!rec) body = c.finaleNone;
    else if (rec.releasedMonth === 12) body = fill(c.finaleDecember, { title: name });
    else if (won.some(function (a) { return a.id === "goty"; })) body = fill(c.finaleGoty, { title: name });
    else if (won.length) body = fill(c.finaleOtherWin, {
      title: name, awards: won.map(function (a) { return a.n; }).join("、")
    });
    else if (nom.length) body = fill(c.finaleNomination, { title: name });
    else body = fill(c.finaleEligible, { title: name });
    if (d.choice === "work") body += c.choiceWorkEcho;
    else if (d.choice === "team") body += c.choiceTeamEcho;
    else if (d.choice === "past") body += c.choicePastEcho;
    d.finaleShown = true;
    return { type: "lastDance", id: "lastDanceFinale", kind: "event",
      kicker: c.kicker, title: c.finaleTitle, body: body };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
