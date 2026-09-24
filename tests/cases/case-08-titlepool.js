// 测试用例组：08-titlepool（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function titlePoolCoversCompanyWithoutCatalogWork() {
    // P2-fix：游戏池回来了，但语义变了——池作不再只是「待命太久才长出来的虚拟作」，
    // 而是「公司排不出目录真作时的顶班」。
    // ⚠️ 不要把公司写死：P2-fix-a 分两批补了 188 部真实历史作品，任何「某厂某年空着」的
    //    硬编码都会随数据增长失效（原来是 fromsoftware 1995，补了《国王密令II》之后就不空了）。
    //    所以现场扫一家在开局当月确实排不出目录真作的公司来验。
    const tp = config.careerWorld.titlePool || {};
    assert(tp.enabled === true, "titlePool.enabled is true by default");
    assert(tp.coverage && tp.coverage.enabled === true && tp.coverage.minFillMonths === 6,
      "coverage policy on with minFillMonths 6");
    assert(tp.fallback && tp.fallback.enabled === true, "fallback policy on");
    assert(tp.idleMaxMonths != null && tp.devMonthsMin != null && tp.devMonthsMax != null && tp.titlesByGenre,
      "pool fields kept (idle cap / duration range / name bank)");

    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    const companies = config.careerWorld.companies || [];
    let picked = null;
    for (let ci = 0; ci < companies.length; ci++) {
      const co = companies[ci];
      const stud = sim.careerStudios(co)[0];
      if (!stud) continue;
      if (co.hireFromYear != null && co.hireFromYear > st.year) continue;
      if (co.hireUntilYear != null && co.hireUntilYear < st.year) continue;
      st.career.companyId = co.id;
      st.career.studioId = stud.id;
      st.career.titleId = null;
      st.career.liveStats = null;
      st.career.idleMonths = 0;
      // 关键：判据要和 assignCareerProject 一致 —— 只有「当月没有目录真作在研」
      //（pickCareerAssignment 返回 null）时池才是唯一出路。只看 careerProjectView().idle
      // 不够：玩家只是还没被派到活，公司照样可能有真作在研。
      if (sim.careerProjectView(st, config).idle &&
          !sim.titlesInDevAt(co.id, st.year, st.month, config, st, stud.id).length &&
          sim.canStartPoolProject(st, config)) {
        picked = co.id;
        break;
      }
    }
    assert(picked, "至少有一家公司在 1995.01 排不出目录真作、且池能顶上");
    assert(sim.careerProjectView(st, config).idle, "starts idle at " + picked + " 1995");
    assert(sim.canStartPoolProject(st, config), "the pool can cover that month");
    assert(sim.poolCandidateAt(st, config, picked, st.career.studioId, 1995, 1),
      "pool candidate exists for that month");
    // 入职当月就顶上：不再先等 idleMaxMonths 个月（R2 入职兜底）
    sim.assignCareerProject(st, config);
    const view = sim.careerProjectView(st, config);
    assert(!view.idle, "join month is covered by a pool project");
    assert(view.title && view.title.virtual && view.title.pool, "the cover is a pool title");
    assert(view.title.companyId === picked && view.title.genreId && view.title.gameplayId,
      "pool title belongs to the company and carries genre/gameplay");
    const det = sim.careerTitleDetail(view.title.id, config, st);
    assert(det.devMonths >= 6 && det.devMonths <= 24, "pool duration in range " + det.devMonths);
    assert(det.inviteEligible === false, "pool titles are not invite targets");
    ok("title pool covers a company with no catalog work, at the join month (" + picked + ")");
  })();

  (function titlePoolOffFallsBackToIdleGap() {
    // 关掉池 → 回到 P2b：空窗不长出任何作品，整段交给推进吸收 / 空窗抉择。
    const off = deepClone(config);
    withoutTitlePool(off);
    const g = sim.createCareerGame("测", "programmer", off);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, off).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleMonths = 0;
    assert(sim.startPoolProject(st, off) === null, "pool builder refuses while the pool is off");
    // 连推 60 个月（远超 idleMaxMonths）：一次都不该出现池作
    let poolSeen = null, months = 0, view = sim.careerProjectView(st, off);
    while (months < 60) {
      st = sim.tickMonth(st, off).state;
      view = sim.careerProjectView(st, off);
      if (view.title && view.title.virtual) poolSeen = view.title.id;
      months += 1;
    }
    assert(!poolSeen, "60 idle months with the pool off never fabricate a title (saw " + poolSeen + ")");
    assert(st.career.idleGap && st.career.idleGap.prompted, "the idle gap choice is the fallback");
    ok("title pool off: idle stays idle, the idle gap choice takes over");
  })();

  (function titlePoolDurationClampedToNextCatalog() {
    const tp = config.careerWorld.titlePool || {};
    assert(tp.devMonthsMax === 24 && tp.devMonthsMin === 6, "pool duration 6-24");
    const on = withoutCatalog(fixCycle(deepClone(config)), "fromsoftware");
    let g = sim.createCareerGame("测", "programmer", on);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, on).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    const virt = sim.startPoolProject(st, on);
    assert(virt && virt.virtual && virt.pool, "fromsoftware 1995 starts a pool project");
    const vdet = sim.careerTitleDetail(virt.id, on, st);
    assert(vdet.devMonths >= 6 && vdet.devMonths <= 24, "pool months in range");

    on.careerWorld.titles = (on.careerWorld.titles || []).concat([{
      id: "gapLongProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "长空窗探针",
      alias: "长空窗探针",
      releaseYear: 1997,
      releaseMonth: 1,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    on.careerWorld.titleDetails = (on.careerWorld.titleDetails || []).concat([{
      id: "gapLongProbe",
      devStartYear: 1995,
      devStartMonth: 11,
      devMonths: 14
    }]);
    g = sim.createCareerGame("测", "programmer", on);
    st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, on).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    assert(sim.catalogGapMonths(st, on, "fromsoftware", "fromsoftware-main") === 10, "gap 10 months");
    const clamped = sim.startPoolProject(st, on);
    assert(clamped && clamped.virtual, "gap>=6 starts virtual");
    const cdet = sim.careerTitleDetail(clamped.id, on, st);
    assert(cdet.devMonths >= 6 && cdet.devMonths <= 10, "pool duration clamped to the gap");
    ok("pool duration clamped to the next catalog title");
  })();

  (function titlePoolCoversEveryCompanyLifespan() {
    // R1 的验收口径：每家可入职公司，从成立（或 1995 开局）到 2025 年底，每个月
    // 要么有目录真作在研，要么能抽池作顶上。唯一允许的空窗是「到下一档真作开工月
    // 不足 minFillMonths」的短空窗 —— 最长 minFillMonths − 1 个月。
    const world = config.careerWorld;
    const tl = world.timeline;
    const minFill = sim.poolMinFillMonths(config);
    const startIdx = sim.monthIndex(tl.startYear, tl.startMonth);
    const endIdx = sim.monthIndex(tl.endYear, tl.endMonth);
    const det = {};
    (world.titleDetails || []).forEach(function (d) { det[d.id] = d; });
    let worst = 0, worstAt = "-", scanned = 0;
    (world.companies || []).filter(function (c) {
      return sim.companyJoinable(c, tl.startYear);
    }).forEach(function (c) {
      const anchor = Math.max(startIdx, sim.monthIndex(c.hireFromYear || c.foundedYear || tl.startYear, 1));
      const cov = new Uint8Array(endIdx - anchor + 1);
      const starts = [];
      (world.titles || []).forEach(function (t) {
        const d = det[t.id];
        if (t.companyId !== c.id || t.virtual || !d) return;
        const a = sim.titleDevStart(t, d, config);
        const b = sim.monthIndex(t.releaseYear, t.releaseMonth);
        starts.push(a);
        for (let i = Math.max(a, anchor); i <= Math.min(b, endIdx); i++) cov[i - anchor] = 1;
      });
      starts.sort(function (x, y) { return x - y; });
      let si = 0, run = 0;
      for (let idx = anchor; idx <= endIdx; idx++) {
        scanned += 1;
        let ok = cov[idx - anchor] === 1;
        if (!ok) {
          while (si < starts.length && starts[si] <= idx) si += 1;
          ok = si >= starts.length || (starts[si] - idx) >= minFill;
        }
        run = ok ? 0 : run + 1;
        if (run > worst) {
          worst = run;
          worstAt = c.id + " @" + sim.monthFromIndex(idx).year + "." + sim.monthFromIndex(idx).month;
        }
      }
    });
    assert(scanned > 10000, "scanned the whole timeline (" + scanned + " company-months)");
    assert(worst <= minFill - 1,
      "longest dead run " + worst + " at " + worstAt + " must be <= " + (minFill - 1) + " months");
    ok("every joinable company is covered from founding to 2025 by catalog + pool");
  })();

  (function careerIdleGapChoiceOnceAndHop() {
    // P2-fix：池开着时空窗一律由池作顶上，本用例覆盖「池关掉」那条兜底路径：
    // 短空窗（< minDevMonths）由推进静默吸收；长空窗（或本公司已排不出下一档目录作）
    // 才弹一次「空窗抉择」：接外包 / 进修 / 休息。
    const gapSpec = config.careerWorld.idleGap || {};
    const minDev = gapSpec.minDevMonths != null ? gapSpec.minDevMonths : 6;
    assert(minDev === 6, "idleGap.minDevMonths is 6");
    assert((gapSpec.choices || []).map(function (c) { return c.id; }).join(",") === "outsource,study,rest",
      "idle gap offers exactly outsource / study / rest");
    // 每个场景只放一部探针，gap 才是干净的「到下一档目录作开工月的月数」
    function cfgWithProbe(id, name, devStartMonth, devMonths, releaseYear, releaseMonth) {
      // 清掉 fromsoftware 的真实目录：不摘的话《国王密令II》盖住 1995.01，
      // 「空窗」根本不存在，这个用例测的空窗机制就无从触发。
      const cfg = withoutCatalog(fixCycle(withoutTitlePool(deepClone(config))), "fromsoftware");
      cfg.careerWorld.titles = (cfg.careerWorld.titles || []).concat([{
        id: id, companyId: "fromsoftware", studioId: "fromsoftware-main",
        name: name, alias: name,
        releaseYear: releaseYear, releaseMonth: releaseMonth,
        score: 7, platforms: ["pc"], genreId: "fantasy", gameplayId: "rpg", releaseType: "boxed",
        stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
      }]);
      cfg.careerWorld.titleDetails = (cfg.careerWorld.titleDetails || []).concat([{
        id: id, devStartYear: 1995, devStartMonth: devStartMonth, devMonths: devMonths, inviteEligible: false
      }]);
      return cfg;
    }
    function base(cfg) {
      const g = sim.createCareerGame("测", "programmer", cfg);
      const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, cfg).state;
      st.career.companyId = "fromsoftware";
      st.career.studioId = "fromsoftware-main";
      st.career.titleId = null;
      st.career.liveStats = null;
      st.career.idleGap = null;
      st.career.idleMonths = 0;
      st.year = 1995;
      st.month = 1;
      return st;
    }

    // 短空窗（4 个月）：静默过月，不排项目、不弹抉择
    const shortCfg = cfgWithProbe("gapShort", "短空窗探针", 5, 3, 1995, 8);
    let st = base(shortCfg);
    assert(sim.catalogGapMonths(st, shortCfg, "fromsoftware", "fromsoftware-main") === 4, "short gap 4");
    assert(!sim.startPoolProject(st, shortCfg), "short gap starts no project");
    let q = [];
    sim.assignCareerProject(st, shortCfg, q);
    assert(!st.career.titleId, "short gap stays off title");
    assert(q.length === 0, "short gap is absorbed silently, no prompt");
    assert(!st.career.idleGap, "short gap leaves no idleGap state");

    // 长空窗（10 个月）：弹一次抉择
    const longCfg = cfgWithProbe("gapLong", "长空窗探针", 11, 14, 1997, 1);
    st = base(longCfg);
    assert(sim.catalogGapMonths(st, longCfg, "fromsoftware", "fromsoftware-main") === 10, "long gap 10");
    q = [];
    sim.assignCareerProject(st, longCfg, q);
    assert(!st.career.titleId, "long gap stays off title");
    assert(q.length === 1 && q[0].eventId === (gapSpec.eventId || "idle-gap"), "long gap queues the idle gap");
    assert(st.career.idleGap && st.career.idleGap.prompted, "gap is marked prompted");
    assert(st.career.idleGap.untilYear === 1995 && st.career.idleGap.untilMonth === 11,
      "gap knows the next catalog start month");
    q = [];
    sim.assignCareerProject(st, longCfg, q);
    assert(q.length === 0, "not queued again");

    // 三选项：进修抬非本职属性，且只结算一次
    const main = sim.careerRole("programmer", longCfg).stat;
    const before = sim.clone(st.career.stats);
    const picked = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "study", longCfg);
    assert(picked.ok, "resolve idle gap");
    st = picked.state;
    assert(st.career.idleGap.settled, "settled once");
    assert(st.career.stats[main] === before[main], "study leaves the main stat alone");
    PDIMS.forEach(function (d) {
      if (d === main) return;
      assert(st.career.stats[d] === before[d] + 2, "study lifts off-stat " + d);
    });
    const again = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "rest", longCfg);
    assert(again.state.career.stats[main] === st.career.stats[main], "no second apply");

    // 空窗期仍可跳槽；空窗结束后接上下一档目录作
    st.month = 12;
    st.career.yearEndOffers = [];
    assert(sim.canCareerHop(st, longCfg), "hop allowed during the idle gap");
    const ticked = sim.tickCareerMonth(st, longCfg);
    assert((ticked.queue || []).some(function (p) { return p.type === "hop"; }), "December hop during the idle gap");
    st = ticked.state;
    st.year = 1995;
    st.month = 11;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleGap = null;
    sim.assignCareerProject(st, longCfg);
    assert(st.career.titleId === "gapLong", "hangs the next catalog after the gap");
    ok("idle gap: silent when short, one choice when long, hop allowed, then catalog");
  })();

  (function careerCycleMultLengthensDevWindow() {
    // P2c：cycleMult 只拉长目录作的开发窗口。发售月是硬数据（榜单 / 奖项 / 履历全读它，
    // 也在 titleCoversMonth 的右端点上），所以换算只能发生在开工那一端：
    //   开工月 = 发售月 − round(原时长 × cycleMult)
    // 全部「覆盖哪几个月 / 做到几成」的判定都必须走 sim.titleDevStart，否则进度与档期分叉。
    const mult = sim.careerCycleMult(config);
    assert(mult >= 1.5 && mult <= 2, "cycleMult sits in 1.5-2, got " + mult);
    const t = sim.careerTitle("ff7", config);
    const d = sim.careerTitleDetail("ff7", config);
    assert(t && d, "ff7 has title + detail");
    const rawStart = sim.monthIndex(d.devStartYear, d.devStartMonth);
    const release = sim.monthIndex(t.releaseYear, t.releaseMonth);
    const startIdx = sim.titleDevStart(t, d, config);
    assert(startIdx === release - Math.round((release - rawStart) * mult),
      "start is reversed from the fixed release month");
    assert(startIdx < rawStart, "longer cycle starts earlier " + rawStart + " -> " + startIdx);
    // 发售日绝不被换算碰到（titleDevStart 是纯函数）
    const relY = t.releaseYear, relM = t.releaseMonth;
    sim.titleDevStart(t, d, config);
    assert(t.releaseYear === relY && t.releaseMonth === relM, "titleDevStart never mutates release");
    // 覆盖区间是闭区间 [start, release]：开工当月算在内，发售当月也算（发售月过完才卸载）
    const s = sim.monthFromIndex(startIdx);
    const after = sim.monthFromIndex(release + 1);
    assert(sim.titleCoversMonth(t, d, s.year, s.month, config), "covers its own start month");
    assert(sim.titleCoversMonth(t, d, t.releaseYear, t.releaseMonth, config), "covers the release month");
    assert(!sim.titleCoversMonth(t, d, after.year, after.month, config), "the month after release is outside");
    // 倍率关掉就回到原始开工月（老存档 / 测试伪作靠这条）
    const one = deepClone(config);
    one.careerWorld = deepClone(config.careerWorld);
    one.careerWorld.development.cycleMult = 1;
    assert(sim.titleDevStart(t, d, one) === rawStart, "cycleMult=1 keeps the raw start");
    // 虚拟作不走这条换算：它的档期是自己从当前月往后排的
    const virt = { id: "v", virtual: true, releaseYear: 2000, releaseMonth: 1 };
    const vdet = { id: "v", virtual: true, devStartYear: 1998, devStartMonth: 3, devMonths: 23 };
    assert(sim.titleDevStart(virt, vdet, config) === sim.monthIndex(1998, 3),
      "virtual titles keep their own start month");
    ok("cycleMult lengthens the dev window: release fixed, start pulled earlier");
  })();

  (function careerVirtualInitialStatsFollowTeamShareAndStudioSkill() {
    // 池作初始四维 = 团队能量 × titlePool.teamStatShare（再乘工作室熟练度）。
    const on = fixCycle(deepClone(config));
    const world = on.careerWorld;
    const share = world.titlePool.teamStatShare;
    const ladder = world.proficiency.ladder;
    const dims = PDIMS;
    function probe() {
      const g = sim.createCareerGame("测", "programmer", on);
      g.rngSeed = 20240916;
      g.rngCount = 0;
      const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, on).state;
      st.career.companyId = "fromsoftware";
      st.career.studioId = "fromsoftware-main";
      st.career.titleId = null;
      st.career.liveStats = null;
      st.career.traits = [];
      st.career.traitsLocked = true;
      st.year = 1995;
      st.month = 1;
      sim.ensureCareerColleagues(st, on);
      return st;
    }
    const st = probe();
    st.companyXp = {};
    st.studioXp = {};
    const members = sim.careerTeamMembers(st, config);
    const rawSum = {};
    dims.forEach(function (k) {
      rawSum[k] = members.reduce(function (a, m) { return a + (m.stats[k] || 0); }, 0);
    });
    assert(sim.studioProficiencyBonusPct(st, "fromsoftware", "fromsoftware-main", "fantasy", "rpg", on) === 0,
      "empty xp yields no studio bonus");
    const base0 = sim.careerCraftLiveStats(st, 12, members.length, on, "fantasy", "rpg");
    const mx = (config.careerWorld.quality || {}).personToTitle || {};
    TDIMS.forEach(function (td) {
      let blended = 0;
      PDIMS.forEach(function (pd) {
        const w = (mx[pd] && mx[pd][td]) || 0;
        blended += rawSum[pd] * w;
      });
      const want = Math.floor(blended * share);
      assert(base0[td] === want,
        "initial " + td + " = floor(share × Σ team person-dim × w): " + base0[td] + " vs " + want);
    });
    const rawTotal = PDIMS.reduce(function (a, pd) { return a + rawSum[pd]; }, 0);
    const baseTotal = TDIMS.reduce(function (a, td) { return a + base0[td]; }, 0);
    assert(Math.abs(baseTotal - rawTotal * share) <= 4,
      "crafted total conserves team energy within floor slack: " + baseTotal + " vs " + (rawTotal * share));

    // 工作室题材档 + 玩法档各练到看家本领 → 加成相加 0.2 + 0.2
    const rich = sim.clone(st);
    rich.studioXp = {
      "fromsoftware-main": { genreXp: { fantasy: 60 }, gameplayXp: { rpg: 60 } }
    };
    const pctFull = sim.studioProficiencyBonusPct(rich, "fromsoftware", "fromsoftware-main", "fantasy", "rpg", on);
    assert(Math.abs(pctFull - (ladder[3] + ladder[3])) < 1e-9, "studio genre+gameplay pct sum " + pctFull);
    const baseFull = sim.careerCraftLiveStats(rich, 12, members.length, on, "fantasy", "rpg");
    TDIMS.forEach(function (td) {
      assert(baseFull[td] === Math.floor(base0[td] * (1 + ladder[3] + ladder[3])), "studio 40% lifts " + td);
    });

    // 玩家熟练度只抬开发月贡献，不动立项初始四维
    const low = sim.clone(st);
    low.career.genreXp = {};
    low.career.gameplayXp = {};
    const virt = sim.startPoolProject(low, on, { genreId: "fantasy", gameplayId: "rpg" });
    assert(virt, "virtual project for contrib probe");
    low.career.titleId = virt.id;
    low.career.liveStats = sim.clone(virt.stats);
    const cLow = sim.careerMonthlyContributionByDim(low, on).program;
    const high = sim.clone(low);
    high.career.genreXp = { fantasy: 60 };
    high.career.gameplayXp = { rpg: 60 };
    const cHigh = sim.careerMonthlyContributionByDim(high, on).program;
    assert(cLow > 0, "monthly contribution positive");
    assert(Math.abs(cHigh / cLow - (1 + ladder[3] + ladder[3])) < 0.01,
      "player 40% pct multiplies monthly contribution " + cLow + " -> " + cHigh);
    assert(sim.playerProficiencyBonusPct(high, "fantasy", "rpg", on) === ladder[3] + ladder[3],
      "player proficiency pct is additive ladder");
    ok("virtual initial stats = 10% team sum + studio proficiency; player skill feeds monthly contribution");
  })();

  (function poolTitlesComeFromGenreBankAndNeverRepeat() {
    // 池作命名取自题材虚构池（titlesByGenre），且本局不重名。
    // ⚠️ 逐月换开工点要求那几个月「排不出目录真作」，否则 poolCandidateAt 会因为
    //    gap < minFillMonths 直接返回 null。所以这家公司的目录要摘掉（原来是空的）。
    const on = withoutCatalog(fixCycle(deepClone(config)), "fromsoftware");
    const byGenre = (on.careerWorld.titlePool || {}).titlesByGenre || {};
    const seen = {};
    Object.keys(byGenre).forEach(function (gid) {
      assert(Array.isArray(byGenre[gid]) && byGenre[gid].length >= 8, "genre pool " + gid);
      byGenre[gid].forEach(function (n) {
        assert(n && !seen[n], "unique fictional name " + n);
        seen[n] = true;
      });
    });
    const g = sim.createCareerGame("测", "programmer", on);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, on).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
    const names = [];
    let i, t, pool, inGenre;
    // fromsoftware 在 1996~2003 整段没有目录真作在研（首部到 2005.8 才开工），
    // 逐月换开工点 → 每次都该抽到一部新的池作。
    for (i = 0; i < 8; i++) {
      st.year = 1996 + i;
      st.month = 1 + (i % 3);
      st.career.titleId = null;
      st.career.liveStats = null;
      t = sim.startPoolProject(st, on);
      assert(t && t.virtual && t.pool && t.name, "pool title " + i);
      assert(names.indexOf(t.name) < 0, "no reuse " + t.name);
      names.push(t.name);
      pool = byGenre[t.genreId] || [];
      inGenre = pool.indexOf(t.name) >= 0;
      assert(inGenre, "name from the genre pool " + t.name + " / " + t.genreId);
    }
    ok("pool titles come from the genre name bank and never repeat");
  })();

  (function transitionProjectsPayOffInsteadOfPunishing() {
    // P2-fix-b：过渡项目（池作）原来是一条**惩罚线** —— 成长被砍半（xpPerVirtualRelease 5 vs 8、
    // virtualReleaseScale / virtualScale 0.5）、晋升学分打 4 折、不给奖项、不进榜单、履历只剩
    // 「过渡项目」四个字。玩家时间轴上 17% 是池作，等于近五分之一的时间在打白工。
    // 这一版掰成中性偏好的一条线 + 给足叙事交代，这个用例把四件事都锁住。
    const cw = config.careerWorld;
    assert(cw.companyXp.xpPerVirtualRelease === 7, "池作发行经验 5→7（历史作 8）");
    assert(cw.jobRanks.statGain.virtualReleaseScale === 0.75, "池作发售属性 0.5→0.75");
    assert(cw.jobRanks.jobXpGain.virtualScale === 0.75, "池作发售职级经验 0.5→0.75");
    assert(cw.jobRanks.virtualCreditWeight === 0.5, "池作作品学分折价 0.4→0.5");
    assert(cw.titlePool.devStatMult > 1 && cw.titlePool.devJobXpMult > 1,
      "池作开发月有加成（小项目什么都得自己上手）");

    // ── 成长：同一 phaseMult、同一起点、清掉天赋倍率后，两边的比值就是配置值 ──
    const grant = sim._.grantMainStatAndXp;
    assert(typeof grant === "function", "grantMainStatAndXp 在共享工具 sim._ 里");
    const key = sim.careerRole("programmer", config).stat;
    function delta(t, kind, phase) {
      const gg = sim.createCareerGame("测", "programmer", config);
      const ss = sim.acceptOpeningOffer(gg, gg.career.openingOffers[0].id, config).state;
      ss.career.titleId = null;
      ss.career.inspirationMonth = false;
      ss.career.traits = [];          // 天赋倍率会随局随机，这里要的是纯配置比值
      ss.career.traitsLocked = true;
      ss.career.stats[key] = 0;
      ss.career.jobXp = 0;
      grant(ss, kind, config, t, phase);
      return { stat: ss.career.stats[key], xp: ss.career.jobXp };
    }
    const catalog = { id: "catalogProbe", virtual: false };
    const poolT = { id: "poolProbe", virtual: true };
    const dCat = delta(catalog, "dev", 1), dPool = delta(poolT, "dev", 1);
    assert(dCat.stat > 0 && dPool.stat > dCat.stat, "池作开发月成长高于目录作");
    assert(Math.abs(dPool.stat - dCat.stat * cw.titlePool.devStatMult) < 1e-9,
      "开发月加成正好是 devStatMult (" + dCat.stat + " -> " + dPool.stat + ")");
    assert(Math.abs(dPool.xp - dCat.xp * cw.titlePool.devJobXpMult) < 1e-9,
      "开发月职级经验加成正好是 devJobXpMult");
    const rCat = delta(catalog, "release", 1), rPool = delta(poolT, "release", 1);
    assert(Math.abs(rPool.stat - rCat.stat * 0.75) < 1e-9, "发售那一笔仍按 0.75 折价");
    assert(Math.abs(rPool.xp - rCat.xp * 0.75) < 1e-9, "发售职级经验同样 0.75");

    // ── 叙事：按落盘分数档给一句专属评语 ──
    const notes = sim.careerCopy(config).poolNotes;
    ["top", "high", "mid", "low"].forEach(function (b) {
      assert(notes && notes[b] && notes[b].length, "过渡项目评语有 " + b + " 档");
      notes[b].forEach(function (s) {
        assert(s.length >= 2 && s.length <= 18, "评语 2~18 字：" + s);
        assert(/[。！？…]$/.test(s), "评语以句末标点收尾：" + s);
        assert(s.indexOf("过渡项目，") !== 0 || s.length > 6, "别只有干巴巴的四个字：" + s);
      });
    });
    assert(sim.mediaQuoteBand(4, config) === "low" && sim.mediaQuoteBand(7, config) === "mid" &&
      sim.mediaQuoteBand(8.5, config) === "high" && sim.mediaQuoteBand(9.6, config) === "top",
      "评语档位与媒体评语同源（release.media 的 top/high/low）");
    const same1 = sim.titlePoolNote("pool-capcom-202", 6.8, config);
    assert(same1 && same1 === sim.titlePoolNote("pool-capcom-202", 6.8, config),
      "同一部过渡项目任何时候都是同一句（RNG-free）：" + same1);
    assert(sim.titlePoolNote("pool-x", null, config) === "", "没落盘分数就不给评语");
    const spread = {};
    for (let i = 0; i < 40; i++) spread[sim.titlePoolNote("pool-t" + i, 7, config)] = 1;
    assert(Object.keys(spread).length >= 3, "评语按 titleId 散开，不是永远第一句");

    // ── 履历 / 结算：把「署名作品」与「过渡项目」拆开显示 ──
    const g = sim.createCareerGame("测", "programmer", config);
    const s2 = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    s2.career.credits = [
      { titleId: "bf2", companyId: "dice", roleId: "programmer", shipped: true, score: 8.6 },
      { titleId: "pool-dice-1", companyId: "dice", roleId: "programmer", shipped: true, score: 6.8, virtual: true }
    ];
    const rv = sim.careerResumeView(s2, config);
    assert(rv.signedCount === 1 && rv.transitionCount === 1,
      "履历拆分署名/过渡：" + rv.signedCount + "/" + rv.transitionCount);
    const poolRow = rv.credits.filter(function (c) { return c.virtual; })[0];
    assert(poolRow && poolRow.poolNote, "过渡项目行带评语：" + (poolRow && poolRow.poolNote));
    assert(poolRow.statusLabel === sim.careerCopy(config).resumeVirtual,
      "状态文案写「过渡项目」而不是「署名发售」");
    const sv = sim.careerSettlementView(s2, config);
    assert(sv.creditedCount === 1 && sv.transitionCount === 1, "结算页同样拆分署名/过渡");
    ok("transition projects pay off: dev growth ×" + cw.titlePool.devStatMult +
      ", release ×0.75, banded notes, resume split");
  })();

};
