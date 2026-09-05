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
})(typeof globalThis !== "undefined" ? globalThis : this);
