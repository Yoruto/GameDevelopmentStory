// 测试用例组：03-traits（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  // 合并榜：底席由 filler 值域决定，是经营档单机的生死线。改 chartSize 必须同时重排 filler。
  // 长线与单机同榜：一把尺（本月实销）、一个榜；长线标记与月活只作展示，不参与排序。
  (function careerTraitDrawIsThreeDistinct() {
    const g = sim.createCareerGame("抽", "programmer", config);
    const pool = sim.traitIds(config, "career");
    let i, draw;
    for (i = 0; i < 30; i++) {
      draw = sim.rollCareerTraitDraw(g, config);
      assert(draw.length === 3, "draw 3, got " + draw.length);
      assert(new Set(draw).size === 3, "draw distinct: " + draw.join(","));
      draw.forEach(function (id) {
        assert(pool.indexOf(id) >= 0, "drawn from career pool: " + id);
      });
    }
    // 注意：这是「三选一」那个未接线 API 的测试，不是开局真实路径（开局见 careerTraitsStayOnLiveKeys）。
    ok("trait draw helper picks 3 distinct career traits");
  })();

  (function careerTraitPicksOnceAndLocks() {
    const g = sim.createCareerGame("锁", "programmer", config);
    assert(g.career.traits.length === 0 && g.career.traitsLocked === false, "no trait before pick");
    const picked = sim.pickCareerTrait(g, "workaholic", config);
    assert(picked.career.traits.length === 1 && picked.career.traits[0] === "workaholic", "trait stored");
    assert(picked.career.traitsLocked === true, "locked after pick");
    const again = sim.pickCareerTrait(picked, "pennyPincher", config);
    assert(again.career.traits[0] === "workaholic", "second pick ignored");
    assert(sim.pickCareerTrait(g, "thrifty", config).career.traits.length === 0, "staff trait rejected");
    const playing = deepClone(g);
    playing.phase = "PLAYING";
    assert(sim.pickCareerTrait(playing, "workaholic", config).career.traits.length === 0,
      "cannot pick once in game");
    ok("trait picked once then locked for the run");
  })();

  (function careerTraitEffectsBothSides() {
    const startYear = (config.careerWorld.timeline || {}).startYear || 1995;
    function withTrait(id, year) {
      const s = sim.createCareerGame("效", "programmer", config);
      s.career.traits = [id];
      if (year != null) s.year = year;
      return s;
    }
    let s;
    // 产出 ↔ 成长：两条互为对方的代价
    s = withTrait("workaholic");
    assert(sim.careerTraitMult(s, "monthContributionMult", config, 1) > 1, "工作狂 产出 up");
    assert(sim.careerTraitMult(s, "jobXpMult", config, 1) < 1, "工作狂 职级XP down");
    s = withTrait("fastLearner");
    assert(sim.careerTraitStatGrowthMult(s, config) > 1, "学得快 成长 up");
    assert(sim.careerTraitMult(s, "jobXpMult", config, 1) > 1, "学得快 职级XP up");
    assert(sim.careerTraitMult(s, "monthContributionMult", config, 1) < 1, "学得快 产出 down");
    s = withTrait("perfectionist");
    assert(sim.careerTraitMult(s, "monthContributionMult", config, 1) > 1, "一丝不苟 产出 up");
    assert(sim.careerTraitStatGrowthMult(s, config) < 1, "一丝不苟 成长 down");
    // 万人迷：关系 + 事件正面 换 产出
    s = withTrait("peoplePerson");
    assert(sim.careerTraitSum(s, "bondTogetherBonus", config) > 0, "万人迷 关系 up");
    assert(sim.careerTraitMult(s, "eventQualityPosMult", config, 1) > 1, "万人迷 事件正面 up");
    assert(sim.careerTraitMult(s, "monthContributionMult", config, 1) < 1, "万人迷 产出 down");
    const lb = config.traits.lateBloomer;
    assert(Math.abs(sim.careerTraitStatGrowthMult(withTrait("lateBloomer", startYear + 2), config) -
      lb.earlyStatGrowthMult) < 1e-9, "大器晚成 前期慢");
    assert(Math.abs(sim.careerTraitStatGrowthMult(withTrait("lateBloomer", startYear + 12), config) -
      lb.lateStatGrowthMult) < 1e-9, "大器晚成 后期快");
    assert(sim.createCareerGame("中", "programmer", config).career.traits.length === 0, "默认无特性");
    assert(sim.careerTraitStatGrowthMult(sim.createCareerGame("中", "programmer", config), config) === 1,
      "无特性时成长中性");
    ok("each trait pairs a real gain with a real cost");
  })();

  (function careerTraitInspirationTradesGrowth() {
    const tweaked = deepClone(config);
    tweaked.traits = deepClone(config.traits);
    tweaked.traits.inspirationBurst = deepClone(config.traits.inspirationBurst);
    tweaked.traits.inspirationBurst.inspirationRate = 1;
    function devState(trait) {
      const st = enterLiveDevMonth(tweaked, 7777, "灵");
      if (trait) { st.career.traits = [trait]; st.career.traitsLocked = true; }
      return st;
    }
    const ctrl = devState(null);
    const ctrlOut = sim.tickMonth(ctrl, tweaked).state;
    assert(ctrlOut.career.jobXp > ctrl.career.jobXp, "control gains job xp in a dev month");
    const burst = devState("inspirationBurst");
    const burstOut = sim.tickMonth(burst, tweaked).state;
    assert(burstOut.career.inspirationCount >= 1, "inspiration fired, got " + burstOut.career.inspirationCount);
    assert(burstOut.career.jobXp === burst.career.jobXp, "inspiration month gains no job xp");
    ok("灵感爆发 gives output but no growth that month");
  })();

  (function careerTraitSecondBatchEffects() {
    const startYear = (config.careerWorld.timeline || {}).startYear || 1995;
    function withTrait(id, year) {
      const s = sim.createCareerGame("效2", "programmer", config);
      s.career.traits = [id];
      if (year != null) s.year = year;
      return s;
    }
    let s;
    // 少年天才：splitYear 8 之前快、之后慢
    const ep = config.traits.earlyProdigy;
    assert(Math.abs(sim.careerTraitStatGrowthMult(withTrait("earlyProdigy", startYear + 2), config) -
      ep.earlyStatGrowthMult) < 1e-9, "少年天才 前期快");
    assert(Math.abs(sim.careerTraitStatGrowthMult(withTrait("earlyProdigy", startYear + 10), config) -
      ep.lateStatGrowthMult) < 1e-9, "少年天才 后期慢");
    // 杂食 / 技术宅：本职与非本职反向
    s = withTrait("generalist");
    assert(sim.careerTraitMult(s, "offDimContributionMult", config, 1) > 1, "杂食 非本职 up");
    assert(sim.careerTraitMult(s, "mainDimContributionMult", config, 1) < 1, "杂食 本职 down");
    assert(sim.careerTraitStatGrowthMult(s, config) < 1, "杂食 成长 down");
    s = withTrait("techRecluse");
    assert(sim.careerTraitMult(s, "mainDimContributionMult", config, 1) > 1, "技术宅 本职 up");
    assert(sim.careerTraitMult(s, "offDimContributionMult", config, 1) < 1, "技术宅 非本职 down");
    assert(sim.careerTraitStatGrowthMult(s, config) < 1, "技术宅 成长 down");
    // 孤狼：一个人快，代价是搭把手不行、交情也处不出来
    assert(sim.careerTraitSum(withTrait("loneWolf"), "bondTogetherBonus", config) < 0, "孤狼 关系 down");
    assert(sim.careerTraitMult(withTrait("loneWolf"), "monthContributionMult", config, 1) > 1, "孤狼 产出 up");
    assert(sim.careerTraitMult(withTrait("loneWolf"), "offDimContributionMult", config, 1) < 1, "孤狼 非本职 down");
    ok("second batch traits each pair a gain with a cost");
  })();

  (function careerTrendSkillMultSplitsOnTrend() {
    const gid = config.content.genres[0].id;
    function st(trait) {
      const s = sim.createCareerGame("潮", "programmer", config);
      s.trend = { genreId: gid, monthsLeft: 3 };
      if (trait) s.career.traits = [trait];
      return s;
    }
    const on = { genreId: gid };
    const off = { genreId: "__not_trending__" };
    const plain = st(null);
    assert(sim.careerTrendSkillMult(plain, on, config) === 1, "no trait: on-trend neutral");
    assert(sim.careerTrendSkillMult(plain, off, config) === 1, "no trait: off-trend neutral");
    const hunter = st("trendHunter");
    assert(sim.careerTrendSkillMult(hunter, on, config) > 1, "风口猎手 踩中 up");
    assert(sim.careerTrendSkillMult(hunter, off, config) < 1, "风口猎手 没踩中 down");
    const retro = st("retroDealer");
    assert(sim.careerTrendSkillMult(retro, on, config) < 1, "古董商 踩中 down");
    assert(sim.careerTrendSkillMult(retro, off, config) > 1, "古董商 没踩中 up");
    ok("trend traits split by whether the title rides the trend");
  })();

  (function hardChargerStreakThenBurnout() {
    function st(trait) {
      const s = sim.createCareerGame("拼", "programmer", config);
      if (trait) s.career.traits = [trait];
      return s;
    }
    const plain = st(null);
    sim.tickCareerGrind(plain, config, true);
    assert(plain.career.grindStreak === 1, "streak counts working months");
    assert(sim.careerGrindMult(plain, config) === 1, "no trait: grind mult neutral");

    const s = st("hardCharger");
    sim.tickCareerGrind(s, config, true);
    sim.tickCareerGrind(s, config, true);
    assert(sim.careerGrindMult(s, config) === 1, "streak below threshold stays neutral");
    sim.tickCareerGrind(s, config, true);
    assert(s.career.grindStreak === 3, "streak reached 3");
    assert(sim.careerGrindMult(s, config) > 1, "拼命三郎 连轴转 up");
    sim.tickCareerGrind(s, config, true);
    sim.tickCareerGrind(s, config, true);
    sim.tickCareerGrind(s, config, true);
    assert(s.career.grindStreak === 6 && s.career.burnoutMonth === true, "burnout every 6th month");
    assert(sim.careerGrindMult(s, config) < 1, "拼命三郎 倦怠 down");
    sim.tickCareerGrind(s, config, false);
    assert(s.career.grindStreak === 0 && !s.career.burnoutMonth, "idle month resets the streak");
    ok("拼命三郎 ramps up then forces a burnout every 6 months");
  })();

  // 天赋的效果键必须有真实消费方，否则等于白写（历史事故：5 条天赋的钱项全是空的）。
  (function careerTraitsStayOnLiveKeys() {
    // livingCostMult：生涯档的钱没有出口（deductLivingCost=false、savings 只进 UI，savingsGate 也是死配置）。
    // bondApartDelta：monthsApart 全仓没有读取点。
    const DEAD = ["livingCostMult", "bondApartDelta"];
    // 效果键方向：mult 以 1 为界；sum 以 0 为界；multRev 方向相反（放大负面＝代价）；
    // gain 是纯收益键（阈值类 streakThreshold / burnoutEveryMonths / splitYear 不参与判定）。
    const KIND = {
      monthContributionMult: "mult", mainDimContributionMult: "mult", offDimContributionMult: "mult",
      streakContributionMult: "mult", burnoutContributionMult: "mult",
      statGrowthMult: "mult", earlyStatGrowthMult: "mult", lateStatGrowthMult: "mult",
      jobXpMult: "mult", skillBonusTrendOnMult: "mult", skillBonusTrendOffMult: "mult",
      eventQualityPosMult: "mult", eventQualityNegMult: "multRev",
      inspirationRate: "gain", inspirationDimBonus: "gain",
      bondTogetherBonus: "sum"
    };
    // 灵感爆发的代价由引擎内建行为承载（灵感月属性与职级 XP 归零），不在配置表里，
    // 由 careerTraitInspirationTradesGrowth 单独验证。
    const ENGINE_COST = ["inspirationBurst"];
    const ids = sim.traitIds(config, "career");
    assert(ids.length === 15, "career pool is 15: " + ids.length);
    // 开局真实路径是 rollCareerStart：按 traitCountMin~Max 加权抽 1~3 条，抽到即全部生效、不可选。
    // 同「收益轴」最多一条（否则三条产出向叠到 ×1.8，或正负互相抵消）。
    const startSpec = ((config.careerWorld || {}).player || {}).startRoll || {};
    const nMin = startSpec.traitCountMin == null ? 1 : startSpec.traitCountMin;
    const nMax = startSpec.traitCountMax == null ? nMin : startSpec.traitCountMax;
    assert(nMin >= 1 && nMax <= 3 && nMin <= nMax, "trait draw range within 1..3: " + nMin + "~" + nMax);
    assert(startSpec.traitAxisDistinct !== false, "axis de-dup on by default");
    const drawG = sim.createCareerGame("抽", "programmer", config);
    const seenCounts = {};
    for (let d = 0; d < 40; d++) {
      drawG.rngSeed = 90210 + d * 131;
      drawG.rngCount = 0;
      const draft = sim.rollCareerStart(drawG, config);
      const got = draft.traitIds;
      seenCounts[got.length] = true;
      assert(got.length >= 1 && got.length <= 3, "draw within 1..3: " + got.join(","));
      assert(new Set(got).size === got.length, "no duplicate trait: " + got.join(","));
      const axes = got.map(id => sim.careerTraitAxis(id, config));
      assert(new Set(axes).size === axes.length, "distinct axes: " + got.join(","));
      got.forEach(id => assert(ids.indexOf(id) >= 0, "drawn from career pool: " + id));
    }
    assert(seenCounts[1] && (seenCounts[2] || seenCounts[3]),
      "both ends of the range are reachable: " + Object.keys(seenCounts).join(","));
    const names = {};
    ids.forEach(function (id) {
      const t = config.traits[id];
      assert(t && t.scope === "career", "scope career: " + id);
      assert(t.drawWeight > 0, "drawWeight set: " + id);
      assert(t.axis, "axis set (multi-draw de-dup): " + id);
      assert(!names[t.displayName], "displayName unique: " + t.displayName);
      names[t.displayName] = true;
      DEAD.forEach(function (k) {
        assert(t[k] == null, "trait " + id + " must not use dead key " + k);
      });
      let gain = 0, cost = 0;
      Object.keys(t).forEach(function (k) {
        const kind = KIND[k];
        if (!kind) return;
        const v = t[k];
        if (kind === "gain") { if (v > 0) gain += 1; return; }
        if (kind === "sum") { if (v > 0) gain += 1; else if (v < 0) cost += 1; return; }
        if (kind === "multRev") { if (v < 1) gain += 1; else if (v > 1) cost += 1; return; }
        if (v > 1) gain += 1; else if (v < 1) cost += 1;
      });
      if (ENGINE_COST.indexOf(id) < 0) assert(cost > 0, "trait " + id + " needs a real cost");
      assert(gain > 0, "trait " + id + " needs a real gain");
    });
    // 员工池不得混入主角特性（反向也一样）
    sim.traitIds(config, "staff").forEach(function (id) {
      assert(config.traits[id].scope !== "career", "staff pool leaks career trait " + id);
    });
    ok("career traits only use effects that have a real consumer");
  })();

  (function eventQualityTraitsScaleBothWays() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents = deepClone(config.careerWorld.devEvents || {});
    tweaked.careerWorld.devEvents.list = (tweaked.careerWorld.devEvents.list || []).slice();
    tweaked.careerWorld.devEvents.list.push({
      id: "test-quality-ev",
      presentation: "choice",
      displayName: "测试事件",
      text: "测试",
      choices: [
        { id: "up", label: "好", qualityDim: "play", qualityDelta: 4 },
        { id: "down", label: "坏", qualityDim: "play", qualityDelta: -4 }
      ]
    });
    function devState(trait) {
      const st = enterLiveDevMonth(tweaked, 515151, "事");
      assert(st.career.liveStats, "live stats exist");
      if (trait) { st.career.traits = [trait]; st.career.traitsLocked = true; }
      return st;
    }
    function delta(trait, optId) {
      const st = devState(trait);
      const before = st.career.liveStats.play;
      const out = sim.resolveCareerEventChoice(st, "test-quality-ev", optId, tweaked);
      assert(out.ok, "event resolved: " + (out.error || ""));
      return out.state.career.liveStats.play - before;
    }
    const upPlain = delta(null, "up");
    const downPlain = delta(null, "down");
    assert(upPlain > 0 && downPlain < 0, "control event moves quality both ways");
    const gUp = delta("gambler", "up");
    const gDown = delta("gambler", "down");
    assert(gUp > upPlain && gDown < downPlain, "赌徒 好坏都放大 " + upPlain + "/" + gUp + " " + downPlain + "/" + gDown);
    const sUp = delta("steadyHand", "up");
    const sDown = delta("steadyHand", "down");
    assert(sUp > 0 && sUp < upPlain, "稳如老狗 好事削减 " + upPlain + " -> " + sUp);
    assert(sDown < 0 && sDown > downPlain, "稳如老狗 坏事削减 " + downPlain + " -> " + sDown);
    ok("赌徒 and 稳如老狗 scale event quality in both directions");
  })();

};
