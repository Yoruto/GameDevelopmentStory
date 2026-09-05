(function (root) {
  var sim = root.GDS.sim;

  sim.maybeOpenSeries = function (st, rec, config, notes) {
    if (rec.seriesId) return;
    if (rec.avg < config.series.mediaAverageThreshold) return;
    var sid = "ser" + st.rngCount;
    st.series.push({ id: sid, name: rec.title + "系列", gameIds: [rec.id], prestige: rec.avg });
    rec.seriesId = sid;
    notes.push("均分够了，开了系列「" + rec.title + "系列」");
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
