#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const drawn = [];
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === "fillText") return (value) => drawn.push(String(value));
    if (key === "measureText") return (value) => ({ width: String(value).length * 12 });
    return target[key] || (() => {});
  },
  set(target, key, value) { target[key] = value; return true; }
});

class Element {
  constructor(id) {
    this.id = id;
    this.textContent = id === "btn-career-poster" ? "查看生涯海报" : "";
    this.hidden = id === "poster-overlay";
    this.disabled = false;
    this.listeners = {};
  }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  focus() { document.activeElement = this; }
  removeAttribute(name) { delete this[name]; }
}

const ids = ["btn-career-poster", "poster-overlay", "poster-close", "poster-prev",
  "poster-next", "poster-image", "poster-count", "poster-canvas"];
const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
elements["poster-canvas"].getContext = () => ctx;
elements["poster-canvas"].toDataURL = () => "data:image/png;base64,AA==";
const document = {
  readyState: "complete",
  activeElement: elements["btn-career-poster"],
  getElementById: (id) => elements[id],
  addEventListener() {}
};
const state = { phase: "SETTLED", career: { characterName: "旧档姓名" } };
let userId = "123456";
let profileReads = 0;
const ui = {
  $: (id) => elements[id],
  session: { state },
  toast: (message) => { throw new Error(message); }
};
const GDS = {
  ui,
  CONFIG: {},
  bridge: { posterUserId: async () => { profileReads += 1; return userId; } },
  sim: {
    formatUnits: String,
    careerPosterView: (current) => ({
      name: current.career.characterName,
      startYear: 1995, endYear: 2025, endingTitle: "生涯终章",
      employer: "工作室", signedCount: 0, transitionCount: 0,
      fame: 0, honor: 0, totalSales: null, best: null,
      job: "制作人", endingBody: "结局", moments: []
    })
  }
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../h5/js/ui/poster.js"), "utf8"),
  { GDS, document }
);

(async () => {
  assert.equal(profileReads, 0, "profile is not read before opening the poster");
  await ui.openCareerPoster();
  assert.equal(profileReads, 1);
  assert.equal(elements["poster-overlay"].hidden, false);
  assert(drawn.includes("123456"), "archive shows the user ID");
  assert(!drawn.includes("旧档姓名"), "old save name stays off the poster");
  drawn.length = 0;
  elements["poster-next"].listeners.click();
  assert(drawn.includes("123456的创作轨迹"), "both pages use the same ID");
  ui.closeCareerPoster();

  userId = "我";
  drawn.length = 0;
  await ui.openCareerPoster();
  assert(drawn.includes("我"), "missing ID uses the fallback");
  elements["poster-next"].listeners.click();
  assert(drawn.includes("我的创作轨迹"));
  assert.equal(state.career.characterName, "旧档姓名", "poster identity is not saved to the game");
  console.log("poster identity checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
