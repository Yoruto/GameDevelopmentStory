/* career-bonds.js —— 自 career.js 迁出的独立域（人物 bond 同址/远程、junior 入场与离队）。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var bondHomeCompanyId, bondRoleForLine, closeTenure, detachFromProject, jobRankSpec, num, peerEpicPool, pickReturnInviteTarget;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    var missing = [];
    bondHomeCompanyId = _.bondHomeCompanyId; if (typeof bondHomeCompanyId === 'undefined') missing.push('bondHomeCompanyId');
    bondRoleForLine = _.bondRoleForLine; if (typeof bondRoleForLine === 'undefined') missing.push('bondRoleForLine');
    closeTenure = _.closeTenure; if (typeof closeTenure === 'undefined') missing.push('closeTenure');
    detachFromProject = _.detachFromProject; if (typeof detachFromProject === 'undefined') missing.push('detachFromProject');
    jobRankSpec = _.jobRankSpec; if (typeof jobRankSpec === 'undefined') missing.push('jobRankSpec');
    num = _.num; if (typeof num === 'undefined') missing.push('num');
    peerEpicPool = _.peerEpicPool; if (typeof peerEpicPool === 'undefined') missing.push('peerEpicPool');
    pickReturnInviteTarget = _.pickReturnInviteTarget; if (typeof pickReturnInviteTarget === 'undefined') missing.push('pickReturnInviteTarget');
    // 绑定发生在加载期，若某个工具所属文件排在本文件之后，会拿到 undefined。
    // 这里出声，免得变成运行到某分支才炸的静默故障。
    if (missing.length && root.console && console.warn) {
      console.warn('[GDS] career-bonds.js: 基座工具绑定失败（检查加载顺序）:', missing.join(', '));
    }
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

  function companyOrSuccessorMatch(homeId, playerCoId, config) {
    var home;
    if (!homeId || !playerCoId) return false;
    if (homeId === playerCoId) return true;
    home = sim.careerCompany(homeId, config);
    return !!(home && home.successorId && home.successorId === playerCoId);
  }


  function noteBondRemoteFlip(st, role, wasColocated, nowColocated, config) {
    var list, i, def, prog;
    if (!wasColocated || nowColocated) return;
    if (!st.career.lines) return;
    list = (sim.eventLineDefs && config) ? sim.eventLineDefs(config) : [];
    for (i = 0; i < list.length; i++) {
      def = list[i];
      if (!def || def.kind !== "bond") continue;
      if (bondRoleForLine(def) !== role) continue;
      prog = st.career.lines[def.id];
      if (prog && prog.status === "active") prog.remotePending = true;
    }
  }


  sim.refreshCareerBondColocation = function (st, config) {
    var b, keys, i, k, bond, home, now, was, playerCo;
    if (!st || !st.career) return st;
    b = st.career.bonds;
    if (!b) return st;
    playerCo = st.career.companyId || null;
    keys = ["mentor", "peer", "junior"];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      bond = b[k];
      if (!bond) continue;
      home = bondHomeCompanyId(bond);
      was = bond.colocated !== false;
      // bond.departed：剧情已经把这个人判成"离队"（如后辈线 juniorLeave）。
      // 离队是既成事实，不因为玩家还留在原公司就被重算拉回"坐在旁边"。
      now = bond.departed ? false : companyOrSuccessorMatch(home, playerCo, config);
      bond.colocated = now;
      noteBondRemoteFlip(st, k, was, now, config);
    }
    return st;
  };


  function stampBondHome(bond, st) {
    if (!bond || !st || !st.career) return bond;
    if (!bond.homeCompanyId) bond.homeCompanyId = st.career.companyId || bond.companyId || null;
    if (!bond.homeStudioId) bond.homeStudioId = st.career.studioId || null;
    if (bond.companyId == null) bond.companyId = bond.homeCompanyId;
    if (bond.colocated == null) bond.colocated = true;
    if (bond.monthsTogether == null) bond.monthsTogether = 0;
    if (bond.monthsApart == null) bond.monthsApart = 0;
    return bond;
  }


  // 导师按玩家岗位匹配（阶段 4）：程序岗拜写程序的人，策划岗拜策划 —— 从前一律取 seniors[0]，
  // 于是程序岗进任天堂也会拜到宫本茂。匹配不到就回落第一个（与改造前一致，无数据公司不受影响）。
  function pickMentorByRole(list, roleId) {
    var i, s, first = null;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (!s) continue;
      if (!first) first = s;
      if (roleId && (s.tags || []).indexOf(roleId) >= 0) return s;
    }
    return first;
  }


  sim.pinCareerBonds = function (st, config) {
    var co, seniors, senior, pool, mate, i;
    if (!st || !st.career) return st;
    if (!st.career.bonds) st.career.bonds = { mentor: null, peer: null, junior: null };
    co = sim.careerCompany(st.career.companyId, config);
    seniors = sim.careerSeniors(co, config);
    if (!st.career.bonds.mentor) {
      // 公司可无前辈：无前辈时建立“占位导师”（以公司名指代），保证师徒玩法不崩
      senior = pickMentorByRole(seniors, st.career.roleId) || { id: null, name: (co && co.name) || "公司", alias: (co && co.alias) || (co && co.name) || "公司", title: "", departYear: null, successorCompanyId: null, successorSeniorId: null };
      st.career.bonds.mentor = stampBondHome({
        seniorId: senior.id,
        companyId: st.career.companyId,
        name: senior.name,
        alias: senior.alias || senior.name,
        title: senior.title || "",
        departYear: senior.departYear != null ? senior.departYear : null,
        successorCompanyId: senior.successorCompanyId || null,
        successorSeniorId: senior.successorSeniorId || null,
        monthsTogether: 0,
        monthsApart: 0,
        colocated: true
      }, st);
    }
    if (!st.career.bonds.peer) {
      pool = st.career.colleagues || [];
      mate = null;
      for (i = 0; i < pool.length; i++) {
        if (pool[i] && pool[i].roleId !== "producer" && pool[i].roleId !== st.career.roleId) {
          mate = pool[i];
          break;
        }
      }
      if (mate) {
        st.career.bonds.peer = stampBondHome({
          id: mate.id,
          name: mate.n,
          roleId: mate.roleId,
          jobRank: mate.jobRank,
          companyId: st.career.companyId,
          monthsTogether: 0,
          monthsApart: 0,
          colocated: true,
          epicTitleId: null,
          epicCompanyId: null
        }, st);
      }
    }
    if (st.career.bonds.mentor) stampBondHome(st.career.bonds.mentor, st);
    if (st.career.bonds.peer) stampBondHome(st.career.bonds.peer, st);
    if (st.career.bonds.junior) stampBondHome(st.career.bonds.junior, st);
    sim.refreshCareerBondColocation(st, config);
    return st;
  };


  sim.tickCareerBonds = function (st, config) {
    var b, keys, i, k, bond;
    if (!st || !st.career) return;
    if (config) sim.refreshCareerBondColocation(st, config);
    b = st.career.bonds;
    if (!b) return;
    keys = ["mentor", "peer", "junior"];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      bond = b[k];
      if (!bond) continue;
      if (bond.colocated && st.career.companyId) {
        bond.monthsTogether = num(bond.monthsTogether, 0) +
          Math.max(0, 1 + sim.careerTraitSum(st, "bondTogetherBonus", config));
      } else {
        // P2a：bondApartDelta 钩子已删除（它从来没被任何天赋用过，monthsApart 也没有读取点）。
        // 分离就是每月 +1，要加新钩子先确认 monthsApart 真的有消费方。
        bond.monthsApart = num(bond.monthsApart, 0) + 1;
      }
    }
  };


  sim.ensureCareerJuniorBond = function (st, config) {
    var spec = ((sim.careerWorld(config).eventLines) || {}).bonds || {};
    var pool = spec.juniorRevealPool || [];
    var hit, senior, cast;
    if (!st || !st.career) return null;
    if (!st.career.bonds) st.career.bonds = { mentor: null, peer: null, junior: null };
    if (st.career.bonds.junior) return st.career.bonds.junior;
    hit = pool.length ? sim.pick(st, pool) : null;
    senior = hit ? sim.findCareerSeniorById(hit.seniorId, config) : null;
    // 揭晓名按当前姓名模式取（cast 是唯一事实源；cast 未覆盖时回落内嵌 senior）。
    cast = hit && hit.seniorId && sim.castFind ? sim.castFind(hit.seniorId, config) : null;
    st.career.bonds.junior = stampBondHome({
      id: "bond-junior",
      aliasThen: spec.juniorAliasThen || "小T",
      aliasNow: senior ? sim.castName(cast || senior, config) : null,
      revealSeniorId: hit && hit.seniorId,
      revealCompanyId: hit && hit.companyId,
      revealTitleId: hit && hit.titleId,
      monthsTogether: 0,
      monthsApart: 0,
      revealed: false,
      companyId: st.career.companyId || null
    }, st);
    sim.refreshCareerBondColocation(st, config);
    return st.career.bonds.junior;
  };


  sim.revealCareerJunior = function (st, config) {
    var junior, senior, cast;
    if (!st || !st.career) return;
    junior = st.career.bonds && st.career.bonds.junior;
    if (!junior) sim.ensureCareerJuniorBond(st, config);
    junior = st.career.bonds && st.career.bonds.junior;
    if (!junior) return;
    senior = sim.findCareerSeniorById(junior.revealSeniorId, config);
    cast = junior.revealSeniorId && sim.castFind ? sim.castFind(junior.revealSeniorId, config) : null;
    if (cast) junior.aliasNow = sim.castName(cast, config);
    else if (senior) junior.aliasNow = senior.alias || senior.name;
    junior.revealed = true;
  };


  sim.kickOutOfCareerCompany = function (st, config) {
    var copy;
    if (!st || !st.career) return st;
    sim.ensureCareerExtras(st, config);
    detachFromProject(st, config);
    closeTenure(st);
    st.career.companyId = null;
    st.career.studioId = null;
    st.career.colleagues = [];
    st.career.invites = [];
    st.career.yearEndOffers = [];
    copy = sim.careerCopy(config);
    st.career.hopNotice = copy.kickOutNotice || "被请出当前公司，先找下一份工作。";
    sim.refreshCareerBondColocation(st, config);
    return st;
  };


  sim.hasPeerEpicTarget = function (st, config) {
    return peerEpicPool(st, config).length > 0;
  };

  // 回国线的落点。只有"当月真的在研一部目录作"的公司接得住这名回国的员工：
  // 挂进一家当月空着的公司，玩家过月就被判空窗，一两个月后被自动塞一部虚拟作
  // （"我明明在做暖暖环游世界，过月怎么变成一个没听过的游戏了"）。
  // 小T 所在的那家不成立就返回 null（回国线靠 when.requireInDevTarget 等它成立）。

  sim.hasCareerReturnTarget = function (st, config) {
    return !!pickReturnInviteTarget(st, config);
  };


  sim.applyCareerPromotePeer = function (st, config) {
    var peer, spec, max, next, pool, k, mate;
    if (!st || !st.career || !st.career.bonds || !st.career.bonds.peer) return st;
    peer = st.career.bonds.peer;
    spec = jobRankSpec(config);
    max = spec.max != null ? spec.max : 6;
    next = num(peer.jobRank, sim.careerJobRank(st.career, config)) + 1;
    if (next > max) next = max;
    peer.jobRank = next;
    mate = null;
    (st.career.colleagues || []).forEach(function (c) {
      if (c && (c.id === peer.id || c.n === peer.name)) mate = c;
    });
    if (mate) mate.jobRank = next;
    pool = st.career.colleaguePool || {};
    for (k in pool) {
      if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
      (function bump(companyPool) {
        var rid, row;
        if (!companyPool) return;
        for (rid in companyPool) {
          if (!Object.prototype.hasOwnProperty.call(companyPool, rid)) continue;
          row = companyPool[rid];
          if (row && (row.id === peer.id || row.n === peer.name)) row.jobRank = next;
        }
      })(pool[k]);
    }
    return st;
  };


  sim.applyCareerInvitePeer = function (st, config) {
    var peer, pool, row;
    if (!st || !st.career || !st.career.companyId) return st;
    peer = st.career.bonds && st.career.bonds.peer;
    if (!peer) return st;
    peer.homeCompanyId = st.career.companyId;
    peer.companyId = st.career.companyId;
    peer.homeStudioId = st.career.studioId || null;
    peer.colocated = true;
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    pool = st.career.colleaguePool[st.career.companyId] || {};
    row = {
      id: peer.id || ("col-peer-" + st.career.companyId),
      n: peer.name,
      roleId: peer.roleId || "programmer",
      jobRank: peer.jobRank != null ? peer.jobRank : sim.careerJobRank(st.career, config),
      stats: null
    };
    pool[row.roleId] = row;
    st.career.colleaguePool[st.career.companyId] = pool;
    sim.ensureCareerColleagues(st, config);
    if ((st.career.colleagues || []).every(function (c) { return c.id !== row.id; })) {
      st.career.colleagues.push(row);
    }
    return st;
  };


  sim.applyCareerJuniorLeave = function (st, config) {
    var junior = st && st.career && st.career.bonds && st.career.bonds.junior;
    if (!junior) return st;
    // 必须落一个持久标记：refreshCareerBondColocation 每回合按"老家公司 == 现公司"重算
    // colocated，只设 colocated=false 会在下一回合被拉回 true（人走了又坐回旁边）。
    junior.departed = true;
    junior.colocated = false;
    void config;
    return st;
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
