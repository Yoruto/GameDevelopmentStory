// 测试用例组：04-catalog（由 scripts/split_tests.py 机械拆分，块内容未改）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok, PDIMS = ctx.PDIMS, TDIMS = ctx.TDIMS,
      fs = ctx.fs, path = ctx.path, ROOT = ctx.ROOT, SIM_FILES = ctx.SIM_FILES,
      __dirname = ctx.__dirname,
      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,
      fixCycle = ctx.fixCycle, withoutTitlePool = ctx.withoutTitlePool,
      withoutCatalog = ctx.withoutCatalog, withTitlePool = ctx.withTitlePool,
      tsum = ctx.tsum, hireOne = ctx.hireOne, firstIds = ctx.firstIds,
      pitchArgs = ctx.pitchArgs, quietWorld = ctx.quietWorld, fillerLadder = ctx.fillerLadder;
  // 世界随机事件池（config.world.events / historicalEvents）随经营档一并移除，
  // 生涯档的事件走 careerWorld.eventLines 与 careerWorld.devEvents。
  (function catalogStatJitterIsIntegerPctCeil() {
    const q = config.careerWorld.quality;
    assert(q.statJitterMinPct === -10 && q.statJitterMaxPct === 10, "jitter range in config");
    const tweaked = deepClone(config);
    tweaked.careerWorld.quality.statJitterMinPct = 7;
    tweaked.careerWorld.quality.statJitterMaxPct = 7;
    const st = { rngSeed: 1, rngCount: 0 };
    const out = sim.applyCatalogStatJitter(st, { play: 85, fun: 85, expression: 85, immersion: 85 }, tweaked);
    assert(out.play === 91 && out.fun === 91 && out.expression === 91 && out.immersion === 91, "85 * 1.07 ceil -> 91");
    tweaked.careerWorld.quality.statJitterMinPct = -10;
    tweaked.careerWorld.quality.statJitterMaxPct = -10;
    const down = sim.applyCatalogStatJitter({ rngSeed: 1, rngCount: 0 }, { play: 85, fun: 10, expression: 0, immersion: 100 }, tweaked);
    assert(down.play === 77, "85 * 0.9 ceil -> 77");
    assert(down.fun === 9, "10 * 0.9 ceil -> 9");
    assert(down.expression === 0, "0 stays 0");
    assert(down.immersion === 90, "100 * 0.9 ceil -> 90");
    const a = sim.applyCatalogStatJitter({ rngSeed: 42, rngCount: 0 }, { play: 76, fun: 82, expression: 96, immersion: 97 }, config);
    const b = sim.applyCatalogStatJitter({ rngSeed: 42, rngCount: 0 }, { play: 76, fun: 82, expression: 96, immersion: 97 }, config);
    assert(JSON.stringify(a) === JSON.stringify(b), "same seed same jitter");
    TDIMS.forEach(function (k) {
      const base = { play: 76, fun: 82, expression: 96, immersion: 97 }[k];
      const lo = Math.ceil(base * 0.9);
      const hi = Math.ceil(base * 1.1);
      assert(a[k] >= lo && a[k] <= hi && a[k] === Math.floor(a[k]), "jitter integer in range " + k);
    });
    const g = sim.createCareerGame("测", "programmer", config);
    const rec = (g.worldReleased || []).filter(function (t) { return t.id; })[0];
    const catalog = rec && sim.careerTitle(rec.id, config);
    if (rec && catalog && catalog.stats) {
      TDIMS.forEach(function (k) {
        const base = catalog.stats[k];
        const lo = Math.ceil(base * 0.9);
        const hi = Math.ceil(base * 1.1);
        assert(rec.stats[k] >= lo && rec.stats[k] <= hi, "worldReleased " + rec.id + "." + k);
      });
    }
    ok("catalog stat jitter is integer pct then ceil");
  })();

  (function worldLabelAliasSwitch() {
    const mihoyo = sim.careerCompany("mihoyo", config);
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.useAlias = false;
    assert(sim.worldLabel(mihoyo, tweaked) === mihoyo.name, "real name");
    tweaked.careerWorld.useAlias = true;
    assert(sim.worldLabel(mihoyo, tweaked) === mihoyo.alias, "alias");
    ok("worldLabel is a single helper for name/alias");
  })();

  (function careerCalendarListsSeriesVersions() {
    const g = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const pack = sim.careerYearReleases(2024, config, acc.state);
    const liveRows = [];
    Object.keys(pack.months).forEach(function (m) {
      (pack.months[m] || []).forEach(function (t) {
        if (t.releaseType === "liveops") liveRows.push(t);
      });
    });
    assert(liveRows.length > 0, "2024 has live releases on the calendar");
    assert(liveRows.some(function (t) { return String(t.name || t.title || "").indexOf("原神：") === 0; }), "genshin version appears as 原神：xxx, got " + liveRows.map(function (t) { return t.name; }).join(","));
    assert(liveRows.some(function (t) { return String(t.name || "").indexOf("魔兽世界：") === 0; }), "wow version appears as 魔兽世界：xxx");
    // 2005 年还没有版本化，只有单条老作品
    const early = sim.careerYearReleases(2005, config, acc.state);
    let earlyVersions = 0;
    Object.keys(early.months).forEach(function (m) {
      (early.months[m] || []).forEach(function (t) {
        if (t.versionName) earlyVersions += 1;
      });
    });
    assert(earlyVersions === 0, "no version entries before the version era, got " + earlyVersions);
    ok("career calendar lists 系列：版本名 entries and nothing before the era");
  })();

  (function flagshipSeriesShipOneVersionPerYear() {
    // 「同一系列每年至多一个版本、相邻版本间隔 ≥12 个月」是 careerWorld.titles 的数据生成规则，
    // 不是可调旋钮——经营档的 liveTag 段已随公司档删除，这两个数在这里直接钉死。
    const versionsPerYear = 1;
    const minIntervalMonths = 12;
    const titles = (config.careerWorld.titles || []).filter(function (t) { return t.releaseType === "liveops" && t.seriesId; });
    const bySeries = {};
    titles.forEach(function (t) {
      const key = t.seriesId;
      bySeries[key] = bySeries[key] || {};
      const y = t.releaseYear;
      bySeries[key][y] = (bySeries[key][y] || 0) + 1;
    });
    Object.keys(bySeries).forEach(function (sid) {
      Object.keys(bySeries[sid]).forEach(function (y) {
        assert(bySeries[sid][y] <= versionsPerYear, sid + " ships " + bySeries[sid][y] + " in " + y);
      });
    });
    // 长线版本必须带版本名，且名字是「系列：版本名」
    let versioned = 0;
    titles.forEach(function (t) {
      if (!t.versionName) return;
      versioned += 1;
      assert(String(t.name).indexOf(t.versionName) > 0, "name carries the version name: " + t.name);
    });
    assert(versioned >= 40, "flagship series laid out with yearly versions, got " + versioned);
    // 同一系列相邻两部的间隔至少 12 个月
    const ordered = {};
    titles.forEach(function (t) {
      (ordered[t.seriesId] = ordered[t.seriesId] || []).push(t);
    });
    Object.keys(ordered).forEach(function (sid) {
      const rows = ordered[sid].slice().sort(function (a, b) {
        return (a.releaseYear * 12 + a.releaseMonth) - (b.releaseYear * 12 + b.releaseMonth);
      });
      let i;
      for (i = 1; i < rows.length; i++) {
        const gap = (rows[i].releaseYear - rows[i - 1].releaseYear) * 12 + (rows[i].releaseMonth - rows[i - 1].releaseMonth);
        assert(gap >= minIntervalMonths, sid + " gap " + gap + " months between " + rows[i - 1].id + " and " + rows[i].id);
      }
    });
    ok("every series ships at most one version per year, gaps >= 12 months");
  })();

  (function careerWorldCatalog() {
    const world = config.careerWorld;
    assert(world && typeof world.useAlias === "boolean", "useAlias flag");
    assert(world.timeline && world.timeline.startYear === 1995, "career timeline 1995");
    assert(world.timeline.endYear === 2025, "career timeline 2025");
    assert(world.quality && world.quality.liveCanExceedMax === true, "live stats can exceed config max");
    assert(world.quality.statMin === 0 && world.quality.statMax === 100, "config stat range 0-100");
    const dimList = world.quality.dims || [];
    assert(dimList.join(",") === "play,fun,expression,immersion", "title quality dims");
    assert((world.quality.personDims || []).join(",") === "program,design,art,music", "person dims");
    const companies = world.companies || [];
    const titles = world.titles || [];
    const details = world.titleDetails || [];
    assert(companies.length >= 40, "company count " + companies.length);
    assert(titles.length >= 120, "title count " + titles.length);
    assert(details.length === titles.length, "titleDetails 1:1 with titles");
    const companyIds = {};
    companies.forEach(function (c) {
      assert(c.id && c.name && c.alias, "company name/alias " + c.id);
      assert(!companyIds[c.id], "dup company " + c.id);
      companyIds[c.id] = true;
      if (c.joinable === true) {
        const seniors = c.seniors || [];
        assert(seniors.length >= 1, "joinable company needs 前辈 " + c.id);
        seniors.forEach(function (s) {
          assert(s.id && s.name && s.title, "senior fields " + c.id + "/" + (s && s.id));
          assert(s.bio, "senior bio " + c.id + "/" + s.id);
        });
      }
    });
    const titleIds = {};
    const years = {};
    const genreIds = {};
    const gameplayIds = {};
    (config.content.genres || []).forEach(function (g) { genreIds[g.id] = true; });
    (config.content.gameplay || []).forEach(function (g) { gameplayIds[g.id] = true; });
    titles.forEach(function (t) {
      assert(t.id && t.name && t.alias, "title name/alias " + t.id);
      assert(!titleIds[t.id], "dup title " + t.id);
      titleIds[t.id] = true;
      assert(companyIds[t.companyId], "title company " + t.id);
      assert(companyIds[t.publisherId], "title publisher " + t.id);
      assert(t.releaseYear >= 1995 && t.releaseYear <= 2025, "title year " + t.id);
      assert(typeof t.score === "number" && t.score >= 1 && t.score <= 10, "title score " + t.id);
      assert(genreIds[t.genreId], "title genre " + t.id + " " + t.genreId);
      assert(gameplayIds[t.gameplayId], "title gameplay " + t.id + " " + t.gameplayId);
      const stt = t.stats || {};
      dimList.forEach(function (d) {
        assert(Number.isInteger(stt[d]), "stats int " + t.id + " " + d);
        assert(stt[d] >= 0 && stt[d] <= 100, "stats range " + t.id + " " + d + "=" + stt[d]);
      });
      if (t.peakDims) {
        t.peakDims.forEach(function (d) {
          assert(stt[d] != null, "peakDim subset " + t.id + " " + d);
        });
      }
      years[t.releaseYear] = true;
    });
    for (let y = 1995; y <= 2025; y += 1) {
      assert(years[y], "missing titles in " + y);
    }
    details.forEach(function (d) {
      assert(titleIds[d.id], "orphan detail " + d.id);
      assert(d.inviteWindow && d.inviteRoles && d.inviteRoles.length === 4, "invite fields " + d.id);
      if (d.awards != null) {
        assert(Array.isArray(d.awards) && d.awards.length === 0, "no prefilled awards " + d.id);
      }
    });
    const opening = companies.filter(function (c) { return c.openingOffer; });
    assert(opening.length >= 9, "opening offer pool");
    const openingSmall = companies.filter(function (c) { return c.openingOffer && c.starterTier === "small"; });
    assert(openingSmall.length >= 12, "opening small pool " + openingSmall.length);
    const openingBig = companies.filter(function (c) { return c.openingOffer && c.starterTier && c.power === 3; });
    assert(openingBig.length <= 3, "few opening 大厂 " + openingBig.map(function (c) { return c.id; }).join(","));
    assert(companies.filter(function (c) { return c.id === "nintendo"; })[0].openingOffer === false, "nintendo not opening");
    const paper = companies.filter(function (c) { return c.id === "paperGames"; })[0];
    const santaMonica = companies.filter(function (c) { return c.id === "santaMonica"; })[0];
    assert(paper && paper.joinable === true && (paper.seniors || []).length >= 1, "paperGames hop pool");
    assert(santaMonica && santaMonica.joinable === true && (santaMonica.seniors || []).length >= 1, "santaMonica hop pool");
    assert(sim.companyJoinable(paper, 2013), "paperGames hire from 2013");
    assert(!sim.companyJoinable(paper, 2012), "paperGames closed before 2013");
    assert(sim.companyJoinable(santaMonica, 1999), "santaMonica hire from 1999");
    assert(!sim.companyJoinable(santaMonica, 1998), "santaMonica closed before 1999");
    const noCatalog = companies.filter(function (c) {
      return c.joinable && !titles.some(function (t) { return t.companyId === c.id; });
    });
    assert(!noCatalog.length, "joinable companies have catalog: " + noCatalog.map(function (c) { return c.id; }).join(", "));
    const paperTitles = titles.filter(function (t) { return t.companyId === "paperGames"; });
    assert(paperTitles.length >= 5, "paperGames has catalog titles " + paperTitles.length);
    const paperReturn = (world.eventLines.bonds.returnInvite.titlesByCompany || {}).paperGames;
    assert(paperReturn, "paperGames returnInvite title");
    const paperJunior = (world.eventLines.bonds.juniorRevealPool || []).filter(function (p) { return p.seniorId === "yao-runhao"; })[0];
    assert(paperJunior && paperJunior.titleId, "paperGames junior reveal has titleId");
    // P1 厂商合并砍掉了 20 家 power=1 的「已倒闭发行商」背景公司（作品 ≤2 且不能入职），
    // 世界里仍保留不可入职的背景公司即可。
    const unjoinable = companies.filter(function (c) { return c.joinable === false; });
    assert(unjoinable.length >= 1, "unjoinable world houses " + unjoinable.length);
    for (let y = 1995; y <= 2025; y += 1) {
      const n = titles.filter(function (t) { return t.releaseYear === y; }).length;
      assert(n >= 10, "year " + y + " releases " + n);
    }
    const genshin = titles.filter(function (t) { return t.id === "genshin"; })[0];
    assert(genshin && genshin.companyId === "mihoyo" && genshin.name === "原神", "genshin real name");
    const mihoyo = companies.filter(function (c) { return c.id === "mihoyo"; })[0];
    assert(mihoyo && mihoyo.alias === "米社", "mihoyo alias");
    const ff7 = titles.filter(function (t) { return t.id === "ff7"; })[0];
    assert(ff7 && ff7.stats.expression > ff7.stats.play && ff7.stats.immersion > ff7.stats.fun, "ff7 expression/immersion peak");
    const events = (world.devEvents && world.devEvents.list) || [];
    assert(events.length >= 56, "career devEvents " + events.length);
    assert(world.devEvents.minGapMonths === 2 && world.devEvents.pityMonths === 6 && world.devEvents.maxPerYear === 2, "devEvent cadence keys (P5e pacing: maxPerYear 2)");
    const eventIds = {};
    const rolePhaseChoices = {};
    const genericChoiceIds = ["crunchTradeoff", "scopeCutChoice", "goldDelayChoice"];
    events.forEach(function (ev) {
      assert(!eventIds[ev.id], "duplicate devEvent " + ev.id);
      eventIds[ev.id] = true;
      if (ev.presentation === "choice") {
        assert(ev.choices && ev.choices.length, "choice dims " + ev.id);
        ev.choices.forEach(function (ch) {
          assert(ch.qualityDim, "choice qualityDim " + ev.id + "/" + ch.id);
        });
        if (genericChoiceIds.indexOf(ev.id) >= 0) {
          assert(!ev.role, "generic choice has no role " + ev.id);
        } else if (ev.role) {
          assert(ev.phase, "role choice needs phase " + ev.id);
          const key = ev.role + ":" + ev.phase;
          rolePhaseChoices[key] = (rolePhaseChoices[key] || 0) + 1;
        }
      } else if (!(ev.manualOnly && ev.triggerFlag)) {
        // echo beats are pure prose: they pay off a flag, they carry no stat payload.
        assert(ev.qualityDim, "event qualityDim " + ev.id);
      }
    });
    genericChoiceIds.forEach(function (id) {
      assert(eventIds[id], "kept generic " + id);
    });
    ["programmer", "art", "design", "music"].forEach(function (role) {
      ["prepro", "production", "alpha", "polish", "gold"].forEach(function (phase) {
        assert((rolePhaseChoices[role + ":" + phase] || 0) >= 2, "role/phase choices " + role + "/" + phase);
      });
    });
    const pl = world.postLaunch || {};
    assert(pl.monthsMin === 0 && pl.monthsMax === 0, "postLaunch occupancy off");
    assert((pl.events || []).length >= 12, "postLaunch events " + (pl.events || []).length);
    const plRoleChoices = {};
    (pl.events || []).forEach(function (ev) {
      assert(!eventIds[ev.id], "duplicate postLaunch " + ev.id);
      eventIds[ev.id] = true;
      if (ev.presentation === "choice") {
        assert(ev.choices && ev.choices.length, "postLaunch choice " + ev.id);
        ev.choices.forEach(function (ch) {
          assert(ch.qualityDim, "postLaunch qualityDim " + ev.id + "/" + ch.id);
        });
        if (ev.role) plRoleChoices[ev.role] = (plRoleChoices[ev.role] || 0) + 1;
      }
    });
    ["programmer", "art", "design", "music"].forEach(function (role) {
      assert((plRoleChoices[role] || 0) >= 2, "postLaunch role choices " + role);
    });
    const px = world.playerXp || {};
    assert(px.liveBonusPerXp != null && px.liveBonusCap != null, "playerXp live formula");
    assert(px.contribBonusPerXp != null && px.contribBonusCap != null, "playerXp contrib formula");
    const vp = world.titlePool || {};
    assert(vp.devMonthsMin === 6 && vp.devMonthsMax === 24, "pool duration 6-24");
    assert(vp.enabled === true, "title pool ships enabled (P2-fix)");
    assert(vp.coverage && vp.coverage.enabled === true && vp.coverage.minFillMonths === 6,
      "pool coverage policy: fill gaps of 6+ months");
    assert(vp.fallback && vp.fallback.enabled === true, "pool fallback policy on");
    const gap = world.idleGap || {};
    assert(gap.minDevMonths === 6, "idleGap minDevMonths");
    assert(gap.eventId && (gap.choices || []).length >= 3, "idleGap choices");
    ["outsource", "study", "rest"].forEach(function (id) {
      assert((gap.choices || []).some(function (c) { return c.id === id; }), "idleGap choice " + id);
    });
    const dev = world.development || {};
    assert(dev.cycleMult >= 1.5 && dev.cycleMult <= 2, "development.cycleMult in 1.5-2, got " + dev.cycleMult);
    const late = world.lateJoin || {};
    assert(late.progressMin != null, "lateJoin progressMin");
    assert(late.hopHireChanceMul != null && late.hopHireChanceMul < 1, "lateJoin hop mul");
    assert(world.save && world.save.version >= 9, "career saveVersion");
    const ranks = world.jobRanks || {};
    assert(ranks.min === 1 && ranks.max === 6, "jobRanks 1-6");
    assert(ranks.codeSeries && ranks.codeSeries.programmer === "T" && ranks.codeSeries.design === "D" && ranks.codeSeries.art === "A" && ranks.codeSeries.music === "M", "rank code series T/D/A/M");
    ["programmer", "design", "art", "music"].forEach(function (role) {
      assert(ranks.titles && ranks.titles[role] && ranks.titles[role].length === 6, "job titles " + role);
      ranks.titles[role].forEach(function (row) {
        assert(row.code != null, "title code " + role + " " + row.id);
      });
    });
    const nintendoSeniors = ((sim.careerCompany("nintendo", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(nintendoSeniors.indexOf("宫本茂") >= 0, "nintendo has 宫本茂");
    const konamiSeniors = ((sim.careerCompany("konami", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(konamiSeniors.indexOf("小岛秀夫") >= 0, "konami has 小岛秀夫");
    const mihoyoSeniors = ((sim.careerCompany("mihoyo", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(mihoyoSeniors.indexOf("大伟哥") >= 0, "mihoyo has 大伟哥");
    ok("career world catalog: companies, titles, details, alias switch");
  })();

};
