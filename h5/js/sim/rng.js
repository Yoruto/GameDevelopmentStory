(function (root) {
  var sim = root.GDS.sim;

  sim.rand = function (st) {
    st.rngCount += 1;
    st.rngSeed = (st.rngSeed * 1664525 + 1013904223) >>> 0;
    return st.rngSeed / 4294967296;
  };

  sim.irand = function (st, a, b) {
    return a + Math.floor(sim.rand(st) * (b - a + 1));
  };

  sim.pick = function (st, arr) {
    return arr[sim.irand(st, 0, arr.length - 1)];
  };

  // 按权重抽一项（weight 缺省为 1）。生涯档事件线 / 天赋抽取共用。
  sim.pickWeighted = function (st, items) {
    if (!items || !items.length) return null;
    var total = 0;
    var i, w;
    for (i = 0; i < items.length; i++) {
      w = items[i].weight == null ? 1 : items[i].weight;
      total += Math.max(0, w);
    }
    if (total <= 0) return items[0];
    var r = sim.rand(st) * total;
    var acc = 0;
    for (i = 0; i < items.length; i++) {
      acc += items[i].weight == null ? 1 : Math.max(0, items[i].weight);
      if (r < acc) return items[i];
    }
    return items[items.length - 1];
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
