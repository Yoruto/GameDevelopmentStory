(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;

  function cfg() { return GDS.CONFIG; }
  function st() { return ui.session.state; }

  ui.paintCalendar = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var copy = config.copy || {};
    var careerCopy = sim.careerCopy ? sim.careerCopy(config) : {};
    var head = ui.$("calendar-head");
    var grid = ui.$("calendar-grid");
    var m, cell, lab, empty, line, pack, titles, shipped;
    if (!grid) return;
    grid.textContent = "";
    pack = sim.careerYearReleases(state.year, config, state);
    if (head) head.textContent = (careerCopy.calendarEntry || copy.calendarTitle || "发售情报") + " · " + pack.year;
    shipped = {};
    (state.worldReleased || []).forEach(function (g) { shipped[g.id] = true; });
    for (m = 1; m <= 12; m++) {
      cell = doc.createElement("div");
      cell.className = "cal-cell";
      if (m === state.month) cell.classList.add("now");
      if (m < state.month) cell.classList.add("past");
      lab = doc.createElement("div");
      lab.className = "cal-m";
      lab.textContent = m + "月";
      cell.appendChild(lab);
      titles = (pack.months && pack.months[m]) || [];
      if (!titles.length) {
        empty = doc.createElement("span");
        empty.className = "cal-g cal-tag";
        empty.textContent = copy.calendarEmpty || "暂无";
        cell.appendChild(empty);
      } else {
        titles.slice(0, 4).forEach(function (t) {
          line = doc.createElement("span");
          line.className = "cal-g";
          var liveMark = (sim.isLiveOpsTitle && sim.isLiveOpsTitle(t))
            ? (" · " + (copy.liveTagLabel || "长线"))
            : "";
          if (shipped[t.id] || m < state.month) {
            line.className += " shipped";
            line.textContent = sim.worldLabel(t, config) + liveMark +
              " · " + (copy.calendarShipped || "已发");
          } else {
            line.textContent = sim.worldLabel(t, config) + liveMark;
          }
          cell.appendChild(line);
        });
      }
      grid.appendChild(cell);
    }
  };

  ui.paintChart = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var copy = config.copy || {};
    var box = ui.$("month-chart");
    if (!box) return;
    box.textContent = "";
    var list = sim.monthlySalesRanking(state, config);
    if (!list.length) {
      var empty = doc.createElement("p");
      empty.className = "hint";
      empty.textContent = copy.chartEmpty || "这个月还没有在售作品上榜。";
      box.appendChild(empty);
      return;
    }
    list.forEach(function (row) {
      var it = doc.createElement("div");
      it.className = "item";
      it.setAttribute("role", "button");
      it.setAttribute("tabindex", "0");
      it.setAttribute("aria-expanded", "false");
      var left = doc.createElement("span");
      left.className = "nm";
      var who = row.source === "player"
        ? (copy.chartPlayerTag || "本公司")
        : (row.pub || copy.chartFillerTag || "");
      left.title = row.rank + ". " + (who ? who + " · " : "") + "《" + row.title + "》";
      it.setAttribute("aria-label", left.title + "，点按查看完整名称");
      it.title = left.title;
      function toggleFullName() {
        var expanded = it.classList.toggle("expanded");
        it.setAttribute("aria-expanded", expanded ? "true" : "false");
        it.setAttribute("aria-label", left.title + (expanded ? "，点按收起完整名称" : "，点按查看完整名称"));
      }
      it.addEventListener("click", toggleFullName);
      it.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleFullName();
      });
      // 位次单独成节点：它绝不能被省略号吃掉
      var rk = doc.createElement("span");
      rk.className = "rk";
      rk.textContent = row.rank + ".";
      left.appendChild(rk);
      // 发行商与标题拆成两个 flex 子项，并让发行商的收缩权重远高于标题（见 app.css）。
      // 宽度不够时先牺牲发行商、保住游戏名——游戏名才是这行的身份。
      if (who) {
        var pub = doc.createElement("span");
        pub.className = "pub";
        pub.textContent = who + " · ";
        left.appendChild(pub);
      }
      var ttl = doc.createElement("span");
      ttl.className = "ttl";
      ttl.textContent = "《" + row.title + "》";
      left.appendChild(ttl);
      it.appendChild(left);
      // 「长线」标必须是 .nm 的兄弟节点，不能塞进 .nm 里——
      // 否则标题一长，省略号会把标记一起吃掉。
      if (row.live) {
        var liveTag = doc.createElement("i");
        liveTag.className = "tag-live";
        liveTag.textContent = copy.liveTagLabel || "长线";
        it.appendChild(liveTag);
      }
      var b = doc.createElement("b");
      // 行尾只放销量与均分。销量一律走 sim.formatUnits 的中文短格式——
      // 改成百万级梯度后，2625727 这种裸数字会撑爆行宽。月活不再显示：
      // 那是实销 ×1500 反推的镜像值，既不影响名次也不提供新信息。
      var tail = sim.formatUnits(row.monthSales);
      if (row.avg) tail += " · " + row.avg;
      b.textContent = tail;
      it.appendChild(b);
      box.appendChild(it);
    });
  };

  // 生涯档「排行榜」页：本月世界发售实销榜。三端份额 / 对手出货 / 自研主机
  // 这些经营局内容已随公司档移除。
  ui.paintShare = function () {
    ui.paintChart();
  };

  var ROLL_DIM_CLASS = { program: "dim-p", design: "dim-d", art: "dim-a", music: "dim-m" };
  var ROLL_DIM_ORDER = ["program", "design", "art", "music"];
  var TRAIT_TIP_ANCHOR = null;
  var TRAIT_TIP_PENDING = null;
  var TRAIT_TIP_FRAME = null;
  function hideTraitTip() {
    if (TRAIT_TIP_FRAME !== null) {
      if (root.cancelAnimationFrame && root.requestAnimationFrame) root.cancelAnimationFrame(TRAIT_TIP_FRAME);
      else root.clearTimeout(TRAIT_TIP_FRAME);
      TRAIT_TIP_FRAME = null;
    }
    TRAIT_TIP_PENDING = null;
    var tip = doc.getElementById("trait-tip");
    if (tip) tip.classList.remove("on");
    if (TRAIT_TIP_ANCHOR) {
      TRAIT_TIP_ANCHOR.setAttribute("aria-expanded", "false");
      TRAIT_TIP_ANCHOR.removeAttribute("aria-describedby");
    }
    TRAIT_TIP_ANCHOR = null;
  }
  function showTraitTip(anchor, text) {
    if (!text) return;
    var tip = doc.getElementById("trait-tip");
    if (!tip) {
      tip = doc.createElement("div");
      tip.id = "trait-tip";
      tip.className = "trait-tip";
      tip.setAttribute("role", "tooltip");
      doc.body.appendChild(tip);
      doc.addEventListener("pointerdown", function (e) {
        var t = e.target;
        while (t && t !== doc.body) {
          if (t.classList && t.classList.contains("trait-chip")) return;
          t = t.parentNode;
        }
        hideTraitTip();
      });
      doc.addEventListener("keydown", function (e) {
        if (e.key === "Escape") hideTraitTip();
      });
    }
    if ((TRAIT_TIP_ANCHOR === anchor && tip.classList.contains("on")) || TRAIT_TIP_PENDING === anchor) {
      hideTraitTip();
      return;
    }
    hideTraitTip();
    TRAIT_TIP_PENDING = anchor;
    var schedule = root.requestAnimationFrame || function (fn) { return root.setTimeout(fn, 16); };
    TRAIT_TIP_FRAME = schedule.call(root, function () {
      TRAIT_TIP_FRAME = null;
      if (TRAIT_TIP_PENDING !== anchor) return;
      TRAIT_TIP_PENDING = null;
      if (anchor.isConnected === false) return;
      var anchorRect = anchor.getBoundingClientRect();
      var viewportWidth = root.innerWidth;
      var viewportHeight = root.innerHeight;
      var left = Math.max(8, Math.min(anchorRect.left, viewportWidth - 268));
      var above = anchorRect.bottom > viewportHeight / 2;
      var top = above ? anchorRect.top - 6 : anchorRect.bottom + 6;
      TRAIT_TIP_ANCHOR = anchor;
      anchor.setAttribute("aria-expanded", "true");
      anchor.setAttribute("aria-describedby", "trait-tip");
      tip.textContent = text;
      tip.classList.add("on");
      tip.style.left = Math.round(left) + "px";
      tip.style.top = Math.round(top) + "px";
      tip.style.transform = above ? "translateY(-100%)" : "";
    });
  }

  function paintTraitChips(box, ids, config, labelText) {
    if (!box) return;
    if ((TRAIT_TIP_ANCHOR && box.contains(TRAIT_TIP_ANCHOR)) ||
        (TRAIT_TIP_PENDING && box.contains(TRAIT_TIP_PENDING))) hideTraitTip();
    box.textContent = "";
    var defs = (ids || []).map(function (id) {
      return { id: id, trait: sim.traitDef(id, config) };
    }).filter(function (entry) { return !!entry.trait; });
    box.hidden = !defs.length;
    if (!defs.length) return;
    var label = doc.createElement("div");
    label.className = "trait-chip-label";
    label.textContent = labelText;
    box.appendChild(label);
    var row = doc.createElement("div");
    row.className = "trait-chip-row";
    defs.forEach(function (entry) {
      var trait = entry.trait;
      var chip = doc.createElement("button");
      chip.type = "button";
      chip.className = "trait-chip";
      chip.textContent = trait.displayName || entry.id;
      chip.setAttribute("aria-label", chip.textContent + "，查看效果");
      chip.setAttribute("aria-expanded", "false");
      chip.addEventListener("click", function () {
        showTraitTip(chip, trait.summary || chip.textContent);
      });
      row.appendChild(chip);
    });
    box.appendChild(row);
  }

  ui.paintCareerStartRoll = function () {
    var config = cfg();
    var copy = sim.careerCopy(config);
    var draft = ui.session.startRoll;
    var statsBox = ui.$("roll-stats");
    var traitBox = ui.$("roll-trait");
    var specEl = ui.$("roll-spec");
    var totalEl = ui.$("roll-total");
    var rerollBtn = ui.$("btn-reroll");
    var rollsLeft = ui.session.rollsLeft != null ? ui.session.rollsLeft : 0;
    var role, i, k, dim, cell, val, name, sum, item, ids;
    if (!statsBox) return;
    statsBox.textContent = "";
    if (!draft) {
      paintTraitChips(traitBox, [], config, copy.traitTitle || "天赋");
      return;
    }
    role = draft.roleId ? sim.careerRole(draft.roleId, config) : null;
    if (specEl) {
      specEl.textContent = (copy.roleTitle || "擅长") + (role ? " · " + sim.worldLabel(role, config) : " —");
    }
    if (totalEl) totalEl.textContent = "总 " + draft.total;
    for (i = 0; i < ROLL_DIM_ORDER.length; i++) {
      k = ROLL_DIM_ORDER[i];
      dim = draft.stats ? draft.stats[k] : 0;
      cell = doc.createElement("div");
      cell.className = ("stat " + (ROLL_DIM_CLASS[k] || "") + (k === draft.mainDim ? " main" : "")).trim();
      val = doc.createElement("b");
      val.textContent = dim;
      name = doc.createElement("span");
      name.textContent = copyDimName(config, k);
      cell.appendChild(val);
      cell.appendChild(name);
      statsBox.appendChild(cell);
    }
    ids = draft.traitIds || (draft.traitId ? [draft.traitId] : []);
    paintTraitChips(traitBox, ids, config, copy.traitTitle || "天赋");
    if (rerollBtn) {
      rerollBtn.textContent = rollsLeft > 0
        ? (copy.rollButton || "🎲 重掷开局（剩 {n} 次）").replace("{n}", String(rollsLeft))
        : ((copy.rollButton || "🎲 重掷开局").replace(/（.*）/, ""));
      rerollBtn.disabled = rollsLeft <= 0;
    }
  };

  function copyDimName(config, dim) {
    var copy = sim.careerCopy(config);
    return { program: copy.dimProgram, design: copy.dimDesign, art: copy.dimArt, music: copy.dimMusic }[dim] || dim;
  }

  ui.paintCareerOffers = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var box = ui.$("offer-list");
    var title, hint;
    if (!box || !state || !state.career) return;
    box.textContent = "";
    title = ui.$("offer-title");
    hint = ui.$("offer-hint");
    if (title) title.textContent = copy.offerTitle || "三份 offer";
    if (hint) {
      hint.textContent = copy.offerHint || "";
      hint.style.display = copy.offerHint ? "" : "none";
    }
    // 入行熟练行已按需求撤下：占位元素直接藏掉，避免留空隙
    (function hideOfferSkills() {
      var el = ui.$("offer-skills");
      if (el) el.style.display = "none";
    })();
    (state.career.openingOffers || []).forEach(function (o) {
      var co = sim.careerCompany(o.companyId, config);
      var role = sim.careerRole(o.roleId, config);
      var card = doc.createElement("div");
      var name = doc.createElement("div");
      var meta = doc.createElement("p");
      var go = doc.createElement("button");
      card.className = "offer-card";
      name.className = "name";
      name.textContent = co ? sim.worldLabel(co, config) : o.companyId;
      meta.className = "hint";
      meta.textContent = (role ? sim.worldLabel(role, config) : "") +
        (o.roleId ? (" · " + sim.formatCareerRankLabel(o.roleId, (o.jobRank != null ? o.jobRank : 1), config)) : "");
      go.type = "button";
      go.className = "btn wide mt-8";
      go.textContent = copy.acceptButton || "入职";
      go.setAttribute("data-offer", o.id);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(go);
      box.appendChild(card);
    });
  };

  ui.paintCareerHq = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var career, co, role, view, live, job, box, tickBtn, self, head, stats, promo;
    var hopCard, hopList, hopApply, roleEl, nameEl, metaEl;
    if (!state || !state.career) return;
    sim.ensureCareerExtras(state);
    career = state.career;
    co = sim.careerCompany(career.companyId, config);
    role = sim.careerRole(career.roleId, config);
    view = sim.careerProjectView(state, config);
    live = view.liveStats;
    stats = career.stats || {};
    ui.$("hq-name").textContent = "我";
    ui.$("end-name").textContent = "我";
    ui.motion.setText(ui.$("hq-date"), sim.dateText(state));
    (function setLabs() {
      var fansLab = ui.$("hq-fans-lab");
      if (fansLab) fansLab.textContent = copy.fameLabel || "声望";
      var healthLab = ui.$("hq-health-lab");
      if (healthLab) healthLab.textContent = copy.healthLabel || "健康";
    })();
    // P4c：声望 KPI 显示称号链档位（裸分留存在 fame 字段与结算页）。
    (function paintRenown() {
      var fans = ui.$("hq-fans");
      var rv = sim.careerRenownView ? sim.careerRenownView(state, config) : null;
      if (fans && rv) {
        fans.textContent = rv.label;
        fans.title = (copy.renownLabel || "声望") + " " + rv.score + "（获奖 " + rv.wins + " · 高分作品 " + rv.scoreHits + "）";
      }
    })();
    // P4b：健康 5 段体检条，不显数字。
    (function paintHealth() {
      var box = ui.$("hq-health");
      if (!box) return;
      var init = (sim.careerWorld(config).careerHealth || {}).init;
      var v = Number(career.health != null ? career.health : (init != null ? init : 4));
      [].slice.call(box.querySelectorAll("i")).forEach(function (pip, i) {
        pip.className = i < v ? "on" : "";
      });
    })();
    ui.$("hq-scale").textContent = co
      ? (sim.worldLabel(co, config) + (function () {
        var studio = sim.careerStudio(career.companyId, career.studioId, config);
        return studio ? (" / " + sim.worldLabel(studio, config)) : "";
      })())
      : (copy.waitRole || "待命");
    ui.$("hq-cap").textContent = (copy.roleChipLabel || "岗位") + " " + (role ? sim.worldLabel(role, config) : "");
    ui.$("hq-plats-chip").textContent = view.idle
      ? (view.idleLabel || copy.idleHint || "待命")
      : ((copy.phasePrefix || "阶段") + " " + (view.phase ? sim.worldLabel(view.phase, config) : ""));
    roleEl = ui.$("hq-player-role");
    if (roleEl) roleEl.textContent = role ? sim.worldLabel(role, config) : "";
    head = ui.$("hq-player-head");
    if (head) head.textContent = copy.playerHead || "自身";
    function showNum(id, val) {
      var el = ui.$(id);
      if (el) el.textContent = val != null ? String(Math.round(val)) : "—";
    }
    showNum("hq-self-p", stats.program);
    showNum("hq-self-d", stats.design);
    showNum("hq-self-a", stats.art);
    showNum("hq-self-m", stats.music);
    head = ui.$("hq-project-head");
    if (head) head.textContent = copy.projectHead || "在研作品";
    nameEl = ui.$("hq-project-name");
    metaEl = ui.$("hq-project-meta");
    (function paintBar() {
      var bar = ui.$("hq-project-bar");
      var liveGrid = ui.$("hq-live-grid");
      if (bar) {
        bar.style.width = view.idle ? "0%" : (Math.round((view.progress || 0) * 100) + "%");
        if (bar.parentNode && bar.parentNode.classList.contains("bar")) {
          bar.parentNode.hidden = !!view.idle;
        }
      }
      if (liveGrid) liveGrid.hidden = !!view.idle;
    })();
    if (view.idle) {
      if (nameEl) nameEl.textContent = view.idleLabel || copy.idleHint || "待命";
      if (metaEl) metaEl.textContent = "";
    } else {
      if (nameEl) {
        nameEl.textContent = sim.worldLabel(view.title, config) +
          (view.phase ? (" · " + sim.worldLabel(view.phase, config)) : "");
      }
      if (metaEl) {
        metaEl.textContent = (copy.genreLabel || "题材") + " " +
          sim.contentName(config.content.genres, view.genreId) +
          " · " + (copy.gameplayLabel || "玩法") + " " +
          sim.contentName(config.content.gameplay, view.gameplayId) +
          (view.title && sim.releaseTypeLabel
            ? (" · " + sim.releaseTypeLabel(view.title.releaseType, config))
            : "");
      }
    }
    // 职级名不带 (A-2) 这类档位代码
    var stripRankCode = function (s) {
      return (s || "").replace(/\s*[（(][A-Za-z]+-\d+[)）]\s*$/, "");
    };
    job = ui.$("hq-career-job");
    if (job && sim.careerPromotionView) {
      promo = sim.careerPromotionView(state, config);
      var titleLine = (copy.jobLabel || "职称") + " " + stripRankCode(promo.currentLabel || "");
      job.hidden = false;
      // 只保留状态提示（可申请晋升 / 已满级）；隐藏「还差 X」晋升·挂名倒计时，避免玩家盯着算进度
      job.textContent = titleLine + (promo.gapLines && promo.gaps && !promo.gaps.length
        ? " · " + promo.gapLines.join("；")
        : "");
    } else if (job) job.textContent = "";
    (function paintGoalAndRecap() {
      var goal = ui.$("hq-goal");
      var recap = ui.session.recap;
      var recapEl = ui.$("hq-recap");
      var emptyEl = ui.$("hq-recap-empty");
      var detailEl = ui.$("hq-recap-details");
      var newsEl = ui.$("hq-news");
      var news = sim.careerYearDigest ? sim.careerYearDigest(state, config) : career.intelNews;
      var gap = promo && promo.gaps && promo.gaps[0];
      var aim;
      if (!co) aim = "寻找合适的东家";
      else if (promo && promo.can) aim = "晋升条件已满足";
      else if (gap && (gap.id === "year" || gap.id === "months")) aim = "积累任职经历";
      else if (gap && gap.id === "stat") aim = "提升主职能力";
      else if (gap && gap.id === "credits") aim = "参与作品，积累署名";
      else if (gap && gap.id === "fame") aim = "积累声望与荣誉";
      else if (!view.idle) aim = "推进在研作品";
      else aim = "等待下一个机会";
      if (goal) goal.textContent = "近期目标 · " + aim;
      if (newsEl) {
        newsEl.hidden = !(news && news.body);
        newsEl.querySelector("b").textContent = "业界快讯 · " + (news && news.year || "");
        ui.$("hq-news-body").textContent = news && news.body || "";
      }
      if (!recapEl) return;
      recapEl.hidden = !recap;
      if (emptyEl) emptyEl.hidden = !!recap;
      if (!recap) return;
      ui.$("hq-recap-head").textContent = recap.head;
      ui.$("hq-recap-main").textContent = recap.main;
      detailEl.hidden = !recap.detail;
      ui.$("hq-recap-detail").textContent = recap.detail || "";
    })();
    (function paintPromote() {
      var btn = ui.$("hq-promote");
      if (!btn || !sim.canPromoteCareer) return;
      var can = sim.canPromoteCareer(state, config);
      var usesLine = sim.promotionUsesEventLine && sim.promotionUsesEventLine(state, config);
      var pathBusy = sim.hasActiveExclusiveGroup && sim.hasActiveExclusiveGroup(state, "careerPath", config);
      var pending = sim.hasPendingCareerLine && sim.hasPendingCareerLine(state);
      btn.hidden = !can || pathBusy || pending;
      btn.textContent = usesLine
        ? ((copy.promoteLineButton || copy.promoteButton) || "申请晋升")
        : (copy.promoteButton || "申请晋升");
    })();
    var liveDimIds = ["hq-live-p", "hq-live-d", "hq-live-a", "hq-live-m"];
    sim.titleDims(config).forEach(function (d, i) {
      showNum(liveDimIds[i], live && live[d]);
    });
    hopCard = ui.$("hq-hop-card");
    hopList = ui.$("hq-hop-list");
    if (hopCard) hopCard.hidden = true;
    if (hopList) hopList.textContent = "";
    hopApply = ui.$("hq-hop-apply");
    if (hopApply) hopApply.hidden = true;
    head = ui.$("hq-team-head");
    if (head) head.textContent = copy.colleagueTitle || "制作组";
    box = ui.$("hq-staff");
    if (box) {
      box.textContent = "";
      var dimOfRole = function (r) {
        var s = r && r.stat;
        return s === "design" ? "dim-d" : s === "art" ? "dim-a" : s === "music" ? "dim-m" : "dim-p";
      };
      var addRow = function (name, roleLabel, dim) {
        var row = doc.createElement("div");
        var ava = doc.createElement("span");
        var nm = doc.createElement("span");
        var rl = doc.createElement("span");
        row.className = "staff-row";
        ava.className = "staff-ava " + dim;
        ava.textContent = (name || "?").charAt(0);
        nm.className = "staff-name";
        nm.textContent = name || "";
        rl.className = "staff-role " + dim;
        rl.textContent = roleLabel || "";
        row.appendChild(ava);
        row.appendChild(nm);
        row.appendChild(rl);
        box.appendChild(row);
      };
      // 制作组只列其他组员，不重复展示玩家本人。
      if (!(career.colleagues || []).length) {
        var empty = doc.createElement("p");
        empty.className = "hint";
        empty.textContent = "暂无其他组员";
        box.appendChild(empty);
      }
      (career.colleagues || []).forEach(function (s) {
        var rr = sim.careerRole(s.roleId, config);
        var rankLabel = sim.formatCareerRankLabel
          ? stripRankCode(sim.formatCareerRankLabel(s.roleId, s.jobRank != null ? s.jobRank : 1, config))
          : "";
        addRow(
          sim.colleagueName ? sim.colleagueName(s, config) : s.n,
          [rr ? sim.worldLabel(rr, config) : "", rankLabel].filter(Boolean).join(" · "),
          dimOfRole(rr)
        );
      });
    }
    tickBtn = ui.$("btn-tick");
    if (tickBtn && !ui.$("dlg-mask").classList.contains("on")) {
      tickBtn.disabled = state.phase !== "PLAYING";
    }
    ui.paintEnds();
  };

  ui.paintPlayer = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var sheet, head;
    if (!state || !state.career || !sim.careerSkillSheet) return;
    sheet = sim.careerSkillSheet(state, config);
    head = ui.$("player-page-head");
    if (head) head.textContent = copy.playerPageTitle || "玩家详情";
    head = ui.$("player-genre-head");
    if (head) head.textContent = copy.playerGenreHead || copy.genreLabel || "题材";
    head = ui.$("player-play-head");
    if (head) head.textContent = copy.playerGameplayHead || copy.gameplayLabel || "玩法";
    function fillGrid(id, rows) {
      var box = ui.$(id);
      if (!box) return;
      box.textContent = "";
      (rows || []).forEach(function (row) {
        var el = doc.createElement("div");
        var name = doc.createElement("span");
        var tier = doc.createElement("b");
        el.className = "skill-item" + (row.tierId ? (" " + row.tierId) : "");
        name.textContent = row.label || row.id;
        tier.className = "tier";
        tier.textContent = row.tier || "";
        el.appendChild(name);
        el.appendChild(tier);
        box.appendChild(el);
      });
    }
    fillGrid("player-genre-grid", sheet.genres);
    fillGrid("player-play-grid", sheet.gameplay);
    paintTraitChips(
      ui.$("player-trait-row"),
      sim.careerTraitIds ? sim.careerTraitIds(state) : [],
      config,
      copy.traitTitle || "天赋"
    );
  };

  ui.paintResume = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var view, box, i, row, el, bits, credits, head;
    if (!state || !state.career || !sim.careerResumeView) return;
    view = sim.careerResumeView(state, config);
    credits = (view.credits || []).filter(function (c) { return c.shipped; });
    // 标题即摘要：把「署名作品」和「过渡项目」拆开，玩家一眼看得见时间花在哪。
    head = ui.$("resume-head");
    if (head) {
      bits = [(copy.resumeCredits || copy.resumeTitle || "署名作品") + " " + (view.signedCount || 0)];
      if ((view.transitionCount || 0) > 0) {
        bits.push((copy.resumeVirtual || "过渡项目") + " " + view.transitionCount);
      }
      head.textContent = bits.join(" · ");
    }
    box = ui.$("resume-credits");
    if (box) {
      box.textContent = "";
      if (!credits.length) {
        el = doc.createElement("p");
        el.className = "hint";
        el.textContent = copy.resumeEmpty || "还没有署名作品。";
        box.appendChild(el);
      }
      for (i = 0; i < credits.length; i++) {
        row = credits[i];
        el = doc.createElement("div");
        el.className = "resume-row";
        bits = doc.createElement("div");
        bits.className = "name";
        bits.textContent = "《" + row.titleLabel + "》";
        el.appendChild(bits);
        bits = doc.createElement("p");
        bits.className = "hint";
        bits.textContent = [
          // 过渡项目显示它的专属评语（按落盘分数档）；前面仍保留「过渡项目」标签，
          // 不然行内只剩一句感慨，玩家看不出这行的性质。
          row.virtual
            ? ((copy.resumeVirtual || "过渡项目") + (row.poolNote ? ("·" + row.poolNote) : ""))
            : "",
          row.supported ? (copy.resumeSupported || "后续支持") : "",
          row.score != null ? String(row.score) : "",
          row.sales != null
            ? ((copy.resumeSalesLabel || "总销量") + " " + sim.formatUnits(row.sales))
            : "",
          sim.formatCareerRankLabel ? sim.formatCareerRankLabel(row.roleId, row.jobRank, config) : ("Lv." + (row.jobRank || 1)),
          row.joinYear ? (row.joinYear + "." + row.joinMonth + (row.leftYear ? ("–" + row.leftYear + "." + row.leftMonth) : "")) : ""
        ].filter(Boolean).join(" · ");
        el.appendChild(bits);
        box.appendChild(el);
      }
    }
  };

  ui.paintEnds = function () {
    var state = st();
    var config = cfg();
    var copy, career, role, co;
    if (!state) return;
    copy = sim.careerCopy(config);
    career = state.career;
    role = sim.careerRole(career.roleId, config);
    co = sim.careerCompany(career.companyId, config);
    var settle = sim.careerSettlementView ? sim.careerSettlementView(state, config) : null;
    ui.$("end-name").textContent = "我";
    ui.$("end-scale").textContent = (settle && settle.jobLabel) || (role ? sim.worldLabel(role, config) : "—");
    ui.$("end-fans").textContent = String((settle && settle.fame) != null ? settle.fame : (career.fame || 0));
    ui.$("end-games").textContent = String(settle ? settle.creditedCount : (career.credits || []).length);
    ui.$("end-series").textContent = (settle && settle.employer) || (co ? sim.worldLabel(co, config) : "—");
    ui.$("end-avg").textContent = String((settle && settle.honor) != null ? settle.honor : (career.honor || 0));
    function setLab(id, text) {
      var el = ui.$(id);
      if (el) el.textContent = text;
    }
    setLab("end-scale-label", copy.settleTitleLabel || "职称");
    setLab("end-fans-label", copy.settleFameLabel || "声望");
    setLab("end-games-label", copy.settleCreditsLabel || "署名作");
    setLab("end-series-label", copy.settleEmployerLabel || "最后东家");
    setLab("end-avg-label", copy.settleHonorLabel || "荣誉");
    var ending = sim.careerEndingView ? sim.careerEndingView(state, config) : null;
    if (ending) {
      ui.$("end-card-title").textContent = ending.title;
      ui.$("end-card-body").textContent = ending.body;
      ui.$("end-card-echo").textContent = ending.echo;
    }
    ui.$("btn-career-poster").hidden = state.phase !== "SETTLED";
  };

  ui.paintHq = function () {
    var state = st();
    if (!state) return;
    ui.paintCareerHq();
  };

  ui.paintStaticCopy = function () {
    var config = cfg();
    var cal = config.calendar;
    var span = ui.$("boot-span");
    var copyC = sim.careerCopy ? sim.careerCopy(config) : {};
    var world = config.careerWorld || {};
    var tl = world.timeline || cal;
    if (span) span.textContent = copyC.bootPill || (tl.startYear + " — " + tl.endYear);
    var startBtn = ui.$("btn-start");
    if (startBtn && copyC.startButton) startBtn.textContent = copyC.startButton;
    var intelBtn = ui.$("btn-sheet-intel");
    if (intelBtn && copyC.intel) intelBtn.textContent = copyC.intel;
    var tickBtnCopy = ui.$("btn-tick");
    // P3：唯一推进按钮文案 = 「继续」。copyC 已是 copy.career（sim.careerCopy 的返回值）。
    if (tickBtnCopy) {
      tickBtnCopy.textContent = copyC.continueButton || copyC.nextMonth || tickBtnCopy.textContent;
    }
    var tgaHead = ui.$("tga-head");
    if (tgaHead && copyC.awardKicker) tgaHead.textContent = copyC.awardKicker;
    var tgaBtn = ui.$("dock-tga");
    if (tgaBtn && copyC.tgaEntry) tgaBtn.textContent = copyC.tgaEntry;
    var calDock = ui.$("dock-cal");
    if (calDock && copyC.calendarEntry) calDock.textContent = copyC.calendarEntry;
    // 两套维度：作品侧（hq-dim-* / pj-dim-*）读 copy.career.prodDim，
    // 人物侧（hq-self-dim-*）读 copy.career.dim*。都按 careerWorld.quality 的维度表驱动，
    // 位置钉到 DOM 的 p/d/a/m 后缀，别在这里再写死一套键名。
    var DIM_SUFFIX = ["p", "d", "a", "m"];
    var prodDim = copyC.prodDim || {};
    var selfDim = { program: copyC.dimProgram, design: copyC.dimDesign,
                    art: copyC.dimArt, music: copyC.dimMusic };
    sim.titleDims(config).forEach(function (d, i) {
      var txt = prodDim[d];
      if (!txt) return;
      var hq = ui.$("hq-dim-" + DIM_SUFFIX[i]);
      if (hq) hq.textContent = txt;
      var pj = ui.$("pj-dim-" + DIM_SUFFIX[i]);
      if (pj) pj.textContent = txt;
    });
    sim.personDims(config).forEach(function (d, i) {
      var el = ui.$("hq-self-dim-" + DIM_SUFFIX[i]);
      if (el && selfDim[d]) el.textContent = selfDim[d];
    });
    var chartHead = ui.$("chart-head");
    if (chartHead && config.copy && config.copy.chartTitle) chartHead.textContent = config.copy.chartTitle;
    var resumeDock = ui.$("dock-resume");
    if (resumeDock && copyC.resumeEntry) resumeDock.textContent = copyC.resumeEntry;
    var resumeL1 = ui.$("dock-resume-l1");
    if (resumeL1 && copyC.resumeEntry) resumeL1.textContent = copyC.resumeEntry;
    var playerL1 = ui.$("dock-player-l1");
    if (playerL1 && copyC.playerDockLabel) playerL1.textContent = copyC.playerDockLabel;
    var tgaL1 = ui.$("dock-tga-l1");
    if (tgaL1 && copyC.tgaEntry) tgaL1.textContent = copyC.tgaEntry;
  };

  function paintAwardBlock(host, a, copy) {
    var wrap = doc.createElement("div");
    var row = doc.createElement("div");
    var l = doc.createElement("span");
    var b = doc.createElement("b");
    var mine = ui.awardPlayerWon && ui.awardPlayerWon(a);
    wrap.className = "media-outlet";
    row.className = "row item";
    l.textContent = a.n;
    b.textContent = a.w;
    if (mine) b.className = "award-mine";
    row.appendChild(l);
    row.appendChild(b);
    wrap.appendChild(row);
    (a.nominees || []).forEach(function (n) {
      var nom = doc.createElement("p");
      nom.className = "hint" + (n.player ? " award-mine" : "");
      nom.textContent = (n.label || "") + (n.player ? (" · " + (copy.awardsPlayerMark || "你")) : "");
      wrap.appendChild(nom);
    });
    host.appendChild(wrap);
  }

  var TGA_SCROLL_FRAME = null;
  function scrollTgaYearChip(nav) {
    if (TGA_SCROLL_FRAME !== null) {
      if (root.cancelAnimationFrame && root.requestAnimationFrame) root.cancelAnimationFrame(TGA_SCROLL_FRAME);
      else root.clearTimeout(TGA_SCROLL_FRAME);
    }
    var schedule = root.requestAnimationFrame || function (fn) { return root.setTimeout(fn, 16); };
    TGA_SCROLL_FRAME = schedule.call(root, function () {
      TGA_SCROLL_FRAME = null;
      var onChip = nav.querySelector(".tga-year-chip.on");
      var scroller = nav.parentNode;
      if (!onChip || !scroller || nav.isConnected === false) return;
      var left = onChip.offsetLeft - (scroller.clientWidth - onChip.offsetWidth) / 2;
      scroller.scrollLeft = Math.max(0, left);
    });
  }

  ui.paintTga = function () {
    var box = ui.$("tga-rows");
    var nav = ui.$("tga-years");
    var config = cfg();
    var copy = (config && config.copy) || {};
    var copyC = sim.careerCopy ? sim.careerCopy(config) : {};
    var hist, yearBox, head, chip, selected, years, i, entry, list;
    if (!box) return;
    box.textContent = "";
    if (nav) nav.textContent = "";
    hist = sim.listAwardsHistory ? sim.listAwardsHistory(st(), config) : [];
    if (!hist.length) {
      return;
    }
    years = hist.map(function (row) { return Number(row.year); });
    selected = Number(ui.session.tgaYear);
    if (years.indexOf(selected) < 0) selected = years[0];
    ui.session.tgaYear = selected;
    if (nav) {
      hist.slice().sort(function (a, b) { return Number(a.year) - Number(b.year); }).forEach(function (row) {
        chip = doc.createElement("button");
        chip.type = "button";
        chip.className = "tga-year-chip" + (Number(row.year) === selected ? " on" : "");
        chip.textContent = String(row.year);
        chip.setAttribute("data-tga-year", String(row.year));
        nav.appendChild(chip);
      });
      scrollTgaYearChip(nav);
    }
    for (i = 0; i < hist.length; i++) {
      if (Number(hist[i].year) === selected) { entry = hist[i]; break; }
    }
    if (!entry) return;
    list = entry.awards || [];
    if (ui.ceremonyAwards) list = ui.ceremonyAwards(list);
    yearBox = doc.createElement("div");
    yearBox.className = "tga-year";
    yearBox.id = "tga-y-" + entry.year;
    head = doc.createElement("h3");
    head.className = "tga-year-head";
    head.textContent = entry.year + " " + (copyC.awardsYearSuffix || copy.awardKicker || "年度盛典");
    yearBox.appendChild(head);
    list.forEach(function (a) { paintAwardBlock(yearBox, a, copyC); });
    box.appendChild(yearBox);
  };

  ui.mediaNodes = function (rec) {
    var nodes = [];
    var media = rec.media || rec;
    (media.rows || []).forEach(function (r) {
      var row = doc.createElement("div");
      var l = doc.createElement("p");
      var q = doc.createElement("p");
      var b = doc.createElement("b");
      row.className = "media-outlet";
      l.className = "fx-outlet-name";
      l.textContent = r.n;
      q.className = "quote";
      if (r.quote) q.appendChild(doc.createTextNode(r.quote + " "));
      b.className = "stars fx-score on";
      b.textContent = String(r.score);
      q.appendChild(b);
      row.appendChild(l);
      row.appendChild(q);
      nodes.push(row);
    });
    var copy = (cfg() && cfg().copy) || {};
    if (rec.baselineSales != null) {
      var br = doc.createElement("div");
      br.className = "row item";
      var bl = doc.createElement("span"); bl.textContent = copy.baselineSalesLabel || "基准（首月参照）";
      var bb = doc.createElement("b"); bb.textContent = sim.formatUnits(rec.baselineSales);
      br.appendChild(bl); br.appendChild(bb); nodes.push(br);
    }
    // 只出月销量（rec.launchSales = 发售当月实销）。首周行随「不显示首周销量」于 2026-09-18 删除。
    if (rec.monthSales != null || rec.launchSales != null) {
      var sr = doc.createElement("div");
      sr.className = "media-outlet fx-outlet fx-sales";
      var sl = doc.createElement("p");
      sl.className = "fx-outlet-name";
      sl.textContent = copy.launchSalesReveal || copy.launchActualSalesLabel || "首月销量";
      var sq = doc.createElement("p");
      sq.className = "quote";
      var sb = doc.createElement("b");
      sb.className = "stars fx-score on";
      sb.textContent = sim.formatUnits(rec.launchSales != null ? rec.launchSales : rec.monthSales);
      sq.appendChild(sb);
      sr.appendChild(sl);
      sr.appendChild(sq);
      if (rec.salesReason) {
        var why = doc.createElement("p");
        why.className = "hint";
        why.textContent = rec.salesReason;
        sr.appendChild(why);
      }
      nodes.push(sr);
      // P6：离奖信号 + 销量具象化（≤2 行；呈现层只读，launchSales 数值链路不动）。
      var stHere = ui.session && ui.session.state;
      if (sim.mediaRevealFlavor && stHere) {
        (sim.mediaRevealFlavor(rec, stHere, cfg()) || []).forEach(function (line) {
          var fr = doc.createElement("div");
          fr.className = "media-outlet fx-flavor";
          var fq = doc.createElement("p");
          fq.className = "quote";
          fq.textContent = line;
          fr.appendChild(fq);
          nodes.push(fr);
        });
      }
    }
    return nodes;
  };

  ui.awardNodes = function (list) {
    var copy = sim.careerCopy ? sim.careerCopy(cfg()) : ((cfg() && cfg().copy) || {});
    return (ui.ceremonyAwards ? ui.ceremonyAwards(list) : list).map(function (a) {
      var wrap = doc.createElement("div");
      paintAwardBlock(wrap, a, copy);
      return wrap.firstChild || wrap;
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
