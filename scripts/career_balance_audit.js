#!/usr/bin/env node
"use strict";

// Reproducible career pacing probe. All transitions use the game simulator.
// The harness fixes opening generation; independent seeds begin after the offer is rolled.
// Usage: node scripts/career_balance_audit.js 32 first --role programmer --rows --output activity/audit.json
const fs = require("fs");
const harness = require("../tests/_harness.js");
const { sim, config } = harness.createContext();
const count = Number(process.argv[2] || 32);
const policy = process.argv[3] === "stay" ? "stay" : "first";
const roleAt = process.argv.indexOf("--role");
const role = roleAt >= 0 ? process.argv[roleAt + 1] : "programmer";
if (!sim.careerPlayableRoles(config).some(r => r.id === role)) {
  throw new Error("Unknown starting role: " + role);
}
const years = [1995, 2000, 2005, 2010, 2015, 2020, 2025];
const rows = [];
const optionalIds = ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"];
const chanceScaleAt = process.argv.indexOf("--line-chance-scale");
const lineChanceScale = chanceScaleAt >= 0 ? Number(process.argv[chanceScaleAt + 1]) : 1;
if (!(lineChanceScale > 0 && lineChanceScale <= 1)) throw new Error("--line-chance-scale must be in (0, 1]");
if (lineChanceScale !== 1) {
  (config.careerWorld.eventLines.lines || []).forEach(line => {
    if (optionalIds.includes(line.id) && line.startWhen && line.startWhen.startChance != null) {
      line.startWhen.startChance *= lineChanceScale;
    }
  });
}
const personDims = sim.personDims(config);
function bestStat(st) { return Math.max(...personDims.map(d => Number(st.career.stats[d] || 0))); }

function answer(st, pages, seed) {
  const queue = (pages || []).slice();
  const history = [];
  for (let i = 0; i < queue.length && i < 300; i++) {
    const page = queue[i];
    if (!page || page.presentation !== "choice" || !page.options || !page.options.length) continue;
    let result;
    const options = policy === "stay" && (page.type === "hop" || page.type === "invite")
      ? page.options.slice().sort((a, b) => {
        const keep = id => id === "stay" || id === "decline";
        return Number(keep(b.id)) - Number(keep(a.id));
      }) : page.options;
    const failures = [];
    let chosen = null;
    for (const opt of options) {
      result = sim.resolveCareerQueueChoice(st, page, opt.id, config);
      if (result && result.ok) { chosen = opt.id; break; }
      failures.push({ id: opt.id, error: result && (result.error || result.code || result.message) });
    }
    if (!result || !result.ok) throw new Error("No valid choice: seed=" + seed +
      " role=" + role + " policy=" + policy + " at " + st.year + "/" + st.month +
      " page=" + page.type + "/" + (page.id || page.title || "") +
      " line=" + (page.lineId || "") + "/" + (page.beatId || "") +
      " status=" + JSON.stringify(st.career.lines && st.career.lines[page.lineId]) +
      " options=" + JSON.stringify(failures) + " prior=" + JSON.stringify(history.slice(-5)));
    st = result.state;
    history.push({ type: page.type, lineId: page.lineId, beatId: page.beatId,
      option: chosen });
    if (result.queue && result.queue.length) queue.splice(i + 1, 0, ...result.queue);
  }
  return st;
}

for (let seed = 1; seed <= count; seed++) {
  const start = sim.createCareerGame("审计", role, config);
  start.rngSeed = seed;
  start.rngCount = 0;
  let st = sim.acceptOpeningOffer(start, start.career.openingOffers[0].id, config).state;
  const snapshots = {};
  const pacing = { idleTotal: 0, idleLongest: 0, unemployedTotal: 0,
    rankFirstAt: {}, producerFirstAt: null, roleChanges: 0 };
  let idleStreak = 0;
  let lastRole = st.career.roleId;
  function observe(state) {
    if (state.phase !== "PLAYING") return;
    const elapsed = (state.year - 1995) * 12 + state.month - 1;
    const rank = sim.careerJobRank(state.career, config);
    const idle = !sim.careerPostLaunch(state) && !state.career.titleId;
    for (let level = 1; level <= rank; level++) {
      if (pacing.rankFirstAt[level] == null) pacing.rankFirstAt[level] = elapsed;
    }
    if (state.career.growthStage === "producer" && pacing.producerFirstAt == null) {
      pacing.producerFirstAt = elapsed;
    }
    if (state.career.roleId !== lastRole) pacing.roleChanges += 1;
    lastRole = state.career.roleId;
    if (!state.career.companyId) pacing.unemployedTotal += 1;
    if (idle) {
      pacing.idleTotal += 1;
      idleStreak += 1;
      pacing.idleLongest = Math.max(pacing.idleLongest, idleStreak);
    } else idleStreak = 0;
  }
  observe(st);
  snapshots[1995] = { stat: +sim.careerMainStat(st, config).toFixed(1),
    bestStat: +bestStat(st).toFixed(1),
    rank: sim.careerJobRank(st.career, config), credits: 0 };
  for (let month = 0; st.phase === "PLAYING" && month < 380; month++) {
    const out = sim.tickMonth(st, config);
    st = answer(out.state, out.queue, seed);
    observe(st);
    if (st.month === 1 && years.includes(st.year)) {
      snapshots[st.year] = {
        stat: +sim.careerMainStat(st, config).toFixed(1),
        bestStat: +bestStat(st).toFixed(1),
        rank: sim.careerJobRank(st.career, config),
        credits: (st.career.credits || []).filter(c => c.shipped).length
      };
    }
  }
  if (st.phase !== "SETTLED") throw new Error("Seed " + seed + " ended at " + st.year + "/" + st.month + " phase " + st.phase);
  const creditIds = new Set((st.career.credits || []).map(c => c.titleId));
  const releases = (st.worldReleased || []).filter(r => creditIds.has(r.id) &&
    typeof r.score === "number" && typeof r.launchSales === "number");
  const lines = st.career.lines || {};
  const lineStates = {};
  optionalIds.forEach(id => { lineStates[id] = lines[id] ? lines[id].status : "unseen"; });
  rows.push({ seed, snapshots, releases, finalRank: sim.careerJobRank(st.career, config),
    producer: st.career.growthStage === "producer", honor: st.career.honor || 0,
    optionalDone: optionalIds.filter(id => lines[id] && lines[id].status === "done").length,
    optionalStarted: optionalIds.filter(id => !!lines[id]).length,
    lineStates, pacing,
    employers: new Set((st.career.tenures || []).map(t => t.companyId)).size,
    ending: sim.careerEndingView(st, config).id,
    trace: process.argv.includes("--trace") ? {
      tenures: (st.career.tenures || []).map(t => ({ companyId: t.companyId, roleId: t.roleId, startYear: t.startYear })),
      releases: releases.filter(r => r.releaseYear >= 2005 && r.releaseYear <= 2014)
        .map(r => ({ id: r.id, year: r.releaseYear, score: r.score, sales: r.launchSales, virtual: r.virtual }))
    } : undefined });
}

function percentile(a, p) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  return +(s[Math.floor((s.length - 1) * p)]).toFixed(1);
}
function dist(a) { return { n: a.length, p10: percentile(a, .1), p50: percentile(a, .5), p90: percentile(a, .9) }; }
const summary = {};
for (const year of years) {
  const snaps = rows.map(r => r.snapshots[year]).filter(Boolean);
  summary[year] = {
    stat: dist(snaps.map(s => s.stat)), bestStat: dist(snaps.map(s => s.bestStat)),
    rank: dist(snaps.map(s => s.rank)),
    credits: dist(snaps.map(s => s.credits))
  };
}
const eras = [[1995, 2004], [2005, 2014], [2015, 2025]];
const releaseSummary = {};
for (const [first, last] of eras) {
  for (const virtual of [true, false]) {
    const releases = rows.flatMap(r => r.releases).filter(r => r.releaseYear >= first &&
      r.releaseYear <= last && r.virtual === virtual);
    releaseSummary[`${first}-${last}-${virtual ? "virtual" : "catalog"}`] = {
      score: dist(releases.map(r => r.score)), sales: dist(releases.map(r => r.launchSales)),
      highScoreShare: releases.length ? +(releases.filter(r => r.score >= 9).length / releases.length).toFixed(3) : null
    };
  }
}
const all = rows.flatMap(r => r.releases);
const lineSummary = {};
optionalIds.forEach(id => {
  lineSummary[id] = {
    started: rows.filter(r => r.lineStates[id] !== "unseen").length,
    done: rows.filter(r => r.lineStates[id] === "done").length,
    activeAtEnd: rows.filter(r => r.lineStates[id] === "active").length
  };
});
const rankFirstAt = {};
for (let level = 2; level <= 6; level++) {
  const reached = rows.map(r => r.pacing.rankFirstAt[level]).filter(m => m != null);
  rankFirstAt[level] = { reached: reached.length, month: dist(reached) };
}
const optionalDoneCounts = {};
for (let n = 0; n <= optionalIds.length; n++) {
  optionalDoneCounts[n] = rows.filter(r => r.optionalDone === n).length;
}
const report = { seeds: count, startingRole: role, lineChanceScale,
  policy: "first opening offer; " +
  (policy === "stay" ? "prefer staying at hop and invite nodes" : "first valid queue choice"), summary,
  releases: releaseSummary,
  pacing: {
    idleTotal: dist(rows.map(r => r.pacing.idleTotal)),
    idleLongest: dist(rows.map(r => r.pacing.idleLongest)),
    unemployedTotal: dist(rows.map(r => r.pacing.unemployedTotal)),
    roleChanges: dist(rows.map(r => r.pacing.roleChanges)),
    rankFirstAt,
    producerEverCount: rows.filter(r => r.pacing.producerFirstAt != null).length,
    producerFirstAt: dist(rows.map(r => r.pacing.producerFirstAt).filter(m => m != null)),
    longestIdleSeeds: rows.slice().sort((a, b) => b.pacing.idleLongest - a.pacing.idleLongest)
      .slice(0, 5).map(r => ({ seed: r.seed, months: r.pacing.idleLongest }))
  },
  optionalLines: lineSummary,
  optionalDoneCounts,
  final: { rank: dist(rows.map(r => r.finalRank)), score: dist(all.map(r => r.score)),
    sales: dist(all.map(r => r.launchSales)), honor: dist(rows.map(r => r.honor)),
    employers: dist(rows.map(r => r.employers)), optionalDone: dist(rows.map(r => r.optionalDone)),
    producerCount: rows.filter(r => r.producer).length,
    endings: rows.reduce((out, r) => { out[r.ending] = (out[r.ending] || 0) + 1; return out; }, {}) },
  trace: process.argv.includes("--trace") ? rows[0].trace : undefined,
  rows: process.argv.includes("--rows") ? rows.map(r => ({
    seed: r.seed, ending: r.ending, finalRank: r.finalRank,
    producer: r.producer, optionalDone: r.optionalDone,
    employers: r.employers, pacing: r.pacing, lineStates: r.lineStates
  })) : undefined };
const outputAt = process.argv.indexOf("--output");
if (outputAt >= 0) {
  if (!process.argv[outputAt + 1]) throw new Error("--output needs a file path");
  fs.writeFileSync(process.argv[outputAt + 1], JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log("wrote " + process.argv[outputAt + 1] + " (" + count + " seeds, " + role + ")");
} else console.log(JSON.stringify(report, null, 2));
