#!/usr/bin/env node
"use strict";
// Fixed clock comes from tests/_harness.js. Each seed takes the first valid choice.
const { createContext } = require("../tests/_harness");
const { sim, config } = createContext();
const RUNS = 24;
const roles = ["programmer", "design", "art", "music"];
const byNode = Object.create(null);
const byPage = Object.create(null);
const samples = [];

function add(map, key) { map[key] = (map[key] || 0) + 1; }
function answer(state, pages) {
  const queue = (pages || []).slice();
  for (let i = 0; i < queue.length; i++) {
    const page = queue[i];
    add(byPage, page.type || "unknown");
    if (page.type === "media") add(byPage, page.rec && page.rec.virtual ? "mediaVirtual" : "mediaCatalog");
    if (page.presentation !== "choice" || !page.options) continue;
    let picked;
    for (const option of page.options) {
      const result = sim.resolveCareerQueueChoice(state, page, option.id, config);
      if (result && result.ok) { picked = result; break; }
    }
    if (!picked) throw new Error("No valid choice at " + (page.type || "unknown"));
    state = picked.state;
    if (picked.queue) queue.splice(i + 1, 0, ...picked.queue);
  }
  return state;
}

for (let run = 0; run < RUNS; run++) {
  const game = sim.createCareerGame("节奏测试", roles[run % roles.length], config);
  game.rngSeed = 700000 + run * 7919;
  game.rngCount = 0;
  let state = sim.acceptOpeningOffer(game, game.career.openingOffers[0].id, config).state;
  let nodes = 0;
  let pages = 0;
  let steps = 0;
  while (state.phase === "PLAYING" && steps < 600) {
    steps++;
    const result = sim.skipToNextNode(state, config);
    add(byNode, result.node && result.node.id || "unknown");
    if (result.queue && result.queue.length) nodes++;
    pages += (result.queue || []).length;
    state = answer(result.state, result.queue);
    if (sim.canPromoteCareer(state, config)) {
      const promoted = sim.promoteCareer(state, config);
      if (promoted && promoted.ok) state = answer(promoted.state, promoted.queue);
    }
  }
  if (state.phase !== "SETTLED") throw new Error("Run " + run + " did not settle");
  samples.push({ run, seed: game.rngSeed, role: roles[run % roles.length], nodes, pages, steps,
    saveBytes: Buffer.byteLength(JSON.stringify(state), "utf8") });
}
const metric = (field) => ({
  average: +(samples.reduce((sum, sample) => sum + sample[field], 0) / RUNS).toFixed(1),
  min: Math.min(...samples.map((sample) => sample[field])),
  max: Math.max(...samples.map((sample) => sample[field]))
});
console.log(JSON.stringify({ runs: RUNS, policy: "first valid choice; promote when eligible",
  nodes: metric("nodes"), pages: metric("pages"), steps: metric("steps"), saveBytes: metric("saveBytes"),
  byNode, byPage, samples }, null, 2));
