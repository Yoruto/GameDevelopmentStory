/* career-mobility.js —— 自 career.js 迁出的独立域（跳槽 / 邀约 / offer（P4c 声望反哺落点））。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var PLAYABLE, applyPromotion, detachFromProject, domesticBoostMul, jobRankSpec, joinCompany, lateJoinSpec, num, pickMobilityRole, producerOfferUnlocked, rankTableVal, requireInDevTitle, skillHireSpec, skillHireWeight, tableMult;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    var missing = [];
    PLAYABLE = _.PLAYABLE; if (typeof PLAYABLE === 'undefined') missing.push('PLAYABLE');
    applyPromotion = _.applyPromotion; if (typeof applyPromotion === 'undefined') missing.push('applyPromotion');
    detachFromProject = _.detachFromProject; if (typeof detachFromProject === 'undefined') missing.push('detachFromProject');
    domesticBoostMul = _.domesticBoostMul; if (typeof domesticBoostMul === 'undefined') missing.push('domesticBoostMul');
    jobRankSpec = _.jobRankSpec; if (typeof jobRankSpec === 'undefined') missing.push('jobRankSpec');
    joinCompany = _.joinCompany; if (typeof joinCompany === 'undefined') missing.push('joinCompany');
    lateJoinSpec = _.lateJoinSpec; if (typeof lateJoinSpec === 'undefined') missing.push('lateJoinSpec');
    num = _.num; if (typeof num === 'undefined') missing.push('num');
    pickMobilityRole = _.pickMobilityRole; if (typeof pickMobilityRole === 'undefined') missing.push('pickMobilityRole');
    producerOfferUnlocked = _.producerOfferUnlocked; if (typeof producerOfferUnlocked === 'undefined') missing.push('producerOfferUnlocked');
    rankTableVal = _.rankTableVal; if (typeof rankTableVal === 'undefined') missing.push('rankTableVal');
    requireInDevTitle = _.requireInDevTitle; if (typeof requireInDevTitle === 'undefined') missing.push('requireInDevTitle');
    skillHireSpec = _.skillHireSpec; if (typeof skillHireSpec === 'undefined') missing.push('skillHireSpec');    skillHireWeight = _.skillHireWeight; if (typeof skillHireWeight === 'undefined') missing.push('skillHireWeight');
    tableMult = _.tableMult; if (typeof tableMult === 'undefined') missing.push('tableMult');
    // 绑定发生在加载期，若某个工具所属文件排在本文件之后，会拿到 undefined。
    // 这里出声，免得变成运行到某分支才炸的静默故障。
    if (missing.length && root.console && console.warn) {
      console.warn('[GDS] career-mobility.js: 基座工具绑定失败（检查加载顺序）:', missing.join(', '));
    }
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function uniqueIds(list) {
    var out = [];
    var seen = {};
    var i, id;
    for (i = 0; i < (list || []).length; i++) {
      id = list[i];
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }


  function skillTierBonus(xp, config) {
    var table = skillHireSpec(config).bonusByTier || {};
    var tier = sim.xpTierFor(xp, config);
    var id = tier && tier.id;
    if (!id || table[id] == null) return 0;
    return num(table[id], 0);
  }


  function maxSkillBonus(st, kind, ids, config) {
    var best = 0;
    var i, b;
    for (i = 0; i < (ids || []).length; i++) {
      b = skillTierBonus(sim.playerXpValue(st, kind, ids[i]), config);
      if (b > best) best = b;
    }
    return best;
  }


  function targetContentIds(st, company, studio, title, config) {
    var genreIds = [];
    var gameplayIds = [];
    var titles, i, t, studios, j, s;
    if (title && (title.genreId || title.gameplayId)) {
      if (title.genreId) genreIds.push(title.genreId);
      if (title.gameplayId) gameplayIds.push(title.gameplayId);
      return { genreIds: genreIds, gameplayIds: gameplayIds };
    }
    if (studio) {
      if (studio.genreIds && studio.genreIds.length) genreIds = studio.genreIds.slice();
      if (studio.gameplayIds && studio.gameplayIds.length) gameplayIds = studio.gameplayIds.slice();
    }
    if (!genreIds.length || !gameplayIds.length) {
      studios = sim.careerStudios(company);
      for (j = 0; j < studios.length; j++) {
        s = studios[j];
        if (!genreIds.length && s.genreIds && s.genreIds.length) genreIds = genreIds.concat(s.genreIds);
        if (!gameplayIds.length && s.gameplayIds && s.gameplayIds.length) gameplayIds = gameplayIds.concat(s.gameplayIds);
      }
    }
    if (!genreIds.length || !gameplayIds.length) {
      titles = (sim.careerWorld(config).titles) || [];
      for (i = 0; i < titles.length; i++) {
        t = titles[i];
        if (!company || t.companyId !== company.id) continue;
        if (t.genreId) genreIds.push(t.genreId);
        if (t.gameplayId) gameplayIds.push(t.gameplayId);
      }
    }
    return { genreIds: uniqueIds(genreIds), gameplayIds: uniqueIds(gameplayIds) };
  }


  sim.careerSkillHireBonus = function (state, config, company, studio, title) {
    var ids = targetContentIds(state, company, studio, title, config);
    return maxSkillBonus(state, "genre", ids.genreIds, config) +
      maxSkillBonus(state, "gameplay", ids.gameplayIds, config);
  };


  sim.careerHireChance = function (company, state, config, studio, title) {
    var spec = sim.careerWorld(config).mobility || {};
    // statRef 原本挂在 personalEconomy.salary 上；P2a 删掉薪资后挪到 mobility.statRef（数值未变）。
    var statRef = num(spec.statRef, 0);
    var power = company && company.power != null ? String(company.power) : "2";
    var base = (studio && studio.hireChance != null) ? studio.hireChance : (company && company.hireChance);
    var cr = state && state.career;
    var role = sim.careerRole(cr && cr.roleId, config);
    var mainStat = 0;
    var chance, min, max, powMul;
    if (base == null) base = (spec.hireChanceByPower && spec.hireChanceByPower[power]);
    if (base == null) base = 0.5;
    if (role && cr && cr.stats) mainStat = num(cr.stats[role.stat], 0);
    chance = base
      + num(cr && cr.fame, 0) * num(spec.fameHirePer, 0)
      + Math.max(0, mainStat - statRef) * num(spec.statHirePer, 0)
      + rankTableVal(jobRankSpec(config).hireChanceRankBonus, sim.careerJobRank(cr, config), 0)
      + sim.careerSkillHireBonus(state, config, company, studio, title);
    // 按公司体量对整条通过率打折（mobility.hireChancePowerMul）。
    // company.hireChance 已是 power 级基准，但上面四项加成会把它一路推到 hireChanceMax——
    // 不乘这一下，大厂到后期就是 92% 的保险箱。作用在夹取之前。
    powMul = tableMult(spec.hireChancePowerMul, power, 1);
    if (powMul >= 0 && powMul !== 1) chance = chance * powMul;
    min = spec.hireChanceMin;
    max = spec.hireChanceMax;
    if (min != null && chance < min) chance = min;
    if (max != null && chance > max) chance = max;
    (function applyMinRank() {
      var powerKey = company && company.power != null ? String(company.power) : "2";
      var minRank = (jobRankSpec(config).offerMinRankByPower || {})[powerKey];
      if (minRank != null && sim.careerJobRank(cr, config) < minRank) chance = 0;
    })();
    if (chance < 0) chance = 0;
    if (chance > 1) chance = 1;
    return chance;
  };


  function pickStudioForOffer(st, company, year, month, config) {
    var studios = sim.careerStudios(company);
    var i, s, title, busy = [];
    if (!studios.length) return null;
    for (i = 0; i < studios.length; i++) {
      s = studios[i];
      title = sim.pickCareerAssignment(company.id, year, month, config, st, s.id);
      if (title) busy.push(s);
    }
    if (busy.length) return sim.pick(st, busy);
    return sim.pick(st, studios);
  }

  // offer / 邀约的准入开关：mobility.requireInDevTitle
  //   true（默认）/ 省略 → 四面全开；false → 全关；
  //   { offer:false, invite:false, scripted:false, studioMove:false } → 分面关。
  // kind: "offer"（年底 offer 表）| "invite"（年中挖人）| "scripted"（剧情邀约：同事线跳槽/
  //       前辈线跟着走/搭史诗作/回国）| "studioMove"（剧情内部调岗）。

  sim.mobilityRequireInDevTitle = function (config, kind) {
    return requireInDevTitle(config, kind);
  };


  function makeHopOffer(st, config, co, studio, roleId, year, month, internal, index) {
    var title = sim.pickCareerAssignment(co.id, year, month, config, st, studio && studio.id);
    // 准入：这家（这个工作室）当月手上没活，就不该发 offer——进去就是空窗，过月没有作品可挂。
    if (!title && requireInDevTitle(config, "offer")) return null;
    var chance = sim.careerHireChance(co, st, config, studio, title);
    var powerKey = co && co.power != null ? String(co.power) : "2";
    var minRank = (jobRankSpec(config).offerMinRankByPower || {})[powerKey] || 1;
    var rank = sim.careerJobRank(st.career, config);
    var late = lateJoinSpec(config);
    var mul;
    if (title && sim.careerTitleIsLate(title, sim.careerTitleDetail(title.id, config, st), year, month, config)) {
      mul = late.hopHireChanceMul;
      if (mul != null) chance *= mul;
      if (chance < 0) chance = 0;
      if (chance > 1) chance = 1;
    }
    // 通过率 0 的 offer 不占选项位：职级不够时大厂（offerMinRankByPower[3]=3）会被硬置 0，
    // 原先仍以「0%」挂在跳槽页上——玩家看着一整排进不去的公司，既挤掉稀缺选项位，
    // 又误导「这家可以试」。返回 null 由调用方跳过（调用方已标记 usedCo，不会重复抽同一家）。
    if (!(chance > 0)) return null;
    return {
      id: "ye-" + year + "-" + index + "-" + co.id + "-" + ((studio && studio.id) || "x"),
      offerYear: year,
      companyId: co.id,
      studioId: studio && studio.id,
      studioName: studio ? sim.worldLabel(studio, config) : "",
      internal: !!internal,
      roleId: roleId,
      // 外面/内部调岗给的位置：按玩家主职维够到的职级定，公司体量封顶（旧写法只给当前职级）。
      jobRank: internal ? rank : inviteRankFor(st, config, co),
      minRank: minRank,
      titleId: title && title.id,
      titleName: title ? sim.worldLabel(title, config) : "",
      successChance: chance,
      successPct: Math.round(chance * 100),
      skillFit: sim.careerSkillHireBonus(st, config, co, studio, title) > 0
    };
  }


  sim.listYearEndOffers = function (state, config) {
    var world = sim.careerWorld(config);
    var spec = world.mobility || {};
    var companies = world.companies || [];
    var year = state.year;
    var month = state.month;
    var current = state.career && state.career.companyId;
    var currentStudio = state.career && state.career.studioId;
    var count = spec.offerCount != null ? spec.offerCount : 4;
    var internalMax = spec.internalOfferMax != null ? spec.internalOfferMax : 2;
    var curCo = sim.careerCompany(current, config);
    var out = [];
    var usedCo = {};
    var internals = [];
    var pool, i, s, co, studio, hiring, roleId, offer;
    // 准入（mobility.requireInDevTitle.offer）：当年月手上没有在研目录作的公司不进 offer 池——
    // 进去就是空窗，过月被塞虚拟作。抽公司前先过滤，免得权重抽签白抽在死公司上。
    var needsWork = requireInDevTitle(config, "offer");
    if (current) usedCo[current] = true;
    if (curCo) {
      (sim.careerStudios(curCo) || []).forEach(function (row) {
        if (row.id !== currentStudio) internals.push(row);
      });
    }
    pool = internals.slice();
    for (i = 0; i < internalMax && pool.length; i++) {
      s = sim.pick(state, pool);
      pool = pool.filter(function (x) { return x.id !== s.id; });
      roleId = pickMobilityRole(state, config, "hop");
      offer = makeHopOffer(state, config, curCo, s, roleId, year, month, true, out.length);
      if (offer) out.push(offer);
    }
    hiring = companies.filter(function (c) {
      if (usedCo[c.id] || !sim.companyJoinable(c, year)) return false;
      if (needsWork && !sim.companyInDevCatalogTitle(c.id, state, config, null)) return false;
      return true;
    });
    while (out.length < count) {
      pool = hiring.filter(function (c) { return !usedCo[c.id]; });
      if (!pool.length) break;
      (function pickExternal() {
        var weighted = pool.map(function (c) {
          return { co: c, weight: skillHireWeight(state, config, c, null, null) * domesticBoostMul(state, c, config) };
        });
        var hit = sim.pickWeighted(state, weighted) || weighted[0];
        co = hit.co;
      })();
      usedCo[co.id] = true;
      studio = pickStudioForOffer(state, co, year, month, config);
      roleId = pickMobilityRole(state, config, "hop");
      offer = makeHopOffer(state, config, co, studio, roleId, year, month, false, out.length);
      if (offer) out.push(offer);
    }
    if (((jobRankSpec(config).promotion || {}).yearEndSlot !== false) && sim.canPromoteCareer(state, config)) {
      (function unshiftPromo() {
        var view = sim.careerPromotionView(state, config);
        var copyP = sim.careerCopy(config);
        var usesLine = sim.promotionUsesEventLine && sim.promotionUsesEventLine(state, config);
        var promoRole = state.career && state.career.roleId;
        if (sim.hasActiveExclusiveGroup && sim.hasActiveExclusiveGroup(state, "careerPath", config)) return;
        if (sim.hasPendingCareerLine && sim.hasPendingCareerLine(state)) return;
        if (usesLine) {
          out.unshift({
            id: "ye-promo-line-" + year,
            kind: "promotionLine",
            lineId: (sim.promotionEventLineDef(state, config) || {}).id,
            offerYear: year,
            companyId: current,
            studioId: currentStudio,
            internal: true,
            roleId: promoRole,
            jobRank: view.nextRank,
            successChance: 1,
            successPct: 100,
            titleName: (copyP.promoteYearEnd || "内部晋升") + " · " + (view.currentLabel || "") + " → " + (view.nextLabel || "")
          });
          return;
        }
        out.unshift({
          id: "ye-promo-" + year,
          kind: "promotion",
          offerYear: year,
          companyId: current,
          studioId: currentStudio,
          internal: true,
          roleId: promoRole,
          jobRank: view.nextRank,
          successChance: 1,
          successPct: 100,
          titleName: (copyP.promoteYearEnd || "内部晋升") + " · " + (view.currentLabel || "") + " → " + (view.nextLabel || "")
        });
      })();
    }
    if (out.length > count) out = out.slice(0, count);
    return out;
  };


  sim.listCompanyStudioViews = function (state, config) {
    var co = state && state.career ? sim.careerCompany(state.career.companyId, config) : null;
    var studios = sim.careerStudios(co);
    var mine = state.career && state.career.studioId;
    var year = state.year;
    var month = state.month;
    return studios.map(function (s) {
      var inDev = sim.titlesInDevAt(co.id, year, month, config, state, s.id);
      var selling = (state.worldReleased || []).filter(function (g) {
        return g.studioId === s.id;
      });
      var last = selling.length ? selling[selling.length - 1] : null;
      return {
        studio: s,
        studioId: s.id,
        mine: s.id === mine,
        inDev: inDev,
        inDevTitle: inDev[0] || null,
        selling: last
      };
    });
  };


  sim.ensureYearEndOffers = function (st, config) {
    if (!st.career) return st;
    if (st.career.yearEndOffers && st.career.yearEndOffers.length) return st;
    st.career.yearEndOffers = sim.listYearEndOffers(st, config);
    st.career.offerYear = st.year;
    return st;
  };


  // 挖人/跳槽给什么职级：按玩家主职维够到的那一级给——外面只认能力，不认你在这家公司熬的资历。
  //   offered = max(当前职级, 属性够到的职级)，再按公司体量 rankCapByPower 封顶（小作坊给不了总监位）；
  //   一年最多升一级（maxPerYear），已升过就只给当前职级。
  // 旧口径是「当前职级 +1，条件 fame>=8」——声望与主职维无关，实测占全部晋升 52.6%，
  // 把 T-5（满级）送到了主职维 46.7 的人身上（issues/bug-career-rank-outruns-stats.md）。
  function inviteRankFor(state, config, co) {
    var spec = jobRankSpec(config);
    var promo = spec.promotion || {};
    var rankSpec = promo.inviteRank || {};
    var cr = state && state.career;
    var rankNow = sim.careerJobRank(cr, config);
    var maxR = spec.max != null ? spec.max : 6;
    var maxPer = promo.maxPerYear != null ? promo.maxPerYear : num(spec.maxPromotionsPerYear, 1);
    var power, cap, r;
    if (rankSpec.enabled === false || !cr) return rankNow;
    if (num(cr.promotionsThisYear, 0) >= maxPer) return rankNow;
    r = Math.max(rankNow, sim.careerStatRank(state, config));
    power = co && co.power != null ? String(co.power) : "2";
    cap = (rankSpec.rankCapByPower || {})[power];
    if (cap != null && r > num(cap, 0)) r = num(cap, 0);
    if (r > maxR) r = maxR;
    if (r < rankNow) r = rankNow;
    return r;
  }

  sim.listCareerInvites = function (state, config) {
    var world = sim.careerWorld(config);
    var titles = world.titles || [];
    var details = world.titleDetails || [];
    var fame = (state.career && state.career.fame) || 0;
    var now = sim.monthIndex(state.year, state.month);
    var out = [];
    var i, d, t, w, co;
    for (i = 0; i < details.length; i++) {
      d = details[i];
      if (!d.inviteEligible || !d.inviteWindow) continue;
      if (num(d.inviteMinFame, 0) > fame) continue;
      w = d.inviteWindow;
      if (now < sim.monthIndex(w.startYear, w.startMonth) || now > sim.monthIndex(w.endYear, w.endMonth)) continue;
      if (state.career && state.career.titleId === d.id) continue;
      t = sim.findById(titles, d.id);
      if (!t) continue;
      // 准入：邀约必须挂着"当月真在开发"的作（inviteWindow 本来就落在开发窗口内，
      // 这里是硬约束，防止窗口与开发窗口改歪之后把人送进空窗）。
      if (requireInDevTitle(config, "invite") && !sim.titleCoversMonth(t, d, state.year, state.month, config)) continue;
      if (sim.careerTitleIsLate(t, d, state.year, state.month, config) && lateJoinSpec(config).inviteEligible !== true) continue;
      if (state.career && t.companyId === state.career.companyId) continue;
      co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, state.year)) continue;
      (function pushInvite() {
        var staffRoles = (d.inviteRoles && d.inviteRoles.length) ? d.inviteRoles.filter(function (rid) {
          return PLAYABLE.indexOf(rid) >= 0;
        }) : PLAYABLE.slice();
        var roleId;
        var offered;
        if (!staffRoles.length && !producerOfferUnlocked(state, config)) return;
        roleId = pickMobilityRole(state, config, "invite", staffRoles);
        offered = inviteRankFor(state, config, co);
        out.push({
          id: "inv-" + d.id,
          titleId: d.id,
          companyId: t.companyId,
          studioId: t.studioId || sim.defaultStudioId(co),
          roleId: roleId,
          jobRank: offered,
          minFame: d.inviteMinFame,
          titleName: sim.worldLabel(t, config)
        });
      })();
    }
    return out;
  };

  // 邀约按「年」掷骰：每年只掷一次，inviteChance 直接就是「这一年会不会有厂商来挖」的概率。
  // 旧写法是每月独立掷一次（失败不消耗次数），12 次叠加后年内命中率 ≈ 99.8%，
  // 等于每年必被挖一次；而邀约是必成的（acceptCareerInvite 不掷骰），
  // 于是「进大厂」变成零门槛。现在改成年度单次判定，概率才可预期。

  sim.applyYearEndOffer = function (state, offerId, config) {
    var offer = null;
    var st, spec, copy, chance;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    (state.career.yearEndOffers || []).forEach(function (o) {
      if (o.id === offerId) offer = o;
    });
    if (!offer) return sim.fail(state, sim.ERR.CAREER_OFFER_NOT_FOUND);
    if (offer.kind === "promotion") {
      if (!sim.canPromoteCareer(state, config)) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
      st = sim.clone(state);
      sim.ensureCareerExtras(st, config);
      applyPromotion(st, config);
      st.career.yearEndOffers = (st.career.yearEndOffers || []).filter(function (o) { return o.kind !== "promotion"; });
      copy = sim.careerCopy(config);
      return { ok: true, state: st, hopped: false, promoted: true, notice: copy.promoteOk || "晋升成功。" };
    }
    if (offer.kind === "promotionLine") {
      if (!offer.lineId) return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
      st = sim.startCareerLine(state, offer.lineId, config);
      if (!st.ok) return st;
      st.state.career.yearEndOffers = (st.state.career.yearEndOffers || []).filter(function (o) {
        return o.kind !== "promotionLine" && o.kind !== "promotion";
      });
      copy = sim.careerCopy(config);
      return {
        ok: true,
        state: st.state,
        hopped: false,
        lineStarted: true,
        queue: st.queue || [],
        notice: copy.lineStarted || "晋升评审已开始。"
      };
    }
    if (state.career && state.career.hopFailedYear === state.year) {
      return sim.fail(state, sim.ERR.CAREER_HOP_WAIT);
    }
    if (!sim.canCareerHop(state, config)) {
      return sim.fail(state, state.career.hopFailedYear === state.year ? sim.ERR.CAREER_HOP_WAIT : sim.ERR.CAREER_BUSY);
    }
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    copy = sim.careerCopy(config);
    spec = sim.careerWorld(config).mobility || {};
    chance = offer.successChance;
    if (chance == null) {
      chance = sim.careerHireChance(sim.careerCompany(offer.companyId, config), st, config, sim.careerStudio(offer.companyId, offer.studioId, config));
    }
    if (sim.rand(st) >= chance) {
      st.career.hopFailedYear = st.year;
      st.career.hopNotice = copy.hopFailNotice || "没通过，明年再试。";
      return { ok: true, state: st, hopped: false, notice: st.career.hopNotice };
    }
    detachFromProject(st, config);
    st.career.fame = (st.career.fame || 0) + num(spec.fameOnAccept, 0);
    st.career.hopFailedYear = null;
    joinCompany(st, offer.companyId, offer.roleId, offer.titleId, config, offer.studioId, "hop", offer.jobRank);
    st.career.hopNotice = copy.hopOkNotice || "跳槽成功。";
    return { ok: true, state: st, hopped: true, notice: st.career.hopNotice };
  };


  sim.acceptYearEndOffer = function (state, offerId, config) {
    return sim.applyYearEndOffer(state, offerId, config);
  };


  sim.declineYearEndOffers = function (state, config) {
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    st = sim.clone(state);
    st.career.yearEndOffers = [];
    return sim.ok(st);
  };


  sim.acceptCareerInvite = function (state, inviteId, config) {
    var invite = null;
    var st, spec, copy;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    (state.career.invites || []).forEach(function (o) {
      if (o.id === inviteId) invite = o;
    });
    if (!invite) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    st = sim.clone(state);
    sim.ensureCareerExtras(st);
    spec = sim.careerWorld(config).mobility || {};
    st.career.fame = (st.career.fame || 0) + num(spec.fameOnAccept, 0);
    detachFromProject(st, config);
    joinCompany(st, invite.companyId, invite.roleId, invite.titleId, config, invite.studioId, "invite", invite.jobRank);
    copy = sim.careerCopy(config);
    st.career.hopNotice = copy.inviteOkNotice || copy.hopOkNotice || "跳槽成功。";
    return { ok: true, state: st, notice: st.career.hopNotice };
  };


  sim.counterCareerInvite = function (state, inviteId, config) {
    var invite = null;
    var st, spec;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    spec = sim.careerWorld(config).mobility || {};
    if (spec.inviteCanCounter === false) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    (state.career.invites || []).forEach(function (o) {
      if (o.id === inviteId) invite = o;
    });
    if (!invite) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    st = sim.clone(state);
    // P2a：货币移除后「现公司还价」不再加薪，只保留留人的声望承诺（stayPromiseFame）。
    // 该分支当前配置（mobility.inviteCanCounter=false）本就不进选项表，函数保留在 API 面上。
    st.career.fame = (st.career.fame || 0) + num(spec.stayPromiseFame, 0);
    st.career.invites = [];
    return sim.ok(st);
  };


  sim.declineCareerInvite = function (state, inviteId, config) {
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    st = sim.clone(state);
    st.career.invites = (st.career.invites || []).filter(function (o) { return o.id !== inviteId; });
    return sim.ok(st);
  };


  sim.careerYearReleases = function (year, config, st) {
    var titles = sim.allCareerTitles(config, st);
    var months = {};
    var m;
    for (m = 1; m <= 12; m++) months[m] = [];
    titles.forEach(function (t) {
      if (t.releaseYear === year) {
        months[t.releaseMonth] = months[t.releaseMonth] || [];
        months[t.releaseMonth].push(t);
      }
    });
    return { year: year, months: months };
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
