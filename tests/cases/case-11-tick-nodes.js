// 测试用例组：11-tick-nodes（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerTickAdvancesAndPhaseUntil() {
    const g = sim.createCareerGame("测", "design", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const r = sim.tickMonth(acc.state, config);
    assert(r.state.month === 2 && r.state.year === 1995, "feb 1995");
    assert(r.state.phase !== "BANKRUPT", "no company bankrupt");
    // P2a：过月不再结算月薪 / 积蓄 / 生活费
    assert(r.state.career.savings === undefined && r.state.career.salary === undefined &&
      r.state.career.lastPay === undefined, "a tick adds no money fields");
    const view = sim.careerProjectView(r.state, config);
    if (!view.idle) {
      assert(view.phase && view.phase.until != null, "phase until");
      assert(view.progress >= 0 && view.progress <= 1, "progress range");
    }
    assert(r.queue && Array.isArray(r.queue), "tick queue");
    const kinds = r.queue.map(function (q) { return q.type; });
    assert(kinds.indexOf("notes") < 0, "no monthly notes popup");
    assert(kinds.indexOf("salary") < 0, "no salary queue item");
    ok("career tickMonth advances, savings change, phase until");
  })();

  (function careerTickTo1996Stable() {
    const g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    let guard = 0;
    while (!(st.year === 1996 && st.month === 1) && guard < 20) {
      const r = sim.tickMonth(st, config);
      st = r.state;
      assert(r.queue && Array.isArray(r.queue), "queue " + guard);
      assert(st.phase !== "BANKRUPT", "no bankrupt " + st.year + "." + st.month);
      guard += 1;
    }
    assert(st.year === 1996 && st.month === 1, "reached 1996.01");
    const dec = sim.listYearEndOffers(st, config);
    const inv = sim.listCareerInvites(st, config);
    assert(Array.isArray(dec) && Array.isArray(inv), "year-end sim APIs");
    ok("career can tick to 1996 without throw; year-end APIs exist");
  })();

  (function careerNodeDetectorRegistry() {
    // 注册表优先级：careerLine ① → choiceEvent ② → media ③ → awards ④ → hop ⑤ → promotion ⑥
    const hitLine = sim.careerNodeHit([{ type: "careerLine" }, { type: "invite" }], config);
    assert(hitLine && hitLine.id === "careerLine", "careerLine outranks invite");
    const hitFork = sim.careerNodeHit([{ type: "careerLineFork" }], config);
    assert(hitFork && hitFork.id === "careerLine", "fork counts as line node");
    const hitHop = sim.careerNodeHit([{ type: "invite", kicker: "k" }], config);
    assert(hitHop && hitHop.id === "hop", "invite is a hop node");
    const hitPromo = sim.careerNodeHit([{ type: "promotion", presentation: "choice" }], config);
    assert(hitPromo && hitPromo.id === "choiceEvent", "promotion page labeled by choiceEvent (higher priority)");
    const hitAwards = sim.careerNodeHit([{ type: "awards", awards: [{ playerWon: true }] }], config);
    assert(hitAwards && hitAwards.id === "awards", "player awards are a node");
    assert(!sim.careerNodeHit([{ type: "awards", awards: [{ playerWon: false, playerNominated: false }] }], config),
      "awards without the player are NOT a node (digest only)");
    assert(!sim.careerNodeHit([{ type: "event", presentation: "notice" }, { type: "story" }], config),
      "notice/story pages are atmosphere, not nodes");
    // 配置闸门：stopOnChoice=false 时 choice 页降级，但 stopOnTypes 默认值兜底 hop/invite
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.careerPace = { stopOnChoice: false };
    const choicePage = [{ type: "event", presentation: "choice", options: [{ id: "a", label: "x" }] }];
    assert(sim.careerNodeHit(choicePage, config), "choice page is a node by default");
    assert(!sim.careerNodeHit(choicePage, tweaked), "stopOnChoice:false demotes choice pages");
    assert(sim.careerNodeHit([{ type: "invite" }], tweaked), "invite still a node via default stopOnTypes");
    // 判定器只读 page/pace/config：不持有 state，天然 RNG-free（rngCount 前后不变）
    const g = sim.createCareerGame("节", "programmer", config);
    g.rngSeed = 4242; g.rngCount = 0;
    sim.careerNodeHit(choicePage, config);
    assert(g.rngCount === 0, "careerNodeHit consumes no RNG");
    sim.careerQueueNeedsDecision(choicePage, config);
    assert(g.rngCount === 0, "careerQueueNeedsDecision consumes no RNG");
    ok("node detectors: priority order + config gates + rng-free");
  })();

  (function creditedWorldShipIsNode() {
    // Master 2026-09-22：参与制作的作品发售不许被推进跳过——世界线发售
    // （玩家已拨去下个项目/离职后原作上市）也要推 media 页并停机。
    const g = sim.createCareerGame("署", "programmer", config);
    const st = deepClone(g);
    const start = sim.monthIndex(st.year, st.month);
    const t = (config.careerWorld.titles || []).find(function (x) {
      return !x.virtual && sim.monthIndex(x.releaseYear, x.releaseMonth) > start;
    });
    assert(t, "world title with future release exists");
    st.year = t.releaseYear; st.month = t.releaseMonth;
    st.career.credits.push({ titleId: t.id, shipped: false, leftYear: st.year, leftMonth: st.month, virtual: false });
    const q = [];
    sim.shipWorldTitlesThisMonth(st, config, q);
    const page = q.filter(function (p) { return p.type === "media"; })[0];
    assert(page && page.rec && page.rec.id === t.id, "participated world ship queues a media page");
    const hit = sim.careerNodeHit(q, config);
    assert(hit && hit.id === "media", "participated world ship is a stop node");
    // 无参与记录的同月发售保持安静（日历可查，不打断推进）
    const st2 = deepClone(sim.createCareerGame("静", "programmer", config));
    st2.year = t.releaseYear; st2.month = t.releaseMonth;
    const q2 = [];
    sim.shipWorldTitlesThisMonth(st2, config, q2);
    assert(!q2.some(function (p) { return p.type === "media"; }), "non-participated world ship stays silent");
    ok("participated world-title ship queues a media stop node (no silent skip)");
  })();

  (function careerNodeSkipMatchesMonthByMonth() {
    // 关键一致性测试：同 seed 下「逐月驱动整局」与「skipToNextNode 驱动整局」
    // 最终 state（属性/作品记录/flags/荣誉）必须完全一致。
    function answerQueueChoices(st, pages) {
      let list = (pages || []).slice();
      let i = 0;
      let guard = 0;
      while (i < list.length && guard < 300) {
        guard += 1;
        const page = list[i];
        if (page && page.presentation === "choice" && page.options && page.options.length) {
          // 自动应答策略（对两条驱动必须是同一个确定性策略）：按选项顺序尝试，
          // 取第一个 ok 的落地。hop 页在研中途 offer 全部 ok:false 时自然落到「先留下」，
          // 与真机「点了失败再点 stay」的最终状态一致。
          let picked = null;
          for (const opt of page.options) {
            const res = sim.resolveCareerQueueChoice(st, page, opt.id, config);
            if (res && res.ok) { picked = res; break; }
          }
          assert(picked, "auto answer " + (page && page.type) + " idx " + i);
          st = picked.state;
          if (picked.queue && picked.queue.length) {
            list = list.slice(0, i + 1).concat(picked.queue).concat(list.slice(i + 1));
          }
        }
        i += 1;
      }
      return st;
    }
    function fullRun(mode, seed) {
      const g = sim.createCareerGame("推", "programmer", config);
      g.rngSeed = seed;
      g.rngCount = 0;
      let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      let guard = 0;
      while (st.phase === "PLAYING" && guard < 600) {
        guard += 1;
        if (mode === "month") {
          const r = sim.tickMonth(st, config);
          st = answerQueueChoices(r.state, r.queue);
        } else {
          const r = sim.skipToNextNode(st, config);
          assert(r.node && r.node.id, "node meta present at step " + guard);
          // 近况摘要移除后，paceCap 且途中无事发生时允许空队列（UI 只走日期动画）
          if (r.node.id !== "paceCap") {
            assert(Array.isArray(r.queue) && r.queue.length > 0, "node queue non-empty at step " + guard);
          }
          st = answerQueueChoices(r.state, r.queue);
        }
      }
      return st;
    }
    const byMonth = fullRun("month", 20260920);
    const byNode = fullRun("node", 20260920);
    assert(byMonth.phase === "SETTLED", "month-driven run settles (phase " + byMonth.phase + ")");
    assert(byNode.phase === "SETTLED", "node-driven run settles (phase " + byNode.phase + ")");
    const ja = JSON.stringify(byMonth);
    const jb = JSON.stringify(byNode);
    if (ja !== jb) {
      function firstDiff(x, y, p) {
        const path = p || "";
        if (typeof x !== typeof y || Array.isArray(x) !== Array.isArray(y)) return path || "root";
        if (x && typeof x === "object") {
          const keys = {};
          Object.keys(x).forEach(function (k) { keys[k] = 1; });
          Object.keys(y).forEach(function (k) { keys[k] = 1; });
          for (const k of Object.keys(keys)) {
            const d = firstDiff(x[k], y[k], path ? path + "." + k : k);
            if (d) return d;
          }
          return null;
        }
        return x === y ? null : (path || "root");
      }
      const d = firstDiff(JSON.parse(ja), JSON.parse(jb), "");
      assert(false, "node-driven final state must equal month-driven; first diff at " + d);
    }
    ok("full-run consistency: skipToNextNode === month-by-month (same seed, whole state)");
  })();

};
