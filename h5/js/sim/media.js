(function (root) {
  var sim = root.GDS.sim;

  function num(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    return fallback;
  }

  function mediaStat(stats, key) {
    if (key === "script") return num(stats.script, num(stats.design, 0));
    if (key === "design") return num(stats.design, num(stats.script, 0));
    return num(stats[key], 0);
  }

  function peakWeightDim(weights) {
    var keys = ["program", "script", "art", "music"];
    var best = keys[0];
    var bestW = -1;
    var i;
    weights = weights || {};
    for (i = 0; i < keys.length; i++) {
      if (num(weights[keys[i]], 0) > bestW) {
        bestW = num(weights[keys[i]], 0);
        best = keys[i];
      }
    }
    return best;
  }

  function quoteBand(score, media) {
    var high = media.highScore != null ? media.highScore : 8;
    var low = media.lowScore != null ? media.lowScore : 5;
    if (score >= high) return "high";
    if (score <= low) return "low";
    return "mid";
  }

  function pickOutletQuote(st, outlet, score, config) {
    var copy = config.copy || {};
    var media = config.release.media;
    var pools = copy.mediaQuotePools || {};
    var dim = peakWeightDim(outlet.weights);
    var band = quoteBand(score, media);
    var outletPool = pools.outlets && outlet && pools.outlets[outlet.id];
    var dimPool = pools[dim] || pools.overall || {};
    var list;
    if (outletPool) {
      list = outletPool[band] || outletPool.mid || outletPool.high || outletPool.low;
    }
    if (!list || !list.length) {
      list = dimPool[band] || dimPool.mid || dimPool.high || dimPool.low;
    }
    if (!list || !list.length) {
      list = (pools.overall && (pools.overall[band] || pools.overall.mid)) || copy.mediaQuotes || [""];
    }
    return sim.pick(st, list);
  }

  sim.scoreMedia = function (st, stats, team, config, producerId) {
    var floor = 0;
    var leadId = producerId || (team[0] && team[0].id);
    team = team || [];
    team.forEach(function (s) {
      var isP = !!(leadId && s.id === leadId);
      (s.traits || []).forEach(function (id) {
        var t = sim.traitDef(id, config);
        if (!t) return;
        floor += isP ? (t.producerScoreFloorBonus || 0) : (t.memberScoreFloorBonus || 0);
      });
    });
    var media = config.release.media;
    var quotes = (config.copy && config.copy.mediaQuotes) || [""];
    var rows = media.outlets.map(function (o) {
      var w = o.weights;
      var wsum = w.program * mediaStat(stats, "program") +
        w.script * mediaStat(stats, "script") +
        w.art * mediaStat(stats, "art") +
        w.music * mediaStat(stats, "music");
      var sc = wsum / media.scoreDivisor;
      sc = Math.max(media.minScore, Math.min(media.maxScore, sc + floor));
      sc = Math.round(sc * 10) / 10;
      return {
        id: o.id,
        n: o.displayName,
        score: sc,
        quote: pickOutletQuote(st, o, sc, config)
      };
    });
    var avg = 0;
    rows.forEach(function (r) { avg += r.score; });
    avg = Math.round((avg / rows.length) * 10) / 10;
    return { rows: rows, avg: avg, quote: (rows[0] && rows[0].quote) || sim.pick(st, quotes) };
  };

  sim.scoreMediaFromPublic = function (st, publicScore, config, scatter) {
    var media = config.release.media;
    var quotes = (config.copy && config.copy.mediaQuotes) || [""];
    var jMin, jMax, tmp;
    scatter = scatter || {};
    jMin = num(scatter.min, 0);
    jMax = num(scatter.max, 0);
    if (jMin > jMax) {
      tmp = jMin;
      jMin = jMax;
      jMax = tmp;
    }
    publicScore = num(publicScore, media.minScore);
    var rows = media.outlets.map(function (o) {
      var mag = jMin + sim.rand(st) * (jMax - jMin);
      var sign = sim.rand(st) < 0.5 ? -1 : 1;
      var sc = publicScore + sign * mag;
      sc = Math.max(media.minScore, Math.min(media.maxScore, sc));
      sc = Math.round(sc * 10) / 10;
      return {
        id: o.id,
        n: o.displayName,
        score: sc,
        quote: pickOutletQuote(st, o, sc, config)
      };
    });
    var avg = 0;
    rows.forEach(function (r) { avg += r.score; });
    avg = Math.round((avg / rows.length) * 10) / 10;
    return { rows: rows, avg: avg, quote: (rows[0] && rows[0].quote) || sim.pick(st, quotes) };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
