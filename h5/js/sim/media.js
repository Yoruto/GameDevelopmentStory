(function (root) {
  var sim = root.GDS.sim;

  function num(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    return fallback;
  }

  function mediaStat(stats, key) {
    return num(stats && stats[key], 0);
  }

  // 该媒体权重最高的那一维，决定抽哪个评语池。作品维顺序从 config 读。
  function peakWeightDim(weights, config) {
    var keys = sim.titleDims(config);
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
    var top = media.topScore != null ? media.topScore : 9.5;
    var high = media.highScore != null ? media.highScore : 8;
    var low = media.lowScore != null ? media.lowScore : 5;
    if (score >= top) return "top";
    if (score >= high) return "high";
    if (score <= low) return "low";
    return "mid";
  }

  // 从某个池里拿该档的评语。缺档时按「就近」回退：顶级→高分，低分→中分，
  // 不是简单的 || 链，避免将来只补了 top 池却掉到中评去。
  var BAND_CHAIN = {
    top: ["top", "high", "mid", "low"],
    high: ["high", "top", "mid", "low"],
    mid: ["mid", "high", "low", "top"],
    low: ["low", "mid", "high", "top"]
  };

  function bandList(pool, band) {
    var chain = BAND_CHAIN[band] || BAND_CHAIN.mid;
    var i, list;
    if (!pool) return null;
    for (i = 0; i < chain.length; i++) {
      list = pool[chain[i]];
      if (list && list.length) return list;
    }
    return null;
  }

  function pickOutletQuote(st, outlet, score, config) {
    var copy = config.copy || {};
    var media = config.release.media;
    var pools = copy.mediaQuotePools || {};
    var dim = peakWeightDim(outlet.weights, config);
    var band = quoteBand(score, media);
    var outletPool = pools.outlets && outlet && pools.outlets[outlet.id];
    var dimPool = pools[dim] || pools.overall || {};
    var list;
    if (outletPool) list = bandList(outletPool, band);
    if (!list) list = bandList(dimPool, band);
    if (!list) list = bandList(pools.overall, band);
    if (!list || !list.length) list = copy.mediaQuotes || [""];
    return sim.pick(st, list);
  }

  // 均分的唯一定义：四家已落盘分数的算术平均，再四舍五入一位小数（与榜单上显示的四家分
  // 同精度）。**面板上的「均分」必须能被玩家拿看得见的四个数手算出来**，所以这里一律从
  // rows 反算，不接受任何外部传入的口碑——那是抖动的中心，不是均分（见 media.js 顶部注释
  // 与 scatterOffsets）。
  function finish(st, rows, quotes) {
    var sum = 0;
    rows.forEach(function (r) { sum += num(r.score, 0); });
    var avg = rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0;
    return { rows: rows, avg: avg, quote: (rows[0] && rows[0].quote) || sim.pick(st, quotes) };
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
      var wsum = 0;
      sim.titleDims(config).forEach(function (d) {
        wsum += num(w && w[d], 0) * mediaStat(stats, d);
      });
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
    return finish(st, rows, quotes);
  };

  // 四家分数是「同一件作品的四种意见」：彼此有分歧，但不该把作品的均分带跑。
  // 做法三条：
  //   1. 正负各半（n=4 时正好两家偏高、两家偏低，哪两家偏高随机轮换）——保证分歧永远存在；
  //   2. 把幅度大的那一侧按比例压到小的一侧，两侧相抵 → **均分恒等于对外口碑**（只差四舍五入）；
  //   3. 再按到上下限的余量整体收窄，永远不吃 minScore/maxScore 的夹子——**一旦被夹，均分就
  //      和口碑脱节**。夹住正是 2026-09-18 那个 bug 的成因：口碑 10 时，本该 +0.5 的那几家被
  //      夹回 10、本该 −0.5 的照旧往下扣，四家均值掉到 9.6~9.9，而面板把口碑 10 当均分显示
  //      （四家都不是 10 分，均分却写 10）。
  // 第 3 条还有个好处：满分作余量正好为 0，四家一致给 10，均分真的到得了 10。
  // 注意别退回「各自取随机符号、再一起减去均值」的写法：四家符号全同时（概率 2/16），
  // 均值本身就有 0.4~0.6，减完残差趋近 0，四家会同分、分歧消失。
  function scatterOffsets(st, publicScore, config, jMin, jMax) {
    var media = config.release.media;
    var n = media.outlets.length;
    var mags = [], offs = [], i, mag, rot, posSum = 0, negSum = 0, big, small, k, limit, mx;
    for (i = 0; i < n; i++) mags.push(jMin + sim.rand(st) * (jMax - jMin));
    // 正负各半：用一次随机轮换决定「从哪一家开始算偏高」，避免永远是同一两家给高分。
    rot = Math.floor(sim.rand(st) * n) % n;
    for (i = 0; i < n; i++) {
      mag = mags[i];
      if (((i + rot) % n) < n / 2) { offs[i] = mag; posSum += mag; }
      else { offs[i] = -mag; negSum += mag; }
    }
    // 配平：大的一侧按比例压到小的一侧。压完每个偏移只会更小，仍 ≤ 抖动上限 jMax。
    big = posSum > negSum ? posSum : negSum;
    small = posSum > negSum ? negSum : posSum;
    if (big > 0 && big !== small) {
      k = small / big;
      for (i = 0; i < n; i++) {
        if ((offs[i] > 0) === (posSum > negSum)) offs[i] *= k;
      }
    }
    // 余量收窄：到 minScore / maxScore 的距离决定这次能抖多少，全局同比压缩不再破坏零和。
    limit = Math.min(media.maxScore - publicScore, publicScore - media.minScore);
    mx = 0;
    for (i = 0; i < n; i++) {
      if (Math.abs(offs[i]) > mx) mx = Math.abs(offs[i]);
    }
    if (!(limit > 0)) {
      for (i = 0; i < n; i++) offs[i] = 0;
    } else if (mx > limit) {
      k = limit / mx;
      for (i = 0; i < n; i++) offs[i] *= k;
    }
    return offs;
  }

  sim.scoreMediaFromPublic = function (st, publicScore, config, scatter) {
    var media = config.release.media;
    var quotes = (config.copy && config.copy.mediaQuotes) || [""];
    var jMin, jMax, tmp, offs;
    scatter = scatter || {};
    jMin = num(scatter.min, 0);
    jMax = num(scatter.max, 0);
    if (jMin > jMax) {
      tmp = jMin;
      jMin = jMax;
      jMax = tmp;
    }
    publicScore = num(publicScore, media.minScore);
    offs = scatterOffsets(st, publicScore, config, jMin, jMax);
    var rows = media.outlets.map(function (o, idx) {
      var sc = publicScore + num(offs[idx], 0);
      sc = Math.max(media.minScore, Math.min(media.maxScore, sc));
      sc = Math.round(sc * 10) / 10;
      return {
        id: o.id,
        n: o.displayName,
        score: sc,
        quote: pickOutletQuote(st, o, sc, config)
      };
    });
    return finish(st, rows, quotes);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
