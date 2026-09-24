// 测试用例组：12-growth-health（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerEconomyFullyRemoved() {
    // P2a：生涯档的货币体系（月薪 / 积蓄 / 生活费 / 公司薪资系数）整体删除。
    // 曾经的 careerSalaryStepsAndInflation 已失去对象，改为这条守卫，防止货币被悄悄引回来。
    const world = config.careerWorld || {};
    assert(world.personalEconomy === undefined, "careerWorld.personalEconomy block is gone");
    assert((world.jobRanks || {}).salaryFloor === undefined, "jobRanks.salaryFloor is gone");
    (world.companies || []).forEach(function (c) {
      assert(c.salaryMult === undefined, "company salaryMult is gone: " + c.id);
    });
    assert(config.traits.thrifty === undefined, "thrifty trait is gone");
    const copy = (config.copy || {}).career || {};
    ["salaryLabel", "livingLabel", "savingsLabel", "payDeltaPrefix", "settleSavingsLabel"].forEach(function (k) {
      assert(copy[k] === undefined, "copy.career." + k + " is gone");
    });
    ["careerSalaryFor", "careerLivingCost", "careerSalaryStepUp", "snapCareerSalary"].forEach(function (k) {
      assert(sim[k] === undefined, "sim." + k + " is gone");
    });
    // 开局 → 接受 offer → 推进一月：状态里不该再长出任何货币字段
    const g = sim.createCareerGame("测", "programmer", config);
    assert(g.career.savings === undefined && g.career.salary === undefined && g.career.lastPay === undefined,
      "fresh game carries no money fields");
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    (st.career.openingOffers || []).forEach(function (o) {
      assert(o.salary === undefined, "opening offer carries no salary: " + o.companyId);
    });
    st = sim.tickMonth(st, config).state;
    assert(st.career.savings === undefined && st.career.salary === undefined && st.career.lastPay === undefined,
      "a ticked month never reintroduces money fields");
    assert(st.career.funds === undefined, "state keeps no funds field");
    ok("career economy is fully removed (no salary / savings / living cost)");
  })();

  // 属性无上限、产出有软上限；主职维与副维都要长。
  (function careerStatSoftCapAndDualDimGrowth() {
    const spec = (config.careerWorld.quality || {}).statSoftCap;
    assert(spec && spec.ref > 0 && spec.max > 0, "quality.statSoftCap configured");
    const f = function (v) { return sim.careerStatFactor(v, config); };
    const linear = function (v) { return v / (config.careerWorld.scoreFromLive.attrRef || 100); };
    assert(Math.abs(f(spec.ref) - 1) < 1e-9, "soft cap is exactly 1.0 at ref, got " + f(spec.ref));
    assert(f(0) === 0, "zero stat → zero factor");
    assert(f(150) > f(100) && f(200) > f(150), "soft cap stays monotonic");
    assert(f(200) < 1.4, "attribute 200 must not double the output, got " + f(200));
    assert(f(100000) < spec.max, "never reaches the asymptote");
    assert(f(200) < linear(200), "soft cap sits strictly below the old linear reading");

    // 跑五年：主职维必须长，副维也要跟着动，否则就是单维怪。
    const g = sim.createCareerGame("测", "design", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    const role = sim.careerRole(st.career.roleId, config);
    const mainKey = role.stat;
    const offKeys = sim.personDims(config).filter(function (k) { return k !== mainKey; });
    const start = Object.assign({}, st.career.stats);
    let grewMain = false, grewOff = false, prev = st.career.stats[mainKey], i;
    for (i = 0; i < 60; i++) {
      st = sim.tickMonth(st, config).state;
      if (st.career.stats[mainKey] > prev + 1e-9) grewMain = true;
      prev = st.career.stats[mainKey];
      if (offKeys.every(function (k) { return st.career.stats[k] > start[k] + 1e-9; })) grewOff = true;
    }
    assert(grewMain, "main stat grows across five years");
    assert(grewOff, "off-role dims creep up too");
    ok("stat soft cap converges below linear, off-role dims follow the main one");
  })();

  // 开发期成长：阶段权重（projectPhases）× 体量阻尼，以及熟练度阶梯拉陡。
  (function careerDevPhaseAndPowerWeighting() {
    const world = config.careerWorld;
    const spec = world.development;
    assert(spec && spec.phaseMult, "careerWorld.development.phaseMult configured");

    // 键必须覆盖 projectPhases 的每个 id —— 改 projectPhases 时漏配就直接暴露。
    const phaseIds = (world.projectPhases || []).map(function (p) { return p.id; });
    assert(phaseIds.length >= 3, "projectPhases has several stages");
    phaseIds.forEach(function (id) {
      assert(spec.phaseMult[id] != null, "phaseMult covers stage " + id);
    });
    assert(spec.phaseMult.gold === 0, "gold stage (waiting for the press) yields no growth");
    assert(spec.phaseMult.prepro < spec.phaseMult.production, "prepro is the slowest working stage");
    assert(spec.phaseMult.alpha > spec.phaseMult.production, "content fill grows faster than production");
    assert(spec.phaseMult.polish > spec.phaseMult.alpha, "polish is the fastest stage");

    // 查表：未知阶段回退 default（长线运营月的 phase 就是 support）。
    phaseIds.forEach(function (id) {
      assert(sim.careerPhaseMult(id, config) === spec.phaseMult[id], "reads table for " + id);
    });
    assert(sim.careerPhaseMult("support", config) === spec.phaseMultDefault, "post-launch falls back to default");
    assert(sim.careerPhaseMult(null, config) === spec.phaseMultDefault, "null phase falls back to default");

    // 体量阻尼：小体量项目一人多岗、个人占比高，倍率更大。
    function powerMult(v) { return sim.careerPowerContribMult({ power: v }, config); }
    assert(powerMult(1) > powerMult(2) && powerMult(2) > powerMult(3), "smaller titles weight the individual more");
    assert(powerMult(1) / powerMult(3) > 1.4, "power spread is noticeable");
    assert(sim.careerPowerContribMult({}, config) === spec.powerContribDefault, "unknown power falls back to default");

    // 熟练度阶梯：末档值钱、后两档比第一档陡，深耕一个题材/玩法才有回报。
    const ladder = world.proficiency.ladder;
    assert(ladder.length === (world.companyXp.tiers || []).length, "ladder has one entry per tier");
    assert(ladder[0] === 0, "novice tier gives nothing");
    assert(ladder[ladder.length - 1] >= 0.25, "signature tier worth >=25%, got " + ladder[ladder.length - 1]);
    assert(ladder[3] - ladder[2] >= ladder[1] - ladder[0], "top step is steeper than the first");

    // 端到端：同一份 state 快照，只把「当前阶段」的权重放大 5 倍，属性月增量必须变大。
    // 用快照对拍而不是跑两遍开局——开局 roll 与事件都会污染差值。
    const g = sim.createCareerGame("测", "design", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.rngSeed = 4242;
    let i;
    for (i = 0; i < 14; i++) st = sim.tickMonth(st, config).state;
    const view = sim.careerProjectView(st, config);
    const pid = view && view.phase ? view.phase.id : null;
    assert(pid && spec.phaseMult[pid] != null, "player sits in a known stage, got " + pid);
    const mainKey = sim.careerRole(st.career.roleId, config).stat;
    const snapshot = JSON.parse(JSON.stringify(st));

    function oneMonth() {
      const next = sim.tickMonth(JSON.parse(JSON.stringify(snapshot)), config).state;
      return next.career.stats[mainKey] - snapshot.career.stats[mainKey];
    }
    const savedMult = spec.phaseMult[pid];
    const baseGain = oneMonth();
    spec.phaseMult[pid] = savedMult * 5;
    const bigGain = oneMonth();
    spec.phaseMult[pid] = savedMult;
    assert(baseGain > 0, "baseline month still grows the main stat, got " + baseGain);
    assert(bigGain > baseGain * 1.4, "stage weight scales the monthly stat gain: base=" + baseGain + " big=" + bigGain);

    ok("dev growth follows stage weight and title power; proficiency ladder is steeper");
  })();

  (function careerRenownTiers() {
    // P4c：声望称号链（累积制：获奖×权重 + 高分署名作品部数）
    const st = { career: { credits: [] }, awardsHistory: [] };
    const rv0 = sim.careerRenownView(st, config);
    assert(rv0.tier === 1 && rv0.label === "无名新人", "empty state = tier 1 无名新人");
    st.awardsHistory = [
      { year: 1996, awards: [{ id: "goty", playerWon: true }] },
      { year: 1997, awards: [{ id: "bestVisual", playerWon: true }, { id: "goty", playerNominated: true, playerWon: false }] }
    ];
    assert(sim.careerRenownView(st, config).score === 4, "2 wins × winWeight 2 = 4");
    st.career.credits = [
      { shipped: true, score: 9 },                          // 高分署名 +1
      { shipped: true, score: 9, signedEligible: false },   // 未署名不算
      { shipped: false, score: 9.4 },                       // 未发售不算
      { shipped: true, score: 7.5 },                        // 低于阈值不算
      { shipped: true, virtual: true, score: 4.9 }          // 过渡项目天然够不着
    ];
    const rv1 = sim.careerRenownView(st, config);
    assert(rv1.score === 5 && rv1.scoreHits === 1, "score = 4 + 1 high-score credit");
    assert(rv1.tier === 1, "5 < tier2 threshold 6");
    st.awardsHistory.push({ year: 1998, awards: [{ id: "x", playerWon: true }] });
    const rv2 = sim.careerRenownView(st, config);
    assert(rv2.score === 7 && rv2.tier === 2 && rv2.label === "业界熟脸", "7 → tier 2 业界熟脸");
    assert(sim.careerRenownTierLabel(config, 5) === "时代之名", "tier 5 label");
    ok("renown view: cumulative wins + high-score credits → 5-tier chain");
  })();

  (function careerHealthOnlyMovesOnEvents() {
    // P4b：健康只随事件变动——无事件月份绝不衰减
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents = deepClone(config.careerWorld.devEvents);
    tweaked.careerWorld.devEvents.chance = 0; // 静默 24 个月
    const g = sim.createCareerGame("健", "programmer", tweaked);
    g.rngSeed = 777; g.rngCount = 0;
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    assert(st.career.health === 4, "health init 4/5");
    for (let i = 0; i < 24 && st.phase === "PLAYING"; i++) {
      st = sim.tickMonth(st, tweaked).state;
    }
    assert(st.career.health === 4, "health unchanged after 24 eventless months, got " + st.career.health);
    // 钳位：±大数收在 1..5
    sim.applyCareerHealthDelta(st, 9, tweaked);
    assert(st.career.health === 5, "clamp max 5");
    sim.applyCareerHealthDelta(st, -9, tweaked);
    assert(st.career.health === 1, "clamp min 1");
    // 事件选项 healthDelta：赶工 -1 / 休息 +1
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.list = [{
      id: "healthProbe", displayName: "健康探针", text: "测", presentation: "choice",
      choices: [
        { id: "gogogo", label: "冲", qualityDim: ["program"], qualityDelta: [1], healthDelta: -1 },
        { id: "takeRest", label: "歇", qualityDim: ["program"], qualityDelta: [1], healthDelta: 1 }
      ]
    }];
    st.career.health = 3;
    st.career.liveStats = { program: 50, design: 50, art: 50, music: 50 };
    const r1 = sim.resolveCareerEventChoice(st, "healthProbe", "gogogo", tweaked);
    assert(r1.ok && r1.state.career.health === 2, "crunch option -1, got " + (r1.state.career.health));
    const r2 = sim.resolveCareerEventChoice(st, "healthProbe", "takeRest", tweaked);
    assert(r2.ok && r2.state.career.health === 4, "rest option +1, got " + (r2.state.career.health));
    // 低健康关怀拍：health ≤ 2 触发 careCheck（每年一次），高健康不触发
    tweaked.careerWorld.devEvents.chance = 0;
    tweaked.careerWorld.devEvents.list = deepClone(config.careerWorld.devEvents.list); // 含 careCheck(manualOnly)
    st.career.health = 1;
    st.career.careBeatYear = null;
    const rq1 = sim.tickMonth(st, tweaked);
    const carePage = (rq1.queue || []).filter(function (p) { return p.eventId === "careCheck"; })[0];
    assert(carePage && carePage.presentation === "choice", "low health queues careCheck");
    assert(rq1.state.career.careBeatYear === rq1.state.year, "care beat stamped");
    const rq2 = sim.tickMonth(rq1.state, tweaked);
    assert(!(rq2.queue || []).some(function (p) { return p.eventId === "careCheck"; }), "care beat once per year");
    const rEat = sim.resolveCareerEventChoice(rq1.state, "careCheck", "goEat", tweaked);
    assert(rEat.ok && rEat.state.career.health === 2, "care meal +1, got " + (rEat.state.career.health));
    const hiState = deepClone(rq1.state);
    hiState.career.health = 3;
    hiState.career.careBeatYear = null;
    const rq3 = sim.tickMonth(hiState, tweaked);
    assert(!(rq3.queue || []).some(function (p) { return p.eventId === "careCheck"; }), "no care beat above 2 segments");
    // manualOnly 事件不得进随机池：把 cadence/chance 拉满狂抽也抽不到 careCheck
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    const st2 = deepClone(st);
    st2.career.health = 5;
    st2.career.titleId = st2.career.titleId || "chronoTrigger";
    st2.career.liveStats = st2.career.liveStats || { program: 50, design: 50, art: 50, music: 50 };
    st2.career.lastDevEventYm = null;
    st2.career.devEventsThisYear = 0;
    st2.career.devEventYear = st2.year;
    let sawCare = false;
    for (let k = 0; k < 40; k++) {
      const r = sim.rollCareerDevEvent(st2, tweaked, []);
      if (r && r.id === "careCheck") { sawCare = true; break; }
    }
    assert(!sawCare, "manualOnly event never rolled from pool");
    ok("health: init 4, event-only movement, clamp 1..5, option healthDelta applies, care beat");
  })();

  (function careerOptionReqGate() {
    // P4a：req 门禁判定（RNG-free）+ dispatch 兜底拒绝
    const st = deepClone(sim.createCareerGame("门", "programmer", config));
    st.career.stats = { program: 20, design: 30, art: 10, music: 10 };
    st.career.jobRank = 2;
    st.career.health = 3;
    st.career.awardStory = { goty: true };
    const rng0 = st.rngCount;
    const hint = sim.careerOptionLockHint(st, config, { minStat: { program: 30, design: 10 }, rank: 3 });
    assert(hint && hint.indexOf("程序 ≥ 30") >= 0 && hint.indexOf("职级 ≥ 3") >= 0, "lock hint: " + hint);
    assert(st.rngCount === rng0, "lock hint consumes no RNG");
    assert(sim.careerOptionLockHint(st, config, { minStat: { program: 20 }, rank: 2 }) === null, "satisfied req → null");
    assert(sim.careerOptionLockHint(st, config, null) === null, "no req → null");
    assert(sim.careerOptionLockHint(st, config, { flags: ["career.awardStory.goty"] }) === null, "flag hit passes");
    assert(sim.careerOptionLockHint(st, config, { flags: ["career.awardStory.never"] }).indexOf("拿过奖") >= 0, "flag miss hinted");
    assert(sim.careerOptionLockHint(st, config, { health: 4 }).indexOf("健康 ≥ 4") >= 0, "health gate hinted");
    assert(sim.careerOptionLockHint(st, config, { renown: 4 }).indexOf("明星制作人") >= 0, "renown gate hints tier label");
    // dispatch 兜底：锁住的选项 ok:false + lockHint 带回；未锁选项正常落地
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents = deepClone(config.careerWorld.devEvents);
    tweaked.careerWorld.devEvents.list = [{
      id: "gateProbe", displayName: "门禁探针", text: "测", presentation: "choice",
      choices: [
        { id: "locked", label: "锁", qualityDim: ["program"], qualityDelta: [1], req: { rank: 6 } },
        { id: "open", label: "开", qualityDim: ["program"], qualityDelta: [1] }
      ]
    }];
    st.career.liveStats = { program: 50, design: 50, art: 50, music: 50 };
    const page = { type: "event", eventId: "gateProbe", presentation: "choice",
                   options: [{ id: "locked", label: "锁", req: { rank: 6 } }, { id: "open", label: "开" }] };
    const blocked = sim.resolveCareerQueueChoice(st, page, "locked", tweaked);
    assert(blocked && blocked.ok === false && blocked.lockHint && blocked.lockHint.indexOf("职级 ≥ 6") >= 0,
      "dispatch rejects locked option with hint");
    const allowed = sim.resolveCareerQueueChoice(st, page, "open", tweaked);
    assert(allowed && allowed.ok, "unlocked option applies");
    ok("option req gate: minStat/flags/rank/health/renown, rng-free, dispatch backstop");
  })();

};
