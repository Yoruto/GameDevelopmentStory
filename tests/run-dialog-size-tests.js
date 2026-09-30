#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.style = {};
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)
    };
    this.heightReads = 0;
    this._offsetHeight = 0;
  }

  set offsetHeight(value) { this._offsetHeight = value; }
  get offsetHeight() { this.heightReads += 1; return this._offsetHeight; }
}

const elements = Object.fromEntries(
  ["dlg", "dlg-body", "dlg-extra", "dlg-actions", "dlg-ok"]
    .map((id) => [id, new Element()])
);
const context = {
  document: {
    getElementById: (id) => elements[id],
    addEventListener() {},
    documentElement: { clientHeight: 800 }
  },
  innerHeight: 800
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../h5/js/ui/dom.js"), "utf8"),
  context
);
const dlg = elements.dlg;
const actions = elements["dlg-actions"];
const ok = elements["dlg-ok"];
const fit = context.GDS.ui.fitDialogToContent;

dlg.offsetHeight = 210;
assert.equal(fit(), "long");
assert.equal(dlg.classList.contains("dlg-size-long"), true);
assert.equal(dlg.style.height, "");
assert.equal(dlg.heightReads, 0, "ordinary dialogs do not force a height measurement");

dlg.offsetHeight = 400;
actions.classList.add("off");
ok.classList.add("off");
assert.equal(fit({ reserveActions: true, lockHeight: true }), "medium");
assert.equal(dlg.classList.contains("dlg-size-short"), false);
assert.equal(dlg.classList.contains("dlg-size-medium"), true);
assert.equal(dlg.style.height, "400px");
assert.equal(dlg.heightReads, 1, "reveal height is measured once");
assert.equal(actions.classList.contains("off"), true);
assert.equal(ok.classList.contains("off"), true);

dlg.offsetHeight = 600;
assert.equal(fit(), "long");
assert.equal(dlg.classList.contains("dlg-size-medium"), false);
assert.equal(dlg.classList.contains("dlg-size-long"), true);
assert.equal(dlg.style.height, "");
assert.equal(dlg.heightReads, 1);

context.innerHeight = 500;
dlg.offsetHeight = 240;
assert.equal(fit({ lockHeight: true }), "medium", "compact viewports use lower content thresholds for reveals");
assert.equal(dlg.heightReads, 2);
console.log("4 dialog size checks passed");
