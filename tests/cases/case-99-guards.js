// 测试用例组：99-guards（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  // ── 加载列表同源守卫 ────────────────────────────────────────────────────────
  // 测试的 SIM_FILES 必须与 h5/index.html 的 <script> 顺序逐项一致：
  // 顺序即依赖顺序，漂移会让「测试全绿但真机某域不生效」。此前两处就不一致
  // （media/awards 与 events/lifecycle 互换），已按生产页顺序对齐。
  (function loaderOrderInSync() {
    const html = fs.readFileSync(path.join(ROOT, "h5", "index.html"), "utf8");
    const fromHtml = [];
    const re = /<script src="js\/sim\/([\w.\-]+\.js)"><\/script>/g;
    let m;
    while ((m = re.exec(html))) fromHtml.push(m[1]);
    assert(fromHtml.join(",") === SIM_FILES.join(","),
      "SIM_FILES 与 index.html 加载顺序不一致:\n  html : " + fromHtml.join(",") +
      "\n  tests: " + SIM_FILES.join(","));
    ok("loader order in sync with index.html (" + SIM_FILES.length + " files)");
  })();

  // ── sim API 面守卫 ──────────────────────────────────────────────────────────
  // career.js 正在按域拆分（见 scripts/split_career.py）：任何导出的丢失、重名覆盖、
  // 或共享基座 sim._ 的缺失都会在这里立刻爆掉，而不是等到真机某个分支静默失效。
  // 有意新增 / 删除 API 时：删掉 tests/sim-api-snapshot.json 后重跑一次即可重建基线。
  (function apiSurface() {
    const snapPath = path.join(__dirname, "sim-api-snapshot.json");
    const sharedPath = path.join(__dirname, "sim-shared-tools.json");
    const keys = Object.keys(GDS.sim).sort();
    // 共享基座完整性：career.js 末尾的 `if (typeof X !== 'undefined') _.X = X` 对
    // 「已迁入域文件」的符号会静默跳过 —— 这里逐个断言，防止域间调用变 undefined。
    assert(!!GDS.sim._, "shared base sim._ must exist (split files depend on it)");
    if (fs.existsSync(sharedPath)) {
      const shared = JSON.parse(fs.readFileSync(sharedPath, "utf8"));
      const missing = shared.filter(function (n) {
        return typeof GDS.sim._[n] === "undefined";   // 基座既有函数也有数组（DIMS/PLAYABLE）
      });
      assert(missing.length === 0,
        "shared base sim._ missing: [" + missing.join(",") +
        "] — 符号迁出 career.js 后未回挂基座");
      ok("shared base sim._ intact (" + shared.length + " tools)");
    } else {
      assert(typeof GDS.sim._.num === "function", "shared base sim._ must expose num");
      ok("shared base sim._ has num (run scripts/split_career.py to emit full manifest)");
    }
    if (!fs.existsSync(snapPath)) {
      fs.writeFileSync(snapPath, JSON.stringify(keys, null, 2) + "\n");
      ok("sim api surface baseline created (" + keys.length + " exports)");
      return;
    }
    const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
    const added = keys.filter(function (k) { return snap.indexOf(k) < 0; });
    const removed = snap.filter(function (k) { return keys.indexOf(k) < 0; });
    assert(added.length === 0 && removed.length === 0,
      "sim API surface changed — added:[" + added.join(",") + "] removed:[" + removed.join(",") + "]");
    ok("sim api surface unchanged (" + keys.length + " exports, sim._ base intact)");
  })();

};
