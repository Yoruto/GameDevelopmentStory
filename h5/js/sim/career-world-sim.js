/* career-world-sim.js —— 自 career.js 迁出的独立域（虚拟作品池 + 世界作品月度推进（P1 数据归并 / P2b 虚拟池开关落点））。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var PLAYABLE, creditIsSigned, findWorldReleased, liveFromTitle, num, pushWorldReleased;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    var missing = [];
    PLAYABLE = _.PLAYABLE; if (typeof PLAYABLE === 'undefined') missing.push('PLAYABLE');
    creditIsSigned = _.creditIsSigned; if (typeof creditIsSigned === 'undefined') missing.push('creditIsSigned');
    findWorldReleased = _.findWorldReleased; if (typeof findWorldReleased === 'undefined') missing.push('findWorldReleased');
    liveFromTitle = _.liveFromTitle; if (typeof liveFromTitle === 'undefined') missing.push('liveFromTitle');
    num = _.num; if (typeof num === 'undefined') missing.push('num');
    pushWorldReleased = _.pushWorldReleased; if (typeof pushWorldReleased === 'undefined') missing.push('pushWorldReleased');
    // 绑定发生在加载期，若某个工具所属文件排在本文件之后，会拿到 undefined。
    // 这里出声，免得变成运行到某分支才炸的静默故障。
    if (missing.length && root.console && console.warn) {
      console.warn('[GDS] career-world-sim.js: 基座工具绑定失败（检查加载顺序）:', missing.join(', '));
    }
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function landmarkMonthBlocked(st, companyId, year, month, config) {
    var spec = sim.titlePoolSpec(config);
    var titles, i, t;
    if (spec.landmarkBlockSameMonth === false) return false;
    titles = sim.careerWorld(config).titles || [];
    for (i = 0; i < titles.length; i++) {
      t = titles[i];
      if (t.companyId === companyId && t.landmark && t.releaseYear === year && t.releaseMonth === month) {
        return true;
      }
    }
    return false;
  }


  function usedVirtualNames(st, config) {
    var used = {};
    var world = sim.careerWorld(config);
    var i, t, list;
    function mark(n) {
      if (n) used[String(n)] = true;
    }
    list = (world && world.titles) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
    }
    list = (st && st.career && st.career.virtualProjects) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
    }
    list = (st && st.worldReleased) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
      mark(t.title);
    }
    return used;
  }


  function collectGenreTitles(pool, genreId) {
    var byGenre = (pool && pool.titlesByGenre) || {};
    var out = [];
    var key, i, names;
    if (genreId && byGenre[genreId] && byGenre[genreId].length) {
      return byGenre[genreId].slice();
    }
    for (key in byGenre) {
      if (!Object.prototype.hasOwnProperty.call(byGenre, key)) continue;
      names = byGenre[key] || [];
      for (i = 0; i < names.length; i++) out.push(names[i]);
    }
    return out;
  }


  // ── 池作的确定性抽取 ───────────────────────────────────────────────────────
  // 池作必须确定性生成：同一家公司同一个月永远抽出同一部作（重开档一致、读档不漂），
  // 而且绝不能消费 st.rng——否则开局抽天赋、事件掷点的随机流会跟着位移。
  // 所以这里一律「字符串哈希 + 取模」，不碰 sim.pick / sim.rand。
  function hash32(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function mixSeed(seed) {
    var x = (seed >>> 0);
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x >>> 0;
  }

  function pickBySeed(list, seed) {
    if (!list || !list.length) return null;
    return list[mixSeed(seed) % list.length];
  }

  function pickWeightedBySeed(weights, seed) {
    var total = 0, acc = 0, r, i;
    if (!weights || !weights.length) return null;
    for (i = 0; i < weights.length; i++) total += num(weights[i].weight, 1);
    if (total <= 0) return weights[0].id;
    r = mixSeed(seed) % total;
    for (i = 0; i < weights.length; i++) {
      acc += num(weights[i].weight, 1);
      if (r < acc) return weights[i].id;
    }
    return weights[weights.length - 1].id;
  }

  // 池作名：按题材从 titlesByGenre 抽，本局用过的（目录名 / 已抽过的池作名 / 已发售名）不再抽。
  // 名字也走 seed，保证确定性；整池用光才退回 fallbackName + 序号。
  function pickPoolName(st, config, genreId, seed) {
    var pool = sim.titlePoolSpec(config);
    var used = usedVirtualNames(st, config);
    var names = collectGenreTitles(pool, genreId);
    var free = [];
    var i, all, name;
    for (i = 0; i < names.length; i++) {
      if (!used[names[i]]) free.push(names[i]);
    }
    if (!free.length) {
      all = collectGenreTitles(pool, null);
      for (i = 0; i < all.length; i++) {
        if (!used[all[i]]) free.push(all[i]);
      }
    }
    if (free.length) {
      name = pickBySeed(free, seed);
      return { name: name, alias: name };
    }
    name = (pool.fallbackName || "未名计划") + ((mixSeed(seed) % 97) + 1);
    return { name: name, alias: name };
  }


  // ── 游戏池兜底：算出一部「顶空档」的池作 ──────────────────────────────────
  // 纯计算：不写 state、不掷 RNG，返回 { title, detail } 或 null。
  // null 的含义是「这个月不值得/不能开」——池没开、或到下一档目录真作的空窗太短
  // （< titlePool.coverage.minFillMonths，开了也会被下一档真作的开工月截断，交给推进吸收）。
  // 规则与字段说明见 activity/career-world.json 的 titlePool.comment。
  sim.poolCandidateAt = function (st, config, companyId, studioId, year, month, opts) {
    var spec, cov, content, studio, now, minM, maxM, next, nextDet, nextStart, gap, cap;
    var seed, genreId, gameplayId, pickedName, months, relY, relM, tries, base, n, id, title, detail;
    if (!sim.titlePoolUsable(config)) return null;
    if (!st || !companyId || year == null) return null;
    opts = opts || {};
    spec = sim.titlePoolSpec(config);
    cov = spec.coverage || {};
    content = config.content || {};
    now = sim.monthIndex(year, month);
    studio = sim.careerStudio(companyId, studioId, config);
    minM = sim.poolMinFillMonths(config);
    maxM = Math.min(num(cov.maxFillMonths, 24), num(spec.devMonthsMax, 24));
    if (maxM < minM) maxM = minM;
    next = sim.nextCatalogTitle(st, config, companyId, studioId, year, month);
    nextDet = next ? sim.careerTitleDetail(next.id, config, st) : null;
    nextStart = next && nextDet ? sim.titleDevStart(next, nextDet, config) : null;
    gap = nextStart == null ? null : nextStart - now;
    if (gap != null && gap < minM) return null;
    cap = gap == null ? maxM : Math.min(maxM, gap);
    if (cap < minM) return null;
    seed = hash32(companyId + "|" + (studioId || "") + "|" + now);
    // 题材/玩法优先跟工作室的偏好走（这家工作室本来就是做这个的），再退到全局权重表。
    genreId = opts.genreId || pickBySeed(studio && studio.genreIds, seed) ||
      pickWeightedBySeed(spec.genreWeights, seed) ||
      pickBySeed((content.genres || []).map(function (g) { return g.id; }), seed);
    gameplayId = opts.gameplayId || pickBySeed(studio && studio.gameplayIds, seed ^ 0x9e3779b9) ||
      pickWeightedBySeed(spec.gameplayWeights, seed ^ 0x9e3779b9) ||
      pickBySeed((content.gameplay || []).map(function (g) { return g.id; }), seed ^ 0x9e3779b9);
    if (!genreId || !gameplayId) return null;
    months = minM + (mixSeed(seed) % (cap - minM + 1));
    relY = year;
    relM = month + months;
    while (relM > 12) { relM -= 12; relY += 1; }
    // 不要和本公司同月的 landmark 发售撞车（titlePool.landmarkBlockSameMonth）。
    tries = 0;
    while (landmarkMonthBlocked(st, companyId, relY, relM, config) && tries < 12) {
      if (nextStart != null && sim.monthIndex(relY, relM) + 1 >= nextStart) break;
      relM += 1;
      if (relM > 12) { relM = 1; relY += 1; }
      months += 1;
      tries += 1;
    }
    if (nextStart != null && sim.monthIndex(relY, relM) > nextStart) {
      months = nextStart - now;
      if (months < minM) return null;
      relY = year;
      relM = month + months;
      while (relM > 12) { relM -= 12; relY += 1; }
    }
    sim.ensureCareerColleagues(st, config);
    n = sim.careerTeamMembers(st, config).length;
    base = sim.careerCraftLiveStats(st, months, n, config, genreId, gameplayId);
    pickedName = pickPoolName(st, config, genreId, seed);
    id = "pool-" + companyId + "-" + now;
    title = {
      id: id,
      companyId: companyId,
      publisherId: companyId,
      studioId: studioId || null,
      name: pickedName.name,
      alias: pickedName.alias,
      releaseYear: relY,
      releaseMonth: relM,
      score: sim.careerCraftPublicScore(sim.titleQualityMean(base, config), config),
      platforms: ["pc"],
      genreId: genreId,
      gameplayId: gameplayId,
      releaseType: "boxed",
      landmark: false,
      prestige: num(spec.prestige, 2),
      stats: base,
      virtual: true,
      pool: true
    };
    detail = {
      id: id,
      blurb: "",
      careerNote: "",
      devStartYear: year,
      devStartMonth: month,
      devMonths: months,
      inviteWindow: {
        startYear: year,
        startMonth: month,
        endYear: relY,
        endMonth: relM
      },
      inviteRoles: PLAYABLE.slice(),
      inviteMinFame: 0,
      inviteEligible: false,
      teamSize: 5,
      awards: [],
      liveAfterRelease: false,
      virtual: true,
      pool: true
    };
    return { title: title, detail: detail };
  };

  // 真正把池作落盘（玩家接手）：写进 virtualProjects / virtualDetails
  // —— careerTitle / careerTitleDetail / allCareerTitles 都认这两个容器。
  // 同一家公司同一个月只会有一部（id 由公司 + 开工月定死），重复调用直接复用。
  sim.startPoolProject = function (st, config, opts) {
    var cand, exist;
    if (!st || !st.career || !st.career.companyId) return null;
    cand = sim.poolCandidateAt(st, config, st.career.companyId, st.career.studioId, st.year, st.month, opts);
    if (!cand) return null;
    if (!st.career.virtualProjects) st.career.virtualProjects = [];
    if (!st.career.virtualDetails) st.career.virtualDetails = [];
    exist = sim.findById(st.career.virtualProjects, cand.title.id);
    if (exist) return exist;
    st.career.virtualProjects.push(cand.title);
    st.career.virtualDetails.push(cand.detail);
    st.career.virtualSeq = num(st.career.virtualSeq, 0) + 1;
    st.career.poolSeq = num(st.career.poolSeq, 0) + 1;
    return cand.title;
  };

  // 旧名（虚拟池时代的入口）。剧情拍、probe 脚本还在用，保留一行别名。
  sim.startVirtualProject = sim.startPoolProject;


  sim.queueProducerVirtualPitch = function (st, config, queue) {
    var world, content, genres, gameplay, pairs, opts, i, j;
    if (!st || !st.career) return false;
    // 池不可用时，制作人的「自定向下立项」也一并停用——它产出的还是池作。
    if (!sim.titlePoolUsable(config)) return false;
    if (!(sim.isCareerProducer && sim.isCareerProducer(st))) return false;
    if (st.career.titleId) {
      var cur = sim.careerTitle(st.career.titleId, config, st);
      if (cur && !cur.virtual) return false;
    }
    world = sim.careerWorld(config);
    content = config.content || {};
    genres = (content.genres || []).slice();
    gameplay = (content.gameplay || []).slice();
    if (!genres.length || !gameplay.length) return false;
    pairs = [];
    for (i = 0; i < genres.length && pairs.length < 4; i++) {
      for (j = 0; j < gameplay.length && pairs.length < 4; j++) {
        pairs.push({ genre: genres[i], gameplay: gameplay[j] });
      }
    }
    if (!pairs.length) return false;
    opts = pairs.map(function (p, idx) {
      return { id: "pitch-" + idx, genreId: p.genre.id, gameplayId: p.gameplay.id };
    });
    st.career.producerPitchOptions = opts;
    st.career.awaitingProducerPitch = true;
    if (queue) {
      queue.push({
        type: "producerPitch",
        kind: "event",
        id: "producerPitch",
        options: opts,
        kicker: (world.producerCareer && world.producerCareer.pitchKicker) || "制作人企划",
        title: (world.producerCareer && world.producerCareer.pitchTitle) || "下一部作品方向",
        body: ""
      });
    }
    return true;
  };


  sim.resolveProducerPitch = function (st, optId, config) {
    var opts, chosen, title;
    if (!st || !st.career) return { ok: false };
    if (!(sim.isCareerProducer && sim.isCareerProducer(st))) return { ok: false };
    if (!st.career.awaitingProducerPitch) return { ok: false };
    opts = st.career.producerPitchOptions || [];
    chosen = null;
    for (var i = 0; i < opts.length; i++) { if (opts[i].id === optId) { chosen = opts[i]; break; } }
    if (!chosen) return { ok: false };
    title = sim.startVirtualProject(st, config, { genreId: chosen.genreId, gameplayId: chosen.gameplayId });
    if (!title || !title.virtual) return { ok: false };
    st.career.titleId = title.id;
    st.career.liveStats = liveFromTitle(st, title, config);
    st.career.awaitingProducerPitch = false;
    st.career.producerPitchOptions = null;
    st.career.idleMonths = 0;
    return { ok: true, virtual: true, state: st, titleId: title.id };
  };


  sim.shipWorldTitlesThisMonth = function (st, config, queue) {
    var titles = sim.allCareerTitles(config, st);
    var skip = st.career && st.career.titleId;
    titles.forEach(function (t) {
      var rec, leftover, signed, participated, label;
      if (skip && t.id === skip) return;
      if (t.releaseYear === st.year && t.releaseMonth === st.month && !findWorldReleased(st, t.id)) {
        leftover = st.career && st.career.leftProjectLive && st.career.leftProjectLive[t.id];
        signed = (st.career.credits || []).some(function (c) {
          return c.titleId === t.id && creditIsSigned(c);
        });
        participated = (st.career.credits || []).some(function (c) {
          return c.titleId === t.id;
        });
        rec = pushWorldReleased(st, t, config, signed);
        if (leftover) rec.stats = sim.cloneTitleStats(leftover, config);
        rec.player = !!signed;
        // 关键节点（Master 2026-09-22）：参与制作的作品发售不许被推进静默吞掉——
        // 之前这里只落库不推页，玩家拨到下个项目后《辐射》这类署名发售直接消失。
        // 参与口径与奖项提名一致（career-awards 的 credits[c.titleId]）：有参与记录就停机揭晓。
        if (participated && queue) {
          label = sim.worldLabel(t, config);
          queue.push({
            type: "media",
            kind: "info",
            kicker: (sim.careerCopy(config) || {}).shipKicker || "发售",
            title: label,
            body: "你参与制作的这部作品今天发售了。媒体均分 " + num(rec.score, 0) + "。",
            rec: rec
          });
        }
      }
    });
  };


  sim.liveStatsForMedia = function (live, config) {
    return sim.cloneTitleStats(live, config);
  };


  // ── 人物层 cast：真实角色 / 随机角色 ────────────────────────────────────────
  // 双模式姓名由 careerWorld.nameMode 决定：real（默认）= name 真名，fiction = alias 虚构名。
  // 全部纯读 —— 不写 state、不消费 RNG；同一「公司 + 年代 + 岗位」恒取到同一个人。
  function castAll(config) {
    var w = sim.careerWorld(config);
    return (w && w.cast) || [];
  }

  function castNameMode(config) {
    var w = sim.careerWorld(config);
    return (w && w.nameMode) === "fiction" ? "fiction" : "real";
  }

  // 在职判定：year 落在任一 career[] 窗口内。没有窗口数据视为恒在职（降级，老数据不改也能跑）。
  function castOnDuty(p, year) {
    var c, i;
    if (!p || year == null) return true;
    if (!p.career || !p.career.length) return true;
    for (i = 0; i < p.career.length; i++) {
      c = p.career[i];
      if (!c) continue;
      if (c.fromYear != null && year < c.fromYear) continue;
      if (c.toYear != null && year > c.toYear) continue;
      return true;
    }
    return false;
  }

  function castKey(o) {
    return [
      (o && o.companyId) || "",
      (o && o.year) == null ? "" : o.year,
      (o && o.roleId) || ""
    ].join("|");
  }

  sim.castName = function (person, config) {
    var real, fic;
    if (!person) return "";
    if (typeof person === "string") return person;
    real = person.name || person.displayName || person.n || "";
    fic = person.alias || "";
    if (castNameMode(config) === "fiction") return fic || real;
    return real || fic;
  };

  sim.castLabel = function (person, config) {
    var name, title;
    if (!person) return "";
    name = sim.castName(person, config);
    title = person.title || "";
    if (name && title) return name + " · " + title;
    return name || title;
  };

  // 队友显示名：有真实角色就实时解析（切姓名模式也跟着变），否则回落池名快照。
  sim.colleagueName = function (mate, config) {
    var cast;
    if (!mate) return "";
    cast = mate.castId && sim.castFind ? sim.castFind(mate.castId, config) : null;
    if (cast) return sim.castName(cast, config);
    return mate.n || "";
  };

  sim.castFind = function (id, config) {
    var list = castAll(config), i;
    if (!id) return null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  };

  // 该公司当年在职的真实角色名单（入职介绍 / 制作组名单 / 队友优选）。
  sim.castRoster = function (opts, config) {
    var list = castAll(config), o = opts || {}, out = [], i, p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p || !p.real) continue;
      if (o.companyId && p.companyId !== o.companyId) continue;
      if (o.roleId && (p.roles || []).indexOf(o.roleId) < 0) continue;
      if (!castOnDuty(p, o.year)) continue;
      out.push(p);
    }
    return out;
  };

  function castNotIn(list, ex) {
    var out = [], i;
    if (!ex || !ex.length) return list;
    for (i = 0; i < list.length; i++) {
      if (ex.indexOf(list[i].id) < 0) out.push(list[i]);
    }
    return out;
  }

  // 自由职业池（作曲 / 外包美术）：不绑公司，任何公司在岗期间都能合作 —— 现实里这两个工种本就大量外包，
  // 所以它们是「公司驻员为空」时的第二级来源，而不是被硬塞成某家公司的正式员工。
  function castFreelance(o, config) {
    var list = castAll(config), out = [], i, p;
    if (!o || !o.roleId) return out;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p || !p.real || p.attach !== "freelance") continue;
      if ((p.roles || []).indexOf(o.roleId) < 0) continue;
      if (!castOnDuty(p, o.year)) continue;
      out.push(p);
    }
    return out;
  }

  // 统一取人入口：本公司驻员优先 → 自由职业者兜底 → 都没有返回 null（交调用方落随机角色）。
  sim.castFor = function (opts, config) {
    var o = opts || {};
    var ex = o.exclude || [];
    var hit = castNotIn(sim.castRoster(o, config), ex);
    if (!hit.length) hit = castNotIn(castFreelance(o, config), ex);
    if (!hit.length) return null;
    return pickBySeed(hit, hash32(castKey(o)));
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
