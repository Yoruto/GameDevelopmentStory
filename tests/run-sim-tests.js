#!/usr/bin/env node
"use strict";
//
// 测试入口：收集 tests/cases/case-*.js 顺序执行（文件名排序即执行序，99-guards 殿后）。
// 沙箱加载 / 共享 helper 在 tests/_harness.js；用例按域分文件，改哪个域看哪个文件。
// 用法：node tests/run-sim-tests.js [--only <关键字>]   # --only 按文件名过滤
//
const fs = require("fs");
const path = require("path");
const HARNESS = require("./_harness.js");

function main() {
  const ctx = HARNESS.createContext();
  const casesDir = path.join(__dirname, "cases");
  const files = fs.readdirSync(casesDir)
    .filter(function (f) { return /^case-[\w\-]+\.js$/.test(f); })
    .sort();
  const onlyIdx = process.argv.indexOf("--only");
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
  const picked = only ? files.filter(function (f) { return f.indexOf(only) >= 0; }) : files;
  if (only && !picked.length) {
    console.error("--only " + only + " matched no case file");
    process.exit(1);
  }
  picked.forEach(function (f) {
    if (only) console.log("== " + f + " ==");
    require(path.join(casesDir, f))(ctx);
  });
  console.log("\n" + ctx.__passed() + " tests passed");
}

try {
  main();
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
