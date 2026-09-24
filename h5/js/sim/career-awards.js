/* career-awards.js —— 自 career.js 迁出的独立域（年度颁奖评选与剧情页）。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var creditIsSigned, fillPaceTemplate, num;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    creditIsSigned = _.creditIsSigned;
    fillPaceTemplate = _.fillPaceTemplate;
    num = _.num;
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function careerAwardCandidate(g, config) {
    var stats = sim.cloneTitleStats(g && g.stats, config);
    var score = g.score != null ? g.score : num(g.avg, 0);
    var out = {
      player: !!g.player,
      titleId: g.id,
      title: sim.worldLabel(g, config),
      label: sim.worldLabel(g, config),
      avg: score,
      score: score,
      qsum: sim.titleQualitySum(stats, config),
      stats: stats,
      prestige: num(g.prestige, 0),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType,
      // 销量口径统一走 launchSales：worldReleased 上记的是首月实销，没有 sales 字段。
      // 之前只读 g.sales，候选的销量恒为 undefined，导致「玩家之选」回退到 prestige——
      // 奖项名不副实。
      sales: num(g.launchSales != null ? g.launchSales : g.sales, 0)
    };
    // 顶层再摊开一份作品维，供 readAwardStat 的 title[dim] 回退读取。
    sim.titleDims(config).forEach(function (d) { out[d] = num(stats[d], 0); });
    return out;
  }

  // ── TGA 评分子 ──────────────────────────────────────────────────────────
  // 归一化三部分（口碑 / 质量 / 商业，都是 0-100）才能加权比较。

  function awardScoreParts(c, config) {
    var spec = (config.awards && config.awards.score) || {};
    var dims = sim.titleDims(config).length || 4;
    var salesRef = num(spec.salesRef, 0);
    var salesCap = num(spec.salesScoreCap, 100);
    var sales = num(c.sales, 0);
    var salesPart = 0;
    if (sales > 0 && salesRef > 0) {
      salesPart = num(spec.salesLogScale, 0) * Math.log(1 + sales / salesRef) / Math.LN10;
      if (salesPart > salesCap) salesPart = salesCap;
    }
    return {
      score: Math.max(0, Math.min(100, num(c.score, 0) * 10)),
      quality: Math.max(0, Math.min(100, num(c.qsum, 0) / dims)),
      sales: Math.max(0, salesPart)
    };
  }


  function awardWeightsFor(a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var weights = spec.weights || {};
    return (a && a.id && weights[a.id]) || weights.default || { score: 0.5, quality: 0.3, sales: 0.2 };
  }


  function awardScoreOf(c, a, config) {
    var w = awardWeightsFor(a, config);
    var p = c._parts || awardScoreParts(c, config);
    return num(w.score, 0) * p.score + num(w.quality, 0) * p.quality + num(w.sales, 0) * p.sales;
  }

  // 奖项专属分：stat 类看对应那一维、avg 看口碑、sales 看商业、qsum 看质量。

  function awardCategoryPart(c, a, config) {
    var from = a.scoreFrom || (a.stat ? "stat" : "");
    var p = c._parts || awardScoreParts(c, config);
    var v;
    if (from === "avg" || from === "score") return p.score;
    if (from === "sales") return p.sales;
    if (from === "qsum") return p.quality;
    if (a.stat) {
      v = sim.readAwardStat(c, a.stat, a.statAliases);
      return Math.max(0, Math.min(100, v));
    }
    return p.score;
  }

  // 提名与得奖的排序键。按奖项口径分三路，别一刀切：
  //   单一维度奖（stat）→ 0.8 × 该维 + 0.2 × 综合分，防止「一维极高、整体平庸」拿走单项奖；
  //   口碑/商业/四维合计（avg / sales / qsum）→ 直接用该奖项自己的评分子或专属分；
  //   真正需要跨维比较的（goty 这类无 stat 的 avg 奖）→ 用该奖项权重算出的综合分。

  function awardPickScore(c, a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var from = a.scoreFrom || (a.stat ? "stat" : "");
    var cw = num(spec.categoryWeight, 0.8);
    if (!a.stat) {
      if (from === "qsum") return awardCategoryPart(c, a, config);
      // 现算该奖项自己的权重，不能复用按 default 权重缓存的 _awardScore——
      // 否则「玩家之选」这种商业权重 0.6 的奖项会退化成一个不含销量的分数。
      return awardScoreOf(c, a, config);
    }
    if (cw < 0) cw = 0;
    if (cw > 1) cw = 1;
    return awardCategoryPart(c, a, config) * cw + num(c._awardScore, 0) * (1 - cw);
  }

  // 提名门槛：绝对线与「当年池子中位数 × 系数」取严。池子小的时候不自动放宽，
  // 由调用方在达标数过少时回退，避免早期奖项长期空缺。

  function awardGateOf(pool, config) {
    var spec = (config.awards && config.awards.score) || {};
    var gate = spec.gate || {};
    var abs = num(gate.absolute, 0);
    var mul = num(gate.medianMul, 1);
    var vals = [];
    var i, mid;
    for (i = 0; i < (pool || []).length; i++) vals.push(num(pool[i]._awardScore, 0));
    if (!vals.length) return abs;
    vals.sort(function (x, y) { return x - y; });
    mid = vals.length % 2
      ? vals[(vals.length - 1) / 2]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    return Math.max(abs, mid * mul);
  }

  // 评审抖动：分差够大就让强者稳定胜出，只在前二咬得紧时才摇号——颁奖夜才有悬念。
  // 抖动幅度是归一化分制上的绝对分（jitter × 100）。

  function pickJuryWinner(st, noms, a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var jitter = num(spec.juryJitter, 0);
    var gap = num(spec.jurySuppressGap, 0);
    var i, v, pick, wid;
    if (!noms || !noms.length) return null;
    if (!(jitter > 0) || noms.length < 2) return noms[0];
    if (awardPickScore(noms[0], a, config) - awardPickScore(noms[1], a, config) > gap) return noms[0];
    pick = -Infinity;
    wid = 0;
    for (i = 0; i < noms.length; i++) {
      v = awardPickScore(noms[i], a, config) + (sim.rand(st) - 0.5) * 2 * jitter * 100;
      if (v > pick) { pick = v; wid = i; }
    }
    return noms[wid];
  }

  // 同一奖项的历次获胜次数，用于重复获奖的名气衰减。

  function awardPriorWins(st, awardId) {
    var n = 0;
    ((st && st.awardsHistory) || []).forEach(function (h) {
      ((h && h.awards) || []).forEach(function (a) {
        if (a.id === awardId && a.playerWon) n += 1;
      });
    });
    return n;
  }


  sim.runCareerAwards = function (st, config, notes) {
    var world = sim.careerWorld(config);
    var windowGames = (st.worldReleased || []).filter(function (g) {
      return sim.inAwardWindow({
        releasedYear: g.releasedYear || g.releaseYear,
        releasedMonth: g.releasedMonth || g.releaseMonth
      }, st.year, config);
    });
    var liveGames = (st.worldReleased || []).filter(function (g) {
      return sim.liveOpsAwardEligible(g, st.year, config);
    });
    var pool = windowGames.map(function (g) { return careerAwardCandidate(g, config); });
    var livePool = liveGames.map(function (g) { return careerAwardCandidate(g, config); });
    var credits = {};
    var spec = world.awards || {};
    var fameWin = spec.famePerWin || 0;
    var honorWin = spec.honorPerWin || 0;
    var fameNom = spec.famePerNomination || 0;
    var honorNom = spec.honorPerNomination || 0;
    var scoreSpec = (config.awards && config.awards.score) || {};
    var repeatDecay = num(scoreSpec.repeatFameDecay, 0);
    var won = 0;
    var nominated = 0;
    var nomCount = (config.awards && config.awards.nomineeCount) || 5;
    var gate, liveGate;
    // 评分子只算一次，挂到候选上供门槛与各奖项共用。
    pool.concat(livePool).forEach(function (c) {
      c._parts = awardScoreParts(c, config);
      c._awardScore = awardScoreOf(c, null, config);
    });
    gate = awardGateOf(pool, config);
    liveGate = awardGateOf(livePool, config);
    (st.career.credits || []).forEach(function (c) {
      if (creditIsSigned(c)) credits[c.titleId] = true;
    });
    var awardPack = (config.awards.list || []).map(function (a) {
      var list = a.liveOnly ? livePool : pool;
      var useGate = a.liveOnly ? liveGate : gate;
      var eligible = list.filter(function (c) { return num(c._awardScore, 0) >= useGate; });
      var noms, hit, playerNom, playerWin, prior, decay;
      // 达标不足两部就保底取全池：早期作品池小，不能让奖项长期空缺。
      if (eligible.length < 2) eligible = list.slice();
      noms = sim.rankAwardCandidates(eligible, function (c) {
        return awardPickScore(c, a, config);
      }).slice(0, Math.max(1, a.nomineeCount || nomCount));
      hit = pickJuryWinner(st, noms, a, config);
      // 得主排到首位：揭晓动效与 nominees[0] 都当它是第一名在用。
      if (hit) noms = [hit].concat(noms.filter(function (c) { return c !== hit; }));
      playerNom = noms.some(function (c) { return c.titleId && credits[c.titleId]; });
      playerWin = !!(hit && hit.titleId && credits[hit.titleId]);
      if (playerNom) {
        nominated += 1;
        st.career.fame = (st.career.fame || 0) + fameNom;
        st.career.honor = (st.career.honor || 0) + honorNom;
      }
      if (playerWin) {
        won += 1;
        // 同一奖项拿得越多名气越不值钱：第 N 次拿同一奖 ×(1+历次数)^(−decay)。
        prior = awardPriorWins(st, a.id);
        decay = repeatDecay > 0 ? Math.pow(1 + prior, -repeatDecay) : 1;
        st.career.fame = (st.career.fame || 0) + Math.round(fameWin * decay);
        st.career.honor = (st.career.honor || 0) + honorWin;
      }
      if ((playerNom || playerWin) && hit && hit.titleId) {
        (st.career.credits || []).forEach(function (c) {
          if (c.titleId === hit.titleId && creditIsSigned(c)) {
            if (!c.awards) c.awards = [];
            c.awards.push({ id: a.id, name: a.displayName, won: playerWin, nominated: playerNom, year: st.year });
          }
        });
      }
      return {
        id: a.id,
        n: a.displayName,
        year: st.year,
        w: hit ? hit.label : "—",
        titleId: hit && hit.titleId,
        nominees: noms.map(function (c) {
          return {
            label: c.label,
            titleId: c.titleId,
            player: !!(c.player || (c.titleId && credits[c.titleId]))
          };
        }),
        playerNominated: playerNom,
        playerWon: playerWin
      };
    });
    if (notes) {
      notes.push(won || nominated ? ("年度盛典：提名 " + nominated + " / 获奖 " + won) : "年度盛典");
    }
    sim.recordAwardsHistory(st, awardPack);
    return awardPack;
  };

  // 玩家那部被提名/获奖的作品名：获奖直接读 a.w，只有提名时从 nominees 里找带 player 标记的那个。

  function awardStoryTitleOf(a) {
    var i, noms;
    if (!a) return "";
    if (a.playerWon && a.w && a.w !== "—") return a.w;
    noms = a.nominees || [];
    for (i = 0; i < noms.length; i++) {
      if (noms[i] && noms[i].player) return noms[i].label || "";
    }
    return "";
  }


  // P5c 落选指路：找出玩家提名作四维里最短板（读发售时的 worldReleased 记录，纯读）。
  function weakestDimOf(st, a, config) {
    var titleId, i, rec, bestDim = null, bestV = Infinity, dims, k, v, copy;
    titleId = a && a.titleId;
    if (!titleId) {
      (a && a.nominees || []).some(function (n) {
        if (n && n.player && n.titleId) { titleId = n.titleId; return true; }
        return false;
      });
    }
    if (!titleId) return null;
    rec = null;
    ((st && st.worldReleased) || []).forEach(function (x) {
      if (x && x.id === titleId) rec = x;
    });
    if (!rec || !rec.stats) return null;
    dims = sim.titleDims(config);
    for (i = 0; i < dims.length; i++) {
      k = dims[i];
      v = num(rec.stats[k], 0);
      if (v < bestV) { bestV = v; bestDim = k; }
    }
    if (!bestDim) return null;
    copy = sim.careerCopy(config);
    return copy["dim" + bestDim.charAt(0).toUpperCase() + bestDim.slice(1)] || bestDim;
  }


  function awardStoryPage(a, kind, copy, st, config) {
    var isGoty = kind === "goty";
    var map = { title: awardStoryTitleOf(a), award: (a && a.n) || "" };
    var fallbackTitle = isGoty ? "年度游戏" : "提名名单上有你的名字";
    var fallbackBody = isGoty
      ? "《{title}》——{award}。台上念出这个名字时，掌声从很远的地方涌过来。你没有喊，只是坐在原地，想起凌晨四点还亮着的那盏灯。它陪了你两年，此刻终于有人替你鼓了掌。"
      : "电话是深夜打来的。对方念出《{title}》的名字，说它进了{award}的提名名单。办公室里静了一瞬。你想起那些被砍掉又捡回来的功能——原来真的有人在看。";
    var body = fillPaceTemplate(
      isGoty ? (copy.tgaGotyStory || fallbackBody) : (copy.tgaNomStory || fallbackBody), map);
    // P5c 落选演出「有收获的落选」：提名但没拿奖时，评语指路最短板 + 回扣一句成长提示。
    if (!isGoty && !(a && a.playerWon)) {
      var weak = weakestDimOf(st, a, config);
      if (weak) {
        body += fillPaceTemplate(
          copy.lostAwardHintTpl || "评委提到你的{dim}还差一口气——下一部把它补上。",
          { dim: weak });
      }
    }
    return {
      type: "story",
      kind: "event",
      presentation: "notice",
      kicker: copy.awardKicker || "年度盛典",
      title: fillPaceTemplate(
        isGoty ? (copy.tgaGotyTitle || fallbackTitle) : (copy.tgaNomTitle || fallbackTitle), map),
      body: body
    };
  }

  // 首次 TGA 提名 / 首次拿下年度游戏的叙事页。纯剧情，不动任何属性。
  // 同一年既被提名又拿了年度游戏时只出大奖那一条：flag.nominated 一并置位，提名剧情不再补播
  // （颁奖夜刚念过年度游戏，紧跟一条「提名」会显得倒叙）。
  // 持久标记落 st.career.awardStory，随存档走；每次只判「第一次」，之后不再重复。

  sim.collectCareerAwardStory = function (st, config, pack) {
    var copy = sim.careerCopy(config);
    var pages = [];
    var flag, goty = null, anyNom = null, i, a;
    if (!st || !st.career || !pack || !pack.length) return pages;
    flag = st.career.awardStory || (st.career.awardStory = {});
    for (i = 0; i < pack.length; i++) {
      a = pack[i];
      if (!a) continue;
      if (a.id === "goty" && a.playerWon && !goty) goty = a;
      if ((a.playerNominated || a.playerWon) && !anyNom) anyNom = a;
    }
    if (goty && !flag.goty) {
      flag.goty = true;
      flag.nominated = true;
      pages.push(awardStoryPage(goty, "goty", copy, st, config));
      return pages;
    }
    if (anyNom && !flag.nominated) {
      flag.nominated = true;
      pages.push(awardStoryPage(anyNom, "nom", copy, st, config));
    }
    return pages;
  };


  // ── P5c 颁奖双档命名：1995-2013「年度游戏大赏」，tgaStartYear（2014）起更名 TGA ──
  sim.careerAwardShowName = function (year, config) {
    var copy = sim.careerCopy(config);
    var tgaStart = num((config.awards || {}).tgaStartYear, 2014);
    return year >= tgaStart
      ? (copy.tgaShowName || "TGA 年度盛典")
      : (copy.classicShowName || "年度游戏大赏");
  };

  sim.careerAwardNightKicker = function (year, config) {
    var copy = sim.careerCopy(config);
    var tgaStart = num((config.awards || {}).tgaStartYear, 2014);
    var tpl = year >= tgaStart
      ? (copy.awardNightKickerTga || "{year} TGA 年度盛典")
      : (copy.awardNightKickerClassic || "{year}年度游戏大赏");
    return sim.fillAwardYear
      ? sim.fillAwardYear(tpl, year, String(year))
      : tpl.replace("{year}", year);
  };

  // 快讯档一行：{show}颁给《{title}》。
  // 口径（REDESIGN-TASKS 5c）：当届年度游戏取「该年 catalog 高声望（landmark 或 prestige≥3）作品」；
  // 真实 goty 得主若本身满足高声望则直接用（与颁奖页/TGA 档案一致），否则从当年 catalog 里
  // 按分取最高（平分取 id 小者）。纯读，无 RNG。
  sim.careerAwardNewsLine = function (year, st, config) {
    var world = sim.careerWorld(config);
    var pack, goty, title = "";
    ((st && st.awardsHistory) || []).forEach(function (h) {
      if (h && h.year === year) pack = h.awards;
    });
    if (!pack || !pack.length) return null;
    goty = null;
    pack.forEach(function (a) {
      if (a && a.id === "goty" && !goty) goty = a;
    });
    if (!goty || goty.playerNominated || goty.playerWon) return null;
    var hit = goty.titleId ? sim.findById(world.titles || [], goty.titleId) : null;
    if (hit && (hit.landmark || num(hit.prestige, 0) >= 3)) {
      title = hit.name || hit.alias || hit.id;
    } else {
      var best = null;
      (world.titles || []).forEach(function (x) {
        if (x.virtual || x.releaseYear !== year) return;
        if (!(x.landmark || num(x.prestige, 0) >= 3)) return;
        if (!best || num(x.score, 0) > num(best.score, 0) ||
            (num(x.score, 0) === num(best.score, 0) && String(x.id) < String(best.id))) {
          best = x;
        }
      });
      if (best) title = best.name || best.alias || best.id;
    }
    if (!title && goty.w && goty.w !== "—") title = goty.w;
    if (!title) return null;
    return (sim.careerCopy(config).awardNewsTpl || "{show}颁给《{title}》")
      .replace("{show}", String(year) + " " + sim.careerAwardShowName(year, config))
      .replace("{title}", title);
  };


  // ── P4c 声望称号链（累积制，纯读 state：不写、不掷骰，可被门禁/渲染反复求值）──
  // score = 获奖(playerWon)次数×winWeight + 署名已发售作品均分≥scoreThreshold 的部数；
  // tier = 满足的最高档（tiers 升序阈值）。数值口径见 careerWorld.renown 的 comment。
  sim.careerRenownView = function (st, config) {
    var spec = sim.careerWorld(config).renown || {};
    var copy = sim.careerCopy(config);
    var tiers = spec.tiers || [0, 6, 14, 26, 42];
    var labels = copy.renownTiers || ["无名新人", "业界熟脸", "中坚力量", "明星制作人", "时代之名"];
    var winWeight = num(spec.winWeight, 2);
    var scoreThreshold = num(spec.scoreThreshold, 8.5);
    var wins = 0;
    var scoreHits = 0;
    var score = 0;
    var tier = 1;
    ((st && st.awardsHistory) || []).forEach(function (h) {
      ((h && h.awards) || []).forEach(function (x) {
        if (x && x.playerWon) wins += 1;
      });
    });
    ((st && st.career && st.career.credits) || []).forEach(function (x) {
      if (x && x.shipped && x.signedEligible !== false && num(x.score, 0) >= scoreThreshold) scoreHits += 1;
    });
    score = wins * winWeight + scoreHits;
    tiers.forEach(function (t, i) {
      if (score >= num(t, 0)) tier = i + 1;
    });
    return {
      score: score,
      wins: wins,
      scoreHits: scoreHits,
      tier: tier,
      label: labels[tier - 1] || ("Lv." + tier),
      maxTier: tiers.length
    };
  };


  sim.careerRenownTierLabel = function (config, tier) {
    var copy = sim.careerCopy(config);
    var labels = copy.renownTiers || ["无名新人", "业界熟脸", "中坚力量", "明星制作人", "时代之名"];
    var i = Math.max(0, Math.min(labels.length - 1, num(tier, 1) - 1));
    return labels[i] || "";
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
