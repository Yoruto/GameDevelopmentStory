#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "activity", "config.json");
const SIM_DIR = path.join(ROOT, "h5", "js", "sim");
const SIM_FILES = [
  "ns.js",
  "rng.js",
  "util.js",
  "media.js",
  "awards.js",
  "events.js",
  "lifecycle.js",
  "career.js",
  "careerLines.js",
  "tick.js",
  "actions.js"
];

// sim 用 Date.now() 给随机数播种（career.js / company.js 的 rngSeed），
// 会让测试结果随运行时刻漂移（表现为偶发的 baseline / producer pitch 失败）。
// 沙箱里固定 now()，让整条测试链可复现。
const FIXED_NOW = 1767225600000;
const RealDate = Date;
function TestDate(a, b, c, d, e, f, g) {
  if (!(this instanceof TestDate)) return new RealDate(FIXED_NOW).toString();
  if (arguments.length === 0) return new RealDate(FIXED_NOW);
  if (arguments.length === 1) return new RealDate(a);
  return new RealDate(a, b, c, d, e, f, g);
}
TestDate.now = function () { return FIXED_NOW; };
TestDate.parse = RealDate.parse;
TestDate.UTC = RealDate.UTC;
TestDate.prototype = RealDate.prototype;

function loadSim() {
  const sandbox = {
    console: console,
    Math: Math,
    JSON: JSON,
    Date: TestDate,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of SIM_FILES) {
    const full = path.join(SIM_DIR, file);
    vm.runInContext(fs.readFileSync(full, "utf8"), sandbox, { filename: file });
  }
  return sandbox.GDS;
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function loadConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const careerPath = path.join(ROOT, "activity", "career-world.json");
  if (fs.existsSync(careerPath)) {
    config.careerWorld = JSON.parse(fs.readFileSync(careerPath, "utf8"));
  }
  return config;
}

function main() {
  const GDS = loadSim();
  const sim = GDS.sim;
  const config = loadConfig();

  // ── 两套维度 ────────────────────────────────────────────────────────────
  // 人物维（员工与玩家的属性）：PDIMS。作品维（作品自身的质量）：TDIMS。
  // 下面两条断言把 career-world.json 的 quality.personDims / quality.dims 钉死；
  // 改配置里的维度名就要同步改这里，否则本文件所有位置配对断言都失去意义。
  const PDIMS = sim.personDims(config);
  const TDIMS = sim.titleDims(config);
  assert(PDIMS.join(",") === "program,design,art,music", "person dims are 程序/策划/美术/音乐");
  assert(TDIMS.join(",") === "play,fun,expression,immersion", "title dims are 游戏性/趣味性/表现力/沉浸感");
  // 人物→作品系数矩阵。下面「团队立项初始四维」等测试按矩阵算期望值，都依赖这条不变式：
  // 矩阵是双随机（每行、每列合计都为 1）——既不放大/缩小作品四维总量，又让每个作品维落在 0-100。
  (function assertPersonToTitleMatrix() {
    const mx = (config.careerWorld.quality || {}).personToTitle || {};
    const PD = ["program", "design", "art", "music"];
    PD.forEach(function (pd) {
      const row = mx[pd] || {};
      let rs = 0;
      TDIMS.forEach(function (td) {
        const w = row[td];
        assert(typeof w === "number" && w >= 0, "matrix " + pd + " -> " + td + " is a weight");
        rs += w;
      });
      assert(Math.abs(rs - 1) < 1e-9, "matrix row " + pd + " sums to 1 (got " + rs + ")");
    });
    TDIMS.forEach(function (td) {
      let cs = 0;
      PD.forEach(function (pd) { cs += (mx[pd] && mx[pd][td]) || 0; });
      assert(Math.abs(cs - 1) < 1e-9, "matrix column " + td + " sums to 1 (got " + cs + ")");
    });
  })();
  function tsum(stats) {
    return sim.titleQualitySum(stats, config);
  }
  let passed = 0;

  function ok(name) {
    passed += 1;
    console.log("ok  " + name);
  }

  function hireOne(seed) {
    const g = sim.createNewGame("测", config);
    g.rngSeed = seed;
    g.rngCount = 0;
    const hired = sim.hire(g, g.talentMarket[0].id, config);
    assert(hired.ok, "hireOne");
    return hired.state;
  }

  function firstIds() {
    const genreId = config.content.genres[0].id;
    const gameplayId = config.content.gameplay[0].id;
    return { genreId, gameplayId };
  }

  function pitchArgs(state, extra) {
    const ids = firstIds();
    const staffId = state.staff[0].id;
    const base = {
      title: extra && extra.title ? extra.title : "测试作",
      genreId: ids.genreId,
      gameplayId: ids.gameplayId,
      platformId: "pc",
      releaseType: "boxed",
      cycle: "short",
      producerId: staffId,
      memberIds: [staffId]
    };
    return Object.assign(base, extra || {});
  }

  function quietWorld(cfg) {
    cfg.world.monthlyEventChance = 0;
    cfg.world.historicalEvents = [];
    cfg.world.events = [];
  }

  function fillerLadder(n, sales) {
    const list = [];
    let i;
    for (i = 1; i <= n; i++) {
      list.push({
        id: "f" + i,
        title: "假作" + i,
        pub: "市场",
        monthSales: sales
      });
    }
    return list;
  }



























  (function salesFactorMonth1IsBase() {
    const y = sim.salesFactor(1, 10, config);
    assert(Math.abs(y - 1) < 0.02, "Y(1,10)≈1 got " + y);
    const yNoScore = sim.salesFactor(2, null, config);
    assert(yNoScore === 0, "no score is not treated as 10");
    ok("salesFactor(1,10)≈1 and missing score is not 10");
  })();

  (function salesFactorFollowsExponentialFormula() {
    const lc = config.lifecycle;
    function expected(m, S) {
      const u = (S - lc.scoreMin) / (lc.scoreMax - lc.scoreMin);
      const lambda = lc.lambda0 + u * lc.lambdaSpan;
      const T = lc.tMin + u * lc.tSpan;
      const x = m - 1;
      return T + (1 - T) * Math.exp(-lambda * x);
    }
    // S=10 的查表对照：λ=0.55、T=0.34，第 2 月掉到 0.72，此后贴着长尾。
    const table10 = [1.00, 0.72, 0.56, 0.47, 0.41, 0.38, 0.36, 0.35, 0.35, 0.34, 0.34, 0.34];
    let m;
    for (m = 1; m <= lc.maxMonths; m++) {
      const y = sim.salesFactor(m, 10, config);
      const exp = expected(m, 10);
      assert(Math.abs(y - exp) < 1e-9, "formula m=" + m + " " + y);
      const tab = table10[m - 1];
      const rel = Math.abs(y - tab) / tab;
      assert(rel < 0.05, "table对照 m=" + m + " y=" + y + " tab=" + tab + " rel=" + rel);
    }
    assert(sim.salesFactor(lc.maxMonths + 1, 10, config) === 0, "past maxMonths");
    ok("salesFactor matches exponential decay from lifecycle config");
  })();

  (function salesFactorDecaysFastThenFlattens() {
    // 第 2 月就该掉到六成上下——旧 logistic 在第 2 月还有 0.99，前 3 个月几乎不衰减。
    const y2high = sim.salesFactor(2, 10, config);
    const y2low = sim.salesFactor(2, 6, config);
    let m, prev, cur;
    assert(y2high > 0.6 && y2high < 0.8, "Y(2,10) in 0.6~0.8 got " + y2high);
    assert(y2low > 0.5 && y2low < 0.72, "Y(2,6) in 0.5~0.72 got " + y2low);
    assert(y2high > y2low, "high score decays slower");
    prev = sim.salesFactor(1, 8, config);
    for (m = 2; m <= config.lifecycle.maxMonths; m++) {
      cur = sim.salesFactor(m, 8, config);
      assert(cur < prev, "monotonic decay at m=" + m);
      assert(cur >= config.lifecycle.tMin, "never below long tail at m=" + m);
      prev = cur;
    }
    ok("salesFactor drops ~30% by month 2 and decays monotonically into the tail");
  })();

  (function mediaOutletsCarryFullQuotePools() {
    // 四家媒体 = 四个维度各一个主场。配置里的 outlets 与评语池必须一一对应：
    // 删了一家却留着它的池（或反过来）就是文案 bug —— 这里当守卫。
    const outlets = config.release.media.outlets;
    const bands = ["top", "high", "mid", "low"];
    assert(outlets.length === 4, "four media outlets, got " + outlets.length);
    const pools = config.copy.mediaQuotePools.outlets;
    assert(Object.keys(pools).length === outlets.length,
      "no orphan quote pool: pools=" + Object.keys(pools).join(","));
    outlets.forEach(function (o) {
      const pool = pools[o.id];
      assert(pool, "quote pool exists for " + o.id);
      let all = [];
      bands.forEach(function (b) {
        assert(Array.isArray(pool[b]) && pool[b].length > 0, "pool " + o.id + "." + b + " non-empty");
        all = all.concat(pool[b]);
      });
      assert(new Set(all).size === all.length, "no duplicate quotes inside " + o.id);
      assert(all.every(function (q) { return typeof q === "string" && q.length >= 2 && q.length <= 18; }),
        "quotes stay one short sentence: " + o.id);
    });
    // 玩家在同一次揭晓里同时看到四家的评语，同档撞句必须为 0
    for (let i = 0; i < outlets.length; i++) {
      for (let j = i + 1; j < outlets.length; j++) {
        bands.forEach(function (b) {
          const a = pools[outlets[i].id][b];
          const bq = new Set(pools[outlets[j].id][b]);
          const hit = a.filter(function (q) { return bq.has(q); });
          assert(hit.length === 0, "no same-band quote collision " + outlets[i].id + "/" + outlets[j].id + ": " + hit.join("|"));
        });
      }
    }
    ok("four outlets each carry a full, non-colliding quote pool");
  })();

  (function mediaAvgIsMeanOfOutlets() {
    // 面板上的「均分」必须能被玩家拿看得见的四家分数手算出来，而且要和作品评分是同一个数
    // ——2026-09-18 的 bug：4 家都不是 10 分，均分却写 10（面板把对外口碑当均分显示了）。
    const jit = config.careerWorld.scoreFromLive;
    const scatter = { min: jit.mediaJitterMin, max: jit.mediaJitterMax };
    const round1 = function (v) { return Math.round(v * 10) / 10; };
    let seen = 0, freeRange = 0;
    for (let p = 10; p <= 100; p += 1) {
      const pub = p / 10;
      // 离上下限足够远时（余量 ≥ 抖动幅度）不压缩，这是绝大多数分数所在的区间。
      const free = Math.min(config.release.media.maxScore - pub, pub - config.release.media.minScore) >= jit.mediaJitterMax;
      for (let seed = 1; seed <= 40; seed++) {
        const st = { rngSeed: (seed * 104729 + p * 31) >>> 0, rngCount: 0 };
        const m = sim.scoreMediaFromPublic(st, pub, config, scatter);
        const rows = m.rows.map(function (r) { return r.score; });
        const hand = round1(rows.reduce(function (a, b) { return a + b; }, 0) / rows.length);
        assert(m.avg === hand, "media avg is the mean of the shown rows: " + m.avg + " vs " + hand + " " + rows);
        // 抖动是配平的：均分落回口碑，不带系统性偏移（也保证榜单/奖项读到的就是面板上那一个数）
        assert(m.avg === round1(pub), "media avg stays on the public score, got " + m.avg + " vs " + pub);
        // 单家偏移不超过配置写的抖动幅度，且永远不吃 min/max 夹子
        rows.forEach(function (v) {
          assert(Math.abs(v - pub) <= jit.mediaJitterMax + 1e-9, "outlet jitter within cap, got " + v + " vs " + pub);
          assert(v >= config.release.media.minScore && v <= config.release.media.maxScore, "outlet clamped into range");
        });
        if (!free) continue;
        // 分歧必须存在：正好两家偏高、两家偏低
        const up = rows.filter(function (v) { return v > pub + 1e-9; }).length;
        assert(up === 2, "two outlets above, two below: " + up + " rows=" + rows + " pub=" + pub);
        // 哪两家偏高必须轮换，不能永远是同一批
        freeRange += 1;
        seen += rows[0] > pub + 1e-9 ? 1 : 0;
      }
    }
    // 第一家在「偏高」那一档的次数应接近一半（正负两侧是按随机轮换分的，不是按出场顺序）
    assert(seen > freeRange * 0.4 && seen < freeRange * 0.6,
      "outlet bias rotates, first outlet high " + seen + "/" + freeRange);
    // 满分作：余量为 0，四家一致给满分，均分真的到得了 10
    const atTop = sim.scoreMediaFromPublic({ rngSeed: 99, rngCount: 0 }, config.release.media.maxScore, config, scatter);
    assert(atTop.avg === config.release.media.maxScore, "perfect work shows a perfect average");
    assert(atTop.rows.every(function (r) { return r.score === config.release.media.maxScore; }), "perfect work: all four agree");
    ok("media average is the mean of the four shown scores, balanced around the public score");
  })();

  (function noWeek1SalesAnyMore() {
    // 揭晓面板不再显示首周销量：sim 层的切分函数与配置项都已删除。
    assert(typeof sim.salesWeek1Share === "undefined", "salesWeek1Share removed");
    assert(typeof sim.boxedWeek1Units === "undefined", "boxedWeek1Units removed");
    assert(config.lifecycle.week1ShareMin === undefined && config.lifecycle.week1ShareSpan === undefined,
      "lifecycle week1Share keys removed");
    assert(config.copy.week1SalesLabel === undefined, "week1SalesLabel removed");
    assert(config.copy.launchSalesReveal === "月销量", "sales row is labelled 月销量");
    ok("first-week sales display is gone, monthly sales remains");
  })();

  (function launchSalesRisesSuperlinearlyWithScore() {
    const mid = { prestige: 3, power: 2, stats: { play: 75, fun: 75, expression: 75, immersion: 75 } };
    const lo = sim.careerLaunchSales(mid, 7, config).launchSales;
    const hi = sim.careerLaunchSales(mid, 9, config).launchSales;
    const ratio = hi / lo;
    const expRatio = Math.exp(config.careerWorld.launchSales.scoreExp * 2);
    assert(Math.abs(lo - 9000) / 9000 < 0.02, "7 分中性作 ≈ 9000，got " + lo);
    assert(Math.abs(ratio - expRatio) / expRatio < 0.02, "9/7 ratio follows scoreExp got " + ratio);
    assert(ratio > 20, "高分必须碾压低分，got " + ratio);
    ok("launchSales rises superlinearly with score (9分/7分 ≈ ×" + Math.round(ratio) + ")");
  })();

  (function launchSalesSpansRealisticMagnitude() {
    const spec = config.careerWorld.launchSales;
    const top = sim.careerLaunchSales(
      { prestige: 5, power: 3, stats: { play: 100, fun: 100, expression: 100, immersion: 100 } }, 9.9, config
    ).launchSales;
    const mid = sim.careerLaunchSales(
      { prestige: 3, power: 2, stats: { play: 75, fun: 75, expression: 75, immersion: 75 } }, 7, config
    ).launchSales;
    const flop = sim.careerLaunchSales(
      { prestige: 2, power: 1, stats: { play: 40, fun: 40, expression: 40, immersion: 40 } }, 6, config
    ).launchSales;
    assert(top > 2000000 && top < 3200000, "顶配 9.9 分首月应为百万级，got " + top);
    assert(Math.abs(mid - 9000) / 9000 < 0.02, "7 分合格作锚点不动，got " + mid);
    assert(flop > 2000 && flop < 6000, "6 分小厂作落在数千档，got " + flop);
    assert(top / flop > 500, "梯度应拉开数百倍以上 got " + Math.round(top / flop));
    assert(spec.baseUnit > 0 && spec.scoreExp > 0, "launchSales spec present");
    ok("launchSales spans flop(" + flop + ") → mid(" + mid + ") → landmark(" + top + ")");
  })();

  // 低分作品不能塌到个位数：真实市场里再烂的作品也有基础曝光。
  // 实现是「拐点换斜率」——scoreRef 以下走更缓的 scoreExpBelow，以上走 scoreExp，中高段一个数不动。
  (function launchSalesLiftsTheLowScoreTail() {
    const spec = config.careerWorld.launchSales;
    const bad = { prestige: 2, power: 1, stats: { play: 40, fun: 40, expression: 40, immersion: 40 } };
    const at = function (s) { return sim.careerLaunchSales(bad, s, config).launchSales; };
    const s1 = at(1), s3 = at(3), s5 = at(5), s7 = at(7);
    assert(s1 > 100, "1 分小厂作也不该归零，got " + s1);
    assert(s3 > 300, "3 分小厂作首月应为数百量级，got " + s3);
    assert(s1 < s3 && s3 < s5 && s5 < s7, "低分段仍须单调递增 " + [s1, s3, s5, s7].join("/"));
    assert(spec.scoreExpBelow != null && spec.scoreExpBelow > 0 && spec.scoreExpBelow < spec.scoreExp,
      "scoreExpBelow 必须是比 scoreExp 更缓的斜率，got " + spec.scoreExpBelow);
    // 斜率切换真的发生在拐点上：跨 7 分那一步的涨幅要大于拐点以下同宽的一步
    const stepBelow = at(6.5) / at(5.5);
    const stepCross = at(7.5) / at(6.5);
    assert(stepBelow < stepCross, "7 分以下每分涨幅应更小，got below=" + stepBelow.toFixed(2) + " cross=" + stepCross.toFixed(2));
    ok("低分作品首月有底（1 分 " + s1 + " / 3 分 " + s3 + " / 5 分 " + s5 + " / 7 分 " + s7 + "）");
  })();

  (function launchSalesGivesBigPublishersAnEdge() {
    const spec = config.careerWorld.launchSales;
    const t = { prestige: 4, stats: { play: 85, fun: 85, expression: 85, immersion: 85 } };
    const small = sim.careerLaunchSales(Object.assign({}, t, { power: 1 }), 8.5, config).launchSales;
    const big = sim.careerLaunchSales(Object.assign({}, t, { power: 3 }), 8.5, config).launchSales;
    const exp = spec.powerMult["3"] / spec.powerMult["1"];
    assert(Math.abs(big / small - exp) / exp < 0.02, "power ratio follows config got " + (big / small));
    assert(big > small, "同分作品大厂发行卖得更多");
    ok("publisher power shifts sales ×" + (big / small).toFixed(2) + " at equal score");
  })();








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
      const g = sim.createCareerGame("灵", "programmer", tweaked);
      g.rngSeed = 7777;
      g.rngCount = 0;
      let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
      let guard = 0;
      st.career.companyId = "fromsoftware";
      st.career.studioId = "fromsoftware-main";
      st.career.titleId = null;
      st.career.liveStats = null;
      while (sim.careerProjectView(st, tweaked).idle && guard < 8) {
        st = sim.tickMonth(st, tweaked).state;
        guard += 1;
      }
      assert(!sim.careerProjectView(st, tweaked).idle, "reached a dev month");
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
      const g = sim.createCareerGame("事", "programmer", tweaked);
      g.rngSeed = 515151;
      g.rngCount = 0;
      let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
      let guard = 0;
      st.career.companyId = "fromsoftware";
      st.career.studioId = "fromsoftware-main";
      st.career.titleId = null;
      st.career.liveStats = null;
      while (sim.careerProjectView(st, tweaked).idle && guard < 8) {
        st = sim.tickMonth(st, tweaked).state;
        guard += 1;
      }
      assert(!sim.careerProjectView(st, tweaked).idle, "reached a dev month");
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

  (function awardsListUsesStatsFields() {
    const list = config.awards.list || [];
    const ids = list.map(function (a) { return a.id; });
    assert(ids.indexOf("bestAudio") >= 0, "bestAudio present");
    assert(ids.indexOf("bestGameplay") >= 0, "bestGameplay present");
    assert(ids.indexOf("bestProduction") < 0, "bestProduction removed");
    list.forEach(function (a) {
      assert(a.scoreFrom || a.stat, "award scoring field " + a.id);
    });
    const audio = list.filter(function (a) { return a.id === "bestAudio"; })[0];
    assert(audio && audio.stat === "immersion", "bestAudio reads immersion");
    ok("awards list is stat/scoreFrom driven");
  })();

  (function scoreAwardCategoryReadsStats() {
    const world = config.careerWorld;
    const ff7 = (world.titles || []).filter(function (t) { return t.id === "ff7"; })[0];
    const even = { stats: { play: 85, fun: 85, expression: 85, immersion: 85 }, score: 9.0 };
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    assert(ff7 && defs.bestVisual && defs.bestAudio, "ff7 and award defs");
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "ff7 visual > even");
    assert(sim.scoreAwardCategory(ff7, defs.bestAudio) > sim.scoreAwardCategory(even, defs.bestAudio), "ff7 audio > even");
    const portal = (world.titles || []).filter(function (t) { return t.id === "portal"; })[0];
    assert(portal && sim.scoreAwardCategory(portal, defs.bestNarrative) > sim.scoreAwardCategory(even, defs.bestNarrative), "portal design > even");
    const missingAudio = { avg: 8.2, qsum: 320, fun: 80, expression: 78 };
    assert(typeof sim.scoreAwardCategory(missingAudio, defs.bestAudio) === "number", "rival missing immersion still scores");
    ok("scoreAwardCategory compares stats without historical winners");
  })();



  (function careerNewGameOpeningOffers() {
    const g = sim.createCareerGame("测", "programmer", config);
    const world = config.careerWorld;
    assert(g.mode === "career", "career mode");
    assert(g.year === world.timeline.startYear && g.month === world.timeline.startMonth, "career starts 1995.01");
    assert(g.year === 1995 && g.month === 1, "1995 jan");
    assert(g.career.characterName === "测", "character name");
    assert(g.career.roleId === "programmer", "locked role");
    assert(g.career.growthStage === "employee", "employee stage");
    assert(g.career.jobRank === 1, "start Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "代码实习生", "programmer intern title");
    assert(sim.formatCareerRankLabel("programmer", 1, config) === "代码实习生 (T-0)", "programmer intern code");
    assert(sim.careerJobTitleDisplay(g, config) === "代码实习生 (T-0)", "programmer intern display");
    assert(g.career.stats.program >= 22 && g.career.stats.program <= 26, "main stat in 20s");
    assert(g.career.stats.art >= 16 && g.career.stats.art <= 20, "off-dim in teens");
    assert(g.career.stats.program < 40, "main not in 40s");
    assert(g.phase === "OFFER", "offer phase");
    const offers = g.career.openingOffers || [];
    assert(offers.length === 3, "three offers");
    const tiers = offers.map(function (o) { return o.tier; });
    ["small", "stable", "wild"].forEach(function (t) {
      assert(tiers.indexOf(t) >= 0, "tier " + t);
    });
    offers.forEach(function (o) {
      assert(o.roleId === "programmer", "offer role matches specialty");
      assert(o.salary > 0, "offer salary " + o.companyId);
      assert(o.risk, "offer risk " + o.tier);
      const co = sim.careerCompany(o.companyId, config);
      assert(co && co.openingOffer && co.starterTier === o.tier, "offer company tier");
      const seniorLine = sim.careerSeniorLine(co, config);
      // 公司可无前辈：opening offer 的 seniorLine 可能为空，不再强制以"前辈"开头
    });
    ok("career new game: 1995, three-tier offers, role locked");
  })();

  (function careerRankCodeFormatting() {
    assert(sim.careerRankCode("programmer", 1, config) === "T-0", "T-0");
    assert(sim.formatCareerRankLabel("programmer", 4, config) === "高级程序员 (T-3)", "T-3");
    assert(sim.formatCareerRankLabel("programmer", 6, config) === "技术总监 (T-5)", "T-5");
    assert(sim.formatCareerRankLabel("design", 5, config) === "主策划 (D-4)", "D-4");
    assert(sim.formatCareerRankLabel("art", 2, config) === "初级美术 (A-1)", "A-1");
    assert(sim.formatCareerRankLabel("art", 5, config) === "主美 (A-4)", "A-4");
    assert(sim.formatCareerRankLabel("music", 1, config) === "音频实习生 (M-0)", "M-0");
    assert(sim.formatCareerRankLabel("music", 6, config) === "音频总监 (M-5)", "M-5");
    const promo = sim.careerPromotionView(sim.createCareerGame("测", "design", config), config);
    assert(promo.currentLabel === "策划实习生 (D-0)", "promo view uses rank code");
    const line = sim.careerSeniorLine("nintendo", config);
    // 公司可无前辈：不再强制 nintendo 有 宫本茂 / 制作总监
    ok("career rank codes T/D/A/M and 前辈 line");
  })();

  (function careerAcceptJoinsOrIdles() {
    const g = sim.createCareerGame("测", "art", config);
    const offer = g.career.openingOffers[1] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, offer.id, config);
    assert(acc.ok, "accept ok");
    assert(acc.state.phase === "PLAYING", "playing");
    assert(acc.state.career.companyId === offer.companyId, "company set");
    assert(acc.state.career.growthStage === "employee", "not producer");
    const view = sim.careerProjectView(acc.state, config);
    assert(view.idle === true || (view.title && view.phase && view.phase.until != null), "project or idle");
    if (!view.idle) {
      assert(view.title.companyId === offer.companyId, "title company matches");
      assert(acc.state.career.liveStats, "live stats present");
      assert(acc.state.career.colleagues.length === 4, "four colleagues");
      const roles = acc.state.career.colleagues.map(function (c) { return c.roleId; });
      assert(roles.indexOf("art") < 0, "player occupies art slot");
      assert(roles.indexOf("producer") >= 0, "producer npc");
    }
    ok("career accept offer joins project or idles without throw");
  })();


  (function careerEventSpecifiedDimCanExceed100() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [{
      id: "testBurst",
      displayName: "测试突破",
      text: "指定程序维",
      presentation: "notice",
      qualityDim: "play",
      qualityDelta: 20
    }];
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const squareOffer = (g.career.openingOffers || []).filter(function (o) {
      return o.companyId === "square";
    })[0] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, squareOffer.id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.jobRank = 6;
    st.career.stats.program = 90;
    st.career.liveStats = { play: 95, fun: 90, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.rngSeed = 1;
    st.rngCount = 0;
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "testBurst", "burst event rolled");
    assert(st.career.liveStats.play > 100, "live can exceed 100, got " + st.career.liveStats.play);
    ok("career event uses specified dim and live can exceed 100");
  })();

  (function careerDevEventRoleAndPhaseFilter() {
    function choiceEv(id, extra) {
      const row = {
        id: id,
        displayName: id,
        text: "测",
        presentation: "choice",
        choices: [{ id: "a", label: "按期", qualityDim: ["play"], qualityDelta: [2] }]
      };
      Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
      return row;
    }
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [
      choiceEv("artOnlyChoice", { role: "art" }),
      choiceEv("genericChoice"),
      choiceEv("progPreproChoice", { role: "programmer", phase: "prepro" }),
      choiceEv("progProdChoice", { role: "programmer", phase: "production" })
    ];
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "phaseProbe",
      companyId: "square",
      publisherId: "square",
      name: "探针",
      alias: "探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "phaseProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11
    }]);
    function primed(roleId, year, month) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "phaseProbe";
      st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
      st.career.credits = [{ titleId: "phaseProbe", companyId: "square", roleId: roleId }];
      st.career.postLaunch = null;
      return st;
    }
    function rollIds(roleId, year, month, n) {
      const ids = {};
      let i;
      for (i = 0; i < n; i++) {
        const st = primed(roleId, year, month);
        st.rngSeed = 1000 + i;
        st.rngCount = 0;
        const ev = sim.rollCareerDevEvent(st, tweaked, []);
        assert(ev, "chance 1 always rolls " + roleId + " " + year + "." + month);
        ids[ev.id] = true;
      }
      return ids;
    }
    const progJan = rollIds("programmer", 1995, 1, 24);
    assert(!progJan.artOnlyChoice, "programmer cannot roll art choice");
    assert(progJan.genericChoice, "role-less generic still rolls");
    assert(progJan.progPreproChoice, "programmer prepro choice rolls in prepro");
    assert(!progJan.progProdChoice, "production choice stays out of prepro");
    const progJun = rollIds("programmer", 1995, 6, 24);
    assert(progJun.progProdChoice, "programmer production choice rolls in production");
    assert(!progJun.progPreproChoice, "prepro choice stays out of production");
    assert(!progJun.artOnlyChoice, "programmer still cannot roll art in production");
    const artJan = rollIds("art", 1995, 1, 24);
    assert(artJan.artOnlyChoice, "art player can roll art choice");
    assert(artJan.genericChoice, "art player can still roll generic");
    assert(!artJan.progPreproChoice, "art player cannot roll programmer choice");
    ok("career devEvents hard-filter role and phase");
  })();

  (function careerPostLaunchRoleFilterAndChoiceReplay() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.postLaunch.eventChance = 1;
    tweaked.careerWorld.postLaunch.events = [
      {
        id: "artPostChoice",
        displayName: "破图",
        text: "测",
        presentation: "choice",
        role: "art",
        choices: [
          { id: "fix", label: "立刻补", qualityDim: ["expression"], qualityDelta: [5] },
          { id: "wait", label: "等大更新", qualityDim: ["expression"], qualityDelta: [-2] }
        ]
      },
      {
        id: "allNotice",
        displayName: "补丁说明",
        text: "测",
        presentation: "notice",
        qualityDim: "play",
        qualityDelta: 1
      }
    ];
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = [{
      id: "genericReplay",
      displayName: "通用抉择",
      text: "测",
      presentation: "choice",
      choices: [
        { id: "push", label: "加钱赶工", qualityDim: ["play", "expression"], qualityDelta: [7, -4] },
        { id: "hold", label: "按期", qualityDim: ["play"], qualityDelta: [0] }
      ]
    }];
    function supportState(roleId) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
      st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: roleId }];
      st.career.postLaunch = { titleId: "chronoTrigger", monthsLeft: 2 };
      return st;
    }
    const progSeen = {};
    let i;
    for (i = 0; i < 20; i++) {
      const st = supportState("programmer");
      st.rngSeed = 50 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      assert(ev, "postLaunch chance 1 rolls");
      progSeen[ev.id] = true;
    }
    assert(!progSeen.artPostChoice, "programmer cannot roll art postLaunch choice");
    assert(progSeen.allNotice, "role-less postLaunch notice still rolls");
    const artSeen = {};
    for (i = 0; i < 20; i++) {
      const st = supportState("art");
      st.rngSeed = 80 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      if (ev) artSeen[ev.id] = true;
    }
    assert(artSeen.artPostChoice, "art player can roll art postLaunch choice");

    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let base = acc.state;
    base.career.companyId = "square";
    base.career.titleId = "chronoTrigger";
    base.career.liveStats = { play: 90, fun: 88, expression: 86, immersion: 84 };
    base.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    base.career.postLaunch = null;
    base.year = 1995;
    base.month = 1;
    base.rngSeed = 424242;
    base.rngCount = 0;
    const snap = JSON.stringify(base);
    const t1 = sim.tickMonth(JSON.parse(snap), tweaked);
    const t2 = sim.tickMonth(JSON.parse(snap), tweaked);
    assert(JSON.stringify(t1.state) === JSON.stringify(t2.state), "career choice tick replays before pick");
    const choicePage = (t1.queue || []).filter(function (q) {
      return q.presentation === "choice" && q.eventId === "genericReplay";
    })[0];
    assert(choicePage, "career generic choice queued");
    const artBefore = t1.state.career.liveStats.expression;
    const a = sim.resolveEventChoice(t1.state, "genericReplay", "push", tweaked);
    const b = sim.resolveEventChoice(t2.state, "genericReplay", "push", tweaked);
    assert(a.ok && b.ok, "career resolve ok");
    assert(JSON.stringify(a.state) === JSON.stringify(b.state), "career same seed same choice");
    const f = sim.careerPlayerImpactFactor(t1.state, tweaked);
    assert(a.state.career.liveStats.play === t1.state.career.liveStats.play + 7 * f, "push raises play by scaled delta");
    assert(a.state.career.liveStats.expression === artBefore - 4 * f, "push drops expression by scaled delta");
    ok("postLaunch role filter and career choice replay same seed");
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

  (function careerXpAndMediaAndHop() {
    const g = sim.createCareerGame("测", "programmer", config);
    const squareXp = sim.companyXpValue(g, "square", "genre", "fantasy");
    assert(squareXp > 0, "1995 companies have seeded genre xp");
    const offer = g.career.openingOffers[0];
    let acc = sim.acceptOpeningOffer(g, offer.id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const beforeXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.lastMedia && st.lastMedia.media && st.lastMedia.media.rows.length === 4, "4 media outlets");
    st.lastMedia.media.rows.forEach(function (row) {
      assert(row.quote && typeof row.score === "number", "outlet quote+score " + row.id);
    });
    assert(queue.some(function (q) { return q.type === "media"; }), "player ship queues media");
    assert(typeof st.lastMedia.launchSales === "number", "career media rec has launchSales");
    assert(st.lastMedia.launchSales > 0, "career launchSales > 0");
    (function assertCareerLaunchMatchesFormula() {
      const packed = sim.careerLaunchSales(
        sim.careerTitle("chronoTrigger", config, st),
        st.lastMedia.score,
        config,
        st.lastMedia.liveStats || st.lastMedia.stats
      );
      const y1 = sim.salesFactor(1, st.lastMedia.score, config);
      assert(st.lastMedia.baselineSales === packed.baselineSales, "career baseline from public score coeffs");
      assert(st.lastMedia.launchSales === packed.launchSales, "career launchSales stamped on rec");
      assert(st.lastMedia.launchSales === sim.boxedActualFromY({ baselineSales: packed.baselineSales }, y1), "career launch is baseline×Y(1)");
      const mediaPage = queue.filter(function (q) { return q.type === "media"; })[0];
      assert(mediaPage && mediaPage.rec && mediaPage.rec.launchSales === packed.launchSales, "queued media rec carries launchSales");
    })();
    const afterXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    assert(afterXp > beforeXp, "player ship raises company xp");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    high.companyXp.square = { genreXp: { scifi: 80 }, gameplayXp: { rpg: 80 } };
    const t = sim.careerTitle("ff7", config);
    const liveLow = (function () {
      high.career.companyId = "square";
      return null;
    })();
    void liveLow;
    const bonusSpec = config.careerWorld.companyXp;
    const lowBonus = Math.floor(sim.companyXpValue(low, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(low, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    const highBonus = Math.floor(sim.companyXpValue(high, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(high, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    assert(highBonus > lowBonus, "higher xp gives higher stat bonus");

    let hopSt = sim.createCareerGame("测", "music", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.year = 1995;
    hopSt.month = 12;
    hopSt.career.titleId = null;
    hopSt.career.liveStats = null;
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const offers = hopSt.career.yearEndOffers;
    assert(offers.length >= 1, "year-end offers in december");
    offers.forEach(function (o) {
      const co = sim.careerCompany(o.companyId, config);
      assert(sim.companyJoinable(co, hopSt.year), "offer company joinable");
      if (o.kind === "promotion" || o.kind === "promotionLine") {
        assert(o.roleId === "music", "promo keeps specialty");
      } else {
        assert(["programmer", "art", "design", "music"].indexOf(o.roleId) >= 0, "hop staff role " + o.roleId);
        assert(o.roleId !== "producer", "producer hop locked before line done");
      }
      assert(o.salary > 0 && o.currentSalary != null, "salary compare");
    });
    offers[0].successChance = 1;
    const take = sim.acceptYearEndOffer(hopSt, offers[0].id, config);
    assert(take.ok, "accept hop");
    assert(take.state.career.companyId === offers[0].companyId, "company switched");

    hopSt.career.fame = 80;
    hopSt.year = 1995;
    hopSt.month = 2;
    const inv = sim.listCareerInvites(hopSt, config);
    assert(Array.isArray(inv), "invites list");
    if (inv.length) {
      hopSt.career.invites = inv;
      const accInv = sim.acceptCareerInvite(hopSt, inv[0].id, config);
      assert(accInv.ok, "accept invite");
      assert(accInv.state.career.companyId === inv[0].companyId, "invite switches company");
    } else {
      const tweaked = deepClone(config);
      const chrono = (tweaked.careerWorld.titleDetails || []).filter(function (d) { return d.id === "chronoTrigger"; })[0];
      assert(chrono && chrono.inviteEligible, "chrono invite eligible");
      hopSt.career.fame = chrono.inviteMinFame;
      hopSt.career.companyId = "nintendo";
      hopSt.year = chrono.inviteWindow.startYear;
      hopSt.month = chrono.inviteWindow.startMonth;
      const inv2 = sim.listCareerInvites(hopSt, tweaked);
      assert(inv2.length >= 1, "invite appears when fame and window match");
      hopSt.career.invites = inv2;
      const accInv = sim.acceptCareerInvite(hopSt, inv2[0].id, tweaked);
      assert(accInv.ok && accInv.state.career.companyId === "square", "chrono invite to square");
    }
    ok("xp, 5-outlet media, year-end hop, invites");
  })();

  (function careerIdleStartsVirtual() {
    const g = sim.createCareerGame("测", "programmer", config);
    const small = (g.career.openingOffers || []).filter(function (o) {
      return o.companyId === "fromsoftware" || o.tier === "small";
    })[0] || g.career.openingOffers[0];
    let st = sim.acceptOpeningOffer(g, small.id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleMonths = 0;
    const idleMax = (config.careerWorld.virtualPool || {}).idleMaxMonths || 1;
    let view = sim.careerProjectView(st, config);
    assert(view.idle, "start idle at fromsoftware 1995");
    let guard = 0;
    while (view.idle && guard < idleMax + 2) {
      st = sim.tickMonth(st, config).state;
      view = sim.careerProjectView(st, config);
      guard += 1;
    }
    assert(!view.idle, "virtual project after idle cap");
    assert(view.title && view.title.virtual, "assignment is virtual");
    assert(view.genreId && view.gameplayId, "virtual has genre and gameplay");
    ok("idle past cap starts virtual project");
  })();

  (function careerVirtualClampedToNextCatalog() {
    const vp = config.careerWorld.virtualPool || {};
    assert(vp.devMonthsMax === 24 && vp.devMonthsMin === 6, "virtual 6-24");
    let g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    const virt = sim.startVirtualProject(st, config);
    assert(virt && virt.virtual, "fromsoftware 1995 starts virtual");
    const vdet = sim.careerTitleDetail(virt.id, config, st);
    assert(vdet.devMonths >= 6 && vdet.devMonths <= 24, "virtual months in pool range");

    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
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
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "gapLongProbe",
      devStartYear: 1995,
      devStartMonth: 11,
      devMonths: 14
    }]);
    g = sim.createCareerGame("测", "programmer", tweaked);
    st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    assert(sim.catalogGapMonths(st, tweaked, "fromsoftware", "fromsoftware-main") === 10, "gap 10 months");
    const clamped = sim.startVirtualProject(st, tweaked);
    const cdet = sim.careerTitleDetail(clamped.id, tweaked, st);
    assert(clamped && clamped.virtual, "gap>=6 starts virtual");
    assert(cdet.devMonths >= 6 && cdet.devMonths <= 10, "virtual clamped to gap");
    ok("virtual duration clamped to next catalog");
  })();

  (function careerShortIdleGapOnceAndHop() {
    const gapSpec = config.careerWorld.idleGap || {};
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "gapProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "空窗探针",
      alias: "空窗探针",
      releaseYear: 1995,
      releaseMonth: 8,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "gapProbe",
      devStartYear: 1995,
      devStartMonth: 5,
      devMonths: 3,
      inviteEligible: false
    }]);
    let g = sim.createCareerGame("测", "programmer", tweaked);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleGap = null;
    st.career.idleMonths = 9;
    st.year = 1995;
    st.month = 1;
    assert(sim.catalogGapMonths(st, tweaked, "fromsoftware", "fromsoftware-main") === 4, "short gap 4");
    assert(!sim.startVirtualProject(st, tweaked), "short gap no virtual");
    const q = [];
    sim.assignCareerProject(st, tweaked, q);
    assert(!st.career.titleId, "stays off title");
    assert(q.length === 1 && q[0].eventId === (gapSpec.eventId || "idle-gap"), "idle gap queued");
    sim.assignCareerProject(st, tweaked, []);
    assert(st.career.idleGap && st.career.idleGap.prompted, "still prompted");
    const q2 = [];
    sim.assignCareerProject(st, tweaked, q2);
    assert(q2.length === 0, "not queued again");
    const prog0 = st.career.stats.program;
    const design0 = st.career.stats.design;
    const picked = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "crossTrain", tweaked);
    assert(picked.ok, "resolve idle gap");
    st = picked.state;
    assert(st.career.idleGap.settled, "settled once");
    assert(st.career.stats.design > design0, "off-stat up");
    assert(st.career.stats.program === prog0, "main stat unchanged");
    const again = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "hone", tweaked);
    assert(again.state.career.stats.program === st.career.stats.program, "no second apply");
    st.month = 12;
    st.career.yearEndOffers = [];
    assert(sim.canCareerHop(st, tweaked), "hop allowed in short gap");
    const ticked = sim.tickCareerMonth(st, tweaked);
    assert((ticked.queue || []).some(function (p) { return p.type === "hop"; }), "December hop in short gap");
    st = ticked.state;
    st.year = 1995;
    st.month = 5;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.idleGap = null;
    sim.assignCareerProject(st, tweaked);
    assert(st.career.titleId === "gapProbe", "hangs next catalog after gap");
    ok("short idle gap once, hop allowed, then catalog");
  })();

  (function careerVirtualInitialStatsFollowTeamShareAndStudioSkill() {
    const world = config.careerWorld;
    const share = world.virtualPool.teamStatShare;
    const ladder = world.proficiency.ladder;
    const dims = PDIMS;
    function probe() {
      const g = sim.createCareerGame("测", "programmer", config);
      g.rngSeed = 20240916;
      g.rngCount = 0;
      const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      st.career.companyId = "fromsoftware";
      st.career.studioId = "fromsoftware-main";
      st.career.titleId = null;
      st.career.liveStats = null;
      st.career.traits = [];
      st.career.traitsLocked = true;
      st.year = 1995;
      st.month = 1;
      sim.ensureCareerColleagues(st, config);
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
    assert(sim.studioProficiencyBonusPct(st, "fromsoftware", "fromsoftware-main", "fantasy", "rpg", config) === 0,
      "empty xp yields no studio bonus");
    const base0 = sim.careerCraftLiveStats(st, 12, members.length, config, "fantasy", "rpg");
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
    const pctFull = sim.studioProficiencyBonusPct(rich, "fromsoftware", "fromsoftware-main", "fantasy", "rpg", config);
    assert(Math.abs(pctFull - (ladder[3] + ladder[3])) < 1e-9, "studio genre+gameplay pct sum " + pctFull);
    const baseFull = sim.careerCraftLiveStats(rich, 12, members.length, config, "fantasy", "rpg");
    TDIMS.forEach(function (td) {
      assert(baseFull[td] === Math.floor(base0[td] * (1 + ladder[3] + ladder[3])), "studio 40% lifts " + td);
    });

    // 玩家熟练度只抬开发月贡献，不动立项初始四维
    const low = sim.clone(st);
    low.career.genreXp = {};
    low.career.gameplayXp = {};
    const virt = sim.startVirtualProject(low, config, { genreId: "fantasy", gameplayId: "rpg" });
    assert(virt, "virtual project for contrib probe");
    low.career.titleId = virt.id;
    low.career.liveStats = sim.clone(virt.stats);
    const cLow = sim.careerMonthlyContributionByDim(low, config).program;
    const high = sim.clone(low);
    high.career.genreXp = { fantasy: 60 };
    high.career.gameplayXp = { rpg: 60 };
    const cHigh = sim.careerMonthlyContributionByDim(high, config).program;
    assert(cLow > 0, "monthly contribution positive");
    assert(Math.abs(cHigh / cLow - (1 + ladder[3] + ladder[3])) < 0.01,
      "player 40% pct multiplies monthly contribution " + cLow + " -> " + cHigh);
    assert(sim.playerProficiencyBonusPct(high, "fantasy", "rpg", config) === ladder[3] + ladder[3],
      "player proficiency pct is additive ladder");
    ok("virtual initial stats = 10% team sum + studio proficiency; player skill feeds monthly contribution");
  })();

  (function careerLateJoinUnsignedAndDecemberShipHop() {
    const lateSpec = config.careerWorld.lateJoin || {};
    const nintendo = sim.careerCompany("nintendo", config);
    const freshCfg = deepClone(config);
    freshCfg.careerWorld = deepClone(config.careerWorld);
    freshCfg.careerWorld.titles = (freshCfg.careerWorld.titles || []).concat([{
      id: "freshProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "刚开工",
      alias: "刚开工",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 70, fun: 70, expression: 70, immersion: 70 }
    }]);
    freshCfg.careerWorld.titleDetails = (freshCfg.careerWorld.titleDetails || []).concat([{
      id: "freshProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1995, startMonth: 1, endYear: 1995, endMonth: 11 }
    }]);
    let earlySt = sim.createCareerGame("测", "programmer", freshCfg);
    earlySt = sim.acceptOpeningOffer(earlySt, earlySt.career.openingOffers[0].id, freshCfg).state;
    earlySt.career.companyId = "fromsoftware";
    earlySt.career.studioId = "fromsoftware-main";
    earlySt.year = 1995;
    earlySt.month = 1;
    earlySt.career.titleId = null;
    sim.assignCareerProject(earlySt, freshCfg);
    assert(earlySt.career.titleId === "freshProbe", "just-started catalog assigned");
    const freshCred = (earlySt.career.credits || []).filter(function (c) { return c.titleId === "freshProbe"; })[0];
    assert(freshCred && freshCred.signedEligible !== false, "fresh join can sign");
    assert(!sim.careerTitleIsLate(
      sim.careerTitle("freshProbe", freshCfg),
      sim.careerTitleDetail("freshProbe", freshCfg),
      1995, 1, freshCfg
    ), "progress 0 is not late");

    const lateTitle = {
      id: "lateProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "后期探针",
      alias: "后期探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 8,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { play: 80, fun: 80, expression: 80, immersion: 80 }
    };
    const lateDet = {
      id: "lateProbe",
      devStartYear: 1994,
      devStartMonth: 1,
      devMonths: 23,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1994, startMonth: 3, endYear: 1995, endMonth: 11 },
      inviteRoles: ["programmer", "art", "design", "music"]
    };
    const lateCfg = deepClone(config);
    lateCfg.careerWorld = deepClone(config.careerWorld);
    lateCfg.careerWorld.titles = (lateCfg.careerWorld.titles || []).concat([lateTitle]);
    lateCfg.careerWorld.titleDetails = (lateCfg.careerWorld.titleDetails || []).concat([lateDet]);
    assert(sim.careerTitleIsLate(lateTitle, lateDet, 1995, 6, lateCfg), "mid 1995 is late");
    let invSt = sim.createCareerGame("测", "art", lateCfg);
    invSt = sim.acceptOpeningOffer(invSt, invSt.career.openingOffers[0].id, lateCfg).state;
    invSt.career.companyId = "nintendo";
    invSt.career.studioId = nintendo.studios[0].id;
    invSt.career.fame = 99;
    invSt.year = 1995;
    invSt.month = 6;
    const invites = sim.listCareerInvites(invSt, lateCfg);
    assert(!invites.some(function (x) { return x.titleId === "lateProbe"; }), "late not invited");

    invSt.career.companyId = "fromsoftware";
    invSt.career.studioId = "fromsoftware-main";
    invSt.career.titleId = null;
    invSt.career.credits = [];
    sim.assignCareerProject(invSt, lateCfg);
    assert(invSt.career.titleId === "lateProbe", "can still be assigned late catalog");
    const lateCred = (invSt.career.credits || []).filter(function (c) { return c.titleId === "lateProbe"; })[0];
    assert(lateCred && lateCred.signedEligible === false, "late join not sign-eligible");
    invSt.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    invSt.year = 1995;
    invSt.month = 12;
    sim.shipPlayerTitle(invSt, lateCfg, [], []);
    assert(!lateCred.shipped, "late join unsigned at ship");

    lateCfg.careerWorld.companies.forEach(function (c) {
      if (c.id !== "nintendo" && c.id !== "fromsoftware") c.joinable = false;
    });
    let hopSt = sim.createCareerGame("测", "programmer", lateCfg);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, lateCfg).state;
    hopSt.year = 1995;
    hopSt.month = 6;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    const fromCo = sim.careerCompany("fromsoftware", lateCfg);
    const fromStudio = sim.careerStudio("fromsoftware", "fromsoftware-main", lateCfg);
    const assigned = sim.pickCareerAssignment("fromsoftware", 1995, 6, lateCfg, hopSt, "fromsoftware-main");
    assert(assigned && assigned.id === "lateProbe", "fromsoftware assignment is late probe");
    const titledChance = sim.careerHireChance(fromCo, hopSt, lateCfg, fromStudio, assigned);
    const lateOffer = sim.listYearEndOffers(hopSt, lateCfg).filter(function (o) {
      return o.companyId === "fromsoftware" && o.titleId === "lateProbe";
    })[0];
    assert(lateOffer, "fromsoftware late offer present");
    assert(lateOffer.successChance < titledChance, "late hop chance lower");
    assert(Math.abs(lateOffer.successChance - titledChance * lateSpec.hopHireChanceMul) < 1e-6, "uses hopHireChanceMul");

    let shipHop = sim.clone(earlySt);
    shipHop.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    shipHop.year = 1995;
    shipHop.month = 12;
    const decTick = sim.tickCareerMonth(shipHop, freshCfg);
    assert((decTick.queue || []).some(function (p) { return p.type === "hop"; }), "December ship queues hop");
    assert(!sim.careerPostLaunch(decTick.state), "December ship has no postLaunch occupancy");
    ok("late join unsigned, invite skipped, December ship hop");
  })();

  // 进大厂的门槛：公司体量倍率（hireChancePowerMul）、声望斜率、以及邀约「每年只掷一次骰」。
  // 旧实现里邀约是每月独立掷一次，12 次叠加后年内命中率 ≈ 99.8%，而邀约必成 → 进大厂零门槛。
  (function bigPublishersDampedAndInvitesRollYearly() {
    const spec = config.careerWorld.mobility;
    const mul = spec.hireChancePowerMul;
    assert(mul && mul["3"] > 0 && mul["3"] < 1, "hireChancePowerMul[3] is a damping factor");
    assert(mul["1"] === 1 && mul["2"] === 1, "small/mid publishers undamped");
    assert(spec.fameHirePer <= 0.002, "fame hiring bonus is small");
    assert(spec.inviteChance > 0 && spec.inviteChance < 0.5, "inviteChance is a yearly chance");

    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[1].id, config).state;
    const role = sim.careerRole(st.career.roleId, config);
    st.career.fame = 40;
    st.career.stats[role.stat] = 75;
    st.career.jobRank = 5;
    st.career.genreXp = {};
    st.career.gameplayXp = {};

    const bigCo = config.careerWorld.companies.filter(function (c) { return c.power === 3; })[0];
    const midCo = config.careerWorld.companies.filter(function (c) { return c.power === 2; })[0];
    const saved3 = mul["3"];
    let undamped, damped;
    try {
      mul["3"] = 1;
      undamped = sim.careerHireChance(bigCo, st, config, null, null);
    } finally {
      mul["3"] = saved3;
    }
    damped = sim.careerHireChance(bigCo, st, config, null, null);
    assert(damped < undamped, "big publisher chance damped, " + undamped.toFixed(3) + " -> " + damped.toFixed(3));
    assert(Math.abs(damped / undamped - saved3) < 0.02, "damping ratio = hireChancePowerMul, got " + (damped / undamped).toFixed(3));
    assert(damped < sim.careerHireChance(midCo, st, config, null, null), "a big publisher stays harder than a mid one");

    // 声望仍线性，但斜率是砍半后的 fameHirePer。
    // 注意取 0→30 这段：中厂在 fame≈30 以上就会顶到 hireChanceMax，夹取会让差值失真。
    const st2 = sim.clone(st);
    st2.career.fame = 0;
    const fame0 = sim.careerHireChance(midCo, st2, config, null, null);
    st2.career.fame = 30;
    const fame30 = sim.careerHireChance(midCo, st2, config, null, null);
    assert(fame0 < config.careerWorld.mobility.hireChanceMax, "probe point stays below the clamp");
    assert(Math.abs((fame30 - fame0) - 30 * spec.fameHirePer) < 0.005, "fame stays linear at fameHirePer");

    // 造一部别的公司、当年在开发、窗口内的目录作，作为邀约候选
    const invCfg = deepClone(config);
    invCfg.careerWorld = deepClone(config.careerWorld);
    invCfg.careerWorld.titles = (invCfg.careerWorld.titles || []).concat([{
      id: "invProbe", companyId: "fromsoftware", studioId: "fromsoftware-main",
      name: "邀约探针", alias: "邀约探针", releaseYear: 2000, releaseMonth: 12,
      score: 8, platforms: ["pc"], genreId: "fantasy", gameplayId: "rpg",
      releaseType: "boxed", stats: { play: 80, fun: 80, expression: 80, immersion: 80 }
    }]);
    invCfg.careerWorld.titleDetails = (invCfg.careerWorld.titleDetails || []).concat([{
      id: "invProbe", devStartYear: 1999, devStartMonth: 1, devMonths: 23,
      inviteEligible: true, inviteMinFame: 0,
      inviteWindow: { startYear: 1999, startMonth: 1, endYear: 2000, endMonth: 11 }
    }]);
    let ist = sim.createCareerGame("测", "programmer", invCfg);
    ist = sim.acceptOpeningOffer(ist, ist.career.openingOffers[0].id, invCfg).state;
    ist.career.companyId = "nintendo";
    ist.career.studioId = sim.defaultStudioId(sim.careerCompany("nintendo", invCfg));
    ist.career.titleId = null;
    ist.career.invites = [];
    ist.career.fame = 50;
    ist.year = 1999;
    ist.month = 3;
    assert(sim.listCareerInvites(ist, invCfg).some(function (x) { return x.titleId === "invProbe"; }),
      "invite candidate is available inside the window");

    // 未命中的年份：整年都不给，而且年度骰不会在年内被重掷
    let miss = sim.clone(ist);
    miss.career.inviteYearStamp = 1999;
    miss.career.invitesRolledThisYear = 0;
    miss.career.inviteYearHit = false;
    const hitVals = {};
    for (let i = 0; i < 9; i++) {
      miss = sim.tickMonth(miss, invCfg).state;
      hitVals[String(miss.career.inviteYearHit)] = true;
      assert((miss.career.invites || []).length === 0, "a missed year yields no invite");
    }
    assert(Object.keys(hitVals).length === 1 && hitVals["false"] === true,
      "the yearly roll is not re-rolled inside the same year");

    // 命中的年份：给出邀约，且一年最多一条
    let hit = sim.clone(ist);
    hit.career.inviteYearStamp = 1999;
    hit.career.invitesRolledThisYear = 0;
    hit.career.inviteYearHit = true;
    let gotInv = null;
    for (let i = 0; i < 9 && !gotInv; i++) {
      hit = sim.tickMonth(hit, invCfg).state;
      if ((hit.career.invites || []).length) gotInv = hit.career.invites[0];
    }
    assert(gotInv, "a hit year delivers an invite");
    assert(gotInv.companyId && gotInv.companyId !== "nintendo", "invite comes from another publisher");
    assert(gotInv.titleId && gotInv.jobRank >= 1, "invite carries a title and a rank");
    for (let i = 0; i < 3; i++) hit = sim.tickMonth(hit, invCfg).state;
    assert((hit.career.invites || []).length <= 1, "at most inviteMaxPerYear invite per year");

    ok("big publisher hiring damped, invites roll once per year");
  })();

  // 开局 offer 压低大厂 + 通过率 0 的公司不进跳槽选项。
  (function openingShunsBigPublishersAndDropsZeroChanceOffers() {
    const oo = config.careerWorld.openingOffer;
    const wp = oo.weightByPower;
    assert(wp["3"] > 0 && wp["3"] <= 0.25, "opening weight for power3 is damped, got " + wp["3"]);
    assert(wp["3"] < wp["2"] && wp["2"] < wp["1"], "small shops weigh more than studios, then big publishers");

    // 确定性对拍：权重 0 → 大厂绝不进开局池；权重拉到极大 → 必然进（证明这个权重真被读）
    const bigIds = {};
    config.careerWorld.companies.forEach(function (c) { if (c.power === 3) bigIds[c.id] = true; });
    const g = sim.createCareerGame("测", "programmer", config);
    function countOpeningBig(tries) {
      let n = 0;
      for (let i = 0; i < tries; i++) {
        const probe = sim.clone(g);
        probe.rngSeed = 700001 + i * 104729;
        sim.rollOpeningOffers(probe, probe.career.roleId, config).forEach(function (o) {
          if (bigIds[o.companyId]) n += 1;
        });
      }
      return n;
    }
    const saved3 = wp["3"];
    let off, on;
    try {
      wp["3"] = 0;
      off = countOpeningBig(300);
      wp["3"] = 999;
      on = countOpeningBig(300);
    } finally {
      wp["3"] = saved3;
    }
    assert(off === 0, "weight 0 keeps big publishers out of opening offers, got " + off);
    assert(on > 0, "a huge weight does let one through, got " + on);

    // 通过率 0 的 offer 不该占位：前期职级不够大厂（offerMinRankByPower[3] 硬门槛）
    const minRankByPower = config.careerWorld.jobRanks.offerMinRankByPower;
    assert(minRankByPower["3"] > 1, "big publishers carry a rank gate");
    const st = sim.acceptOpeningOffer(sim.clone(g), g.career.openingOffers[0].id, config).state;
    st.year = 1996;
    st.month = 12;
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.jobRank = 1;
    assert(sim.careerHireChance(config.careerWorld.companies.filter(function (c) {
      return c.power === 3;
    })[0], st, config, null, null) === 0, "a gated big publisher really does sit at 0% early");
    const early = sim.listYearEndOffers(st, config);
    assert(early.length >= 1, "early hop table is not empty");
    early.forEach(function (o) {
      const pct = o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100);
      assert(pct > 0, "no zero-chance offer in the hop table: " + o.companyId + " " + pct + "%");
      const co = sim.careerCompany(o.companyId, config);
      assert(!(co && co.power === 3), "gated big publisher stays out of the early hop table");
    });

    // 职级够了以后大厂要能回来（证明过滤只吃掉 0%，不吃掉低概率）
    const late = sim.clone(st);
    late.career.jobRank = minRankByPower["3"];
    let sawBig = false;
    for (let i = 0; i < 60 && !sawBig; i++) {
      const probe = sim.clone(late);
      probe.rngSeed = 900001 + i * 7919;
      sim.listYearEndOffers(probe, config).forEach(function (o) {
        const co = sim.careerCompany(o.companyId, config);
        if (co && co.power === 3) sawBig = true;
      });
    }
    assert(sawBig, "big publishers return once the rank gate is met");

    ok("opening shuns big publishers (w=0 → " + off + ", w=999 → " + on + "), zero-chance hop offers dropped");
  })();

  (function startingAbleSkillsAndHopFit() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ableXp = px.startingAbleXp;
    const gCount = px.startingAbleGenreCount;
    const pCount = px.startingAbleGameplayCount;
    assert(ableXp > 0 && gCount === 2 && pCount === 2, "starting able config");
    const g = sim.createCareerGame("测", "programmer", config);
    const genreIds = Object.keys(g.career.genreXp || {}).filter(function (id) {
      return g.career.genreXp[id] > 0;
    });
    const playIds = Object.keys(g.career.gameplayXp || {}).filter(function (id) {
      return g.career.gameplayXp[id] > 0;
    });
    assert(genreIds.length === gCount, "starting genre count " + genreIds.length);
    assert(playIds.length === pCount, "starting gameplay count " + playIds.length);
    genreIds.forEach(function (id) {
      assert(g.career.genreXp[id] === ableXp, "starting genre xp " + id);
      assert(sim.xpTierFor(g.career.genreXp[id], config).id === "able", "starting genre able " + id);
    });
    playIds.forEach(function (id) {
      assert(g.career.gameplayXp[id] === ableXp, "starting play xp " + id);
      assert(sim.xpTierFor(g.career.gameplayXp[id], config).id === "able", "starting play able " + id);
    });
    const sheet = sim.careerSkillSheet(g, config);
    assert(sheet.genres.length === (config.content.genres || []).length, "sheet all genres");
    assert(sheet.gameplay.length === (config.content.gameplay || []).length, "sheet all gameplay");
    sheet.genres.concat(sheet.gameplay).forEach(function (row) {
      assert(row.xp == null, "sheet hides xp " + row.id);
      assert(row.tier && row.tierId, "sheet has tier " + row.id);
    });
    const ableGenre = genreIds[0];
    const ablePlay = playIds[0];
    const missGenre = (config.content.genres || []).map(function (x) { return x.id; }).filter(function (id) {
      return genreIds.indexOf(id) < 0;
    })[0];
    const missPlay = (config.content.gameplay || []).map(function (x) { return x.id; }).filter(function (id) {
      return playIds.indexOf(id) < 0;
    })[0];
    const co = sim.careerCompany("fromsoftware", config) || sim.careerCompany(g.career.openingOffers[0].companyId, config);
    const chanceFit = sim.careerHireChance(co, g, config, null, { genreId: ableGenre, gameplayId: ablePlay });
    const chanceMiss = sim.careerHireChance(co, g, config, null, { genreId: missGenre, gameplayId: missPlay });
    assert(chanceFit > chanceMiss, "skill fit hireChance " + chanceMiss + " -> " + chanceFit);
    ok("starting able skills, sheet, hop fit");
  })();

  (function skillEventsGrantCurrentTitleXp() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ids = ((config.careerWorld.devEvents && config.careerWorld.devEvents.list) || []).map(function (e) { return e.id; });
    ["genreRefBoard", "playRefClear", "genrePlayClinic", "alphaPlaytestNotes", "goldGenrePass",
      "progFeelLab", "artMoodBoard", "designComps", "musicGenreListen", "polishPlayTune",
      "polishGenreLock", "goldPlayFaq", "artPolishPass", "designPlayPass", "musicThemeLock"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "skill event " + id);
    });
    const prodIds = ((config.careerWorld.producerEvents && config.careerWorld.producerEvents.list) || []).map(function (e) { return e.id; });
    assert(prodIds.indexOf("prodSkillClinic") >= 0, "producer skill clinic");
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = (config.careerWorld.devEvents.list || []).filter(function (e) {
      return e.id === "genreRefBoard";
    }).map(function (e) {
      const row = deepClone(e);
      delete row.phase;
      delete row.role;
      return row;
    });
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    st.rngSeed = 1;
    st.rngCount = 0;
    const beforeG = sim.playerXpValue(st, "genre", chrono.genreId);
    const beforeP = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "genreRefBoard", "rolled genreRefBoard");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) === beforeG + px.eventGenreXp, "notice genre xp");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) === beforeP, "notice play xp unchanged");

    const g2 = sim.createCareerGame("测", "design", config);
    let st2 = sim.acceptOpeningOffer(g2, g2.career.openingOffers[0].id, config).state;
    st2.career.companyId = "square";
    st2.career.titleId = "chronoTrigger";
    st2.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    const g0 = sim.playerXpValue(st2, "genre", chrono.genreId);
    const p0 = sim.playerXpValue(st2, "gameplay", chrono.gameplayId);
    const picked = sim.resolveCareerEventChoice(st2, "genrePlayClinic", "play", config);
    assert(picked.ok, "clinic choice ok");
    assert(sim.playerXpValue(picked.state, "gameplay", chrono.gameplayId) === p0 + px.eventFocusXp, "choice play focus xp");
    assert(sim.playerXpValue(picked.state, "genre", chrono.genreId) === g0, "choice genre unchanged");
    const prod = sim.resolveCareerEventChoice(st2, "prodSkillClinic", "genreClass", config);
    assert(prod.ok, "producer clinic ok");
    assert(sim.playerXpValue(prod.state, "genre", chrono.genreId) === g0 + px.eventFocusXp, "producer genre class xp");
    ok("skill events grant current title xp");
  })();


  (function virtualTitlesAreGenreFictionAndUnique() {
    const byGenre = (config.careerWorld.virtualPool || {}).titlesByGenre || {};
    const seen = {};
    Object.keys(byGenre).forEach(function (gid) {
      assert(Array.isArray(byGenre[gid]) && byGenre[gid].length >= 8, "genre pool " + gid);
      byGenre[gid].forEach(function (n) {
        assert(n && !seen[n], "unique fictional name " + n);
        seen[n] = true;
      });
    });
    const g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
    st.year = 1995;
    st.month = 1;
    const names = [];
    let i, t, pool, inGenre;
    for (i = 0; i < 8; i++) {
      t = sim.startVirtualProject(st, config);
      assert(t && t.virtual && t.name, "virtual " + i);
      assert(names.indexOf(t.name) < 0, "no reuse " + t.name);
      names.push(t.name);
      pool = byGenre[t.genreId] || [];
      inGenre = pool.indexOf(t.name) >= 0;
      assert(inGenre || seen[t.name], "name from genre pool " + t.name + " / " + t.genreId);
    }
    ok("virtual titles are genre fiction and unique");
  })();

  (function careerNominationHonor() {
    const g = sim.createCareerGame("测", "design", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "design" }];
    const rec = (st.worldReleased || []).filter(function (t) { return t.id === "chronoTrigger"; })[0];
    if (!rec) {
      st.worldReleased.push({
        id: "chronoTrigger",
        name: "时空之轮",
        companyId: "square",
        releaseYear: 1995,
        releaseMonth: 3,
        releasedYear: 1995,
        releasedMonth: 3,
        score: 9.5,
        avg: 9.5,
        stats: { play: 82, fun: 94, expression: 88, immersion: 92 },
        prestige: 5,
        player: true
      });
    } else rec.player = true;
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseYear !== 1995) return;
      if ((st.worldReleased || []).some(function (g) { return g.id === t.id; })) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        player: false
      });
    });
    st.year = 1995;
    st.month = 11;
    const honor0 = st.career.honor || 0;
    const fame0 = st.career.fame || 0;
    const pack = sim.runCareerAwards(st, config, []);
    const nom = pack.filter(function (a) { return a.playerNominated; }).length;
    const win = pack.filter(function (a) { return a.playerWon; }).length;
    if (nom) {
      assert(st.career.honor > honor0 || st.career.fame > fame0, "nomination grants honor/fame");
    }
    void win;
    pack.forEach(function (a) {
      if (a.id === "bestLiveOps") {
        assert(!a.nominees || a.nominees.length === 0, "1995 bestLiveOps still empty before liveops era");
        return;
      }
      assert(a.nominees && a.nominees.length === 5, "career tga 5 noms " + a.id);
    });
    ok("player nomination honor and 5 nominees");
  })();


  (function liveOpsIdentityAndAwardWindow() {
    const boxed = { releaseType: "boxed" };
    const live = { releaseType: "liveops", stats: { play: 80, fun: 82, expression: 70, immersion: 68 } };
    assert(!sim.isLiveOpsTitle(boxed), "boxed is not liveops");
    assert(sim.isLiveOpsTitle(live), "releaseType liveops counts");
    assert(sim.isLiveOpsTitle({ live: true }), "live flag counts");
    assert(sim.isLiveOpsTitle({ liveOps: { active: true } }), "legacy liveOps object still counts");
    const inYear = Object.assign({ releasedYear: 2004, releasedMonth: 8 }, live);
    assert(sim.liveOpsAwardEligible(inYear, 2004, config), "same-year live release is eligible");
    const early = Object.assign({ releasedYear: 2002, releasedMonth: 8 }, live);
    assert(!sim.liveOpsAwardEligible(early, 2004, config), "no cross-year carry-over any more");
    assert(!sim.liveOpsAwardEligible({ releaseType: "boxed", releasedYear: 2004, releasedMonth: 8 }, 2004, config), "boxed not in liveops award");
    assert(!sim.liveOpsAwardEligible({ releaseType: "outsource", live: true, releasedYear: 2004, releasedMonth: 8 }, 2004, config), "outsource not in liveops award");
    ok("liveops identity is a tag; award only looks at this year's window");
  })();


  (function careerBestLiveOpsComparesQualitySum() {
    const g = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const st = acc.state;
    const year = 2024;
    st.year = year;
    st.month = 11;
    st.worldReleased = [];
    // 当年窗口（去年 12 月～今年 11 月）里发售的全部长线版本，外加一部更早的（不该参评）。
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseType !== "liveops") return;
      const inWindow = t.releaseYear === year ||
        (t.releaseYear === year - 1 && t.releaseMonth === 12);
      if (!inWindow) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        studioId: t.studioId || null,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        releaseType: t.releaseType,
        live: true,
        versionName: t.versionName || "",
        player: false
      });
    });
    assert(st.worldReleased.length >= 3, "several same-year live releases to compare, got " + st.worldReleased.length);
    const qsum = function (row) {
      const s = row.stats || {};
      return sim.titleQualitySum(s, config);
    };
    const best = st.worldReleased.slice().sort(function (a, b) { return qsum(b) - qsum(a); })[0];
    // 评审抖动开启时得主带随机性（前二咬得紧就摇号），要断言排序语义必须先关抖动。
    const tw = deepClone(config);
    tw.awards = deepClone(config.awards);
    tw.awards.score.juryJitter = 0;
    const pack = sim.runCareerAwards(st, tw, []);
    const live = pack.filter(function (a) { return a.id === "bestLiveOps"; })[0];
    assert(live && live.nominees && live.nominees.length === (config.awards.nomineeCount || 5), "career bestLiveOps 5 noms got " + (live && live.nominees && live.nominees.length));
    assert(live.w && live.w !== "—", "career bestLiveOps has a winner");
    assert(live.nominees[0] && live.nominees[0].label === live.w, "career liveops winner from nominees");
    assert(live.w === sim.worldLabel(best, config), "winner is the highest quality-sum live release, got " + live.w + " want " + sim.worldLabel(best, config));
    // 颁奖窗口外的老长线不再参评
    const outside = sim.liveOpsAwardEligible({ releaseType: "liveops", releasedYear: year - 3, releasedMonth: 6 }, year, config);
    assert(!outside, "older live release is out of the window");
    ok("career bestLiveOps picks the highest quality-sum live release of the year");
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


  (function careerSalaryStepsAndInflation() {
    const steps = (((config.careerWorld || {}).personalEconomy || {}).salary || {}).steps || [];
    assert(steps.length >= 8, "salary steps table");
    for (let i = 1; i < steps.length; i++) assert(steps[i] > steps[i - 1], "salary steps monotonic " + steps[i]);
    const g = sim.createCareerGame("测", "programmer", config);
    const mid = (config.careerWorld.companies || []).filter(function (c) {
      return c.power === 2 && c.salaryMult === 1 && c.joinable !== false;
    })[0] || sim.careerCompany("sega", config);
    const junior = sim.careerSalaryFor(mid, 1995, config, g.career);
    assert(steps.indexOf(junior) >= 0, "1995 salary in steps " + junior);
    const floor1 = ((config.careerWorld.jobRanks || {}).salaryFloor || [])[1];
    assert(junior === floor1, "1995 intern sits on rank-1 salary floor, got " + junior);
    (g.career.openingOffers || []).forEach(function (o) {
      assert(steps.indexOf(o.salary) >= 0, "opening salary in steps " + o.salary);
    });
    const grown = sim.clone(g);
    grown.career.stats = { program: 120, design: 100, art: 100, music: 100 };
    grown.career.fame = 180;
    grown.career.honor = 24;
    grown.year = 2024;
    const nintendo = sim.careerCompany("nintendo", config);
    const late = sim.careerSalaryFor(nintendo, 2024, config, grown.career);
    assert(steps.indexOf(late) >= 0, "late salary in steps " + late);
    assert(late >= 10000, "high stats fame late years reach 万级, got " + late);
    const y1 = sim.careerSalaryFor(mid, 2000, config, g.career);
    const y2 = sim.careerSalaryFor(mid, 2001, config, g.career);
    assert(steps.indexOf(y1) >= 0 && steps.indexOf(y2) >= 0, "inflation salaries in steps");
    assert(y2 >= y1, "same person next year salary not lower " + y1 + " -> " + y2);
    ok("career salary snaps to steps, intern floor, growth and inflation");
  })();

  (function careerYearEndOffersStudiosAndHopRules() {
    const nintendo = sim.careerCompany("nintendo", config);
    assert(nintendo && nintendo.studios && nintendo.studios.length >= 2, "nintendo has 2+ studios");
    ["sony", "sega", "square", "squareEnix", "capcom", "ea", "blizzard", "activision", "tencent", "netease", "mihoyo", "ubisoft", "rockstar"].forEach(function (id) {
      const co = sim.careerCompany(id, config);
      if (!co || co.joinable === false) return;
      assert(co.studios && co.studios.length >= 2, id + " has 2+ studios");
    });
    const titled = (config.careerWorld.titles || []).filter(function (t) {
      return t.companyId === "nintendo" && t.studioId;
    });
    assert(titled.length >= 1, "nintendo titles hang studioId");

    let st = sim.createCareerGame("测", "programmer", config);
    st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
    st.career.companyId = "nintendo";
    st.career.studioId = nintendo.studios[0].id;
    st.year = 1998;
    st.month = 12;
    const list = sim.listYearEndOffers(st, config);
    const hops = list.filter(function (o) { return o.kind !== "promotion" && o.kind !== "promotionLine"; });
    assert(list.length === 4, "year-end offer count 4, got " + list.length);
    assert(hops.length >= 3 && hops.length <= 4, "year-end hop slots 3–4, got " + hops.length);
    const internals = hops.filter(function (o) { return o.internal; });
    assert(internals.length <= 2, "internal offers <= 2, got " + internals.length);
    internals.forEach(function (o, i) {
      assert(hops[i].internal, "internals come first at " + i);
      assert(o.studioId && o.studioId !== st.career.studioId, "internal is another studio");
    });
    hops.forEach(function (o) {
      assert(typeof o.successChance === "number", "successChance on offer");
      assert(o.studioId, "offer studioId");
    });
    (function hopPageShowsFourLeanCards() {
      const pageSt = sim.clone(st);
      pageSt.career.yearEndOffers = [];
      pageSt.career.titleId = null;
      pageSt.career.liveStats = null;
      const tick = sim.tickCareerMonth(pageSt, config);
      const hopPage = (tick.queue || []).filter(function (p) { return p.type === "hop"; })[0];
      assert(hopPage, "december hop page");
      const hopOpts = (hopPage.options || []).filter(function (o) { return o.id !== "stay"; });
      assert(hopOpts.length === 4, "hop UI shows 4, got " + hopOpts.length);
      hopOpts.forEach(function (opt) {
        assert(opt.label.indexOf("前辈") < 0, "hop label no 前辈");
        assert(opt.label.indexOf("对口") < 0, "hop label no 对口");
        assert(opt.label.indexOf("→") < 0, "hop label no current salary");
        assert(opt.hopView && opt.hopView.title, "hop title");
        assert(opt.hopView.meta, "hop salary/rank");
        assert(/^\d+%$/.test(opt.hopView.pct), "hop pct " + opt.hopView.pct);
      });
    })();

    const failList = sim.listYearEndOffers(st, config);
    failList[0].successChance = 0;
    st.career.yearEndOffers = failList;
    const liveBefore = { play: 91, fun: 88, expression: 84, immersion: 80 };
    st.career.titleId = "oot";
    st.career.liveStats = { play: 91, fun: 88, expression: 84, immersion: 80 };
    st.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "programmer" }];
    const failed = sim.applyYearEndOffer(st, failList[0].id, config);
    assert(failed.ok && failed.hopped === false, "failed apply still ok, not hopped");
    assert(failed.state.career.hopFailedYear === failed.state.year, "hopFailedYear set");
    assert(failed.state.career.companyId === "nintendo", "stay at nintendo on fail");
    const again = sim.applyYearEndOffer(failed.state, failList[1] ? failList[1].id : failList[0].id, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_HOP_WAIT, "same year cannot apply again");
    const nextYear = sim.clone(failed.state);
    nextYear.year = failed.state.year + 1;
    nextYear.career.hopFailedYear = failed.state.career.hopFailedYear;
    nextYear.career.yearEndOffers = sim.listYearEndOffers(nextYear, config);
    nextYear.career.yearEndOffers[0].successChance = 1;
    const retry = sim.applyYearEndOffer(nextYear, nextYear.career.yearEndOffers[0].id, config);
    assert(retry.ok && retry.hopped === true, "next year can apply");
    assert(retry.notice, "hop success notice survives join");
    assert(retry.state.career.hopNotice, "hopNotice kept after joinCompany");
    assert(!(retry.state.career.yearEndOffers || []).length, "hop clears leftover offers");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    hopSt.year = 1998;
    hopSt.month = 6;
    hopSt.career.titleId = "oot";
    hopSt.career.liveStats = { play: 91, fun: 88, expression: 84, immersion: 80 };
    hopSt.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "art" }];
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const hopTarget = (hopSt.career.yearEndOffers || []).filter(function (o) {
      return o.companyId !== "nintendo";
    })[0] || hopSt.career.yearEndOffers[0];
    hopTarget.successChance = 1;
    const mid = sim.applyYearEndOffer(hopSt, hopTarget.id, config);
    assert(mid.ok && mid.hopped, "mid-project hop allowed");
    const left = (mid.state.career.leftProjectLive || {}).oot;
    assert(left && left.play === 91 && left.fun === 88, "left project live unchanged");
    const ootCredit = (mid.state.career.credits || []).filter(function (c) { return c.titleId === "oot"; })[0];
    assert(ootCredit, "resume keeps unsigned participation");
    assert(!ootCredit.shipped, "mid hop not credited at ship");
    assert(ootCredit.leftYear != null, "left dates written");
    assert(mid.state.career.companyId === hopTarget.companyId, "joined new company");
    assert(mid.state.career.studioId, "join writes studioId");

    hopSt.career.yearEndOffers = [{ id: "stale-hop" }];
    hopSt.career.invites = [{
      id: "inv-test",
      titleId: "chronoTrigger",
      companyId: "square",
      studioId: "square-rd3",
      roleId: "art",
      salary: 4000,
      currentSalary: 2000
    }];
    assert((config.careerWorld.mobility || {}).inviteCanCounter === false, "invite counter off");
    assert(!sim.counterCareerInvite(hopSt, "inv-test", config).ok, "counter API disabled");
    const invOptSt = sim.clone(hopSt);
    invOptSt.year = 1995;
    invOptSt.month = 2;
    invOptSt.career.fame = 90;
    invOptSt.career.titleId = null;
    invOptSt.career.companyId = "nintendo";
    const listedInv = sim.listCareerInvites(invOptSt, config);
    assert(listedInv.length >= 1, "invite list for option test");
    invOptSt.career.inviteYearStamp = invOptSt.year;
    invOptSt.career.invitesRolledThisYear = 99;
    invOptSt.career.invites = [listedInv[0]];
    const inviteTick = sim.tickMonth(invOptSt, config);
    const invPage = ((inviteTick && inviteTick.queue) || []).filter(function (p) { return p.type === "invite"; })[0];
    assert(invPage, "invite page queued");
    assert((invPage.options || []).every(function (o) { return o.id !== "counter"; }), "invite has no counter");
    assert((invPage.options || []).some(function (o) { return o.id === "accept"; }), "invite accept remains");
    assert((invPage.options || []).some(function (o) { return o.id === "decline"; }), "invite decline remains");
    const beforeCo = hopSt.career.companyId;
    const inv = sim.acceptCareerInvite(hopSt, "inv-test", config);
    assert(inv.ok, "invite accept ok");
    assert(inv.notice, "invite success notice");
    assert(!(inv.state.career.yearEndOffers || []).length, "invite clears stale hop list");
    assert(inv.state.career.companyId === "square", "invite hops without dice");
    assert(inv.state.career.companyId !== beforeCo || hopSt.career.companyId === "square", "invite company set");
    ok("year-end 4 offers, hop fail cooldown, invite sure, mid hop keeps unsigned credit");
  })();

  (function careerPostLaunchAndPlayerSkill() {
    const pl = (config.careerWorld || {}).postLaunch || {};
    const px = (config.careerWorld || {}).playerXp || {};
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const g = sim.createCareerGame("测", "programmer", config);
    assert(g.career.genreXp && typeof g.career.genreXp === "object", "genreXp default");
    assert(g.career.gameplayXp && typeof g.career.gameplayXp === "object", "gameplayXp default");
    assert(!sim.careerPostLaunch(g), "new game no postLaunch");
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.studioId = (sim.careerCompany("square", config).studios || [])[0] && sim.careerCompany("square", config).studios[0].id;
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const gxp0 = sim.playerXpValue(st, "genre", chrono.genreId);
    const pxp0 = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.career.titleId === "chronoTrigger", "player title stays during ship call");
    assert(st.career.liveStats, "live still present at ship");
    assert(!sim.careerPostLaunch(st), "ship does not occupy postLaunch");
    const view = sim.careerProjectView(st, config);
    assert(!view.postLaunch, "view is not postLaunch after ship");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) > gxp0, "genreXp up on ship");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) > pxp0, "gameplayXp up on ship");
    const shippedId = st.career.titleId;
    st.month = 4;
    sim.assignCareerProject(st, config);
    assert(!sim.careerPostLaunch(st), "still no postLaunch after unload");
    assert(st.career.titleId !== shippedId, "cleared shipped title after month ends");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "square";
    hopSt.career.titleId = "chronoTrigger";
    hopSt.career.liveStats = { play: 80, fun: 80, expression: 90, immersion: 80 };
    hopSt.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "art" }];
    hopSt.career.yearEndOffers = [{
      id: "ye-hop-pl",
      companyId: "nintendo",
      studioId: (sim.careerCompany("nintendo", config).studios || [])[0].id,
      roleId: "art",
      salary: 4000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hopSt, "ye-hop-pl", config);
    assert(hopped.ok && hopped.hopped, "hopped off before ship");
    const chronoCredit = (hopped.state.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(chronoCredit && !chronoCredit.shipped, "unsigned resume remains");
    hopSt = hopped.state;
    hopSt.year = 1995;
    hopSt.month = 3;
    hopSt.career.postLaunch = null;
    sim.shipWorldTitlesThisMonth(hopSt, config);
    assert(!sim.careerPostLaunch(hopSt), "hopped player does not enter postLaunch");
    const rec = (hopSt.worldReleased || []).filter(function (g) { return g.id === "chronoTrigger"; })[0];
    assert(rec && !rec.player, "world ship without player credit");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    const t = sim.careerTitle("ff7", config);
    low.career.companyId = "square";
    high.career.companyId = "square";
    high.career.genreXp[t.genreId] = 80;
    high.career.gameplayXp[t.gameplayId] = 80;
    const liveLow = sim.careerLiveFromTitle(low, t, config);
    const liveHigh = sim.careerLiveFromTitle(high, t, config);
    const artStat = (sim.careerRole("art", config) || {}).stat || "art";
    assert(liveHigh[artStat] === liveLow[artStat], "player skill never lifts live base");
    assert(liveHigh.play === liveLow.play, "player skill does not lift other dims");
    low.career.titleId = "ff7";
    high.career.titleId = "ff7";
    assert(sim.careerMonthlyContribution(high, config) > sim.careerMonthlyContribution(low, config), "high skill raises contrib");
    assert(px.xpPerDevMonth != null && px.xpPerRelease != null && px.xpPerPostLaunchMonth != null, "player xp amounts in config");
    assert(pl.monthsMin === 0 && pl.monthsMax === 0, "postLaunch months occupancy 0");
    ok("ship unloads after month, hop skip unsigned, player skill live/contrib");
  })();


  (function careerEventLinesAndProducer() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const founder = (world.growthStages || []).filter(function (s) { return s.id === "founder"; })[0];
    assert(founder && founder.lockedThisVersion, "founder lockedThisVersion");
    assert(lines.some(function (l) { return l.id === "promo-to-expert"; }), "promo-to-expert line configured");
    assert(lines.some(function (l) { return l.id === "become-producer"; }), "become-producer line configured");
    assert((world.producerCareer || {}).minJobRank === 4, "producer unlock at rank 4");

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    function makePromotable(st, rank) {
      const reqs = ((world.jobRanks.promotion || {}).requirements || [])[rank] || {};
      const role = sim.careerRole(st.career.roleId, config);
      const statKey = (role && role.stat) || "program";
      st.career.jobRank = rank;
      st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
      st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
      st.career.stats = st.career.stats || {};
      st.career.stats[statKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
      st.career.fame = (reqs.fameOrHonor || 0) + 1;
      st.career.honor = 0;
      st.career.promotionsThisYear = 0;
      st.career.lastPromotionYear = null;
      st.career.credits = [];
      const need = reqs.creditedTitles || 0;
      for (let i = 0; i < Math.ceil(need); i++) {
        st.career.credits.push({
          titleId: "cred-" + i,
          shipped: true,
          virtual: false,
          jobRank: rank,
          companyId: st.career.companyId
        });
      }
      return st;
    }

    let st = makePromotable(hired("design"), 4);
    assert(sim.canPromoteCareer(st, config), "rank4 eligible");
    assert(sim.promotionUsesEventLine(st, config), "rank4 uses event line");
    assert(sim.canStartBecomeProducerLine(st, config), "producer unlock at jobRank 4");
    const instant = sim.promoteCareer(st, config);
    assert(instant.ok, "promoteCareer at rank4 starts line");
    assert(instant.state.career.jobRank === 4, "rank unchanged until final beat");
    assert(sim.activeCareerLineId(instant.state) === "promo-to-expert", "promo line active");

    let lineSt = instant.state;
    let step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "offer", "apply", config);
    assert(step.ok && step.state.career.lines["promo-to-expert"].flags.applied, "offer accepted");
    lineSt = step.state;
    lineSt.career.lines["promo-to-expert"].waitUntil = sim.monthIndex(lineSt.year, lineSt.month);
    lineSt.career.lines["promo-to-expert"].pending = false;
    const q = [];
    sim.processCareerLines(lineSt, config, q, []);
    assert(q.length && q[0].beatId === "review", "months wait fires review");
    step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "review", "depth", config);
    lineSt = step.state;
    assert(lineSt.career.jobRank === 4, "still rank4 after review");
    lineSt.career.lines["promo-to-expert"].waitingFor = "shipReady";
    lineSt.career.lines["promo-to-expert"].pending = false;
    const q2 = [];
    sim.processCareerLines(lineSt, config, q2, []);
    assert(q2.length && q2[0].beatId === "decision", "onShip fires decision");
    step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "decision", "accept", config);
    assert(step.ok && step.done, "promo line done");
    assert(step.state.career.jobRank === 5, "final beat promotes 4→5");
    assert(step.state.career.lines["promo-to-expert"].status === "done", "line status done");

    let abortSt = makePromotable(hired("art"), 4);
    abortSt.career.lines = {};
    let started = sim.startCareerLine(abortSt, "promo-to-expert", config);
    assert(started.ok, "start promo line");
    const aborted = sim.resolveCareerLineChoice(started.state, "promo-to-expert", "offer", "decline", config);
    assert(aborted.ok && aborted.aborted, "abort ok");
    assert(aborted.state.career.jobRank === 4, "abort keeps rank");
    assert(aborted.state.career.lines["promo-to-expert"].status === "aborted", "aborted status");
    assert(!sim.canStartPromotionLine(aborted.state, config), "no reopen same year");
    aborted.state.year += 1;
    aborted.state.career.promotionsThisYear = 0;
    assert(sim.canStartPromotionLine(aborted.state, config), "reopen next year");

    [4, 5, 6].forEach(function (rank) {
      let p = makePromotable(hired("music"), Math.min(rank, 5));
      p.career.jobRank = rank;
      p.career.lines = {};
      p.career.promotionsThisYear = 0;
      assert(sim.canStartBecomeProducerLine(p, config), "producer unlock at rank " + rank);
    });

    let prod = makePromotable(hired("programmer"), 4);
    prod.career.lines = {};
    started = sim.startCareerLine(prod, "become-producer", config);
    assert(started.ok, "start become-producer");
    assert(!sim.canStartPromotionLine(started.state, config), "mutual exclusion while producer line active");
    step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
    prod = step.state;
    prod.career.lines["become-producer"].waitUntil = sim.monthIndex(prod.year, prod.month);
    prod.career.lines["become-producer"].pending = false;
    sim.processCareerLines(prod, config, [], []);
    step = sim.resolveCareerLineChoice(prod, "become-producer", "trial", "craft", config);
    prod = step.state;
    prod.career.lines["become-producer"].waitingFor = "shipReady";
    prod.career.lines["become-producer"].pending = false;
    sim.processCareerLines(prod, config, [], []);
    const keptRank = prod.career.jobRank;
    step = sim.resolveCareerLineChoice(prod, "become-producer", "seat", "accept", config);
    assert(step.ok && step.done, "producer line done");
    assert(step.state.career.roleId === "producer", "roleId producer");
    assert(step.state.career.growthStage === "producer", "growthStage producer");
    assert(step.state.career.jobRank === keptRank, "kept jobRank after producer");
    assert(sim.careerJobTitleDisplay(step.state, config) === "制作人", "display 制作人");
    assert(sim.isCareerProducer(step.state), "isCareerProducer");
    assert(!sim.canPromoteCareer(step.state, config), "producer cannot promote ladder");

    const virtSt = sim.clone(step.state);
    virtSt.career.titleId = null;
    virtSt.career.liveStats = null;
    virtSt.career.idleMonths = 99;
    virtSt.year = 2024;
    virtSt.month = 1;
    const virt = sim.startVirtualProject(virtSt, config, { genreId: "fantasy", gameplayId: "rpg" });
    assert(virt && virt.virtual && virt.genreId === "fantasy" && virt.gameplayId === "rpg", "producer virtual genre/gameplay choosable");

    let capSt = makePromotable(hired("programmer"), 4);
    capSt.career.lines = {};
    started = sim.startCareerLine(capSt, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 1, "first producer ask counted");
    const no1 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    assert(no1.ok && no1.aborted, "first producer ask declined");
    no1.state.year += 1;
    no1.state.career.promotionsThisYear = 0;
    assert(sim.canStartBecomeProducerLine(no1.state, config), "producer ask can reopen once");
    started = sim.startCareerLine(no1.state, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 2, "second producer ask counted");
    const no2 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    no2.state.year += 1;
    no2.state.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(no2.state, config), "producer ask cap after 2");
    const blocked = sim.startCareerLine(no2.state, "become-producer", config);
    assert(!blocked.ok, "third producer start blocked");

    assert(sim.isGrowthStageLocked("founder", config), "founder still locked helper");
    const stages = world.growthStages || [];
    assert(stages.every(function (s) { return s.id !== "founder" || s.lockedThisVersion; }), "no founder unlock");

    ok("event lines, rank4→5 final beat, producer unlock 4/5/6, founder locked");
  })();

  (function producerCatalogDirectionAndInviteRoles() {
    function hiredAt(role, rank) {
      let st = sim.createCareerGame("测", role, config);
      // createCareerGame 用 Date.now() 播种，开局 offer 随机 → 固定种子保证可复现
      st.rngSeed = 20240915;
      st.rngCount = 0;
      st.career.openingOffers = sim.rollOpeningOffers(st, st.career.roleId, config);
      st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
      st.career.jobRank = rank;
      st.career.fame = 80;
      st.career.lines = {};
      return st;
    }

    function finishProducerLine(st) {
      let started = sim.startCareerLine(st, "become-producer", config);
      assert(started.ok, "start producer line for invite test");
      let step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
      st = step.state;
      st.career.lines["become-producer"].waitUntil = sim.monthIndex(st.year, st.month);
      st.career.lines["become-producer"].pending = false;
      sim.processCareerLines(st, config, [], []);
      step = sim.resolveCareerLineChoice(st, "become-producer", "trial", "craft", config);
      st = step.state;
      st.career.lines["become-producer"].waitingFor = "shipReady";
      st.career.lines["become-producer"].pending = false;
      sim.processCareerLines(st, config, [], []);
      step = sim.resolveCareerLineChoice(st, "become-producer", "seat", "accept", config);
      assert(step.ok && step.done, "finish producer line");
      return step.state;
    }

    let prod = finishProducerLine(hiredAt("programmer", 4));
    assert(sim.hasCompletedBecomeProducerLine(prod, config), "become-producer done");

    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && !chrono.virtual, "chrono is catalog");
    const snap = {
      name: chrono.name,
      alias: chrono.alias,
      genreId: chrono.genreId,
      gameplayId: chrono.gameplayId
    };
    prod.career.titleId = "chronoTrigger";
    prod.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    prod.career.awaitingProducerPitch = false;
    const queued = [];
    assert(!sim.queueProducerVirtualPitch(prod, config, queued), "no pitch while on catalog");
    assert(queued.length === 0, "catalog blocks pitch queue");

    prod.career.titleId = null;
    prod.career.liveStats = null;
    prod.career.idleMonths = 99;
    assert(sim.queueProducerVirtualPitch(prod, config, queued), "pitch when idle virtual path");
    assert(queued.length === 1 && queued[0].type === "producerPitch", "pitch queued");
    const optId = (prod.career.producerPitchOptions || [])[0].id;
    const pitched = sim.resolveProducerPitch(prod, optId, config);
    assert(pitched.ok && pitched.virtual, "pitch resolves virtual");
    const virtTitle = sim.careerTitle(pitched.state.career.titleId, config, pitched.state);
    assert(virtTitle && virtTitle.virtual, "assigned virtual");
    assert(virtTitle.genreId && virtTitle.gameplayId, "virtual has genre/gameplay from pitch");
    assert(chrono.name === snap.name && chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId,
      "catalog name/genre/gameplay untouched");

    const rewriteCfg = deepClone(config);
    rewriteCfg.careerWorld = deepClone(config.careerWorld);
    rewriteCfg.careerWorld.producerEvents = deepClone(config.careerWorld.producerEvents || { list: [] });
    rewriteCfg.careerWorld.producerEvents.list = (rewriteCfg.careerWorld.producerEvents.list || []).concat([{
      id: "testCatalogRewrite",
      displayName: "试改目录",
      text: "不该改写目录作。",
      presentation: "choice",
      choices: [{
        id: "rewrite",
        label: "改",
        virtualGenreId: "horror",
        virtualGameplayId: "survival",
        virtualName: "黑客编的假名"
      }]
    }]);
    let onCatalog = sim.clone(pitched.state);
    onCatalog.career.titleId = "chronoTrigger";
    onCatalog.career.liveStats = { play: 80, fun: 80, expression: 80, immersion: 80 };
    const rewrite = sim.resolveCareerEventChoice(onCatalog, "testCatalogRewrite", "rewrite", rewriteCfg);
    assert(rewrite.ok, "rewrite choice resolves");
    assert(chrono.name === snap.name && chrono.alias === snap.alias, "catalog name blocked");
    assert(chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId, "catalog genre/gameplay blocked");

    let beforeDone = hiredAt("design", 4);
    beforeDone.career.roleId = "producer";
    beforeDone.career.growthStage = "producer";
    beforeDone.career.lines = {};
    assert(!sim.hasCompletedBecomeProducerLine(beforeDone, config), "role alone ≠ line done");
    beforeDone.year = 1995;
    beforeDone.month = 2;
    beforeDone.career.companyId = "nintendo";
    const invBefore = sim.listCareerInvites(beforeDone, config);
    invBefore.forEach(function (inv) {
      assert(inv.roleId !== "producer", "no producer dig before line done");
    });
    const hopsBefore = sim.listYearEndOffers(beforeDone, config).filter(function (o) {
      return !o.kind;
    });
    hopsBefore.forEach(function (o) {
      assert(o.roleId !== "producer", "no producer hop before line done");
    });

    let after = finishProducerLine(hiredAt("art", 4));
    after.year = 1995;
    after.month = 2;
    after.career.companyId = "nintendo";
    after.career.fame = 90;
    after.career.titleId = null;
    const weights = deepClone(config);
    weights.careerWorld = deepClone(config.careerWorld);
    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const invProd = sim.listCareerInvites(after, weights);
    assert(invProd.length >= 1, "invites exist after line done");
    assert(invProd.some(function (inv) { return inv.roleId === "producer"; }), "producer dig can appear after line done");

    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const invStaff = sim.listCareerInvites(after, weights);
    assert(invStaff.length >= 1, "staff digs while currently producer");
    assert(invStaff.every(function (inv) { return inv.roleId !== "producer"; }), "producer weight 0 → staff only");
    assert(invStaff.some(function (inv) {
      return ["programmer", "design", "art", "music"].indexOf(inv.roleId) >= 0;
    }), "staff role dig while producer");

    after.career.invites = [invStaff[0]];
    const acc = sim.acceptCareerInvite(after, invStaff[0].id, weights);
    assert(acc.ok, "accept staff dig as producer");
    assert(acc.state.career.roleId === invStaff[0].roleId, "switched to staff role");
    assert(acc.state.career.growthStage === "employee", "growthStage back to employee");
    assert(!sim.isCareerProducer(acc.state), "no longer producer after staff dig");

    after = finishProducerLine(hiredAt("music", 4));
    after.year = 1995;
    after.month = 12;
    after.career.titleId = null;
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const hops = sim.listYearEndOffers(after, weights);
    const hopStaff = hops.filter(function (o) { return !o.kind; });
    assert(hopStaff.length >= 1, "year-end hops");
    hopStaff.forEach(function (o) {
      assert(o.roleId !== "producer", "hop staff when producer weight 0");
    });

    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const hopsProd = sim.listYearEndOffers(after, weights).filter(function (o) { return !o.kind; });
    assert(hopsProd.some(function (o) { return o.roleId === "producer"; }), "producer hop after line done");

    ok("producer catalog locked; invite/hop roles gated by become-producer line");
  })();

  (function careerScoreTracksColleaguesAndMedia() {
    const world = config.careerWorld;
    const player = world.player || {};
    const dims = ["program", "design", "art", "music"];
    dims.forEach(function (d) {
      assert(player.startingStats[d] >= 16 && player.startingStats[d] <= 20, d + " starting teens");
    });
    assert(player.specialtyBonus >= 6 && player.specialtyBonus <= 8, "specialtyBonus 6-8");
    const craft = world.virtualPool.craft || {};
    assert(craft.scoreBase === 1 && craft.statDivisor === 7.5, "craft scale scoreBase/statDivisor");
    assert(Math.abs(sim.careerCraftPublicScore(15, config) - 3) <= 0.1, "open four-dim 15 -> 3");
    assert(Math.abs(sim.careerCraftPublicScore(56, config) - 8.5) <= 0.1, "open four-dim 56 -> 8.5");
    assert(sim.careerCraftPublicScore(150, config) === 10, "craft caps at 10");
    assert(sim.careerCraftPublicScore(0, config) === 1, "craft floors at 1");
    assert(sim.careerCraftPublicScore(22, config) < 8, "weak team cannot grind masterpiece");

    function meanStats(stats) {
      return PDIMS.reduce(function (a, d) { return a + sim.personStatVal(stats, d); }, 0) / PDIMS.length;
    }
    function meanTitleStats(stats) {
      return sim.titleQualityMean(stats, config);
    }
    function hireAt(companyId, role) {
      let st = sim.createCareerGame("测", role || "programmer", config);
      st.career.companyId = companyId;
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(companyId, config));
      st.career.roleId = role || "programmer";
      st.career.jobRank = 1;
      st.rngSeed = 42;
      st.rngCount = 0;
      sim.ensureCareerColleagues(st, config);
      return st;
    }

    const nintendo = hireAt("nintendo", "programmer");
    assert((nintendo.career.colleagues || []).length === 4, "four nintendo colleagues");
    nintendo.career.colleagues.forEach(function (c) {
      assert(c.jobRank != null, "colleague has jobRank");
      if (c.roleId === "producer") {
        assert(c.jobRank >= 5 && c.jobRank <= 6, "power3 producer rank " + c.jobRank);
      } else {
        assert(c.jobRank >= 4 && c.jobRank <= 6, "power3 specialist rank " + c.jobRank);
      }
      const avg = meanStats(c.stats);
      assert(avg >= 80 && avg <= 100, "power3 stats " + avg);
    });

    const atlus = hireAt("atlus", "programmer");
    atlus.career.colleagues.forEach(function (c) {
      assert(c.jobRank >= 1 && c.jobRank <= 3, "power1 rank " + c.jobRank);
      const avg = meanStats(c.stats);
      assert(avg >= 35 && avg <= 58, "power1 stats " + avg);
    });
    const nAvg = meanStats(sim.careerTeamAvgStats(nintendo, config));
    const pAvg = meanStats(sim.careerTeamAvgStats(atlus, config));
    assert(nAvg > pAvg + 15, "power3 team avg exceeds power1");
    const nBase = sim.careerCraftLiveStats(nintendo, 6, 5, config, "fantasy", "rpg");
    const pBase = sim.careerCraftLiveStats(atlus, 6, 5, config, "fantasy", "rpg");
    const nCraft = sim.careerCraftPublicScore(meanTitleStats(nBase), config);
    const pCraft = sim.careerCraftPublicScore(meanTitleStats(pBase), config);
    assert(nCraft >= 5 && nCraft <= 6.6, "nintendo virtual intern craft " + nCraft);
    assert(pCraft >= 3 && pCraft <= 4.4, "power1 virtual intern craft " + pCraft);
    assert(nCraft > pCraft + 1.5, "nintendo virtual beats small-studio virtual");

    const oot = sim.careerTitle("oot", config);
    assert(oot && oot.landmark && oot.prestige === 5, "oot landmark p5");
    nintendo.career.titleId = "oot";
    nintendo.career.liveStats = sim.careerLiveFromTitle(nintendo, oot, config);
    sim.shipPlayerTitle(nintendo, config, [], []);
    const rec = (nintendo.worldReleased || []).filter(function (g) { return g.id === "oot"; })[0];
    assert(rec && rec.score >= 9.5 && rec.score <= 10, "intern landmark public " + (rec && rec.score));
    assert(rec.score >= oot.score - 0.1, "landmark floor catalog-0.1");
    assert(rec.media && rec.media.rows && rec.media.rows.length === 4, "four media rows");
    // 作品的评分 = 面板上那四家的均分：榜单 / 奖项 / 销量曲线 / 履历都读这一个数，
    // 不允许再出现「面板一个数、榜单另一个数」（旧实现把对外口碑写在 rec.avg 上）。
    assert(rec.avg === rec.media.avg && rec.score === rec.media.avg,
      "work score is the media average, got " + rec.avg + " vs " + rec.media.avg);
    assert(rec.launchSales === sim.careerLaunchSales(oot, rec.media.avg, config, rec.liveStats || rec.stats).launchSales,
      "launchSales uses the shown average");
    rec.media.rows.forEach(function (row) {
      assert(Math.abs(row.score - rec.score) <= 0.7, "media tracks public " + row.score + " vs " + rec.score);
    });
    assert(typeof rec.launchSales === "number" && rec.launchSales > 0, "intern landmark launchSales");
    assert(rec.launchSales === sim.careerLaunchSales(oot, rec.score, config, rec.liveStats || rec.stats).launchSales, "landmark launch matches formula");

    const mid = sim.createCareerGame("测", "programmer", config);
    mid.rngSeed = 7;
    mid.rngCount = 0;
    const pub = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7.2, config, mid);
    const around = sim.scoreMediaFromPublic(mid, pub, config, {
      min: world.scoreFromLive.mediaJitterMin,
      max: world.scoreFromLive.mediaJitterMax
    });
    assert(around.rows.every(function (r) { return Math.abs(r.score - pub) <= 0.7; }), "scatter around public");
    assert(around.rows.some(function (r) { return r.score < 9.5; }), "high live stats do not force media 10s");
    const studioMedia = sim.scoreMedia(mid, { play: 90, fun: 90, expression: 90, immersion: 90 }, [], config, null);
    assert(studioMedia.rows.every(function (r) { return r.score >= 9.5; }), "studio divisor 6.5 still maps 90s to ~10");

    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.devEvents.chance = 1;
    tw.careerWorld.devEvents.minGapMonths = 0;
    tw.careerWorld.devEvents.maxPerYear = 99;
    tw.careerWorld.devEvents.list = [{
      id: "ootHistory",
      titleId: "oot",
      displayName: "史实",
      text: "测",
      presentation: "notice",
      qualityDim: "play",
      qualityDelta: 10
    }];
    const hist = hireAt("nintendo", "programmer");
    hist.career.titleId = "oot";
    hist.career.liveStats = { play: 90, fun: 90, expression: 90, immersion: 90 };
    hist.career.jobRank = 1;
    hist.rngSeed = 1;
    hist.rngCount = 0;
    const fired = sim.rollCareerDevEvent(hist, tw, []);
    assert(fired && fired.id === "ootHistory", "titleId notice rolled");
    assert(hist.career.liveStats.play === 100, "landmark titleId notice unscaled, got " + hist.career.liveStats.play);

    ok("starting teens, craft anchors, colleagues-by-power, intern landmark, media around public");
  })();

  (function careerLaunchSalesZeroWhenBaseUnitIsZero() {
    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.launchSales = { baseUnit: 0 };
    const packed = sim.careerLaunchSales(
      { prestige: 5, stats: { play: 90, fun: 90, expression: 90, immersion: 90 } },
      10,
      tw,
      { play: 90, fun: 90, expression: 90, immersion: 90 }
    );
    assert(packed.baselineSales === 0 && packed.launchSales === 0, "zero coeffs → 0 launch");
    const g = sim.createCareerGame("测", "programmer", tw);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tw).state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { play: 90, fun: 95, expression: 88, immersion: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    sim.shipPlayerTitle(st, tw, [], []);
    assert(st.lastMedia.launchSales === 0, "ship writes 0 when formula says so");
    assert(st.lastMedia.media && st.lastMedia.media.rows.length === 4, "media rec still present");
    ok("career launchSales is 0 only when coeffs say so");
  })();

  (function optionalEventLinesParallelKickOutReturnMentor() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const ids = lines.map(function (l) { return l.id; });
    ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "optional line " + id);
      const def = lines.filter(function (l) { return l.id === id; })[0];
      assert(def.exclusiveGroup !== "careerPath", id + " not in careerPath");
    });
    const kojima = ((sim.careerCompany("konami", config) || {}).seniors || []).filter(function (s) {
      return s.id === "kojima";
    })[0];
    // kojima 前辈已移除：successor 剧情不再强制配置

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }

    let st = hired("programmer");
    st.career.jobRank = 4;
    st.career.fame = 20;
    st.career.honor = 20;
    st.career.jobXp = 99;
    st.career.monthsInRank = 99;
    st.career.promotionsThisYear = 0;
    st.career.credits = [{ titleId: "x", shipped: true, virtual: false, jobRank: 4 }];
    const company0 = st.career.companyId;
    // mentor 由 sim 在建（真实或占位），非 null，不再强制
    const prod = sim.startCareerLine(st, "become-producer", config);
    assert(prod.ok, "start producer while bonds exist");
    let step = sim.resolveCareerLineChoice(prod.state, "become-producer", "invite", "yes", config);
    st = step.state;
    const mentorStart = sim.startCareerLine(st, "bond-mentor", config);
    assert(mentorStart.ok, "mentor starts while producer line active");
    st = mentorStart.state;
    const actives = sim.activeCareerLineIds(st);
    assert(actives.indexOf("become-producer") >= 0 && actives.indexOf("bond-mentor") >= 0, "two lines active");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    st.career.lines["become-producer"].waitUntil = sim.monthIndex(st.year, st.month);
    st.career.lines["become-producer"].pending = false;
    st.career.lines["bond-mentor"].waitUntil = sim.monthIndex(st.year, st.month);
    st.career.lines["bond-mentor"].pending = false;
    const qPri = [];
    sim.processCareerLines(st, config, qPri, []);
    assert(qPri.length === 1, "one beat per month");
    assert(qPri[0].lineId === "become-producer", "careerPath beat wins priority, got " + (qPri[0] && qPri[0].lineId));

    let kickSt = hired("design");
    const chrono = sim.careerTitle("chronoTrigger", config);
    const worldScore0 = chrono && chrono.score;
    const savings0 = kickSt.career.savings;
    const fame0 = kickSt.career.fame;
    kickSt.career.titleId = "chronoTrigger";
    kickSt.career.companyId = kickSt.career.companyId || "square";
    const epic = sim.startCareerLine(kickSt, "epic-title", config);
    assert(epic.ok, "start epic-title");
    const collapsed = sim.resolveCareerLineChoice(epic.state, "epic-title", "weight", "collapse", config);
    assert(collapsed.ok && collapsed.done, "collapse completes");
    assert(collapsed.state.career.companyId == null, "kicked out of company");
    assert((collapsed.state.career.tenures || []).every(function (t) { return t.endYear != null; }), "tenures closed");
    assert(collapsed.state.career.savings === savings0, "no extra money penalty");
    assert(collapsed.state.career.fame === fame0, "no extra fame penalty");
    assert(sim.careerTitle("chronoTrigger", config).score === worldScore0, "catalog score unchanged");
    assert(sim.canCareerHop(collapsed.state, config), "unemployed can seek work");
    const offers = sim.listYearEndOffers(collapsed.state, config);
    assert(offers.length >= 1, "year-end offers after kick");
    offers[0].successChance = 1;
    collapsed.state.career.yearEndOffers = offers;
    const hopped = sim.applyYearEndOffer(collapsed.state, offers[0].id, config);
    assert(hopped.ok && hopped.hopped, "rehire via existing hop");
    assert(hopped.state.career.companyId, "employed again");

    let ret = hired("art");
    ret.year = 2014;
    ret.month = 3;
    const retStart = sim.startCareerLine(ret, "era-return-china", config);
    assert(retStart.ok, "start return line");
    let retStep = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert(retStep.ok, "read letter");
    const invitePage = (retStep.queue || []).filter(function (p) { return p.beatId === "invite"; })[0];
    assert(invitePage, "chained to return invite");
    const optIds = (invitePage.options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("staff") >= 0, "staff option");
    assert(optIds.indexOf("producer") >= 0, "producer option allowed on this invite");
    const staffJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "staff", config);
    assert(staffJoin.ok, "staff join");
    const cnIds = ["mihoyo", "hypergryph", "paperGames"];
    assert(cnIds.indexOf(staffJoin.state.career.companyId) >= 0, "joined a catalog CN company");
    assert(["programmer", "art", "design", "music"].indexOf(staffJoin.state.career.roleId) >= 0, "staff is one of four roles");
    assert(staffJoin.state.career.growthStage !== "founder", "staff not founder");
    const prodJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "producer", config);
    assert(prodJoin.ok, "producer join");
    assert(prodJoin.state.career.roleId === "producer", "producer role");
    assert(prodJoin.state.career.growthStage === "producer", "producer stage");
    assert(prodJoin.state.career.growthStage !== "founder", "still not founder");
    assert(cnIds.indexOf(prodJoin.state.career.companyId) >= 0, "producer is employee of catalog CN company");
    assert(sim.isGrowthStageLocked("founder", config), "founder still locked");

    let stay = hired("music");
    stay.career.companyId = "konami";
    stay.year = 2015;
    stay.month = 9;
    stay.career.bonds = stay.career.bonds || {};
    stay.career.bonds.mentor = {
      seniorId: "kojima",
      name: "小岛秀夫",
      alias: "小岛秀夫",
      title: "制作人",
      companyId: "konami",
      homeCompanyId: "konami",
      colocated: true,
      departYear: 2015,
      successorCompanyId: "kojimaProductions",
      monthsTogether: 20
    };
    const stayCo = stay.career.companyId;
    const mStart = sim.startCareerLine(stay, "bond-mentor", config);
    const mFollow = sim.resolveCareerLineChoice(mStart.state, "bond-mentor", "take-in", "follow", config);
    stay = mFollow.state;
    const mentorDef = lines.filter(function (l) { return l.id === "bond-mentor"; })[0];
    const leaveIdx = mentorDef.beats.map(function (b) { return b.id; }).indexOf("leave");
    assert(leaveIdx >= 0, "leave beat still present");
    stay.career.lines["bond-mentor"].beat = leaveIdx;
    stay.career.lines["bond-mentor"].pending = false;
    stay.career.lines["bond-mentor"].waitUntil = null;
    stay.career.lines["bond-mentor"].waitingFor = null;
    // 准入（mobility.requireInDevTitle.scripted）：小岛组 2015～2017.10 一部在研目录作都没有
    //（死亡搁浅 2017.11 才开工），这时"跟着走"＝进空窗，过月被塞虚拟作 → 这一拍先不拍。
    const qEarly = [];
    sim.processCareerLines(deepClone(stay), config, qEarly, []);
    assert(!qEarly.some(function (x) { return x.beatId === "leave"; }),
      "leave beat waits while the successor company has nothing in dev");
    stay.year = 2018;
    const qLeave = [];
    sim.processCareerLines(stay, config, qLeave, []);
    assert(qLeave.length && qLeave[0].beatId === "leave", "leave beat ready");
    const stayed = sim.resolveCareerLineChoice(stay, "bond-mentor", "leave", "stay", config);
    assert(stayed.ok && stayed.done, "not following is a legal end");
    assert(stayed.state.career.lines["bond-mentor"].status === "done", "mentor line done");
    assert(stayed.state.career.companyId === stayCo, "still at same company");
    void company0;

    ok("optional lines parallel, kick-out only, return invite roles, mentor stay ends");
  })();

  (function themedBondLinesMergerRemoteStoryPromo() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    function lineDef(id) {
      return lines.filter(function (l) { return l.id === id; })[0];
    }
    function beatIdx(lineId, beatId) {
      const beats = (lineDef(lineId).beats || []);
      let i;
      for (i = 0; i < beats.length; i++) if (beats[i].id === beatId) return i;
      return -1;
    }
    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    function pinPeer(st) {
      st.career.bonds = st.career.bonds || {};
      if (!st.career.bonds.peer) {
        st.career.bonds.peer = {
          id: "peer-test",
          name: "同组",
          roleId: "design",
          jobRank: 3,
          companyId: st.career.companyId,
          homeCompanyId: st.career.companyId,
          monthsTogether: 30,
          colocated: true
        };
      } else {
        st.career.bonds.peer.monthsTogether = 30;
        st.career.bonds.peer.jobRank = st.career.bonds.peer.jobRank || 3;
        st.career.bonds.peer.homeCompanyId = st.career.bonds.peer.homeCompanyId || st.career.companyId;
        st.career.bonds.peer.colocated = true;
      }
      return st;
    }
    function jumpBeat(st, lineId, beatId) {
      st.career.lines[lineId].beat = beatIdx(lineId, beatId);
      st.career.lines[lineId].pending = false;
      st.career.lines[lineId].waitUntil = sim.monthIndex(st.year, st.month);
      st.career.lines[lineId].waitingFor = null;
      st.career.lines[lineId].waitUntilYear = null;
    }
    function hopTo(st, companyId) {
      const co = sim.careerCompany(companyId, config);
      const studio = ((co && co.studios) || [])[0];
      st.career.yearEndOffers = [{
        id: "test-hop",
        companyId: companyId,
        studioId: studio && studio.id,
        roleId: st.career.roleId,
        salary: 1200,
        successChance: 1
      }];
      return sim.applyYearEndOffer(st, "test-hop", config);
    }

    assert(lineDef("company-merger") && lineDef("company-merger").exclusiveGroup !== "careerPath", "merger not careerPath");
    assert((world.producerCareer || {}).minJobRank === 4, "producer minRank still 4");

    let st = hired("programmer");
    st.career.jobRank = 2;
    let started = sim.startCareerLine(st, "bond-mentor", config);
    let step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    let q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "nominate", "mentor nominate fires at rank 2");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.ok, "rank2 nominate promote");
    assert(step.state.career.jobRank === 3, "mentor finale rank 2 → +1");
    ok("mentor finale rank 2 promotes +1");

    st = hired("programmer");
    st.career.jobRank = 3;
    st.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(st, config), "rank 3 cannot start producer globally");
    assert(sim.canStartBecomeProducerLine(st, config, { ignoreMinRank: true }), "mentor sponsor ignores minRank");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q[0] && q[0].beatId === "nominate", "nominate at rank 3");
    const optIds = (q[0].options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("sponsor-producer") >= 0, "producer sponsor option visible");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "sponsor-producer", config);
    assert(step.ok, "sponsor producer");
    const act = sim.activeCareerLineIds(step.state);
    assert(act.indexOf("become-producer") >= 0, "mentor rank 3 starts become-producer");
    assert((world.producerCareer || {}).minJobRank === 4, "minRank config unchanged");
    ok("mentor finale rank 3 starts become-producer");

    const tweaked = deepClone(config);
    const peerLine = ((tweaked.careerWorld.eventLines || {}).lines || []).filter(function (l) {
      return l.id === "bond-peer";
    })[0];
    peerLine.startWhen.startChance = 1;
    peerLine.startWhen.minMonthsTogether = { bond: "peer", n: 0 };
    let peerSt = pinPeer(hired("programmer"));
    peerSt.career.jobRank = 2;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(!(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active"), "peer line will not start at jobRank 2");
    peerSt.career.jobRank = 3;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active", "peer starts at jobRank 3");
    ok("peer line gated at minJobRank 3");

    function startPeerFinale(rank) {
      let s = pinPeer(hired("programmer"));
      s.career.jobRank = rank;
      s.career.promotionsThisYear = 0;
      const go = sim.startCareerLine(s, "bond-peer", config);
      const rival = sim.resolveCareerLineChoice(go.state, "bond-peer", "rival", "compete", config);
      s = rival.state;
      jumpBeat(s, "bond-peer", "finale-path");
      const qq = [];
      sim.processCareerLines(s, config, qq, []);
      assert(qq[0] && qq[0].beatId === "finale-path", "peer finale ready");
      return { state: s, page: qq[0] };
    }
    let pack = startPeerFinale(3);
    const promoIds = (pack.page.options || []).map(function (o) { return o.id; });
    assert(promoIds.indexOf("promo") >= 0 && promoIds.indexOf("dual") >= 0 && promoIds.indexOf("role-change") >= 0, "peer finale endings present");
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "promo", config);
    assert(step.state.career.jobRank === 4, "peer promo 3→4");
    pack = startPeerFinale(3);
    const peerRank0 = pack.state.career.bonds.peer.jobRank;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "dual", config);
    assert(step.state.career.jobRank === 4, "dual player +1");
    assert(step.state.career.bonds.peer.jobRank === peerRank0 + 1, "dual peer +1");
    pack = startPeerFinale(3);
    const role0 = pack.state.career.roleId;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "role-change", config);
    assert(step.state.career.roleId !== role0, "role change among staff jobs");
    assert(step.state.career.jobRank === 3, "role change keeps jobRank");
    pack = startPeerFinale(4);
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale-path", "promo", config);
    assert(step.state.career.jobRank === 5, "peer promo 4→5");
    assert(step.state.career.lines["promo-to-expert"] && step.state.career.lines["promo-to-expert"].status === "done", "promo-to-expert marked done");
    ok("peer finale promote / dual / role change");

    st = hired("programmer");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    const home0 = st.career.companyId;
    const hopped = hopTo(st, home0 === "nintendo" ? "sega" : "nintendo");
    assert(hopped.ok && hopped.hopped, "mid-line hop");
    st = hopped.state;
    assert(st.career.bonds.mentor.colocated === false, "hop sets colocated false");
    assert(st.career.lines["bond-mentor"].remotePending, "remote beat pending");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "remote", "remote check beat");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "remote", "keep", config);
    assert(step.ok && step.state.career.lines["bond-mentor"].status === "active", "keep in touch continues");
    ok("hop mid-line remote beat");

    st = hired("programmer");
    st.career.companyId = "square";
    st.career.studioId = "square-rd1";
    st.year = 2004;
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].lineId === "company-merger", "merger interrupt queued");
    step = sim.resolveCareerLineChoice(st, "company-merger", "merge", "stay", config);
    assert(step.ok && step.state.career.companyId === "squareEnix", "merger stay joins successor");
    ok("company merger join successor");

    st = hired("art");
    started = sim.startCareerLine(st, "bond-junior", config);
    assert(started.ok, "junior line starts");
    st = started.state;
    assert(st.career.bonds && st.career.bonds.junior, "ensureBond junior");
    st.year = 2014;
    const retStart = sim.startCareerLine(st, "era-return-china", config);
    step = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert((step.queue || []).some(function (p) { return p.beatId === "reveal"; }) || (step.state.career.bonds.junior && step.state.career.bonds.junior.revealed), "return line reveal still works");
    ok("junior bond + return reveal");

    // ── 三条关系线的选择要有回声：写进去的 flag 必须被后续拍读回 ──────────────
    // 旧状态：option.setFlags 写了 voice / credit / taughtWell / remote，但整份
    // eventLines 只有史诗线用 flagOn/flagOff 读回（held），三条关系线的 flag 全是死链。
    (function themedBondLinesEchoTheirChoices() {
      function echoBeats(lineId) {
        return (lineDef(lineId).beats || []).filter(function (b) {
          return b.skipIf && (b.skipIf.flagOn || b.skipIf.flagOff);
        });
      }
      assert(echoBeats("bond-mentor").length >= 2, "前辈线要有读回 voice 选择的回声拍");
      assert(echoBeats("bond-peer").length >= 2, "同事线要有读回 credit 选择的回声拍");
      assert(echoBeats("bond-junior").length >= 2, "后辈线要有读回 taughtWell 选择的回声拍");

      // 前辈线：选「照着做」只出 mirror 那版回声，own 那版被跳过
      let mEcho = hired("programmer");
      mEcho = sim.startCareerLine(mEcho, "bond-mentor", config).state;
      mEcho = sim.resolveCareerLineChoice(mEcho, "bond-mentor", "take-in", "follow", config).state;
      mEcho = sim.resolveCareerLineChoice(mEcho, "bond-mentor", "own-voice", "mirror", config).state;
      assert(mEcho.career.lines["bond-mentor"].flags.mirrorStyle === true, "选『照着做』记下 mirrorStyle");
      jumpBeat(mEcho, "bond-mentor", "voice-echo-mirror");
      const mq = [];
      sim.processCareerLines(mEcho, config, mq, []);
      assert(mq.length && mq[0].beatId === "voice-echo-mirror", "mirror 分支触发 mirror 回声");
      jumpBeat(mEcho, "bond-mentor", "voice-echo-own");
      const mq2 = [];
      sim.processCareerLines(mEcho, config, mq2, []);
      assert(!mq2.some(function (x) { return x.beatId === "voice-echo-own"; }),
        "mirror 分支不该触发 own 回声");

      // 同事线：结尾拆成「关系收束 -> 职业去向」，散伙后需要关系的选项消失
      let pSplit = pinPeer(hired("programmer"));
      pSplit.career.jobRank = 3;
      pSplit = sim.startCareerLine(pSplit, "bond-peer", config).state;
      pSplit = sim.resolveCareerLineChoice(pSplit, "bond-peer", "rival", "compete", config).state;
      const relIds = (lineDef("bond-peer").beats.filter(function (x) {
        return x.id === "finale-relation";
      })[0].options || []).map(function (o) { return o.id; });
      assert(relIds.indexOf("reconcile") >= 0 && relIds.indexOf("split") >= 0, "同事线要有关系收束拍");
      pSplit = sim.resolveCareerLineChoice(pSplit, "bond-peer", "finale-relation", "split", config).state;
      assert(pSplit.career.lines["bond-peer"].flags.peerSplit === true, "散伙记下 peerSplit");
      jumpBeat(pSplit, "bond-peer", "finale-path");
      const q3 = [];
      sim.processCareerLines(pSplit, config, q3, []);
      const pathIds = (q3[0] && q3[0].options ? q3[0].options : []).map(function (o) { return o.id; });
      assert(pathIds.indexOf("promo") >= 0, "去向拍仍给『你先升一级』");
      assert(pathIds.indexOf("dual") < 0, "散伙后不再给『一起升』");

      // 后辈线：自身收束到揭晓，不再只挂在回国线上
      let jr = hired("art");
      jr = sim.startCareerLine(jr, "bond-junior", config).state;
      assert(jr.career.bonds.junior && !jr.career.bonds.junior.revealed, "后辈初始未揭晓");
      const revealBeat = (lineDef("bond-junior").beats || []).filter(function (b) {
        return b.id === "reveal";
      })[0];
      assert(revealBeat && revealBeat.effects && revealBeat.effects.revealJunior === true,
        "后辈线尾拍要带 revealJunior");
      jumpBeat(jr, "bond-junior", "reveal");
      const jq = [];
      sim.processCareerLines(jr, config, jq, []);
      assert(jr.career.bonds.junior.revealed === true, "揭晓拍触发后 bond.revealed 置真");
      assert(jr.career.bonds.junior.aliasNow, "揭晓后要有真名 aliasNow");
      assert(jq.length && jq[0].beatId === "reveal", "揭晓拍会推上队列");
      // 渲染层面：揭晓拍必须用真名，且不能把 {juniorName} 漏成字面量
      assert(jq[0].body.indexOf("{") < 0, "揭晓拍正文不能漏出占位符");
      assert(jq[0].body.indexOf(jr.career.bonds.junior.aliasNow) >= 0, "揭晓拍正文要出现真名");

      // 收束形态：一通陌生电话。响铃拍不认人、刻意不提名，接起拍才报名字。
      // 拆两拍的意义是让"陌生号码"单独占一屏——紧张感不被叙述句稀释。
      const callBeat = (lineDef("bond-junior").beats || []).filter(function (b) {
        return b.id === "call";
      })[0];
      assert(callBeat, "后辈线收束要写成『陌生电话』，不再是一份摊在桌上的署名文件");
      assert(!(callBeat.effects && callBeat.effects.revealJunior),
        "响铃拍不能带 revealJunior，否则名字提前揭晓、『陌生』白写");
      assert(String(callBeat.body).indexOf("{juniorName}") < 0 &&
        String(callBeat.bodyRemote).indexOf("{juniorName}") < 0,
        "响铃拍要刻意不提名，名字留给接起拍");
      assert((revealBeat.wait || {}).type === "sameMonthChain",
        "接起拍要同月连弹，不额外占月度车道");
      assert((callBeat.wait || {}).n >= 12, "响铃前要留出足够年月，『某天』才成立");
      assert(callBeat.bodyRemote && callBeat.bodyRemote !== callBeat.body,
        "电话拍要按异地/当面分叉：当面那版得先交代他后来走了");

      // 真跑一遍连弹：一个月内应当连续推出『响铃』+『接起』两拍。
      // 电话有准入：他所在的公司得已经成立、且当月确有在研目录作。
      // 2013 + 米哈游（2011 成立，崩坏学园2 在研 2012-09~2014-03）是一个满足点。
      let jrCall = hired("art");
      jrCall = sim.startCareerLine(jrCall, "bond-junior", config).state;
      jrCall.career.bonds.junior.revealCompanyId = "mihoyo";
      jrCall.year = 2013;
      jumpBeat(jrCall, "bond-junior", "call");
      const jqCall = [];
      sim.processCareerLines(jrCall, config, jqCall, []);
      assert(jqCall.length === 2 && jqCall[0].beatId === "call" && jqCall[1].beatId === "reveal",
        "响铃与接起要在同一个月连弹（got " + jqCall.map(function (x) { return x.beatId; }).join(",") + "）");
      assert(jqCall[1].body.indexOf(jrCall.career.bonds.junior.aliasNow) >= 0,
        "接起拍要报出真名");
      assert(jqCall[1].body.indexOf("{") < 0, "接起拍不能漏出占位符");

      // 门禁：公司已成立 + 当月有在研目录作，两个条件都满足电话才响。
      // 只按作品窗口判不够——暖暖环游世界开发期从 2012-06 起，叠纸 2013 才成立。
      function callBeatsAt(year, companyId) {
        let s = hired("art");
        s = sim.startCareerLine(s, "bond-junior", config).state;
        s.career.bonds.junior.revealCompanyId = companyId;
        s.year = year;
        jumpBeat(s, "bond-junior", "call");
        const q = [];
        sim.processCareerLines(s, config, q, []);
        return q.map(function (x) { return x.beatId; }).join(",");
      }
      assert(callBeatsAt(1997, "mihoyo") === "", "公司还没成立时，这通电话不该响");
      assert(callBeatsAt(2013, "hypergryph") === "", "鹰角 2017 才成立，2013 年不该有这通电话");
      assert(callBeatsAt(2013, "mihoyo") === "call,reveal", "公司已成立且在研时，电话要响");

      // 那家公司彻底不出新作了（世界目录里它的窗口已全部过去）→ 这通电话不会来，
      // 线要在 finale 正常收束，不能永久挂在 call 拍上。
      let jrGone = hired("art");
      jrGone = sim.startCareerLine(jrGone, "bond-junior", config).state;
      jrGone.career.bonds.junior.revealCompanyId = "mihoyo";
      jrGone.year = 2035;
      jumpBeat(jrGone, "bond-junior", "call");
      const jqGone = [];
      sim.processCareerLines(jrGone, config, jqGone, []);
      assert(jqGone.length === 0, "公司已无新作在研时，电话不该来");
      assert(jrGone.career.lines["bond-junior"].status === "done",
        "电话不来的线要在 finale 收束，不能留在挂起状态");

      // juniorLeave 必须持久。旧行为只设 colocated=false，下一回合被
      // refreshCareerBondColocation 按"老家公司 == 现公司"重算回 true —— 人走了又坐回旁边。
      let jrLeft = hired("art");
      jrLeft = sim.startCareerLine(jrLeft, "bond-junior", config).state;
      jrLeft = sim.resolveCareerLineChoice(jrLeft, "bond-junior", "finale", "recommend", config).state;
      assert(jrLeft.career.bonds.junior.colocated === false, "『推荐去别的工作室』当帧即为异地");
      jrLeft = sim.tickMonth(jrLeft, config).state;
      assert(jrLeft.career.bonds.junior.colocated === false, "过月后仍是异地：离队要持久，不能被位置重算拉回");

      // 回国线的揭晓是兜底路径：后辈线自己已经揭晓过，就别再演第二遍反转
      const retReveal = (lineDef("era-return-china").beats || []).filter(function (b) {
        return b.id === "reveal";
      })[0];
      assert(retReveal && retReveal.skipIf && retReveal.skipIf.juniorRevealed === true,
        "回国线揭晓要在已揭晓时跳过");
      let retSkip = hired("programmer");
      retSkip = sim.startCareerLine(retSkip, "bond-junior", config).state;
      retSkip.career.bonds.junior.revealed = true;
      retSkip.year = 2014;
      const retSkipStep = sim.resolveCareerLineChoice(
        sim.startCareerLine(retSkip, "era-return-china", config).state,
        "era-return-china", "letter", "read", config);
      assert(!(retSkipStep.queue || []).some(function (p) { return p.beatId === "reveal"; }),
        "已揭晓时回国线不再重复演揭晓");

      // 揭晓之前，同一段文案应当显示当时的称呼（而不是真名）
      let jrEarly = hired("art");
      jrEarly = sim.startCareerLine(jrEarly, "bond-junior", config).state;
      assert(jrEarly.career.bonds.junior.revealed !== true, "开线时还没揭晓");
      jumpBeat(jrEarly, "bond-junior", "copy");
      const jqEarly = [];
      sim.processCareerLines(jrEarly, config, jqEarly, []);
      assert(jqEarly.length && jqEarly[0].body.indexOf("{") < 0, "早期拍正文不能漏出占位符");
      assert(jqEarly[0].body.indexOf(jrEarly.career.bonds.junior.aliasThen) >= 0,
        "揭晓前要用当时的称呼（aliasThen）");

      // 前辈线兜底：尾拍 leave 被跳过时不能再静默完结（旧行为：leave 是最后一拍，
      // skipIf.noMentorSuccessor 命中 -> advanceSkippedBeats 直接 completeLine）
      const mentorBeats = lineDef("bond-mentor").beats || [];
      const leavePos = mentorBeats.map(function (b) { return b.id; }).indexOf("leave");
      assert(leavePos >= 0 && leavePos < mentorBeats.length - 1, "leave 之后要有兜底拍，不能再当尾拍");
      assert(mentorBeats[mentorBeats.length - 1].skipIf == null, "兜底拍必须无条件可触发");

      ok("bond lines echo their choices, endings split, junior reveals");
    })();

    // ── 回国/跳槽邀约不能把玩家挂到"还没开工"的目录作上 ──────────────────────
    // 旧行为：pickScriptedInviteTitle 找不到当月真在研的作时兜底 nextCatalogTitle（下一档
    // 还没开工的真作），玩家被挂在几年后才开工的作上，过月被判空窗，一两个月后被自动塞
    // 一部虚拟作——表现就是"我在做暖暖环游世界，过月怎么变成另一个虚拟游戏了"。
    (function careerInviteNeverFabricatesATitle() {
      const eraLine = ((world.eventLines || {}).lines || []).filter(function (l) {
        return l.id === "era-return-china";
      })[0];
      assert(eraLine && eraLine.startWhen && eraLine.startWhen.requireInDevTarget === true,
        "回国线 startWhen 必须带 requireInDevTarget");
      function onNikki(year, month) {
        const g = hired("programmer");
        g.year = year;
        g.month = month;
        g.career.companyId = "paperGames";
        g.career.studioId = "paperGames-main";
        g.career.titleId = "nikkiWorld";
        g.career.liveStats = sim.careerLiveFromTitle(g, sim.careerTitle("nikkiWorld", config, g), config);
        g.career.bonds = g.career.bonds || {};
        g.career.bonds.junior = {
          id: "bond-junior", aliasThen: "小T", aliasNow: "海猫络合物",
          revealCompanyId: "hypergryph", revealTitleId: "arknights",
          revealed: true, companyId: "paperGames"
        };
        return g;
      }
      // 2012：鹰角还没有任何在研目录作（明日方舟 2017.5 才开工）→ 邀约落点不成立。
      let early = onNikki(2012, 6);
      assert(!sim.hasCareerReturnTarget(early, config), "2012 年鹰角没有在研目录作");
      const credsBefore = (early.career.credits || []).length;
      sim.applyScriptedCareerInvite(early, "returnStaff", config);
      assert(early.career.companyId === "paperGames", "没有落点就不换东家");
      assert(early.career.titleId === "nikkiWorld", "没有落点就继续做手上的作");
      assert((early.career.credits || []).length === credsBefore, "不给没开工的作发署名");
      // 2017.6：鹰角在研明日方舟了，落点成立，挂的是真在研的那部。
      const late = onNikki(2017, 6);
      assert(sim.hasCareerReturnTarget(late, config), "2017 年鹰角在研明日方舟");
      sim.applyScriptedCareerInvite(late, "returnStaff", config);
      assert(late.career.companyId === "hypergryph" && late.career.titleId === "arknights",
        "落点成立时挂到真在研的明日方舟");
      ok("return invite only lands on an in-dev catalog title");
    })();

    // ── 在研的目录作不被同公司别部（prestige 更高的 landmark）静默顶掉 ──────
    (function careerKeepsTheTitlePlayerIsOn() {
      const st2 = hired("programmer");
      st2.year = 2012;
      st2.month = 6;
      st2.career.companyId = "paperGames";
      st2.career.studioId = "paperGames-main";
      st2.career.titleId = "nikkiWorld";
      st2.career.liveStats = sim.careerLiveFromTitle(st2, sim.careerTitle("nikkiWorld", config, st2), config);
      assert(sim.pickCareerAssignment("paperGames", 2013, 3, config, st2, "paperGames-main").id === "miracleNikki",
        "2013.3 叠纸当月在研的 landmark 是奇迹暖暖");
      st2.year = 2013;
      st2.month = 3;
      sim.assignCareerProject(st2, config);
      assert(st2.career.titleId === "nikkiWorld", "奇迹暖暖开工不抢走在做暖暖环游世界的人");
      st2.year = 2014;
      st2.month = 1;
      sim.assignCareerProject(st2, config);
      assert(st2.career.titleId === "miracleNikki", "手上的作发售之后才换下一档");
      ok("assignCareerProject keeps an in-dev catalog title");
    })();

    // ── offer / 邀约准入：企业挖人是为了让人做事情 ──────────────────────────
    // 只挑"当年月真有在研目录作"的东家。挂进当月空着的公司 → 过月判空窗 → 被塞虚拟作。
    (function offersAndInvitesRequireAnInDevTitle() {
      assert(sim.mobilityRequireInDevTitle(config, "offer") === true, "准入默认开：offer");
      assert(sim.mobilityRequireInDevTitle(config, "invite") === true, "准入默认开：invite");
      assert(sim.mobilityRequireInDevTitle(config, "scripted") === true, "准入默认开：scripted");
      function withRequireInDevTitle(spec) {
        return Object.assign({}, config, {
          careerWorld: Object.assign({}, world, {
            mobility: Object.assign({}, world.mobility, { requireInDevTitle: spec })
          })
        });
      }
      const allOff = withRequireInDevTitle(false);
      assert(sim.mobilityRequireInDevTitle(allOff, "offer") === false, "false = 全关");
      assert(sim.mobilityRequireInDevTitle(allOff, "scripted") === false, "false = 全关");
      const offerOff = withRequireInDevTitle({ offer: false });
      assert(sim.mobilityRequireInDevTitle(offerOff, "offer") === false, "分面关：offer");
      assert(sim.mobilityRequireInDevTitle(offerOff, "invite") === true, "分面关不影响其它面");

      // 公司当月"有没有活"：目录作才算，虚拟作不算（虚拟作本身就是空窗的产物）。
      const probe = hired("programmer");
      probe.career.companyId = "kojimaProductions";
      probe.career.studioId = "kojimaProductions-main";
      probe.year = 2015;
      probe.month = 9;
      assert(!sim.companyInDevCatalogTitle("kojimaProductions", probe, config, null),
        "2015.9 小岛组还没有在研目录作（死亡搁浅 2017.11 才开工）");
      probe.year = 2018;
      probe.month = 6;
      assert(sim.companyInDevCatalogTitle("kojimaProductions", probe, config, null).id === "deathStranding",
        "2018 小岛组在研死亡搁浅");
      const virtualOnly = sim.clone(probe);
      virtualOnly.year = 2016;
      virtualOnly.month = 6;
      virtualOnly.career.companyId = "sega";
      virtualOnly.career.studioId = "sega-am2";
      assert(!sim.companyInDevCatalogTitle("sega", virtualOnly, config, null),
        "2016 世嘉目录表里没有在研作");
      virtualOnly.career.virtualProjects = [{
        id: "virt-sega-1", companyId: "sega", studioId: "sega-am2", name: "自研作",
        releaseYear: 2017, releaseMonth: 6, landmark: false, prestige: 2, virtual: true
      }];
      virtualOnly.career.virtualDetails = [{
        id: "virt-sega-1", devStartYear: 2016, devStartMonth: 1, devMonths: 18, virtual: true
      }];
      assert(sim.pickCareerAssignment("sega", 2016, 6, config, virtualOnly, "sega-am2").virtual,
        "pickCareerAssignment 认得自家自研作");
      assert(!sim.companyInDevCatalogTitle("sega", virtualOnly, config, null),
        "虚拟作不算『有活干』");

      // 年底 offer：每一格都得说得出"你来做哪部"，且那部当月真在研。
      let named = 0;
      [["konami", 1998], ["sega", 1996], ["konami", 2004], ["sega", 2010],
        ["konami", 2016], ["sega", 2018], ["konami", 2024]].forEach(function (row) {
        const g = hired("programmer");
        g.year = row[1];
        g.month = 12;
        g.career.companyId = row[0];
        g.career.studioId = row[0] === "sega" ? "sega-am2" : "konami-main";
        g.career.fame = 60;
        sim.listYearEndOffers(g, config).forEach(function (o) {
          if (o.kind) return; // 内部晋升格不受准入约束
          named += 1;
          assert(!!o.titleId, "offer 必须带在研的目标作品 " + row[0] + " " + row[1]);
          const t = sim.careerTitle(o.titleId, config, g);
          const d = sim.careerTitleDetail(o.titleId, config, g);
          assert(!!(t && d && sim.titleCoversMonth(t, d, row[1], 12)),
            "offer 的目标作品当月必须在研 " + o.titleId);
        });
      });
      assert(named >= 20, "多年 offer 不该空（有活的东家有的是），实得 " + named);

      // 挖人邀请：邀请挂的作当月必须在研，邀请方公司也必须在研。
      let invited = 0;
      for (let y = 1996; y <= 2024; y += 4) {
        const g = hired("programmer");
        g.year = y;
        g.month = 4;
        g.career.companyId = "konami";
        g.career.studioId = "konami-main";
        g.career.fame = 90;
        sim.listCareerInvites(g, config).forEach(function (inv) {
          invited += 1;
          const t = sim.careerTitle(inv.titleId, config, g);
          const d = sim.careerTitleDetail(inv.titleId, config, g);
          assert(!!(t && d && sim.titleCoversMonth(t, d, y, 4)),
            "挖人邀请的目标作品当月必须在研 " + inv.titleId);
          assert(!!sim.companyInDevCatalogTitle(inv.companyId, g, config, null),
            "邀请方当月必须有在研目录作 " + inv.companyId);
        });
      }
      assert(invited > 0, "多年挖人邀请不该空，实得 " + invited);

      // 真接一格 offer 走一遍：入职当场就该挂到 offer 上写的那部，而不是空窗。
      let landed = 0;
      [["konami", 2000], ["sega", 2008], ["konami", 2016], ["sega", 2018]].forEach(function (row) {
        const g = hired("programmer");
        g.year = row[1];
        g.month = 12;
        g.career.companyId = row[0];
        g.career.studioId = row[0] === "sega" ? "sega-am2" : "konami-main";
        g.career.fame = 60;
        const offers = sim.listYearEndOffers(g, config).filter(function (o) { return !o.kind; });
        assert(offers.length > 0, "有 offer 可接 " + row[0] + " " + row[1]);
        g.career.yearEndOffers = offers;
        const take = offers[0];
        take.successChance = 1;
        const res = sim.applyYearEndOffer(g, take.id, config);
        assert(res.ok && res.hopped, "接 offer 成功 " + row[0] + " " + row[1]);
        assert(res.state.career.titleId === take.titleId, "入职就挂到 offer 写的那部");
        assert(!sim.careerProjectView(res.state, config).idle, "接完 offer 不是空窗");
        landed += 1;
      });
      assert(landed === 4, "4 次入职都落到在研作上");

      // 剧情邀约的选项门禁（没有落点时不给选项）与效果兜底（给了也不动人）。
      const peerFinale = (((world.eventLines || {}).lines || []).filter(function (l) {
        return l.id === "bond-peer";
      })[0].beats || []).filter(function (b) { return b.id === "finale-path"; })[0];
      const optOf = function (id) {
        return (peerFinale.options || []).filter(function (o) { return o.id === id; })[0];
      };
      assert(optOf("hop").skipIf && optOf("hop").skipIf.noStrongHopTarget === true,
        "『跳去别家』要挂 noStrongHopTarget 门禁");
      assert(optOf("epic").skipIf && optOf("epic").skipIf.noPeerEpicTarget === true,
        "『搭史诗作』要挂 noPeerEpicTarget 门禁");
      assert(optOf("studio-move").skipIf && optOf("studio-move").skipIf.noOtherStudioInDev === true,
        "『调去另一个工作室』要挂 noOtherStudioInDev 门禁");

      const late = hired("programmer");
      late.year = 2025;
      late.month = 12;
      late.career.companyId = "konami";
      late.career.studioId = "konami-main";
      assert(!sim.hasPeerEpicTarget(late, config), "2025.12 没有别家在研的史诗作 → 不给这个选项");
      const soleWork = hired("programmer");
      soleWork.year = 2025;
      soleWork.month = 12;
      soleWork.career.companyId = "netease";
      assert(sim.hasStrongHopTarget(soleWork, config) === false,
        "2025.12 只剩自家在研 → 没有『别家』可跳");
      const noEpicCfg = Object.assign({}, config, {
        careerWorld: Object.assign({}, world, {
          eventLines: Object.assign({}, world.eventLines, {
            bonds: Object.assign({}, world.eventLines.bonds, {
              peerEpic: Object.assign({}, world.eventLines.bonds.peerEpic, { minPrestige: 99 })
            })
          })
        })
      });
      assert(!sim.hasPeerEpicTarget(hired("programmer"), noEpicCfg), "门槛抬到 99 就没有候选");
      const withRolls = hired("programmer");
      const rngBefore = withRolls.rngCount;
      sim.hasStrongHopTarget(withRolls, config);
      sim.hasPeerEpicTarget(withRolls, config);
      assert(withRolls.rngCount === rngBefore, "选项判定不能掷骰（否则每帧评估都会搅乱随机流）");

      // 前辈线「跟着走」：新东家没活就原地不动，有活才走。
      function atKonami(year) {
        const s = hired("programmer");
        s.year = year;
        s.month = 6;
        s.career.companyId = "konami";
        s.career.studioId = "konami-main";
        s.career.titleId = null;
        s.career.bonds = s.career.bonds || {};
        s.career.bonds.mentor = {
          seniorId: "kojima", name: "小岛秀夫", alias: "小岛秀夫", title: "制作人",
          companyId: "konami", homeCompanyId: "konami", colocated: true,
          departYear: 2015, successorCompanyId: "kojimaProductions"
        };
        return s;
      }
      const stuck = atKonami(2015);
      sim.applyScriptedCareerInvite(stuck, "mentorSuccessor", config);
      assert(stuck.career.companyId === "konami", "小岛组 2015 没活 → 跟着走不成立，原地不动");
      const moved = atKonami(2018);
      sim.applyScriptedCareerInvite(moved, "mentorSuccessor", config);
      assert(moved.career.companyId === "kojimaProductions", "新东家有活 → 跟着走成立");
      assert(moved.career.titleId === "deathStranding", "落点是真在研的死亡搁浅");
      ok("offers and invites only land on an in-dev catalog title");
    })();

    st = hired("programmer");
    st.career.jobRank = 1;
    st.career.promotionsThisYear = 0;
    const reqs = ((world.jobRanks.promotion || {}).requirements || [])[1] || {};
    const progRole = sim.careerRole(st.career.roleId, config);
    const progKey = (progRole && progRole.stat) || "program";
    st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
    st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
    st.career.stats = st.career.stats || {};
    st.career.stats[progKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
    st.career.fame = (reqs.fameOrHonor || 0) + 1;
    st.career.credits = [{ titleId: "c0", shipped: true, virtual: false, jobRank: 1 }];
    const first = sim.promoteCareer(st, config);
    assert(first.ok && first.state.career.jobRank === 2, "click promo 1→2");
    st = first.state;
    assert(st.career.promotionsThisYear >= 1, "year cap used");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.state.career.jobRank === 2, "second story promo same year delayed");
    assert(step.state.career.pendingStoryPromos >= 1, "pending story promo queued");
    st = step.state;
    st.month = 1;
    st.year += 1;
    st.career.promotionsThisYear = 0;
    sim.applyPendingStoryPromos(st, config);
    assert(st.career.jobRank === 3, "delayed story promo settles in January");
    ok("year promo cap delays second story promo");
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
    assert(openingSmall.length >= 16, "opening small pool " + openingSmall.length);
    const openingBig = companies.filter(function (c) { return c.openingOffer && c.starterTier && c.power === 3; });
    assert(openingBig.length <= 3, "few opening 大厂 " + openingBig.map(function (c) { return c.id; }).join(","));
    assert(companies.filter(function (c) { return c.id === "nintendo"; })[0].openingOffer === false, "nintendo not opening");
    const paper = companies.filter(function (c) { return c.id === "paperGames"; })[0];
    const crytek = companies.filter(function (c) { return c.id === "crytek"; })[0];
    assert(paper && paper.joinable === true && (paper.seniors || []).length >= 1, "paperGames hop pool");
    assert(crytek && crytek.joinable === true && (crytek.seniors || []).length >= 1, "crytek hop pool");
    assert(sim.companyJoinable(paper, 2013), "paperGames hire from 2013");
    assert(!sim.companyJoinable(paper, 2012), "paperGames closed before 2013");
    assert(sim.companyJoinable(crytek, 1999), "crytek hire from 1999");
    assert(!sim.companyJoinable(crytek, 1998), "crytek closed before 1999");
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
    const unjoinable = companies.filter(function (c) { return c.joinable === false; });
    assert(unjoinable.length >= 8, "unjoinable world houses " + unjoinable.length);
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
    assert(world.devEvents.minGapMonths === 2 && world.devEvents.pityMonths === 6 && world.devEvents.maxPerYear === 5, "devEvent cadence keys");
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
      } else {
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
    const vp = world.virtualPool || {};
    assert(vp.devMonthsMin === 6 && vp.devMonthsMax === 24, "virtual pool 6-24");
    const gap = world.idleGap || {};
    assert(gap.minDevMonths === 6, "idleGap minDevMonths");
    assert(gap.eventId && (gap.choices || []).length >= 3, "idleGap choices");
    ["secondment", "crossTrain", "hone"].forEach(function (id) {
      assert((gap.choices || []).some(function (c) { return c.id === id; }), "idleGap choice " + id);
    });
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

  (function careerTickAdvancesAndPhaseUntil() {
    const g = sim.createCareerGame("测", "design", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const before = acc.state.career.savings;
    const r = sim.tickMonth(acc.state, config);
    assert(r.state.month === 2 && r.state.year === 1995, "feb 1995");
    assert(r.state.phase !== "BANKRUPT", "no company bankrupt");
    assert(r.state.career.savings === before + acc.state.career.salary, "savings plus salary, no living cost");
    assert(r.state.career.lastPay === acc.state.career.salary, "lastPay recorded");
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

  // 评奖门槛（绝对+相对取严）、评审抖动、保底，以及「玩家之选」真的读销量。
  (function careerAwardGateJuryAndSales() {
    function probeState(rows, seed) {
      const g = sim.createCareerGame("测", "music", config);
      const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      st.rngSeed = seed == null ? 7 : seed;
      st.year = 1997;
      st.month = 11;
      st.worldReleased = rows.map(function (r, i) {
        return {
          id: "probe" + i,
          name: "探针" + i,
          alias: "探针" + i,
          companyId: "square",
          score: r.score,
          avg: r.score,
          stats: r.stats,
          prestige: r.prestige == null ? 3 : r.prestige,
          releaseType: "boxed",
          releasedYear: 1997,
          releasedMonth: 6,
          launchSales: r.sales == null ? 100000 : r.sales
        };
      });
      return st;
    }
    function gotyOf(st, cfg) {
      return sim.runCareerAwards(st, cfg || config, []).filter(function (a) { return a.id === "goty"; })[0];
    }
    const stats = function (v) { return { play: v, fun: v, expression: v, immersion: v }; };
    const elite = { score: 9.5, stats: stats(95) };   // awardScore ≈ 95
    const mid = { score: 6.5, stats: stats(57) };     // awardScore ≈ 58.6
    const fodder = { score: 6, stats: stats(50) };    // awardScore ≈ 52，低于绝对线 55

    // 4 精锐 + 4 中庸：中位数 76.8 把门槛抬到 76.8，只有精锐进提名 → 4 部
    const mixed = [elite, elite, elite, elite, mid, mid, mid, mid];
    assert(gotyOf(probeState(mixed)).nominees.length === 4, "median line trims the ballot to the elite");
    // 放开相对线 → 门槛落回绝对线 55 → 全池达标 → 提名补满
    const loose = deepClone(config);
    loose.awards.score.gate.medianMul = 0.5;
    assert(gotyOf(probeState(mixed), loose).nominees.length === (config.awards.nomineeCount || 5), "loosening the relative line fills the ballot");
    // 全池都够不上绝对线 → 保底取全池，奖项不空缺
    const weak = gotyOf(probeState([fodder, fodder, fodder, fodder, fodder, fodder]));
    assert(weak.nominees.length > 0 && weak.w && weak.w !== "—", "all-fodder year still crowns someone");
    // 分差大 → 强者稳定胜出，换种子也不翻
    let stable = true;
    for (let seed = 1; seed <= 10; seed++) {
      if (gotyOf(probeState([elite, mid], seed)).nominees[0].titleId !== "probe0") stable = false;
    }
    assert(stable, "a wide awardScore gap survives jury jitter");
    // 玩家之选按销量排：高销量低 prestige 必须压过高 prestige 低销量
    const choice = sim.runCareerAwards(probeState([
      { score: 8, stats: stats(80), prestige: 5, sales: 1000 },
      { score: 8, stats: stats(80), prestige: 2, sales: 5000000 }
    ]), config, []).filter(function (a) { return a.id === "playersChoice"; })[0];
    assert(choice.nominees[0].titleId === "probe1", "players choice follows sales, not prestige");
    ok("award gate takes the stricter line, wide gaps survive jitter, sales drives players choice");
  })();

  (function careerAwards1997LiveCompare() {
    const g = sim.createCareerGame("测", "music", config);
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[1].id, config);
    let st = acc.state;
    st.rngSeed = 11;
    let guard = 0;
    while (!(st.year === 1997 && st.month === 11) && guard < 80) {
      st = sim.tickMonth(st, config).state;
      guard += 1;
    }
    assert(st.year === 1997 && st.month === 11, "reached 1997.11 in " + guard);
    const r = sim.tickMonth(st, config);
    const pack = r.state.lastAwards;
    // 剧情页必须和「这一年玩家首次被卷进奖项」对齐：首次 → 恰好一页，重复年 → 一页都没有。
    const involved = pack.some(function (a) { return a.playerNominated || a.playerWon; });
    const hadFlag = !!(st.career.awardStory && st.career.awardStory.nominated);
    const storyPages = (r.queue || []).filter(function (p) { return p.type === "story"; });
    assert(storyPages.length <= 1, "at most one award story page per tick, got " + storyPages.length);
    assert(storyPages.length === ((involved && !hadFlag) ? 1 : 0),
      "story page queued exactly on first involvement, involved=" + involved + " had=" + hadFlag);
    if (storyPages.length) {
      assert(r.state.career.awardStory && r.state.career.awardStory.nominated, "story flag persisted on state");
      assert(storyPages[0].kicker && storyPages[0].title && storyPages[0].body, "story page carries copy");
    }
    assert(pack && pack.length === config.awards.list.length, "awardPack size");
    pack.forEach(function (a) {
      assert(a.id && a.n && a.w, "award row " + a.id);
      assert(Array.isArray(a.nominees), "nominees array " + a.id);
      assert(a.nominees.length <= (config.awards.nomineeCount || 5), "nominee cap " + a.id);
      if (a.id !== "bestLiveOps") {
        assert(a.nominees.length === (config.awards.nomineeCount || 5), "5 nominees " + a.id + " got " + a.nominees.length);
        assert(a.nominees[0] && a.nominees[0].label === a.w, "winner from nominees " + a.id);
      } else {
        assert(a.nominees.length === 0 || a.nominees[0].label === a.w, "liveops winner from nominees or empty");
      }
    });
    const ff7 = (r.state.worldReleased || []).filter(function (t) { return t.id === "ff7"; })[0];
    assert(ff7, "ff7 shipped into window");
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    const even = { stats: { play: 40, fun: 40, expression: 40, immersion: 40 } };
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "compare still uses stats");
    assert(r.state.phase !== "BANKRUPT", "1997 tick no bankrupt");
    const hist = r.state.awardsHistory;
    assert(Array.isArray(hist) && hist.length >= 3, "awardsHistory years " + (hist && hist.length));
    const years = hist.map(function (h) { return h.year; });
    assert(years.indexOf(1995) >= 0 && years.indexOf(1996) >= 0 && years.indexOf(1997) >= 0, "history has 95-97");
    const listed = sim.listAwardsHistory(r.state, config);
    assert(listed[0] && listed[0].year === 1997, "listAwardsHistory newest first");
    pack.forEach(function (a) {
      assert(typeof a.playerWon === "boolean", "playerWon flag " + a.id);
      assert(a.year === 1997, "award year stamped " + a.id);
      assert(a.n.indexOf("1997") < 0, "category name has no year " + a.n);
    });
    const night = r.queue.filter(function (p) { return p.type === "awards"; })[0];
    assert(night && night.title === "1997年颁奖夜", "night title has year");
    assert(night.kicker === "1997年度盛典", "night kicker has year");
    ok("career 1997.11 awardPack live compare, no historical winner assert");
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

  (function careerDevEventCadence() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 2;
    tweaked.careerWorld.devEvents.pityMonths = 6;
    tweaked.careerWorld.devEvents.maxPerYear = 5;
    tweaked.careerWorld.devEvents.list = [{
      id: "cadenceProbe",
      displayName: "节奏探针",
      text: "测",
      presentation: "notice",
      qualityDim: "program",
      qualityDelta: 1
    }];
    function primed(year, month) {
      const g = sim.createCareerGame("测", "programmer", tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
      st.career.postLaunch = null;
      st.career.lastDevEventYm = null;
      st.career.devEventYear = year;
      st.career.devEventsThisYear = 0;
      st.rngSeed = 1;
      st.rngCount = 0;
      return st;
    }
    const jan = primed(1995, 1);
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "first month can fire");
    assert(jan.career.devEventsThisYear === 1, "year count 1");
    jan.month = 2;
    assert(!sim.rollCareerDevEvent(jan, tweaked, []), "min gap blocks next month");
    jan.month = 3;
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "fires after min gap");

    const pity = primed(1995, 7);
    pity.career.lastDevEventYm = sim.monthIndex(1995, 1);
    pity.career.devEventsThisYear = 1;
    tweaked.careerWorld.devEvents.chance = 0;
    assert(sim.rollCareerDevEvent(pity, tweaked, []), "pity fires at 6 months");

    tweaked.careerWorld.devEvents.chance = 1;
    const cap = primed(1995, 11);
    cap.career.lastDevEventYm = sim.monthIndex(1995, 1);
    cap.career.devEventsThisYear = 5;
    assert(!sim.rollCareerDevEvent(cap, tweaked, []), "max 5 per year");
    cap.year = 1996;
    cap.month = 1;
    cap.career.lastDevEventYm = sim.monthIndex(1995, 11);
    assert(sim.rollCareerDevEvent(cap, tweaked, []), "new year resets cap");

    const lineSkip = primed(1995, 6);
    lineSkip.career.lastDevEventYm = null;
    const q = [];
    const notes = [];
    if (sim.processCareerLines) sim.processCareerLines(lineSkip, tweaked, q, notes);
    const rolled = sim.rollCareerDevEvent(lineSkip, tweaked, notes);
    assert(rolled, "line-free month still rolls random");
    ok("career dev event cadence 4 months / 3-5 year");
  })();

  (function careerJobRankResumeAndPromotion() {
    const world = config.careerWorld;
    const ranks = world.jobRanks || {};
    const steps = (((world.personalEconomy || {}).salary || {}).steps) || [];
    const nintendo = sim.careerCompany("nintendo", config);
    const sega = sim.careerCompany("sega", config) || (world.companies || []).filter(function (c) { return c.power === 2; })[0];
    let g = sim.createCareerGame("测", "design", config);
    assert(g.career.jobRank === 1, "design starts Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "策划实习生", "design intern title");
    assert(sim.formatCareerRankLabel("design", 1, config) === "策划实习生 (D-0)", "design intern code");
    g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    assert(g.career.growthStage === "employee", "still employee after hire");
    assert((g.career.tenures || []).length === 1, "opening tenure written");
    assert(g.career.tenures[0].source === "opening", "tenure source opening");
    assert(g.career.tenures[0].jobRank === 1, "tenure rank 1");
    assert(!sim.canPromoteCareer(g, config), "fresh hire cannot promote yet");

    const base = Number((world.player && world.player.monthlyContribution) != null ? world.player.monthlyContribution : 2);
    const low = sim.createCareerGame("测", "programmer", config);
    const high = sim.clone(low);
    high.career.jobRank = 6;
    high.career.stats = { program: 90, design: 17, art: 17, music: 17 };
    const c1 = sim.careerMonthlyContribution(low, config);
    const c6 = sim.careerMonthlyContribution(high, config);
    assert(c1 < c6, "higher rank+stat contrib " + c1 + " -> " + c6);
    assert(c1 < base, "Lv.1 contrib below old 2, got " + c1);
    assert(c6 > base, "Lv.6 high-stat contrib above 2, got " + c6);

    const floor6 = (ranks.salaryFloor || [])[6];
    const poor = sim.clone(g);
    poor.career.jobRank = 6;
    poor.career.stats = { program: 34, design: 34, art: 34, music: 34 };
    poor.career.fame = 0;
    poor.career.honor = 0;
    poor.year = 1995;
    const floored = sim.careerSalaryFor(sega || nintendo, 1995, config, poor.career);
    assert(steps.indexOf(floored) >= 0, "floored salary in steps");
    assert(floored >= floor6, "Lv.6 salary floor " + floored + " >= " + floor6);

    const wLow = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, low);
    const wHigh = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, high);
    assert(wHigh > wLow, "higher rank weighs player more in score " + wLow + " -> " + wHigh);

    const attrLow = sim.clone(low);
    const attrHigh = sim.clone(low);
    attrLow.career.jobRank = 4;
    attrHigh.career.jobRank = 4;
    attrLow.career.stats = { program: 30, design: 17, art: 17, music: 17 };
    attrHigh.career.stats = { program: 80, design: 17, art: 17, music: 17 };
    const aLow = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, attrLow);
    const aHigh = sim.liveToPublicScore({ play: 90, fun: 90, expression: 90, immersion: 90 }, 7, config, attrHigh);
    assert(aHigh > aLow, "higher mainStat weighs player more at same rank " + aLow + " -> " + aHigh);

    const chanceLow = sim.careerHireChance(nintendo, low, config);
    const chanceHigh = sim.careerHireChance(nintendo, high, config);
    assert(chanceHigh > chanceLow, "high rank hireChance higher");
    assert(chanceLow === 0, "nintendo power3 minRank blocks Lv.1, got " + chanceLow);

    function makePromotable(st, rank) {
      const reqs = ((ranks.promotion || {}).requirements || [])[rank] || {};
      const role = sim.careerRole(st.career.roleId, config);
      const statKey = (role && role.stat) || "program";
      st.career.jobRank = rank;
      st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
      st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
      st.career.stats = st.career.stats || {};
      st.career.stats[statKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
      st.career.fame = (reqs.fameOrHonor || 0) + 1;
      st.career.honor = 0;
      st.career.promotionsThisYear = 0;
      st.career.lastPromotionYear = null;
      st.career.credits = [];
      let n = 0;
      const need = reqs.creditedTitles || 0;
      while (n < need) {
        n += 1;
        st.career.credits.push({
          titleId: "cred-" + n,
          companyId: st.career.companyId,
          roleId: st.career.roleId,
          jobRank: rank,
          shipped: true,
          virtual: false
        });
      }
      return st;
    }

    let st = sim.clone(g);
    st = makePromotable(st, 1);
    assert(sim.canPromoteCareer(st, config), "eligible after meeting gates");
    const lowStat = sim.clone(st);
    const designKey = (sim.careerRole(lowStat.career.roleId, config) || {}).stat || "design";
    lowStat.career.stats[designKey] = 20;
    assert(!sim.canPromoteCareer(lowStat, config), "low mainStat blocks even with jobXp");
    const blocked = sim.promoteCareer(lowStat, config);
    assert(!blocked.ok && blocked.error === sim.ERR.CAREER_PROMOTE_LOCKED, "click promo blocked by mainStat");
    sim.applyCareerPromotion(lowStat, config, { story: true });
    assert(lowStat.career.jobRank === 2, "story promo skips mainStat gate");
    const before = st.career.jobRank;
    const silent = sim.clone(st);
    const ticked = sim.tickMonth(silent, config).state;
    assert(ticked.career.jobRank === before, "tick does not auto promote");
    const promo = sim.promoteCareer(st, config);
    assert(promo.ok, "promote ok");
    assert(promo.state.career.jobRank === 2, "clicked up to Lv.2");
    assert(promo.state.career.growthStage === "employee", "promotion does not change growthStage");
    assert(sim.careerJobTitleLabel(promo.state, config) === "初级策划", "design junior title");
    assert(sim.formatCareerRankLabel("design", 2, config) === "初级策划 (D-1)", "design junior code");
    assert((promo.state.career.tenures || []).filter(function (t) { return t.source === "promotion"; }).length === 1, "promotion tenure");
    assert(!sim.canPromoteCareer(promo.state, config), "one promo per year");
    const again = sim.promoteCareer(promo.state, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_PROMOTE_LOCKED, "second promo blocked");

    let hop = sim.clone(promo.state);
    hop.career.yearEndOffers = [{
      id: "ye-rank-hop",
      companyId: "square",
      studioId: ((sim.careerCompany("square", config).studios || [])[0] || {}).id,
      roleId: "design",
      jobRank: hop.career.jobRank,
      salary: 8000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hop, "ye-rank-hop", config);
    assert(hopped.ok && hopped.hopped, "hop ok");
    assert(hopped.state.career.jobRank === 2, "hop keeps rank");
    assert(hopped.state.career.growthStage === "employee", "hop still employee");

    let top = sim.clone(g);
    top.career.jobRank = 6;
    top.career.jobTitleId = "des-director";
    top.career.monthsInRank = 99;
    top.career.jobXp = 999;
    top.career.fame = 99;
    top.career.credits = [{ titleId: "x", shipped: true, virtual: false }];
    top.career.promotionsThisYear = 0;
    assert(!sim.canPromoteCareer(top, config), "Lv.6 cannot promote");
    const fake = sim.promoteCareer(top, config);
    assert(!fake.ok, "Lv.6 promote fails");
    assert(top.career.growthStage === "employee", "Lv.6 still employee");

    const resume = sim.careerResumeView(promo.state, config);
    assert(resume.tenures.length >= 1, "resume tenures");
    const settle = sim.careerSettlementView(hopped.state, config);
    assert(settle.jobLabel, "settlement job label");
    assert(settle.growthStage === "employee", "settlement employee");
    assert(settle.creditedCount >= 0, "settlement credited count");

    const shipSt = sim.clone(g);
    shipSt.career.titleId = "chronoTrigger";
    shipSt.career.companyId = "square";
    shipSt.career.liveStats = { program: 90, design: 90, art: 80, music: 80 };
    shipSt.career.credits = [];
    sim.shipPlayerTitle(shipSt, config, [], []);
    const shipped = (shipSt.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(shipped && shipped.shipped, "ship writes signed credit");
    assert(shipped.score != null, "ship writes score on credit");
    assert(shipSt.career.stats.design > g.career.stats.design, "main stat grows on ship");

    const evLow = { id: "fatalBug", minRank: undefined, maxRank: 3, qualityDelta: -6 };
    const evHigh = { id: "engineBreakthrough", minRank: 4, qualityDelta: 8 };
    const fatal = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "fatalBug"; })[0];
    const engine = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "engineBreakthrough"; })[0];
    assert(fatal && fatal.maxRank === 3, "junior negative event maxRank");
    assert(engine && engine.minRank === 4, "senior event minRank");
    void evLow; void evHigh;

    ok("job rank, click promotion, salary floor, resume, hop keeps rank, one promo/year, Lv.6 employee");
  })();

  (function careerResumeSalesAndFirstTgaStory() {
    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.worldReleased = [{
      id: "chronoTrigger", name: "时空之轮", alias: "时空之轮", companyId: st.career.companyId,
      releaseYear: 1995, releaseMonth: 12, releasedYear: 1995, releasedMonth: 12,
      score: 8.8, avg: 8.8, stats: { play: 80, fun: 80, expression: 80, immersion: 80 },
      launchSales: 1200000, lifetimeSales: 1200000
    }];
    st.career.credits = [
      { titleId: "chronoTrigger", companyId: st.career.companyId, studioId: st.career.studioId,
        roleId: "programmer", jobRank: 2, joinYear: 1995, joinMonth: 6, shipped: true, score: 8.8 },
      { titleId: "ghostTitle", companyId: st.career.companyId, studioId: st.career.studioId,
        roleId: "programmer", jobRank: 2, joinYear: 1995, joinMonth: 6, shipped: true, score: 7 }
    ];
    const creditOf = function (state, id) {
      return sim.careerResumeView(state, config).credits.filter(function (c) { return c.titleId === id; })[0];
    };
    assert(creditOf(st, "chronoTrigger").sales === 1200000, "resume carries the title's total sales");
    assert(creditOf(st, "ghostTitle").sales === null, "a credit with no release record shows no sales");
    // 目录作 / 后期加入的作品只盖 launchSales，也要读得到
    st.worldReleased.push({ id: "ghostTitle", name: "未记总销量", launchSales: 345000,
      releasedYear: 1995, releasedMonth: 12 });
    assert(creditOf(st, "ghostTitle").sales === 345000,
      "launchSales is the fallback when lifetimeSales is absent, got " + creditOf(st, "ghostTitle").sales);

    function freshState() {
      const gg = sim.createCareerGame("测", "programmer", config);
      return sim.acceptOpeningOffer(gg, gg.career.openingOffers[0].id, config).state;
    }
    const nomOnly = [{ id: "bestVisual", n: "最佳视觉", year: 1997, w: "别的作", playerWon: false,
      playerNominated: true,
      nominees: [{ label: "我的作", player: true }, { label: "别的作", player: false }] }];
    const gotyOnly = function (year) {
      return [{ id: "goty", n: "年度游戏", year: year, w: "我的作", playerWon: true, playerNominated: true,
        nominees: [{ label: "我的作", player: true }] }];
    };

    const s1 = freshState();
    const snap = JSON.stringify({ fame: s1.career.fame, honor: s1.career.honor,
      stats: s1.career.stats, savings: s1.career.savings });
    let pages = sim.collectCareerAwardStory(s1, config, nomOnly);
    assert(pages.length === 1 && pages[0].type === "story", "first nomination queues one story page");
    assert(pages[0].body.indexOf("我的作") >= 0 && pages[0].body.indexOf("最佳视觉") >= 0,
      "nomination story names the title and the award");
    assert(pages[0].body.length <= 100, "nomination story under 100 chars, got " + pages[0].body.length);
    assert(JSON.stringify({ fame: s1.career.fame, honor: s1.career.honor,
      stats: s1.career.stats, savings: s1.career.savings }) === snap, "story changes no stat");
    assert(sim.collectCareerAwardStory(s1, config, nomOnly).length === 0, "nomination story fires only once");

    // 同一届既有提名又拿了年度游戏 → 只出大奖那一条，提名剧情不再补播
    const s2 = freshState();
    const both = nomOnly.concat(gotyOnly(1997));
    pages = sim.collectCareerAwardStory(s2, config, both);
    assert(pages.length === 1 && pages[0].body.indexOf("年度游戏") >= 0,
      "same year keeps only the grand award story");
    assert(pages[0].body.length <= 100, "grand award story under 100 chars, got " + pages[0].body.length);
    assert(s2.career.awardStory && s2.career.awardStory.goty && s2.career.awardStory.nominated,
      "grand award marks both flags");
    assert(sim.collectCareerAwardStory(s2, config, both).length === 0, "grand award story fires only once");
    assert(sim.collectCareerAwardStory(freshState(), config, []).length === 0, "no awards, no story");
    // 世界作品得奖与玩家无关时不触发
    assert(sim.collectCareerAwardStory(freshState(), config, [{ id: "goty", n: "年度游戏", w: "别的作",
      playerWon: false, playerNominated: false, nominees: [{ label: "别的作", player: false }] }]).length === 0,
      "awards the player is not part of queue nothing");

    // 先提名、后获奖：两条各触发一次
    const s3 = freshState();
    assert(sim.collectCareerAwardStory(s3, config, nomOnly).length === 1, "earlier nomination fires once");
    assert(sim.collectCareerAwardStory(s3, config, gotyOnly(1999)).length === 1,
      "later grand award fires after an earlier nomination");
    assert(sim.collectCareerAwardStory(s3, config, gotyOnly(1999)).length === 0, "grand award fires only once");
    ok("resume shows total sales; first TGA nomination and first grand award each tell a story once");
  })();

  console.log("\n" + passed + " tests passed");
}

try {
  main();
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
