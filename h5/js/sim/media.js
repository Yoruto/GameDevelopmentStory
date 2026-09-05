(function (root) {
  var sim = root.GDS.sim;

  sim.scoreMedia = function (st, stats, team, config) {
    var floor = 0;
    var meti = config.traits.meticulous;
    team.forEach(function (s) {
      if ((s.traits || []).indexOf("meticulous") >= 0) {
        floor += s.id && team[0] && s.id === team[0].id ? meti.producerScoreFloorBonus : meti.memberScoreFloorBonus;
      }
    });
    var media = config.release.media;
    var quotes = (config.copy && config.copy.mediaQuotes) || [""];
    var rows = media.outlets.map(function (o) {
      var w = o.weights;
      var wsum = w.program * stats.program + w.script * stats.script + w.art * stats.art + w.music * stats.music;
      var sc = wsum / media.scoreDivisor;
      sc = Math.max(media.minScore, Math.min(media.maxScore, sc + floor));
      sc = Math.round(sc * 10) / 10;
      return { id: o.id, n: o.displayName, score: sc };
    });
    var avg = 0;
    rows.forEach(function (r) { avg += r.score; });
    avg = Math.round((avg / rows.length) * 10) / 10;
    return { rows: rows, avg: avg, quote: sim.pick(st, quotes) };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
