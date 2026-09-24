/* career-pace.js —— 自 career.js 迁出的独立域（节奏层：月度主循环 / 决策点判定 → P3 节点推进（skipToNextNode）主战场）。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var DIMS, dateLabel, domesticBoostMul, fillPaceTemplate, findCredit, grantMainStatAndXp, grantPlayerTitleXp, num, persistProjectLive, skillHireWeight;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    var missing = [];
    DIMS = _.DIMS; if (typeof DIMS === 'undefined') missing.push('DIMS');
    dateLabel = _.dateLabel; if (typeof dateLabel === 'undefined') missing.push('dateLabel');
    domesticBoostMul = _.domesticBoostMul; if (typeof domesticBoostMul === 'undefined') missing.push('domesticBoostMul');
    fillPaceTemplate = _.fillPaceTemplate; if (typeof fillPaceTemplate === 'undefined') missing.push('fillPaceTemplate');
    findCredit = _.findCredit; if (typeof findCredit === 'undefined') missing.push('findCredit');
    grantMainStatAndXp = _.grantMainStatAndXp; if (typeof grantMainStatAndXp === 'undefined') missing.push('grantMainStatAndXp');
    grantPlayerTitleXp = _.grantPlayerTitleXp; if (typeof grantPlayerTitleXp === 'undefined') missing.push('grantPlayerTitleXp');
    num = _.num; if (typeof num === 'undefined') missing.push('num');
    persistProjectLive = _.persistProjectLive; if (typeof persistProjectLive === 'undefined') missing.push('persistProjectLive');
    skillHireWeight = _.skillHireWeight; if (typeof skillHireWeight === 'undefined') missing.push('skillHireWeight');
    // 绑定发生在加载期，若某个工具所属文件排在本文件之后，会拿到 undefined。
    // 这里出声，免得变成运行到某分支才炸的静默故障。
    if (missing.length && root.console && console.warn) {
      console.warn('[GDS] career-pace.js: 基座工具绑定失败（检查加载顺序）:', missing.join(', '));
    }
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function applyMonthlyLiveContribution(st, config, mult) {
    var by = sim.careerMonthlyContributionByDim(st, config);
    var m = sim.careerTraitMult(st, "monthContributionMult", config, 1);
    var extra = num(mult, 1);
    var role = sim.careerRole(st && st.career && st.career.roleId, config);
    var mainDim = role && role.stat;
    var mainM = sim.careerTraitMult(st, "mainDimContributionMult", config, 1);
    var offM = sim.careerTraitMult(st, "offDimContributionMult", config, 1);
    var grindM = sim.careerGrindMult(st, config);
    var personGain = {};
    // by 是人物维的产出（主职维倍率已经算在里面），整块过 personToTitle 落到作品维。
    DIMS.forEach(function (dim) {
      personGain[dim] = num(by[dim], 0) * m * extra * grindM * (mainDim && dim === mainDim ? mainM : offM);
    });
    var titleGain = sim.titleStatsFromPerson(personGain, config);
    sim.titleDims(config).forEach(function (dim) {
      if (!titleGain[dim]) return;
      sim.applyCareerLiveDelta(st, dim, titleGain[dim], config);
    });
  }


  function rollInspirationMonth(st, config, notes) {
    var rate, bonus, dim;
    if (!st || !st.career) return;
    rate = sim.careerTraitMult(st, "inspirationRate", config, 0);
    bonus = sim.careerTraitSum(st, "inspirationDimBonus", config);
    if (rate <= 0 || bonus <= 0) return;
    if (sim.rand(st) >= rate) return;
    dim = sim.pick(st, sim.titleDims(config));
    sim.applyCareerLiveDelta(st, dim, bonus, config);
    st.career.inspirationMonth = true;
    st.career.inspirationCount = num(st.career.inspirationCount, 0) + 1;
    notes.push("灵感爆发：" + sim.titleDimLabel(dim, config) + " +" + bonus + "，但这个月学不进东西");
  }


  // P4b：赶工类事件文案分年代——eraLateYear 之后换重口径（textLate），数值规则不变。
  function eraEventText(ev, st, config) {
    var spec = sim.careerWorld(config).careerHealth || {};
    if (ev.textLate != null && st && st.year >= num(spec.eraLateYear, 2010)) {
      return ev.textLate;
    }
    return ev.text || ev.displayName;
  }


  function careerEventQueueItem(ev, copy, st, config) {
    var pres = ev.presentation || "notice";
    var body = eraEventText(ev, st, config);
    if (sim.eventSpeakerName && sim.eventSpeakerFill) {
      body = sim.eventSpeakerFill(body, sim.eventSpeakerName(ev, st, config));
    }
    return {
      type: "event",
      kind: "event",
      presentation: pres,
      eventId: ev.id,
      kicker: copy.eventKicker || "开发事件",
      title: ev.displayName,
      body: body,
      options: pres === "choice" ? (ev.choices || []).map(function (c) {
        return { id: c.id, label: c.label, req: c.req || null };
      }) : null
    };
  }


  // 挖人来的那一家要跟玩家属性档次匹配：属性够到的职级 vs 公司体量能给到的理想职级
  // （理想职级直接取 jobRanks.promotion.inviteRank.rankCapByPower[power]——那正是这家公司给到的上限）。
  // 差距越大权重越低；mobility.inviteFitPenalty=0 即关掉这个倾斜，回到只按熟练度/声望抽。
  function inviteFitMul(st, config, inv) {
    var world = sim.careerWorld(config);
    var penalty = num((world.mobility || {}).inviteFitPenalty, 0);
    var rankSpec = ((world.jobRanks || {}).promotion || {}).inviteRank || {};
    var co, power, ideal, statRank;
    if (!(penalty > 0)) return 1;
    co = sim.careerCompany(inv.companyId, config);
    power = co && co.power != null ? String(co.power) : "2";
    ideal = num((rankSpec.rankCapByPower || {})[power], 3);
    statRank = sim.careerStatRank(st, config);
    return 1 / (1 + Math.abs(statRank - ideal) * penalty);
  }

  function rollInvitesThisMonth(st, config) {
    var spec = sim.careerWorld(config).mobility || {};
    var max = spec.inviteMaxPerYear != null ? spec.inviteMaxPerYear : 1;
    var chance = spec.inviteChance;
    var eligible, picked;
    if (st.career.inviteYearStamp !== st.year) {
      st.career.inviteYearStamp = st.year;
      st.career.invitesRolledThisYear = 0;
      if (chance == null) chance = 1;
      st.career.inviteYearHit = sim.rand(st) < chance;
    }
    if (!st.career.inviteYearHit) return st.career.invites || [];
    if (st.career.invitesRolledThisYear >= max) return st.career.invites || [];
    eligible = sim.listCareerInvites(st, config);
    if (!eligible.length) return st.career.invites || [];
    (function pickInvite() {
      // P4c 反哺：声望档次越高，邀约权重整体上浮（大厂更愿意来挖人）。
      var renown = sim.careerRenownView ? sim.careerRenownView(st, config) : null;
      var renownMult = 1 + num((sim.careerWorld(config).renown || {}).inviteWeightPerTier, 0) * (renown ? renown.tier - 1 : 0);
      var weighted = eligible.map(function (inv) {
        var title = sim.careerTitle(inv.titleId, config, st);
        var co = sim.careerCompany(inv.companyId, config);
        var studio = sim.careerStudio(inv.companyId, inv.studioId, config);
        return {
          inv: inv,
          weight: skillHireWeight(st, config, co, studio, title) *
            domesticBoostMul(st, co, config) * renownMult * inviteFitMul(st, config, inv)
        };
      });
      var hit = sim.pickWeighted(st, weighted) || weighted[0];
      picked = hit && hit.inv;
    })();
    if (!picked) return st.career.invites || [];
    st.career.invitesRolledThisYear += 1;
    st.career.invites = [picked];
    return st.career.invites;
  }


  function hopOfferCount(config) {
    var n = ((sim.careerWorld(config).mobility || {}).offerCount);
    return n != null ? n : 4;
  }


  function hopOfferChoice(o, config) {
    var copy = sim.careerCopy(config);
    var co = sim.careerCompany(o.companyId, config);
    var studio = sim.careerStudio(o.companyId, o.studioId, config);
    var isPromo = o.kind === "promotion" || o.kind === "promotionLine";
    var prefix = isPromo ? (copy.promoteYearEnd || "内部晋升") : (o.internal ? (copy.hopInternal || "内部调动") : "");
    var companyName = co ? sim.worldLabel(co, config) : (o.companyId || "");
    var studioName = studio ? sim.worldLabel(studio, config) : (o.studioName || "");
    var title = companyName + (studioName ? (" / " + studioName) : "");
    var pct = o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100);
    var rankLabel = sim.formatCareerRankLabel(o.roleId, o.jobRank, config) || "";
    var metaBits = [];
    var labelBits = [];
    if (prefix) title = prefix + " · " + title;
    if (rankLabel) metaBits.push(rankLabel);
    if (title) labelBits.push(title);
    if (metaBits.length) labelBits.push(metaBits.join(" · "));
    labelBits.push(pct + "%");
    return {
      id: o.id,
      label: labelBits.join(" · "),
      hopView: {
        title: title,
        meta: metaBits.join(" · "),
        pct: pct + "%"
      }
    };
  }


  function hopQueueItem(st, config) {
    var copy = sim.careerCopy(config);
    var offers = (st.career.yearEndOffers || []).slice(0, hopOfferCount(config));
    var can = sim.canCareerHop(st, config);
    return {
      type: "hop",
      kind: "event",
      presentation: "choice",
      kicker: copy.hopKicker || "年底跳槽",
      title: copy.hopTitle || "全球 offer",
      body: can ? (copy.hopBody || "") : (copy.hopLocked || "在研中途不能走。"),
      offers: offers,
      canHop: can,
      options: offers.map(function (o) {
        return hopOfferChoice(o, config);
      }).concat([{ id: "stay", label: copy.hopStay || "先留下" }])
    };
  }


  function inviteQueueItem(invite, config) {
    var copy = sim.careerCopy(config);
    var co = sim.careerCompany(invite.companyId, config);
    var role = sim.careerRole(invite.roleId, config);
    var seniorLine = sim.careerSeniorLine(co, config);
    var rankLabel = invite.jobRank ? (sim.formatCareerRankLabel(invite.roleId, invite.jobRank, config) || ("职级 Lv." + invite.jobRank)) : "";
    var spec = sim.careerWorld(config).mobility || {};
    var options = [
      { id: "accept", label: copy.inviteAccept || "跳槽加入" },
      { id: "decline", label: copy.inviteDecline || "留下" }
    ];
    if (spec.inviteCanCounter === true) {
      options.splice(1, 0, { id: "counter", label: copy.inviteCounter || "现公司还价" });
    }
    return {
      type: "invite",
      kind: "event",
      presentation: "choice",
      inviteId: invite.id,
      kicker: copy.inviteKicker || "挖人",
      title: copy.inviteTitle || "入职邀请",
      body: (co ? sim.worldLabel(co, config) : invite.companyId) +
        " 请你做" + (role ? sim.worldLabel(role, config) : "") +
        (invite.titleName ? ("，进组《" + invite.titleName + "》") : "") +
        (rankLabel ? ("，" + rankLabel) : "") +
        "。给的不只是岗位，是一个更大的舞台。" +
        (seniorLine ? (seniorLine) : ""),
      options: options
    };
  }


  sim.tickCareerMonth = function (state, config) {
    var st = sim.clone(state);
    var notes = [];
    var queue = [];
    var copy = sim.careerCopy(config);
    var world = sim.careerWorld(config);
    var cal = world.timeline || {};
    var mobility = world.mobility || {};
    var hopMonth = mobility.hopMonth || 12;
    var awardPack = null;
    var awardStory = [];
    var firedEvent = null;
    var careEv = null;
    var echoEv = null;
    var lineFired = 0;
    var co, view, projectView, phaseLabel, role, invites, supporting, titleNow, xpSpec, phaseMult;

    sim.ensureCareerExtras(st, config);
    if (st.career) st.career.inspirationMonth = false;
    if (st.month === 1 && sim.applyPendingStoryPromos) {
      sim.applyPendingStoryPromos(st, config);
    }
    if (st.career && st.career.companyId && !st.career.studioId) {
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(st.career.companyId, config));
    }
    supporting = !!sim.careerPostLaunch(st);
    projectView = sim.careerProjectView(st, config);
    view = projectView;
    xpSpec = world.playerXp || {};
    titleNow = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    if (sim.tickCareerGrind) {
      sim.tickCareerGrind(st, config, !!st.career.liveStats && (supporting || !projectView.idle));
    }
    if (supporting && st.career.liveStats) {
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerPostLaunchMonth, num(xpSpec.xpPerDevMonth, 0)));
      grantMainStatAndXp(st, "support", config, titleNow);
      role = sim.careerRole(st.career.roleId, config);
      // 长线运营月不吃阶段权重（那是开发期的节奏），只吃体量阻尼。
      applyMonthlyLiveContribution(st, config, sim.careerPowerContribMult(titleNow, config));
      (function markSupported() {
        var cred = findCredit(st, st.career.titleId);
        if (cred) cred.supported = true;
      })();
      phaseLabel = projectView.phase ? sim.worldLabel(projectView.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    } else if (!projectView.idle && st.career.liveStats) {
      role = sim.careerRole(st.career.roleId, config);
      if (st.career.burnoutMonth) notes.push("倦怠：连轴转太久了，这个月状态只剩一半");
      // 开发月的成长倍率：阶段权重（立项慢 / 填充·打磨快 / 金盘期 0）× 体量阻尼。
      // 同一个倍率同时管「属性成长」「职级经验」「作品月贡献」，玩家才对得上「这个月干了多少活」。
      phaseMult = sim.careerPhaseMult(projectView.phase && projectView.phase.id, config) *
        sim.careerPowerContribMult(titleNow, config);
      applyMonthlyLiveContribution(st, config, phaseMult);
      rollInspirationMonth(st, config, notes);
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerDevMonth, 0) * phaseMult);
      grantMainStatAndXp(st, "dev", config, titleNow, phaseMult);
      phaseLabel = projectView.phase ? sim.worldLabel(projectView.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    }

    // P6：主职维突破晋升刻度 → 里程碑拍（每档一次；页型 milestone 走检测器最高优先级停机）。
    if (st.phase === "PLAYING" && st.career.companyId) {
      sim.checkStatMilestones(st, config, queue);
    }

    sim.shipWorldTitlesThisMonth(st, config, queue);

    if (st.career.titleId && !sim.careerPostLaunch(st)) {
      view = sim.careerTitle(st.career.titleId, config, st);
      if (view && view.releaseYear === st.year && view.releaseMonth === st.month) {
        sim.shipPlayerTitle(st, config, notes, queue);
      }
    }

    if (st.month === hopMonth && sim.markCareerLineYearEnd) {
      sim.markCareerLineYearEnd(st);
    }

    if (sim.processCareerLines) {
      lineFired = sim.processCareerLines(st, config, queue, notes) || 0;
    }

    if (!lineFired && supporting && st.career.liveStats) {
      firedEvent = sim.rollPostLaunchEvent(st, config, notes);
      if (firedEvent) {
        queue.push(careerEventQueueItem(firedEvent, copy, st, config));
      }
    } else if (!lineFired && !projectView.idle && st.career.liveStats && !sim.careerPostLaunch(st)) {
      firedEvent = sim.rollCareerDevEvent(st, config, notes);
      if (firedEvent) {
        queue.push(careerEventQueueItem(firedEvent, copy, st, config));
      }
    }

    // P2a：月薪 / 积蓄 / 生活费整条链路已删除（personalEconomy 与 company.salaryMult 一并移除）。
    // 生涯档不再有货币：成长看属性与职级，评价看作品与荣誉。别在这里重新引入收支字段。

    if (st.phase === "PLAYING") {
      st.career.monthsInRank = num(st.career.monthsInRank, 0) + (st.career.companyId ? 1 : 0);
      if (sim.tickCareerBonds) sim.tickCareerBonds(st, config);
    }

    if (st.phase === "PLAYING" && st.month === (config.awards.month || 11)) {
      awardPack = sim.runCareerAwards(st, config, notes);
      if (sim.collectCareerAwardStory) {
        awardStory = sim.collectCareerAwardStory(st, config, awardPack);
      }
    }

    invites = rollInvitesThisMonth(st, config);
    if (invites && invites.length) {
      queue.push(inviteQueueItem(invites[0], config));
    }

    // P4b：健康 ≤ 2 段 → 人物线关怀拍（每年至多一次；choice 页会让节点推进停机）。
    if (st.phase === "PLAYING" && num(st.career.health, 4) <= 2 && st.career.careBeatYear !== st.year) {
      careEv = sim.findById(world.devEvents.list || [], "careCheck");
      if (careEv) {
        st.career.careBeatYear = st.year;
        queue.push(careerEventQueueItem(careEv, copy, st, config));
      }
    }

    // P7 echo beat: a flag written by an earlier choice pays off once, when it comes due.
    if (st.phase === "PLAYING" && sim.dueEventCallback) {
      echoEv = sim.dueEventCallback(st, config);
      if (echoEv) queue.push(careerEventQueueItem(echoEv, copy, st, config));
    }

    if (st.month === hopMonth) {
      st.career.yearEndOffers = sim.listYearEndOffers(st, config);
      st.career.offerYear = st.year;
      if (!supporting && st.career.yearEndOffers.length) queue.push(hopQueueItem(st, config));
    }

    st.month += 1;
    if (st.month > 12) {
      st.month = 1;
      st.year += 1;
      st.career.promotionsThisYear = 0;
    }

    if (st.month === hopMonth) {
      st.career.yearEndOffers = sim.listYearEndOffers(st, config);
      st.career.offerYear = st.year;
    } else if (mobility.allowMidProject && st.phase === "PLAYING" && st.career.companyId) {
      sim.ensureYearEndOffers(st, config);
    }

    if (supporting && st.career.postLaunch) {
      st.career.postLaunch.monthsLeft = num(st.career.postLaunch.monthsLeft, 0) - 1;
      if (num(st.career.postLaunch.monthsLeft, 0) <= 0) {
        persistProjectLive(st, config);
        st.career.postLaunch = null;
        st.career.titleId = null;
        st.career.liveStats = null;
      }
    }
    if (!sim.careerPostLaunch(st) && !st.career.titleId) st.career.idleMonths = num(st.career.idleMonths, 0) + 1;
    sim.assignCareerProject(st, config, queue);
    sim.ensureCareerColleagues(st, config);

    if (st.phase === "PLAYING" && (st.year > cal.endYear || (st.year === cal.endYear && st.month > cal.endMonth))) {
      st.phase = "SETTLED";
    }

    if (awardPack && awardsInvolvePlayer(awardPack)) {
      // P5c 完整档：只有玩家被卷进本届颁奖（提名/获奖）才推完整颁奖夜；
      // 快讯档在跨年「年度快讯」页呈现（skipToNextNode 的 yearBanner）。
      queue.push({
        type: "awards",
        kind: "event",
        year: st.year,
        kicker: sim.careerAwardNightKicker
          ? sim.careerAwardNightKicker(st.year, config)
          : sim.fillAwardYear(copy.awardNightKicker, st.year, st.year + "年度盛典"),
        title: sim.fillAwardYear
          ? sim.fillAwardYear(copy.awardNightTitle, st.year, st.year + "颁奖夜")
          : (copy.awardTitle || "颁奖夜"),
        body: copy.awardBody || "",
        awards: awardPack
      });
      // 剧情页排在颁奖夜之后：先看滚幕揭晓，再读这一段。
      awardStory.forEach(function (p) { queue.push(p); });
    }
    return { state: st, queue: queue };
  };


  function careerPaceSpec(config) {
    return (sim.careerWorld(config).careerPace) || {};
  }


  // ── P5a 章容器：year 命中某章起始年 → 返回该章定义，否则 null ──
  sim.careerChapterOf = function (year, config) {
    var list = (sim.careerWorld(config).chapters || {}).list || [];
    var i, ch;
    for (i = 0; i < list.length; i++) {
      ch = list[i];
      if (ch && ch.years && num(ch.years[0], -1) === num(year, -2)) return ch;
    }
    return null;
  };


  // ── P5a 章末收束：year 是某章最后一年 → 返回该章定义 ──
  sim.careerChapterEndingAt = function (year, config) {
    var list = (sim.careerWorld(config).chapters || {}).list || [];
    var i, ch;
    for (i = 0; i < list.length; i++) {
      ch = list[i];
      if (ch && ch.years && num(ch.years[1], -1) === num(year, -2)) return ch;
    }
    return null;
  };


  function awardsInvolvePlayer(pack) {
    return (pack || []).some(function (a) {
      return !!(a && (a.playerWon || a.playerNominated));
    });
  }


  function nodeTypeEnabled(pace, ids) {
    var list = pace.stopOnTypes;
    var i;
    if (!list) return true;
    if (typeof ids === "string") ids = [ids];
    for (i = 0; i < ids.length; i++) {
      if (list.indexOf(ids[i]) >= 0) return true;
    }
    return false;
  }


  // ── P3 节点推进 ──────────────────────────────────────────────
  // 节点判定器注册表（按优先级排列，先命中先算数）：同一月多类命中时全部页面仍按序呈现，
  // 这里只决定「停在哪 / 节点叫什么」。test 只读 page/pace/config，绝不消费 RNG。
  // 配置入口：careerWorld.careerPace.{stopOnTypes, stopOnChoice, stopOnPlayerAwards,
  // maxSkipMonths}（缺省走代码里的默认值）。
  sim.careerNodeDetectors = [
    // ⓪ 属性里程碑（P6：被世界承认——每档一次， rare，优先级最高）
    { id: "milestone", test: function (page) {
      return page.type === "milestone";
    } },
    // ① eventLines 拍（复用 waitUntil 调度；路径分叉也在这一档）
    { id: "careerLine", test: function (page) {
      return page.type === "careerLine" || page.type === "careerLineFork";
    } },
    // ② 带选项的事件（开发 / 长线 / 空窗抉择；devEvents.list 里 presentation==="choice" 的子集）
    { id: "choiceEvent", test: function (page, pace) {
      return pace.stopOnChoice !== false && page.presentation === "choice";
    } },
    // ③ 发售 / 评分揭晓
    { id: "media", test: function (page, pace) {
      return nodeTypeEnabled(pace, "media") && page.type === "media";
    } },
    // ④ 年度颁奖（涉及玩家才停；与玩家无关的颁奖由跨年「年度快讯」一行带过）
    { id: "awards", test: function (page, pace) {
      return pace.stopOnPlayerAwards !== false && page.type === "awards" && awardsInvolvePlayer(page.awards);
    } },
    // ⑤ 跳槽抉择（年底 offer / 挖角邀约；空窗 ≥6 月的 idle-gap 事件是 choice，落在 ② 里）
    { id: "hop", test: function (page, pace) {
      return nodeTypeEnabled(pace, ["hop", "invite"]) && (page.type === "hop" || page.type === "invite");
    } },
    // ⑥ 晋升
    { id: "promotion", test: function (page, pace) {
      return nodeTypeEnabled(pace, "promotion") && page.type === "promotion";
    } }
  ];


  // 命中返回 { id, page }，没命中返回 null。RNG-free（可在测试里用 rngCount 前后不变守卫）。
  sim.careerNodeHit = function (queue, config) {
    var pace = careerPaceSpec(config);
    var i, j, page, det;
    for (i = 0; i < (queue || []).length; i++) {
      page = queue[i];
      if (!page) continue;
      for (j = 0; j < sim.careerNodeDetectors.length; j++) {
        det = sim.careerNodeDetectors[j];
        if (det.test(page, pace, config)) return { id: det.id, page: page };
      }
    }
    return null;
  };


  // 老口径保留：等价于「队列里有没有节点」。
  sim.careerQueueNeedsDecision = function (queue, config) {
    return !!sim.careerNodeHit(queue, config);
  };


  // 跨年新闻条：当年目录最高分真作（并列取 id 小者）。纯函数，不消费 RNG。
  function yearNewsLine(year, config) {
    var world = sim.careerWorld(config);
    var best = null;
    (world.titles || []).forEach(function (t) {
      if (t.virtual || t.releaseYear !== year) return;
      if (!best || num(t.score, 0) > num(best.score, 0) ||
          (num(t.score, 0) === num(best.score, 0) && String(t.id) < String(best.id))) {
        best = t;
      }
    });
    if (!best) return null;
    return fillPaceTemplate(
      (sim.careerCopy(config) || {}).yearNewsTpl || "{year}年，《{title}》风靡业界。",
      { year: year, title: best.name || best.alias || best.id }
    );
  }


  // P5c/5d：跨年「年度快讯」页（title=年份大字幕；body=行业新闻 + 颁奖快讯，各 ≤1 行）。
  // 行业新闻走 yearNewsLine（当年最高分真作）；颁奖快讯读上届 goty 得主（快讯档才上墙）。
  function yearDigestBody(year, st, config) {
    var lines = [];
    var news = yearNewsLine(year, config);
    var awardLine = sim.careerAwardNewsLine ? sim.careerAwardNewsLine(year - 1, st, config) : null;
    if (news) lines.push(news);
    if (awardLine) lines.push(awardLine);
    return lines;
  }


  // P5a：章开场演出页（年份大字幕 + 时代白描 2~3 行）。
  function chapterOpenPage(ch, year, config) {
    var copy = sim.careerCopy(config);
    return {
      type: "chapterOpen",
      kind: "info",
      chapterId: ch.id,
      kicker: (copy.chapterKicker || "第{n}章") ? (copy.chapterKicker || "第{n}章").replace("{n}", String(ch.id).replace("ch", "")) : "",
      title: year + " 年 · " + (ch.name || ""),
      body: (ch.open && ch.open.lines || []).join("\n")
    };
  }


  // P5a：章末收束页（时代谢幕 + 该年年终颁奖快讯，随新章开场同批呈现）。
  function chapterClosePage(ch, year, st, config) {
    var lines = [];
    if (ch.closeLine) lines.push(ch.closeLine);
    var awardLine = sim.careerAwardNewsLine ? sim.careerAwardNewsLine(year, st, config) : null;
    if (awardLine) lines.push(awardLine);
    return {
      type: "chapterClose",
      kind: "info",
      chapterId: ch.id,
      kicker: "时代谢幕",
      title: year + " 年 · " + (ch.name || "") + " 落幕",
      body: lines.join("\n")
    };
  }


  // 「继续」按钮的唯一引擎入口：循环现有月 tick（与逐月同一条代码路径，RNG 流不分叉），
  // 直到命中节点判定 / 局面结束 / 连跳上限。跨年推年份字幕。
  // （Master 2026-09-22 拍板：近况摘要弹窗移除——中间月份的纯氛围页直接丢弃，
  //   时间流逝感交给顶部日期动画与日历；参与制作的世界作发售已升级为停机节点。）
  sim.skipToNextNode = function (state, config) {
    var pace, maxSkip, fromY, fromM, skipped, st, last, hit, queue, banners, yearSeen, chapterNow;
    if (!state || state.mode !== "career") {
      return sim.tickMonth(state, config);
    }
    pace = careerPaceSpec(config);
    maxSkip = num(pace.maxSkipMonths, 12);
    if (maxSkip < 1) maxSkip = 1;
    fromY = state.year;
    fromM = state.month;
    skipped = 0;
    st = state;
    last = null;
    hit = null;
    banners = [];
    yearSeen = st.year;
    while (st.phase === "PLAYING") {
      last = sim.tickCareerMonth(st, config);
      st = last.state;
      skipped += 1;
      if (st.year !== yearSeen) {
        yearSeen = st.year;
        var chapterNow = sim.careerChapterOf(st.year, config);
        if (chapterNow) {
          // P5a：章末收束（前一章谢幕 + 该年年终颁奖快讯）→ 章开场演出，停下来让人读。
          var prevCh = sim.careerChapterEndingAt(st.year - 1, config);
          if (prevCh) banners.push(chapterClosePage(prevCh, st.year - 1, st, config));
          banners.push(chapterOpenPage(chapterNow, st.year, config));
          hit = { id: "chapterOpen", chapterId: chapterNow.id };
          break;
        }
        banners.push({
          type: "yearBanner",
          kind: "info",
          kicker: (sim.careerCopy(config) || {}).awardNewsKicker || "年度快讯",
          title: st.year + " 年",
          body: yearDigestBody(st.year, st, config).join("\n")
        });
      }
      if (st.phase !== "PLAYING") { hit = { id: "settle" }; break; }
      hit = sim.careerNodeHit(last.queue, config);
      if (hit) break;
      if (skipped >= maxSkip) { hit = { id: "paceCap" }; break; }
    }
    // 近况摘要已移除：queue = 跨年/章末字幕 + 停机当月的原始队列。
    // 命中 paceCap 且途中无事发生时 queue 可为空——UI 层只走日期动画，不弹窗。
    queue = banners.slice().concat((last && last.queue) ? last.queue.slice() : []);
    return {
      state: st,
      queue: queue,
      skippedMonths: skipped,
      node: hit,
      from: { year: fromY, month: fromM },
      to: { year: st.year, month: st.month }
    };
  };


  // 兼容别名：旧调用方（UI / 探针脚本）无需改动。
  sim.tickCareerToDecision = function (state, config) {
    return sim.skipToNextNode(state, config);
  };


  // 选项落地唯一入口：UI 的 data-event-opt 与测试的自动应答都走这里，别再写第二份 dispatch。
  sim.resolveCareerQueueChoice = function (state, page, optionId, config) {
    var opt, i, hint;
    if (!state || !page) return { ok: false, state: state };
    // P4a 门禁兜底：UI 置灰之外，落地层再拒一次（置灰 ≠ 隐藏，老存档/构造调用仍会被挡）。
    if (page.options && sim.careerOptionLockHint) {
      for (i = 0; i < page.options.length; i++) {
        if (page.options[i] && page.options[i].id === optionId) opt = page.options[i];
      }
      if (opt && opt.req) {
        hint = sim.careerOptionLockHint(state, config, opt.req);
        if (hint) return { ok: false, state: state, lockHint: hint };
      }
    }
    if (page.type === "hop") {
      if (optionId === "stay") return sim.declineYearEndOffers(state, config);
      return sim.applyYearEndOffer(state, optionId, config);
    }
    if (page.type === "promotion") {
      if (optionId === "promote") {
        return sim.requestCareerPromotion
          ? sim.requestCareerPromotion(state, config)
          : sim.promoteCareer(state, config);
      }
      return { ok: true, state: state };
    }
    if (page.type === "invite") {
      if (optionId === "accept") return sim.acceptCareerInvite(state, page.inviteId, config);
      if (optionId === "counter") return sim.counterCareerInvite(state, page.inviteId, config);
      return sim.declineCareerInvite(state, page.inviteId, config);
    }
    if (page.type === "careerLineFork") return sim.resolveCareerPathFork(state, optionId, config);
    if (page.type === "careerLine") return sim.resolveCareerLineChoice(state, page.lineId, page.beatId, optionId, config);
    if (page.type === "producerPitch") return sim.resolveProducerPitch(state, optionId, config);
    if (!page.eventId) return { ok: false, state: state };
    return sim.resolveEventChoice(state, page.eventId, optionId, config);
  };




  // ── 共享基座 sim._（供拆分出去的域文件取用，勿在别处重复定义）──
})(typeof globalThis !== "undefined" ? globalThis : this);
