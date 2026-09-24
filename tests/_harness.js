#!/usr/bin/env node
"use strict";
//
// 测试沙箱 + 共享 helper（2026-09-22 由 run-sim-tests.js 拆分而来，
// 函数体一字不改；用例在 tests/cases/，本文件只负责加载与注入）。
//
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
  "events.js",
  "lifecycle.js",
  "media.js",
  "awards.js",
  "career.js",
  "career-colleagues.js",
  "career-awards.js",
  "career-events.js",
  "career-mobility.js",
  "career-bonds.js",
  "career-world-sim.js",
  "career-pace.js",
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


function createContext() {
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
  // ── P2c 共享 helper：挑一家「开局当月 + 次月都真实在研」的可入职公司 ──────────
  // cycleMult 把目录作的开工月整体前移，公司名 + 年份写死的旧写法会随档期漂移失效。
  // 需要「玩家确实在开发月」的用例统一走这里，只依赖「存在这样的公司」这一前提。
  function liveHostCompany(cfg) {
    const cw = cfg.careerWorld || {};
    const cal = cw.timeline || {};
    const det = {};
    (cw.titleDetails || []).forEach(function (d) { det[d.id] = d; });
    const covers = function (t, y, m) {
      return sim.titleCoversMonth(t, det[t.id], y, m, cfg);
    };
    const cos = cw.companies || [];
    for (let i = 0; i < cos.length; i++) {
      const c = cos[i];
      if (!sim.companyJoinable(c, cal.startYear)) continue;
      const live = (cw.titles || []).some(function (t) {
        return t.companyId === c.id && !t.virtual &&
          covers(t, cal.startYear, cal.startMonth) &&
          covers(t, cal.startYear, cal.startMonth + 1);
      });
      if (!live) continue;
      const studio = (cw.studios || []).filter(function (s) {
        return s.companyId === c.id;
      })[0];
      return { company: c, studio: studio || null };
    }
    return null;
  }
  // 走完「接受开局 offer → 换到 host 公司 → 推进到开发月」的公共样板。
  function enterLiveDevMonth(tweaked, seed, roleName, cfg) {
    const host = liveHostCompany(cfg || tweaked);
    assert(host, "a joinable company has a live catalog project at the opening month");
    const g = sim.createCareerGame(roleName || "测", "programmer", tweaked);
    g.rngSeed = seed;
    g.rngCount = 0;
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    let guard = 0;
    st.career.companyId = host.company.id;
    st.career.studioId = host.studio ? host.studio.id : null;
    st.career.titleId = null;
    st.career.liveStats = null;
    while (sim.careerProjectView(st, tweaked).idle && guard < 8) {
      st = sim.tickMonth(st, tweaked).state;
      guard += 1;
    }
    assert(!sim.careerProjectView(st, tweaked).idle, "reached a dev month");
    return st;
  }

  // P2c：注入「伪目录作」的用例，档期是测试自己造的，必须固定 cycleMult=1 ——
  // 否则真实作品的「发售日倒排」换算会把伪作的开工月前移，phase / progress 全部对不上。
  // 真正的 cycleMult 行为由 careerCycleMultShiftsDevStartKeepsRelease 单独覆盖。
  function fixCycle(cfg) {
    if (cfg && cfg.careerWorld && cfg.careerWorld.development) {
      cfg.careerWorld.development.cycleMult = 1;
    }
    return cfg;
  }

  // P2-fix：游戏池（titlePool）默认开启。池作 = 从池里抽出来顶空档的作品，
  // 覆盖补全 + 入职兜底都走它。要复现 P2b 的「没有池」世界（空窗抉择那条路径）
  // 就用 withoutTitlePool 把池关掉。
  function withoutTitlePool(cfg) {
    if (cfg && cfg.careerWorld) {
      cfg.careerWorld.titlePool = deepClone(cfg.careerWorld.titlePool || {});
      cfg.careerWorld.titlePool.enabled = false;
    }
    return cfg;
  }

  // 把某家公司的目录真作整体摘掉。
  // 一批「机制」用例需要一家**当月确实没有活**的公司来验：空窗抉择（gap<6 静默 / ≥6 弹一次）、
  // 池作工期被下一档真作夹取、池名不重复、late-join 探针。它们过去都借 fromsoftware 1995——
  // 那时这家公司到 2005 年才开工，1995~2003 整段是空的。P2-fix-a 补了 188 部真实历史作品
  // （第一批《国王密令II》就盖住 1995、接着《装甲核心》……），这个前提不再成立。
  // 与其把公司名换成另一家（数据再长一点又会失效），不如显式清空：用例测的是机制，与目录数据无关。
  function withoutCatalog(cfg, companyId) {
    const keep = {};
    if (cfg && cfg.careerWorld) {
      cfg.careerWorld.titles = (cfg.careerWorld.titles || []).filter(function (t) {
        if (t.companyId === companyId) return false;
        keep[t.id] = true;
        return true;
      });
      cfg.careerWorld.titleDetails = (cfg.careerWorld.titleDetails || []).filter(function (d) {
        return keep[d.id];
      });
    }
    return cfg;
  }

  // 改池的策略子块（例如只关 coverage、或调 minFillMonths）时先过这里。
  function withTitlePool(cfg) {
    if (cfg && cfg.careerWorld) {
      cfg.careerWorld.titlePool = deepClone(cfg.careerWorld.titlePool || {});
      cfg.careerWorld.titlePool.enabled = true;
    }
    return cfg;
  }

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
  return {
    GDS: GDS, sim: sim, config: config, assert: assert, deepClone: deepClone,
    ok: ok, PDIMS: PDIMS, TDIMS: TDIMS,
    __passed: function () { return passed; },
    fs: fs, path: path, ROOT: ROOT, SIM_FILES: SIM_FILES, __dirname: __dirname,
    liveHostCompany: liveHostCompany,
    enterLiveDevMonth: enterLiveDevMonth,
    fixCycle: fixCycle,
    withoutTitlePool: withoutTitlePool,
    withoutCatalog: withoutCatalog,
    withTitlePool: withTitlePool,
    tsum: tsum,
    hireOne: hireOne,
    firstIds: firstIds,
    pitchArgs: pitchArgs,
    quietWorld: quietWorld,
    fillerLadder: fillerLadder,
  };
}

module.exports = { createContext: createContext, SIM_FILES: SIM_FILES, ROOT: ROOT };
