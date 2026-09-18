#!/usr/bin/env node
"use strict";
// 临时数值探针：不同队伍强度 × 工作室/玩家熟练度，5人6个月、同题材立项的分数区间。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SIM_DIR = path.join(ROOT, "h5", "js", "sim");
const SIM_FILES = ["ns.js", "rng.js", "util.js", "company.js", "staff.js", "project.js",
  "liveops.js", "series.js", "rivals.js", "media.js", "awards.js", "events.js",
  "lifecycle.js", "career.js", "careerLines.js", "tick.js", "actions.js"];

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
  const sandbox = { console, Math, JSON, Date: TestDate, Array, Object, String, Number, Boolean };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of SIM_FILES) {
    vm.runInContext(fs.readFileSync(path.join(SIM_DIR, file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.GDS;
}
function loadConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "activity", "config.json"), "utf8"));
  config.careerWorld = JSON.parse(fs.readFileSync(path.join(ROOT, "activity", "career-world.json"), "utf8"));
  return config;
}
const GDS = loadSim();
const sim = GDS.sim;
const config = loadConfig();
const DIMS = ["program", "design", "art", "music"];
const META = config.release.media;
const JIT = config.careerWorld.scoreFromLive;

const GENRE = "fantasy";
const PLAY = "rpg";
const TEAM_N = 5;
const MONTHS = Number(process.argv[2] || 6);

// 熟练度：xp → 档位。无=0(生疏) 低=12(熟练) 中=30(拿手) 高=60(看家本领)
const LEVELS = [
  { key: "无", xp: 0 },
  { key: "低", xp: 12 },
  { key: "高", xp: 60 }
];
const XP_EXTRA = { key: "中", xp: 30 };

function makeState(statVal) {
  const g = sim.createCareerGame("探", "programmer", config);
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
  // 全队四维抹平到 statVal
  DIMS.forEach(function (k) { st.career.stats[k] = statVal; });
  (st.career.colleagues || []).forEach(function (c) {
    DIMS.forEach(function (k) { c.stats[k] = statVal; });
  });
  // 同事只留 4 个，凑满 5 人队
  st.career.colleagues = (st.career.colleagues || []).slice(0, TEAM_N - 1);
  return st;
}

function setProficiency(st, worldXp, playerXp) {
  st.studioXp = {};
  st.studioXp[st.career.studioId] = {
    genreXp: {}, gameplayXp: {}, total: 0
  };
  st.studioXp[st.career.studioId].genreXp[GENRE] = worldXp;
  st.studioXp[st.career.studioId].gameplayXp[PLAY] = worldXp;
  st.companyXp = {};
  st.companyXp[st.career.companyId] = {
    genreXp: {}, gameplayXp: {}, total: 0
  };
  st.companyXp[st.career.companyId].genreXp[GENRE] = worldXp;
  st.companyXp[st.career.companyId].gameplayXp[PLAY] = worldXp;
  st.career.genreXp = {}; st.career.gameplayXp = {};
  st.career.genreXp[GENRE] = playerXp;
  st.career.gameplayXp[PLAY] = playerXp;
}

function mean(stats) {
  return DIMS.reduce(function (s, k) { return s + stats[k]; }, 0) / DIMS.length;
}
function sum(stats) {
  return DIMS.reduce(function (s, k) { return s + stats[k]; }, 0);
}

// 媒体分分布：5 家媒体各自 publicScore ± U(0.3,0.6)，再取均值
function mediaRange(st, publicScore) {
  const vals = [];
  for (let seed = 1; seed <= 4000; seed++) {
    st.rngSeed = seed * 2654435761 % 4294967296;
    st.rngCount = 0;
    const m = sim.scoreMediaFromPublic(st, publicScore, config,
      { min: JIT.mediaJitterMin, max: JIT.mediaJitterMax });
    vals.push(m.avg);
  }
  vals.sort(function (a, b) { return a - b; });
  return {
    min: vals[0],
    p05: vals[Math.floor(vals.length * 0.05)],
    p95: vals[Math.floor(vals.length * 0.95)],
    max: vals[vals.length - 1],
    mean: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length
  };
}

function run(statVal, level, worldXp, playerXp) {
  const st = makeState(statVal);
  setProficiency(st, worldXp, playerXp);
  const share = config.careerWorld.virtualPool.teamStatShare;
  const teamSum = statVal * TEAM_N;
  const pct = sim.studioProficiencyBonusPct(st, st.career.companyId, st.career.studioId, GENRE, PLAY, config);

  const base = sim.careerCraftLiveStats(st, MONTHS, TEAM_N, config, GENRE, PLAY);
  const openScore = sim.careerCraftPublicScore(mean(base), config);

  // 立项：与 startVirtualProject 同序（先算 base，再写 title/liveStats）
  const title = sim.startVirtualProject(st, config, { genreId: GENRE, gameplayId: PLAY });
  st.career.titleId = title.id;
  st.career.liveStats = JSON.parse(JSON.stringify(title.stats));

  const by = sim.careerMonthlyContributionByDim(st, config);
  for (let m = 1; m <= MONTHS; m++) {
    DIMS.forEach(function (k) {
      if (!by[k]) return;
      sim.applyCareerLiveDelta(st, k, by[k], config);
    });
  }
  const finalLive = st.career.liveStats;
  const finalScore = sim.liveToPublicScore(finalLive, title.score, config, st, title);
  const media = mediaRange(st, finalScore);

  return {
    statVal, level, worldXp, playerXp, share, teamSum, pct,
    base, openScore, by, finalLive, finalScore, media,
    role: st.career.roleId, rank: sim.careerJobRank(st.career, config),
    playPct: sim.playerProficiencyBonusPct(st, GENRE, PLAY, config)
  };
}

function fmt(r) {
  const liveStr = DIMS.map(function (k) { return r.finalLive[k]; }).join("/");
  return [
    String(r.statVal).padStart(3),
    r.level,
    (r.pct * 100).toFixed(0).padStart(3) + "%",
    DIMS.map(function (k) { return String(r.base[k]).padStart(3); }).join("/"),
    r.openScore.toFixed(1).padStart(4),
    DIMS.map(function (k) { return r.finalLive[k].toFixed(1).padStart(5); }).join("/"),
    r.finalScore.toFixed(1).padStart(4),
    r.media.min.toFixed(1) + " ~ " + r.media.max.toFixed(1),
    r.media.p05.toFixed(1) + " ± " + r.media.p95.toFixed(1)
  ].join(" | ");
}

console.log("队伍 5 人，全属性统一；题材 fantasy + 玩法 rpg；工期 " + MONTHS + " 个月；团队经验 xp → 档位加成（题材档+玩法档相加）");
console.log("口碑标尺 = craft.scoreBase(1) + 四维均值 / craft.statDivisor(7.5)，夹 1～10");
console.log("队伍 | 熟练 | 工作室加成 | 立项四维(程序/策划/美术/音乐) | 立项口碑 | " + MONTHS + "月后四维 | 发售口碑 | 媒体分极值 | 媒体5%~95%");
console.log("-".repeat(150));
const results = [];
[80, 50, 30].forEach(function (v) {
  LEVELS.forEach(function (lv) {
    const r = run(v, lv.key, lv.xp, lv.xp);
    results.push(r);
    console.log(fmt(r));
  });
  const rx = run(v, XP_EXTRA.key, XP_EXTRA.xp, XP_EXTRA.xp);
  results.push(rx);
  console.log(fmt(rx));
  console.log("-".repeat(150));
});

console.log("\n== 玩家每月贡献（主职维 / 其余维）==");
results.filter(function (r) { return r.level !== "中"; }).forEach(function (r) {
  console.log("  属性 " + r.statVal + " / " + r.level + "熟练: 主职维 +" + r.by.program.toFixed(2) +
    "/月, 其余维 +" + r.by.art.toFixed(2) + "/月 (玩家熟练度倍率 " + (1 + r.playPct).toFixed(2) +
    ", 职级 " + r.rank + ")");
});
