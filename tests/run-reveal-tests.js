#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.children = [];
    this.listeners = { capture: [], bubble: [] };
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)
    };
    this._scrollHeight = 0;
    this.scrollHeightReads = 0;
    this.scrollTop = 0;
    this._text = "";
  }

  set scrollHeight(value) { this._scrollHeight = value; }
  get scrollHeight() { this.scrollHeightReads += 1; return this._scrollHeight; }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get textContent() { return this._text; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, callback, capture) {
    if (type === "click") this.listeners[capture ? "capture" : "bubble"].push(callback);
  }

  clickThrough(target, onTarget) {
    const event = { target, preventDefault() {}, stopPropagation() {} };
    this.listeners.capture.slice().forEach((listener) => listener(event));
    onTarget();
    this.listeners.bubble.slice().forEach((listener) => listener(event));
  }
}

const elements = Object.fromEntries(
  ["dlg-mask", "dlg-extra", "dlg-body", "dlg", "dlg-ok", "dlg-actions"]
    .map((id) => [id, new Element()])
);
const fitSnapshots = [];
const ui = {
  $: (id) => elements[id],
  fitDialogToContent: (opts) => {
    fitSnapshots.push({ options: opts, rows: elements["dlg-extra"].children.length });
  }
};
let nextTimer = 0;
let nextFrame = 0;
const frames = new Map();
const context = {
  GDS: { ui, sim: {}, CONFIG: { fx: {} } },
  document: { createElement: () => new Element() },
  matchMedia: () => ({ matches: false }),
  setTimeout: () => ++nextTimer,
  setInterval: () => ++nextTimer,
  clearTimeout() {},
  clearInterval() {},
  requestAnimationFrame: (fn) => {
    const id = ++nextFrame;
    frames.set(id, fn);
    return id;
  },
  cancelAnimationFrame: (id) => { frames.delete(id); },
  innerWidth: 375,
  innerHeight: 667
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../h5/js/ui/reveal.js"), "utf8"),
  context
);

const awards = Array.from({ length: 7 }, (_, index) => ({
  id: index === 6 ? "goty" : "award-" + index,
  n: "Award " + index,
  w: "Winner " + index,
  nominees: [{ label: "Other " + index }, { label: "Winner " + index }]
}));
let completed = 0;
const start = () => ui.startAwardReveal(awards, { onDone: () => completed++ });
const mask = elements["dlg-mask"];

mask.clickThrough(elements["dlg-ok"], start);
assert.equal(completed, 0, "opening click must not skip the first ceremony");
assert.equal(mask.classList.contains("fx-busy"), true);
assert.equal(fitSnapshots[0].rows, awards.length, "size preview includes the complete ceremony");
assert.equal(fitSnapshots[0].options.lockHeight, true);

mask.clickThrough(mask, () => {});
assert.equal(completed, 1, "a later click should still skip the ceremony");

mask.clickThrough(elements["dlg-ok"], start);
assert.equal(completed, 1, "opening click must not skip after the listener is bound");
assert.equal(mask.classList.contains("fx-busy"), true);
assert.equal(fitSnapshots[1].rows, awards.length);

mask.clickThrough(mask, () => {});
assert.equal(completed, 2);
context.matchMedia = () => ({ matches: true });
elements["dlg-extra"].scrollHeight = 42;
ui.startMediaReveal({ media: { rows: [{ n: "Outlet", score: 8 }] } });
assert.equal(elements["dlg-extra"].scrollHeightReads, 0, "completion does not read layout synchronously");
Array.from(frames.values()).forEach((fn) => fn());
frames.clear();
assert.equal(elements["dlg-extra"].scrollTop, 42, "final scroll runs in the next frame");
console.log("8 reveal click, sizing and scroll checks passed");
