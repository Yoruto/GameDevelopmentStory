// B1 文案守卫：sim 层含 CJK 的行数「只许降不许涨」（基线 tests/sim-copy-baseline.json）。
// 规矩：新文案一律进 config.copy；sim 只允许模板拼接 config 文案。
// 存量硬编码文案不强制一次搬光——P7 每碰一个域，顺手把该域文案迁走，把基线数字往下调。
// 有意减少后：更新 sim-copy-baseline.json（files + total 一起改）。
"use strict";
const fs = require("fs");
const path = require("path");

const CJK_RE = /[\u4e00-\u9fff]/;

module.exports = function runGroup(ctx) {
  const fs_ = ctx.fs, path_ = ctx.path, assert = ctx.assert, ok = ctx.ok, ROOT = ctx.ROOT;

  const simDir = path_.join(ROOT, "h5", "js", "sim");
  const basePath = path_.join(ctx.__dirname, "sim-copy-baseline.json");

  (function copyLinesNeverGrow() {
    const baseline = JSON.parse(fs_.readFileSync(basePath, "utf8"));
    const now = {};
    let total = 0;
    fs_.readdirSync(simDir).filter(function (f) { return f.endsWith(".js"); }).sort().forEach(function (f) {
      const n = fs_.readFileSync(path_.join(simDir, f), "utf8").split("\n")
        .filter(function (l) { return CJK_RE.test(l); }).length;
      if (n) now[f] = n;
      total += n;
    });
    const files = Object.keys(baseline.files);
    files.forEach(function (f) {
      assert(!(f in now) || now[f] <= baseline.files[f],
        "sim copy grew in " + f + ": baseline " + baseline.files[f] + " -> now " + now[f] +
        "（新文案进 config.copy；若是注释行数自然变化，请同步更新 tests/sim-copy-baseline.json）");
    });
    assert(total <= baseline.total,
      "sim CJK line total grew: baseline " + baseline.total + " -> now " + total);
    // 基线文件覆盖了现存所有文件（新增文件含文案时必须重新登记）
    Object.keys(now).forEach(function (f) {
      assert(f in baseline.files,
        "new sim file with CJK copy is not in baseline: " + f + "（登记进 tests/sim-copy-baseline.json）");
    });
    ok("sim copy guard: CJK lines " + total + " <= baseline " + baseline.total);
  })();
};
