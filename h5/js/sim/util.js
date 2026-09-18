(function (root) {
  var sim = root.GDS.sim;

  sim.clone = function (st) {
    return JSON.parse(JSON.stringify(st));
  };

  // ── 两套维度 ────────────────────────────────────────────────────────────
  // 人物维：员工与玩家的属性（程序/策划/美术/音乐），走 roles[].stat、jobRanks、career.stats、
  //         inviteRoles、seniors[].tags。永远不要拿作品维去索引员工。
  // 作品维：作品自身的质量（游戏性/趣味性/表现力/沉浸感），走 titles[].stats、peakDims、
  //         qualityDim、liveStats、项目 stats。永远不要拿人物维去索引作品。
  // 两套是分开的键，靠 careerWorld.quality.personToTitle 系数矩阵换算。定义在
  // career-world.json 的 quality.dims / quality.personDims，这里只是代码侧的兜底默认值。
  var PERSON_DIMS = ["program", "design", "art", "music"];
  var TITLE_DIMS = ["play", "fun", "expression", "immersion"];

  function num0(v) {
    return typeof v === "number" && isFinite(v) ? v : 0;
  }

  function qualitySpec(config) {
    return (config && config.careerWorld && config.careerWorld.quality) || {};
  }

  // 读人物某一维。design 与 script 是同一个维的两套写法（roles[].stat 用 design、
  // 员工数据用 script），这里统一收口，别在别处再判一次。
  function personStatVal(stats, dim) {
    if (!stats) return 0;
    if (dim === "design") return num0(stats.design != null ? stats.design : stats.script);
    return num0(stats[dim]);
  }
  sim.personStatVal = personStatVal;

  sim.personDims = function (config) {
    var q = qualitySpec(config);
    return (q.personDims && q.personDims.length) ? q.personDims.slice() : PERSON_DIMS.slice();
  };

  sim.titleDims = function (config) {
    var q = qualitySpec(config);
    return (q.dims && q.dims.length) ? q.dims.slice() : TITLE_DIMS.slice();
  };

  // 维度展示名。月报（tick 的 notes）这类字符串会直接上屏，别把内部 id 漏给玩家。
  sim.personDimLabel = function (dim, config) {
    var c = (config && config.copy && config.copy.career) || {};
    var map = { program: c.dimProgram, design: c.dimDesign, art: c.dimArt, music: c.dimMusic };
    return map[dim] || dim;
  };

  sim.titleDimLabel = function (dim, config) {
    var c = (config && config.copy && config.copy.career) || {};
    return (c.prodDim || {})[dim] || dim;
  };

  // 作品四维的归一化克隆：只认作品维的键，缺的补 0。作品数据一律过这里。
  sim.cloneTitleStats = function (src, config) {
    var out = {};
    sim.titleDims(config).forEach(function (d) {
      out[d] = num0(src && src[d]);
    });
    return out;
  };

  // 作品四维合计。销量公式、最佳长线运营奖都用它，不要在各处再手写加法。
  sim.titleQualitySum = function (stats, config) {
    var s = 0;
    sim.titleDims(config).forEach(function (d) {
      s += num0(stats && stats[d]);
    });
    return s;
  };

  sim.titleQualityMean = function (stats, config) {
    var dims = sim.titleDims(config);
    return dims.length ? sim.titleQualitySum(stats, config) / dims.length : 0;
  };

  // 销量数字的中文短格式。销量改成百万级梯度后，2625727 这种裸数字既读不出来也撑爆行宽。
  // 一万以下原样，一万到一亿用「万」（过百万转整数），一亿以上用「亿」。UI 侧一律走这里。
  sim.formatUnits = function (n) {
    var v = Number(n);
    var f;
    if (!isFinite(v)) v = 0;
    v = Math.round(v);
    if (v < 0) v = 0;
    if (v >= 100000000) {
      f = v / 100000000;
      return (f >= 10 ? f.toFixed(1) : f.toFixed(2)) + " 亿";
    }
    f = v / 10000;
    if (f >= 100) return Math.round(f) + " 万";
    if (v >= 10000) return f.toFixed(1) + " 万";
    return String(v);
  };

  // 把「人物四维的一坨产出」按矩阵摊到作品四维上。mult 是可选全局倍率，matrixOverride 是
  // 可选矩阵（不传则用 quality.personToTitle）。这是人物侧与作品侧唯一的换算入口：月贡献、
  // 立项底分都走它，不要另写换算。没配矩阵时按位置对位。
  sim.titleStatsFromPerson = function (personStats, config, mult, matrixOverride) {
    var q = qualitySpec(config);
    var map = matrixOverride || q.personToTitle || {};
    var pdims = sim.personDims(config);
    var tdims = sim.titleDims(config);
    var m = mult == null ? 1 : mult;
    var out = {};
    tdims.forEach(function (d) { out[d] = 0; });
    pdims.forEach(function (pdim, i) {
      var v = personStatVal(personStats, pdim);
      if (!v) return;
      var row = map[pdim];
      if (row && typeof row === "object") {
        tdims.forEach(function (tdim) {
          var w = num0(row[tdim]);
          if (w) out[tdim] += v * w * m;
        });
        return;
      }
      out[tdims[i % tdims.length]] += v * m;
    });
    return out;
  };

  sim.matchesTrend = function (item, trend) {
    if (!item || !trend) return false;
    if (trend.genreId && item.genreId === trend.genreId) return true;
    if (trend.gameplayId && item.gameplayId === trend.gameplayId) return true;
    return false;
  };

  sim.fail = function (state, error) {
    return { ok: false, error: error, state: state };
  };

  sim.ok = function (st) {
    return { ok: true, state: st };
  };

  sim.unlockYear = function (item) {
    return item.unlockYear != null ? item.unlockYear : item.y;
  };

  sim.displayName = function (item) {
    return item.displayName || item.n || item.name || "";
  };

  sim.unlocked = function (list, year) {
    return (list || []).filter(function (x) {
      return sim.unlockYear(x) <= year;
    });
  };

  sim.contentName = function (list, id) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return sim.displayName(list[i]);
    return id;
  };

  sim.findById = function (list, id) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  sim.releaseTypeLabel = function (type, config) {
    var labels = (config.copy && config.copy.releaseTypes) || {};
    if (labels[type]) return labels[type];
    if (type === "liveops") return "长线运营（标记）";
    if (type === "outsource") return "外包接活";
    return "普通发售";
  };

  sim.padMonth = function (m) {
    return m < 10 ? "0" + m : String(m);
  };

  sim.dateText = function (st) {
    return st.year + "." + sim.padMonth(st.month);
  };

  // ── 天赋（config.traits）────────────────────────────────────────────────
  // 员工特性系统已随公司档移除，生涯档「天赋」沿用同一张表（scope: career）。
  sim.traitDef = function (id, config) {
    return (config && config.traits && config.traits[id]) || null;
  };

  sim.traitIds = function (config, scope) {
    var out = [];
    var traits = (config && config.traits) || {};
    var k, sc;
    for (k in traits) {
      if (!Object.prototype.hasOwnProperty.call(traits, k)) continue;
      if (k === "comment") continue;
      if (!traits[k] || !traits[k].displayName) continue;
      if (scope) {
        sc = traits[k].scope || "staff";
        if (sc !== scope) continue;
      }
      out.push(k);
    }
    return out;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
