"use strict";

module.exports = function runGroup(ctx) {
  const sim = ctx.sim, config = ctx.config, assert = ctx.assert;
  const deepClone = ctx.deepClone, ok = ctx.ok;

  function at2025(releaseYear, releaseMonth, virtual) {
    const cfg = deepClone(config);
    const fresh = sim.createCareerGame("终章测试", "programmer", cfg);
    fresh.rngSeed = 81234;
    fresh.rngCount = 0;
    const st = sim.acceptOpeningOffer(fresh, fresh.career.openingOffers[0].id, cfg).state;
    st.year = 2025;
    st.month = 1;
    st.career.postLaunch = null;
    st.career.awaitingProducerPitch = false;
    const id = "test-penultimate-" + releaseYear + "-" + releaseMonth;
    const stats = { play: 30, fun: 30, expression: 30, immersion: 30 };
    const title = {
      id: id, companyId: st.career.companyId, studioId: st.career.studioId,
      name: "Penultimate", alias: "Penultimate", releaseYear: releaseYear,
      releaseMonth: releaseMonth, genreId: cfg.content.genres[0].id,
      gameplayId: cfg.content.gameplay[0].id, platforms: ["pc"],
      releaseType: "boxed", score: 7, prestige: 2, stats: stats,
      virtual: virtual
    };
    const detail = {
      id: id, devStartYear: 2024, devStartMonth: 1, devMonths: 18,
      virtual: virtual, inviteEligible: false
    };
    if (virtual) {
      st.career.virtualProjects.push(title);
      st.career.virtualDetails.push(detail);
    } else {
      cfg.careerWorld.titles.push(title);
      cfg.careerWorld.titleDetails.push(detail);
    }
    st.career.titleId = id;
    st.career.liveStats = deepClone(stats);
    st.career.credits.push({ titleId: id, companyId: st.career.companyId,
      studioId: st.career.studioId, shipped: false, signedEligible: true });
    return { cfg: cfg, st: st, title: title };
  }

  function month(st, cfg) {
    return sim.tickCareerMonth(st, cfg);
  }

  (function longLinesStopStartingBeforeFinalYear() {
    const x = at2025(2025, 2, true);
    x.st.year = 2021;
    assert(!sim.startCareerLine(x.st, "bond-peer", x.cfg).ok,
      "a colleague line cannot start after its last eligible year");
    x.st.year = 2023;
    assert(!sim.canStartBecomeProducerLine(x.st, x.cfg, { ignoreMinRank: true }),
      "a producer line cannot start close to the final year");
    assert(!sim.startCareerLine(x.st, "become-producer", x.cfg, { ignoreMinRank: true }).ok,
      "direct producer starts obey the same cutoff");
    ok("last dance: producer and colleague lines stop opening in late career");
  })();

  (function oldSaveLongLinesCloseAtLastDance() {
    const x = at2025(2025, 2, true);
    const lines = x.st.career.lines;
    lines["become-producer"] = { status: "active", beat: 1, pending: false, waitingFor: "ship" };
    lines["bond-junior"] = { status: "active", beat: 5, pending: false, waitingFor: "months" };
    x.st.career.pendingMentorProducer = { mentorSponsor: true };
    x.st.career.awaitingProducerPitch = true;
    x.st.career.producerPitchOptions = [{ id: "stale-pitch" }];
    const r = month(x.st, x.cfg);
    const cr = r.state.career;
    assert(cr.lastDance.linesClosed && cr.lines["become-producer"].status === "aborted" &&
      cr.lines["bond-junior"].status === "aborted",
      "unfinished producer and colleague lines close before the final year runs");
    assert(cr.lines["bond-junior"].endgameClosed && !cr.lines["bond-junior"].pending &&
      cr.lines["bond-junior"].waitingFor === null,
      "an old save no longer waits for a colleague beat");
    assert(!cr.pendingMentorProducer && !cr.awaitingProducerPitch && !cr.producerPitchOptions,
      "old producer prompts cannot block the last assignment");
    ok("last dance: old save long lines and producer prompts close on entry");
  })();

  (function skipRunHasNoLateColleagueLine() {
    const fresh = sim.createCareerGame("快进回归", "programmer", config);
    fresh.rngSeed = 34;
    fresh.rngCount = 0;
    let st = sim.acceptOpeningOffer(fresh, fresh.career.openingOffers[0].id, config).state;
    let reached = false;
    for (let step = 0; step < 600 && st.phase === "PLAYING"; step++) {
      const r = sim.skipToNextNode(st, config);
      st = r.state;
      if ((r.queue || []).some(function (p) { return p.id === "lastDanceOpening"; })) {
        reached = true;
        break;
      }
      const pages = (r.queue || []).slice();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.presentation !== "choice" || !page.options) continue;
        let chosen = null;
        for (const option of page.options) {
          const trial = sim.resolveCareerQueueChoice(st, page, option.id, config);
          if (trial && trial.ok) { chosen = trial; break; }
        }
        assert(chosen, "skip run can answer " + (page.id || page.type));
        st = chosen.state;
        if (chosen.queue && chosen.queue.length) pages.splice(i + 1, 0, ...chosen.queue);
      }
    }
    assert(reached, "seed 34 reaches the last dance with skip navigation");
    assert(!sim.activeCareerLineIds(st).some(function (id) {
      return id === "become-producer" || id.indexOf("bond-") === 0;
    }), "seed 34 has no active producer or colleague line at the last dance");
    ok("last dance: skip seed 34 has finished its long lines");
  })();

  (function earlyProjectGetsFinalWork() {
    const x = at2025(2025, 2, true);
    let r = month(x.st, x.cfg);
    r = month(r.state, x.cfg);
    const d = r.state.career.lastDance;
    const final = sim.careerTitle(d.finalId, x.cfg, r.state);
    assert(!!final && final.releaseYear === 2025 && final.releaseMonth <= 10,
      "early penultimate receives final short work before November");
    assert(r.queue.some(function (p) { return p.id === "lastDanceOpening"; }),
      "handoff opens the last dance event");
    ok("last dance: early completion assigns a short final work");
  })();

  (function finalWorkNameIsChosenFromTheTitlePool() {
    const names = {};
    for (let seed = 1; seed <= 8; seed++) {
      const x = at2025(2025, 2, true);
      x.st.rngSeed = seed;
      let r = month(x.st, x.cfg);
      r = month(r.state, x.cfg);
      const final = sim.careerTitle(r.state.career.lastDance.finalId, x.cfg, r.state);
      const pool = x.cfg.careerWorld.titlePool.titlesByGenre[final.genreId];
      assert(pool.indexOf(final.name) >= 0,
        "last work uses a name from its genre's title pool");
      names[final.name] = true;
    }
    assert(Object.keys(names).length > 1, "last work name varies between careers");
    ok("last dance: final work names vary and match their genre");
  })();

  (function springVirtualExtendsToJune() {
    const x = at2025(2025, 4, true);
    let r = month(x.st, x.cfg);
    assert(x.title.releaseMonth === 4, "input state is immutable across tick");
    let st = r.state;
    assert(sim.careerTitle(x.title.id, x.cfg, st).releaseMonth === 6,
      "spring virtual work moves to June");
    for (let i = 2; i <= 6; i++) r = month(st, x.cfg), st = r.state;
    assert(st.career.lastDance.finalId &&
      sim.careerTitle(st.career.lastDance.finalId, x.cfg, st).releaseMonth === 10,
      "June completion leaves a July-October final project");
    ok("last dance: virtual penultimate extends to June");
  })();

  (function historicalDateStaysAndHandoffExtends() {
    const x = at2025(2025, 3, false);
    let st = x.st, r;
    for (let i = 1; i <= 6; i++) r = month(st, x.cfg), st = r.state;
    assert(x.title.releaseMonth === 3, "historical catalogue date is unchanged");
    assert(st.career.lastDance.finalId &&
      sim.careerTitle(st.career.lastDance.finalId, x.cfg, st).releaseMonth === 10,
      "historical spring release hands over in June, then starts final short work");
    ok("last dance: historical release date survives the midyear handoff");
  })();

  (function laterProjectIsReplanned() {
    const x = at2025(2026, 3, false);
    const r = month(x.st, x.cfg);
    const d = r.state.career.lastDance;
    assert(d.penultimateId && d.penultimateId !== x.title.id &&
      sim.careerTitle(d.penultimateId, x.cfg, r.state).releaseMonth === 6,
      "a project past midyear is replaced by a June fictional penultimate");
    assert(x.title.releaseYear === 2026, "late historical release stays in the catalogue");
    ok("last dance: a late project is replanned without changing history");
  })();

  (function finaleReadsThisWorksActualAwards() {
    const x = at2025(2025, 2, true);
    const st = x.st;
    st.career.lastDance = { stage: "final", finalId: "signed-final", choice: "work" };
    st.career.credits.push({ titleId: "signed-final", shipped: true, signedEligible: true });
    st.worldReleased.push({ id: "signed-final", title: "Final", releasedYear: 2025, releasedMonth: 10 });
    st.awardsHistory.push({ year: 2025, awards: [{ id: "goty", n: "GOTY", titleId: "signed-final",
      nominees: [{ titleId: "signed-final" }] }] });
    assert(sim.lastDanceFinale(st, x.cfg).body.indexOf("最后一项奖") >= 0,
      "GOTY win uses actual final title result");
    st.awardsHistory[0].awards[0].titleId = "another-title";
    assert(sim.lastDanceFinale(st, x.cfg).body.indexOf("提名席") >= 0,
      "nomination without win has its own finale");
    st.awardsHistory[0].awards[0].nominees = [];
    assert(sim.lastDanceFinale(st, x.cfg).body.indexOf("没有走上颁奖台") >= 0,
      "eligible but un-nominated work has its own finale");
    ok("last dance: finale follows the signed title's real award result");
  })();

  (function completeYearKeepsDecemberBeforePoster() {
    const x = at2025(2025, 2, true);
    let st = x.st, r, opening = 0, awardCue = 0, finale = 0;
    for (let i = 1; i <= 12; i++) {
      r = month(st, x.cfg);
      st = r.state;
      if (i < 12) assert(st.phase === "PLAYING", "career still plays before December ends");
      let pending = r.queue.slice();
      while (pending.length) {
        const page = pending.shift();
        if (page.id === "lastDanceOpening") opening++;
        if (page.id === "lastDanceAwardNight") awardCue++;
        if (page.id === "lastDanceFinale") {
          finale++;
          assert(i === 12 && pending.length === 0, "final text follows all December pages");
        }
        if (page.options && page.options.length) {
          let chosen = null;
          for (const option of page.options) {
            const attempt = sim.resolveCareerQueueChoice(sim.clone(st), page, option.id, x.cfg);
            if (attempt && attempt.ok) { chosen = attempt; break; }
          }
          if (chosen) {
            st = chosen.state;
            pending = (chosen.queue || []).concat(pending);
          }
        }
      }
      st = deepClone(st);
    }
    assert(st.phase === "SETTLED" && opening === 1 && awardCue === 1 && finale === 1,
      "opening, final award cue and December finale each fire once before settlement");
    const final = sim.careerTitle(st.career.lastDance.finalId, x.cfg, st);
    assert(final.releaseMonth <= 10 && st.worldReleased.some(function (g) {
      return g.id === final.id && g.player;
    }), "last work is signed and released before the November awards");
    const poster = sim.careerPosterView(st, x.cfg);
    const resume = sim.careerResumeView(st, x.cfg);
    assert(poster.moments.some(function (moment) {
      return moment.item.titleId === final.id && moment.item.title === final.name;
    }), "final work appears by name on the career poster");
    assert(poster.signedCount === 1 && poster.transitionCount === 0 &&
      resume.signedCount === 1 && resume.transitionCount === 0,
      "final work counts as a signed release in this one-release career: " +
      [poster.signedCount, poster.transitionCount, resume.signedCount, resume.transitionCount].join("/"));
    ok("last dance: save/resume preserves the November award and December finale");
  })();
};
