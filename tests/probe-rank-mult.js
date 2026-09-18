#!/usr/bin/env node
"use strict";
// 数值探针：职级（jobRanks.contribMult / playerWeightMult）对月贡献、抉择倍率与口碑的影响。
// 用法：node tests/probe-rank-mult.js [队伍属性] [月数]
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
const GDS = loadSim();
const sim = GDS.sim;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "activity", "config.json"), "utf8"));
config.careerWorld = JSON.parse(fs.readFileSync(path.join(ROOT, "activity", "career-world.json"), "utf8"));

const DIMS = ["program", "design", "art", "music"];
const JR = config.careerWorld.jobRanks || {};
const SFL = config.careerWorld.scoreFromLive || {};
const GENRE = "fantasy";
const PLAY = "rpg";
const TEAM_N = 5;
const STAT_VAL = Number(process.argv[2] || 80);
const MONTHS = Number(process.argv[3] || 6);
const WORLD_XP = 60;   // 工作室熟练度：看家本领
const PLAYER_XP = 60;

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
  DIMS.forEach(function (k) { st.career.stats[k] = statVal; });
  (st.career.colleagues || []).forEach(function (c) {
    DIMS.forEach(function (k) { c.stats[k] = statVal; });
  });
  st.career.colleagues = (st.career.colleagues || []).slice(0, TEAM_N - 1);
  st.studioXp = {};
  st.studioXp[st.career.studioId] = {
    genreXp: {}, gameplayXp: {}, total: 0
  };
  st.studioXp[st.career.studioId].genreXp[GENRE] = WORLD_XP;
  st.studioXp[st.career.studioId].gameplayXp[PLAY] = WORLD_XP;
  st.career.genreXp = {}; st.career.gameplayXp = {};
  st.career.genreXp[GENRE] = PLAYER_XP;
  st.career.gameplayXp[PLAY] = PLAYER_XP;
  return st;
}

function mean(stats) {
  return DIMS.reduce(function (s, k) { return s + stats[k]; }, 0) / DIMS.length;
}

function runAtRank(rank) {
  const st = makeState(STAT_VAL);
  st.career.jobRank = rank;
  const by = sim.careerMonthlyContributionByDim(st, config);
  const base = sim.careerCraftLiveStats(st, MONTHS, TEAM_N, config, GENRE, PLAY);
  const title = sim.startVirtualProject(st, config, { genreId: GENRE, gameplayId: PLAY });
  st.career.titleId = title.id;
  st.career.liveStats = JSON.parse(JSON.stringify(title.stats));
  const before = sim.liveToPublicScore(st.career.liveStats, title.score, config, st, title);
  const by2 = sim.careerMonthlyContributionByDim(st, config);
  for (let m = 1; m <= MONTHS; m++) {
    DIMS.forEach(function (k) { sim.applyCareerLiveDelta(st, k, by2[k], config); });
  }
  const finalScore = sim.liveToPublicScore(st.career.liveStats, title.score, config, st, title);
  return {
    rank,
    main: by2.program,
    off: by2.art,
    liveMean: mean(st.career.liveStats),
    openScore: title.score,
    before: before,
    finalScore: finalScore,
    impact: sim.careerPlayerImpactFactor(st, config),
    weight: sim.careerPlayerScoreWeight(st, config),
    baseMean: mean(base)
  };
}

const rows = [];
for (let r = 1; r <= 6; r++) rows.push(runAtRank(r));

console.log("队伍 " + TEAM_N + " 人全属性 " + STAT_VAL + "，题材 " + GENRE + "+" + PLAY +
  "，工期 " + MONTHS + " 月，工作室/玩家熟练 xp=" + WORLD_XP + "（看家本领档）");
console.log("contribMult      = " + JSON.stringify(JR.contribMult));
console.log("playerWeightMult = " + JSON.stringify(JR.playerWeightMult));
console.log("playerWeight=" + SFL.playerWeight + " min=" + SFL.playerWeightMin + " max=" + SFL.playerWeightMax +
  " attrRef=" + SFL.attrRef);
console.log("");
console.log("Lv | contribMult | 主职维/月 | 其余维/月 | 四倍月合计 | 立项口碑 | 发售口碑 | 抉择倍率 | 目录作玩家权重");
console.log("-".repeat(118));
rows.forEach(function (r) {
  const mult = (JR.contribMult || [])[r.rank];
  console.log([
    " " + r.rank,
    String(mult).padStart(11),
    ("+" + r.main.toFixed(2)).padStart(9),
    ("+" + r.off.toFixed(2)).padStart(9),
    ("+" + (r.main + r.off * 3).toFixed(2) + "/" + MONTHS + "月").padStart(12),
    r.openScore.toFixed(1).padStart(8),
    r.finalScore.toFixed(1).padStart(8),
    r.impact.toFixed(3).padStart(8),
    r.weight.toFixed(3).padStart(12)
  ].join(" | "));
});
console.log("-".repeat(118));
const lo = rows[0], hi = rows[rows.length - 1];
console.log("跨度：主职维/月 " + lo.main.toFixed(2) + " → " + hi.main.toFixed(2) +
  "（" + (hi.main / lo.main).toFixed(2) + "x；contribMult 表 " +
  (JR.contribMult[1] || 0) + " → " + (JR.contribMult[6] || 0) + " = " +
  ((JR.contribMult[6] || 0) / (JR.contribMult[1] || 1)).toFixed(2) + "x）");
console.log("跨度：发售口碑 " + lo.finalScore.toFixed(1) + " → " + hi.finalScore.toFixed(1) +
  "（+" + (hi.finalScore - lo.finalScore).toFixed(2) + " 分）");
