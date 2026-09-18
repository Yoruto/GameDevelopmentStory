(function (root) {
  var sim = root.GDS.sim;

  // 现行 H5 只有人生生涯档：点月唯一入口就是 tickCareerMonth。
  sim.tickMonth = function (state, config) {
    return sim.tickCareerMonth(state, config);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
