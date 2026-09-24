// 测试用例组：00-core-dims（由 scripts/split_tests.py 机械拆分，块内容未改）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok, PDIMS = ctx.PDIMS, TDIMS = ctx.TDIMS,
      fs = ctx.fs, path = ctx.path, ROOT = ctx.ROOT, SIM_FILES = ctx.SIM_FILES,
      __dirname = ctx.__dirname,
      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,
      fixCycle = ctx.fixCycle, withoutTitlePool = ctx.withoutTitlePool,
      withoutCatalog = ctx.withoutCatalog, withTitlePool = ctx.withTitlePool,
      tsum = ctx.tsum, hireOne = ctx.hireOne, firstIds = ctx.firstIds,
      pitchArgs = ctx.pitchArgs, quietWorld = ctx.quietWorld, fillerLadder = ctx.fillerLadder;
  (function assertPersonToTitleMatrix() {
    const mx = (config.careerWorld.quality || {}).personToTitle || {};
    const PD = ["program", "design", "art", "music"];
    PD.forEach(function (pd) {
      const row = mx[pd] || {};
      let rs = 0;
      TDIMS.forEach(function (td) {
        const w = row[td];
        assert(typeof w === "number" && w >= 0, "matrix " + pd + " -> " + td + " is a weight");
        rs += w;
      });
      assert(Math.abs(rs - 1) < 1e-9, "matrix row " + pd + " sums to 1 (got " + rs + ")");
    });
    TDIMS.forEach(function (td) {
      let cs = 0;
      PD.forEach(function (pd) { cs += (mx[pd] && mx[pd][td]) || 0; });
      assert(Math.abs(cs - 1) < 1e-9, "matrix column " + td + " sums to 1 (got " + cs + ")");
    });
  })();

};
