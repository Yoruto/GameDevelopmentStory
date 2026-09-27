#!/usr/bin/env node
"use strict";

// Reproducible career pacing probe. All transitions use the game simulator.
// The harness fixes opening generation; independent seeds begin after the offer is rolled.
const harness = require("../tests/_harness.js");
const { sim, config } = harness.createContext();
const count = Number(process.argv[2] || 32);
const policy = process.argv[3] === "stay" ? "stay" : "first";
const years = [1995, 2000, 2005, 2010, 2015, 2020, 2025];
const rows = [];
const personDims = sim.personDims(config);
function bestStat(st) { return Math.max(...personDims.map(d => Number(st.career.stats[d] || 0))); }

function answer(st, pages) {
  const queue = (pages || []).slice();
  for (let i = 0; i < queue.length && i < 300; i++) {
    const page = queue[i];
    if (!page || page.presentation !== "choice" || !page.options || !page.options.length) continue;
    let result;
    const options = policy === "stay" && (page.type === "hop" || page.type === "invite")
      ? page.options.slice().sort((a, b) => {
        const keep = id => id === "stay" || id === "decline";
        return Number(keep(b.id)) - Number(keep(a.id));
      }) : page.options;
    for (const opt of options) {
      result = sim.resolveCareerQueueChoice(st, page, opt.id, config);
      if (result && result.ok) break;
    }
    if (!result || !result.ok) throw new Error("No valid choice at " + st.year + "/" + st.month);
    st = result.state;
    if (result.queue && result.queue.length) queue.splice(i + 1, 0, ...result.queue);
  }
  return st;
}

for (let seed = 1; seed <= count; seed++) {
  const start = sim.createCareerGame("审计", "programmer", config);
  start.rngSeed = seed;
  start.rngCount = 0;
  let st = sim.acceptOpeningOffer(start, start.career.openingOffers[0].id, config).state;
  const snapshots = {};
  snapshots[1995] = { stat: +sim.careerMainStat(st, config).toFixed(1),
    bestStat: +bestStat(st).toFixed(1),
    rank: sim.careerJobRank(st.career, config), credits: 0 };
  for (let month = 0; st.phase === "PLAYING" && month < 380; month++) {
    const out = sim.tickMonth(st, config);
    st = answer(out.state, out.queue);
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
  const optionalIds = ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"];
  const lines = st.career.lines || {};
  rows.push({ seed, snapshots, releases, finalRank: sim.careerJobRank(st.career, config),
    producer: st.career.growthStage === "producer", honor: st.career.honor || 0,
    optionalDone: optionalIds.filter(id => lines[id] && lines[id].status === "done").length,
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
console.log(JSON.stringify({ seeds: count, policy: "first opening offer; " +
  (policy === "stay" ? "prefer staying at hop and invite nodes" : "first valid queue choice"), summary,
  releases: releaseSummary,
  final: { rank: dist(rows.map(r => r.finalRank)), score: dist(all.map(r => r.score)),
    sales: dist(all.map(r => r.launchSales)), honor: dist(rows.map(r => r.honor)),
    employers: dist(rows.map(r => r.employers)), optionalDone: dist(rows.map(r => r.optionalDone)),
    producerCount: rows.filter(r => r.producer).length,
    endings: rows.reduce((out, r) => { out[r.ending] = (out[r.ending] || 0) + 1; return out; }, {}) },
  trace: process.argv.includes("--trace") ? rows[0].trace : undefined }, null, 2));
