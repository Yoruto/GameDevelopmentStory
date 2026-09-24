/* career-colleagues.js —— 自 career.js 迁出的独立域（制作组同事生成（5 个符号，全独占，最小验证域））。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var DIMS, clampJobRank, cloneStats, num;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    DIMS = _.DIMS;
    clampJobRank = _.clampJobRank;
    cloneStats = _.cloneStats;
    num = _.num;
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function colleagueBand(config, power) {
    var spec = (sim.careerWorld(config).colleagues) || {};
    var by = spec.byPower || {};
    var key = power != null ? String(power) : "2";
    return by[key] || by["2"] || {};
  }


  function colleaguePoolStale(pool) {
    var k;
    if (!pool) return true;
    for (k in pool) {
      if (Object.prototype.hasOwnProperty.call(pool, k)) {
        if (!pool[k] || pool[k].jobRank == null || !pool[k].stats) return true;
      }
    }
    return false;
  }


  function makeColleagueStats(st, roleId, band, config) {
    var q = (sim.careerWorld(config).quality) || {};
    var role = sim.careerRole(roleId, config);
    var dim = role && role.stat;
    var stats = cloneStats();
    var i, k, bonusMin, bonusMax, cap;
    var min = num(band.statMin, 0);
    var max = num(band.statMax, min);
    if (min > max) {
      cap = min;
      min = max;
      max = cap;
    }
    cap = q.statMax;
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      stats[k] = sim.irand(st, min, max);
    }
    if (dim) {
      bonusMin = num(band.specialtyBonusMin, 0);
      bonusMax = num(band.specialtyBonusMax, bonusMin);
      if (bonusMin > bonusMax) {
        k = bonusMin;
        bonusMin = bonusMax;
        bonusMax = k;
      }
      stats[dim] = num(stats[dim], 0) + sim.irand(st, bonusMin, bonusMax);
    }
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      if (stats[k] < 0) stats[k] = 0;
      if (cap != null && stats[k] > cap) stats[k] = cap;
    }
    return stats;
  }


  function makeColleagueRank(st, roleId, band, config) {
    var isProd = roleId === "producer";
    var min = isProd ? num(band.producerRankMin, band.specialistRankMin) : num(band.specialistRankMin, 1);
    var max = isProd ? num(band.producerRankMax, band.specialistRankMax) : num(band.specialistRankMax, min);
    if (min > max) {
      var tmp = min;
      min = max;
      max = tmp;
    }
    return clampJobRank(sim.irand(st, min, max), config);
  }


  // 按公司所在地区取姓名池（避免「卡普空的程序员叫阿肥」）。老字段 staffNamePool 作为 cn 池兜底。
  function colleagueNamePool(config, region) {
    var copy = (config && config.copy) || {};
    var by = copy.staffNamePoolByRegion || {};
    return by[region] || by.cn || copy.staffNamePool || ["同事"];
  }


  sim.ensureCareerColleagues = function (st, config) {
    var companyId = st.career && st.career.companyId;
    var roleIds = ["producer", "programmer", "art", "design", "music"];
    var pool, co, band, i, rid, stats, mate, region, names, taken, real, fb, order;
    if (!st.career || !companyId) {
      if (st.career) st.career.colleagues = [];
      return st;
    }
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    pool = st.career.colleaguePool[companyId];
    co = sim.careerCompany(companyId, config);
    band = colleagueBand(config, co && co.power);
    region = (co && co.region) || "cn";
    names = colleagueNamePool(config, region);
    if (colleaguePoolStale(pool)) {
      pool = {};
      taken = [];
      // 分人顺序按「候选人数」升序：最稀缺的岗位先挑。否则一岗多能的人（宫本茂是 producer+design）
      // 会被排在前面的一般岗位先占走，害得后面唯一能胜任他的岗位只能落随机名。
      order = roleIds.slice().sort(function (a, b) {
        var na = 0, nb = 0;
        if (sim.castRoster) {
          na = sim.castRoster({ companyId: companyId, year: num(st.year, 0), roleId: a }, config).length;
          nb = sim.castRoster({ companyId: companyId, year: num(st.year, 0), roleId: b }, config).length;
        }
        return na - nb;
      });
      for (i = 0; i < order.length; i++) {
        rid = order[i];
        stats = makeColleagueStats(st, rid, band, config);
        // 兜底名无论有无真实角色都先抽一次：保住 RNG 消费位序与改造前逐次一致，
        // 否则事件掷点 / 开局天赋的随机序列会整体位移（case-10 用固定种子断言同事属性）。
        fb = sim.pick(st, names);
        // 队友优先贴近真实角色；该岗位当年没有真实角色才用上面的兜底名。
        real = sim.castFor
          ? sim.castFor({ companyId: companyId, year: num(st.year, 0), roleId: rid, exclude: taken }, config)
          : null;
        if (real) taken.push(real.id);
        pool[rid] = {
          id: "col-" + companyId + "-" + (real ? real.id : rid),
          castId: real ? real.id : null,
          n: real ? sim.castName(real, config) : fb,
          roleId: rid,
          jobRank: makeColleagueRank(st, rid, band, config),
          stats: stats
        };
      }
      st.career.colleaguePool[companyId] = pool;
    }
    st.career.colleagues = [];
    for (i = 0; i < roleIds.length; i++) {
      rid = roleIds[i];
      if (rid === st.career.roleId) continue;
      mate = pool[rid];
      if (mate) st.career.colleagues.push(mate);
    }
    return st;
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
