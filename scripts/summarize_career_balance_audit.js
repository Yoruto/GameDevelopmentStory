#!/usr/bin/env node
"use strict";

// Summarize the paired 32-seed cohorts produced by career_balance_audit.js.
const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname, "..", "activity", "balance-audit-2026-09-27");
const roles = ["programmer", "art", "design", "music"];
const policies = ["first", "stay"];
const variants = ["baseline", "candidate15"];
const lineIds = ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"];

function read(variant, policy, role) {
  const stem = variant === "baseline" ? policy : variant + "-" + policy;
  const file = path.join(dir, stem + "-" + role + ".json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.seeds !== 32 || data.rows.length !== 32 || data.startingRole !== role) {
    throw new Error("Incomplete cohort: " + file);
  }
  return data.rows.map(row => Object.assign({ startingRole: role, policy: policy }, row));
}
function percentile(values, share) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * share)];
}
function summary(rows) {
  const n = rows.length;
  const doneCounts = [0, 1, 2, 3, 4, 5].map(k => rows.filter(r => r.optionalDone === k).length);
  const lines = {};
  lineIds.forEach(id => {
    lines[id] = {
      started: rows.filter(r => r.lineStates[id] !== "unseen").length,
      done: rows.filter(r => r.lineStates[id] === "done").length
    };
  });
  const endings = {};
  rows.forEach(r => { endings[r.ending] = (endings[r.ending] || 0) + 1; });
  return {
    n, doneCounts, lines, endings,
    rankP50: percentile(rows.map(r => r.finalRank), .5),
    rank5Ever: rows.filter(r => r.pacing.rankFirstAt[5] != null).length,
    rank6Ever: rows.filter(r => r.pacing.rankFirstAt[6] != null).length,
    producerEver: rows.filter(r => r.pacing.producerFirstAt != null).length,
    idleP50: percentile(rows.map(r => r.pacing.idleTotal), .5),
    idleP90: percentile(rows.map(r => r.pacing.idleTotal), .9),
    unemployedP90: percentile(rows.map(r => r.pacing.unemployedTotal), .9),
    longestIdleP90: percentile(rows.map(r => r.pacing.idleLongest), .9),
    employerP50: percentile(rows.map(r => r.employers), .5),
    examples: [0, 1, 5].map(k => ({ completed: k,
      seeds: rows.filter(r => r.optionalDone === k).slice(0, 3)
        .map(r => r.startingRole + "/" + r.seed) }))
  };
}

console.log("variant | policy | runs | lines done 0/1/2/3/4/5 | rank p50 | ever rank 5/6 | producer ever | idle months p50/p90 | employers p50");
for (const variant of variants) {
  for (const policy of policies) {
    const rows = roles.flatMap(role => read(variant, policy, role));
    const s = summary(rows);
    console.log([variant, policy, s.n, s.doneCounts.join("/"), s.rankP50,
      s.rank5Ever + "/" + s.rank6Ever, s.producerEver,
      s.idleP50 + "/" + s.idleP90, s.employerP50].join(" | "));
    console.log("  line done: " + lineIds.map(id => id + "=" + s.lines[id].done + "/" + s.n +
      " (started " + s.lines[id].started + ")").join(", "));
    console.log("  unemployed months p90=" + s.unemployedP90 +
      ", longest project gap p90=" + s.longestIdleP90);
    console.log("  endings: " + JSON.stringify(s.endings));
    console.log("  examples: " + JSON.stringify(s.examples));
    if (variant === "candidate15") {
      for (const role of roles) {
        const cohort = rows.filter(r => r.startingRole === role);
        const rank4 = cohort.map(r => r.pacing.rankFirstAt[4]).filter(m => m != null);
        const rank5 = cohort.map(r => r.pacing.rankFirstAt[5]).filter(m => m != null);
        console.log("  role " + role + ": final rank p50=" + percentile(cohort.map(r => r.finalRank), .5) +
          ", rank4 reached=" + rank4.length + "/32 (month p50=" + percentile(rank4, .5) +
          "), rank5 reached=" + rank5.length + "/32 (month p50=" + percentile(rank5, .5) +
          "), idle p90=" + percentile(cohort.map(r => r.pacing.idleTotal), .9));
      }
    }
  }
}
