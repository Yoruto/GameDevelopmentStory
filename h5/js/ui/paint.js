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
    var hint = ui.$("calendar-hint");
    var grid = ui.$("calendar-grid");
    var m, cell, lab, empty, line, pack, plans, titles, shipped, cal;
    if (!grid) return;
    grid.textContent = "";
    if (sim.isCareerMode && sim.isCareerMode(state)) {
      pack = sim.careerYearReleases(state.year, config, state);
      if (head) head.textContent = (careerCopy.calendarEntry || copy.calendarTitle || "发售情报") + " · " + pack.year;
      if (hint) hint.textContent = copy.calendarHint || hint.textContent;
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
            if (t.isVersion) {
              if (m < state.month) line.className += " shipped";
              line.textContent = (t.label || sim.worldLabel(t, config)) +
                (m < state.month ? (" · " + (copy.calendarShipped || "已发")) : "") +
                " · " + (copy.liveopsVersionTag || "版本");
            } else if (shipped[t.id] || m < state.month) {
              line.className += " shipped";
              line.textContent = sim.worldLabel(t, config) + " · " + (copy.calendarShipped || "已发");
              if (sim.isLiveOpsTitle && sim.isLiveOpsTitle(t)) {
                line.textContent += " · " + (((copy.releaseTypes || {}).liveops) || "");
              }
            } else {
              line.textContent = sim.worldLabel(t, config);
              if (sim.isLiveOpsTitle && sim.isLiveOpsTitle(t)) {
                line.textContent += " · " + (((copy.releaseTypes || {}).liveops) || "");
              }
            }
            cell.appendChild(line);
          });
        }
        grid.appendChild(cell);
      }
      return;
    }
    cal = sim.getRivalCalendar(state, state.year);
    if (head) head.textContent = (copy.calendarTitle || "发售日历") + " · " + cal.year;
    if (hint) hint.textContent = copy.calendarHint || hint.textContent;
    var grid = ui.$("calendar-grid");
    if (!grid) return;
    grid.textContent = "";
    var m;
    for (m = 1; m <= 12; m++) {
      var cell = doc.createElement("div");
      cell.className = "cal-cell";
      if (m === state.month) cell.classList.add("now");
      if (m < state.month) cell.classList.add("past");
      var lab = doc.createElement("div");
      lab.className = "cal-m";
      lab.textContent = m + "月";
      cell.appendChild(lab);
      var plans = (cal.months[m] || []).slice();
      if (sim.listLiveOpsVersionDrops) {
        sim.listLiveOpsVersionDrops(state, state.year, config).forEach(function (d) {
          if (d.month !== m) return;
          plans.push(d);
        });
      }
      if (!plans.length) {
        var empty = doc.createElement("span");
        empty.className = "cal-g cal-tag";
        empty.textContent = copy.calendarEmpty || "暂无";
        cell.appendChild(empty);
      } else {
        plans.forEach(function (plan) {
          var line = doc.createElement("span");
          line.className = "cal-g";
          var mark = "";
          if (plan.isVersion) {
            if (m < state.month) line.className += " shipped";
            line.textContent = (plan.label || plan.title || "") +
              (m < state.month ? (" · " + (copy.calendarShipped || "已发")) : "") +
              " · " + (copy.liveopsVersionTag || "版本") +
              (plan.source === "player" ? (" · " + (copy.chartPlayerTag || "本公司")) : "");
            cell.appendChild(line);
            return;
          }
          if (plan.status === "shipped") {
            mark = " · " + (copy.calendarShipped || "已发");
            line.className += " shipped";
          } else if (plan.status === "moved") {
            mark = " · " + (copy.calendarMoved || "已改期");
            line.className += " moved";
          } else if (m < state.month) {
            mark = " · " + (copy.calendarShipped || "已发");
          }
          var plat = plan.platformId
            ? sim.contentName(config.content.platforms, plan.platformId)
            : "";
          line.textContent = sim.calendarPlanLabel(plan) + (plat ? " · " + plat : "") + mark;
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
      var left = doc.createElement("span");
      var who = row.source === "player"
        ? (copy.chartPlayerTag || "本公司")
        : (row.pub || copy.chartFillerTag || "");
      left.textContent = row.rank + ". " + (who ? who + " · " : "") + "《" + row.title + "》";
      var b = doc.createElement("b");
      b.textContent = row.monthSales + (row.avg ? " · " + row.avg : "");
      it.appendChild(left);
      it.appendChild(b);
      box.appendChild(it);
    });
  };

  ui.paintShare = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    sim.ensureRivals(state, config);
    ui.paintChart();
    ui.$("hq-mysales").textContent = String(state.monthSales || 0);
    var shareBox = ui.$("hq-share-rows");
    if (shareBox) {
      shareBox.textContent = "";
      sim.marketShares(state, config).forEach(function (row) {
        var it = doc.createElement("div");
        it.className = "row item";
        var l = doc.createElement("span");
        l.textContent = row.displayName + "份额";
        var b = doc.createElement("b");
        b.textContent = sim.formatSharePercent(row.share, config) +
          " · 我方 " + row.playerSales + " / 全市场 " + (row.playerSales + row.rivalSales);
        it.appendChild(l); it.appendChild(b); shareBox.appendChild(it);
      });
    }
    var box = ui.$("rival-month");
    if (box) {
      box.textContent = "";
      var list = state.rivalMonth || [];
      if (!list.length) {
        var empty = doc.createElement("p");
        empty.className = "hint";
        empty.textContent = "这个月没有大厂新作上线。点「下一月」他们也会推进开发。";
        box.appendChild(empty);
      } else {
        var per = 3;
        var pages = Math.ceil(list.length / per);
        if (ui.session.uiPage.rival >= pages) ui.session.uiPage.rival = pages - 1;
        list.slice(ui.session.uiPage.rival * per, ui.session.uiPage.rival * per + per).forEach(function (g) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        left.textContent = g.pub + " · " + g.series +
          (g.platformId ? " · " + sim.contentName(config.content.platforms, g.platformId) : "");
        var b = doc.createElement("b");
        b.textContent = (g.genreId ? sim.contentName(config.content.genres, g.genreId) : "") + "/" +
          (g.gameplayId ? sim.contentName(config.content.gameplay, g.gameplayId) : "") + " · " + g.avg +
          (g.mau ? " · " + ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(g.mau) : "");
        it.appendChild(left); it.appendChild(b); box.appendChild(it);
        });
        ui.addPager(box, ui.session.uiPage.rival, pages, function (p) {
          ui.session.uiPage.rival = p; ui.paintShare();
        });
      }
    }
    var mauBox = ui.$("rival-mau");
    if (mauBox) {
      mauBox.textContent = "";
      var mauList = sim.monthlyActiveChart(state, config);
      if (!mauList.length) {
        var noHit = doc.createElement("p");
        noHit.className = "hint";
        noHit.textContent = "还没有长线运营游戏在榜。历史级大作会把月活写在这里。";
        mauBox.appendChild(noHit);
      } else {
        mauList.forEach(function (row) {
          var it = doc.createElement("div");
          it.className = "item";
          var left = doc.createElement("span");
          var who = row.source === "player"
            ? (copy.chartPlayerTag || "本公司")
            : (row.pub || "");
          left.textContent = row.rank + ". " + (who ? who + " · " : "") + "《" + row.title + "》";
          var b = doc.createElement("b");
          b.textContent = ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(row.mau);
          it.appendChild(left); it.appendChild(b); mauBox.appendChild(it);
        });
      }
    }
    var platsBox = ui.$("hq-plats");
    platsBox.textContent = "";
    sim.platformsNow(state, config).forEach(function (p) {
      var sp = doc.createElement("span");
      sp.className = "pill";
      sp.textContent = sim.displayName(p);
      platsBox.appendChild(sp);
    });
    ui.$("hq-console").textContent = state.company.ownConsole
      ? ("自研主机已解锁，并入" +
        sim.contentName(config.content.platforms, config.company.ownConsoleFoldIntoPlatformId || "console") +
        "加成。")
      : ("自研主机：大公司且粉丝够 " + config.company.unlockOwnConsoleMinFans + " 才并入主机端加成。");
  };

  ui.paintCareerRoles = function () {
    var config = cfg();
    var copy = sim.careerCopy(config);
    var box = ui.$("role-box");
    var roles, title, hint, btn;
    if (!box) return;
    box.textContent = "";
    roles = sim.careerPlayableRoles(config);
    if (!ui.session.pendingRole && roles[0]) ui.session.pendingRole = roles[0].id;
    title = ui.$("role-title");
    hint = ui.$("role-hint");
    btn = ui.$("btn-role");
    if (title) title.textContent = copy.roleTitle || "擅长";
    if (hint) hint.textContent = copy.roleHint || "";
    if (btn) btn.textContent = copy.roleNext || "看 offer";
    roles.forEach(function (r) {
      var chip = doc.createElement("button");
      chip.type = "button";
      chip.className = "role-pick" + (r.id === ui.session.pendingRole ? " on" : "");
      chip.textContent = sim.worldLabel(r, config);
      chip.setAttribute("data-role", r.id);
      box.appendChild(chip);
    });
  };

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
    if (hint) hint.textContent = copy.offerHint || "";
    (function paintOfferSkills() {
      var el = ui.$("offer-skills");
      var sheet, able, bits;
      if (!el) return;
      if (!sim.careerSkillSheet) {
        el.textContent = "";
        return;
      }
      sheet = sim.careerSkillSheet(state, config);
      able = (sheet.genres || []).concat(sheet.gameplay || []).filter(function (row) {
        return row.tierId && row.tierId !== "novice";
      });
      if (!able.length) {
        el.textContent = "";
        return;
      }
      bits = able.map(function (row) { return row.label + " " + (row.tier || ""); });
      el.textContent = (copy.offerSkillPrefix || "入行熟练：") + bits.join(" · ");
    })();
    (state.career.openingOffers || []).forEach(function (o) {
      var co = sim.careerCompany(o.companyId, config);
      var role = sim.careerRole(o.roleId, config);
      var card = doc.createElement("div");
      var name = doc.createElement("div");
      var meta = doc.createElement("p");
      var risk = doc.createElement("p");
      var go = doc.createElement("button");
      card.className = "offer-card";
      name.className = "name";
      name.textContent = co ? sim.worldLabel(co, config) : o.companyId;
      meta.className = "hint";
      meta.textContent = (role ? sim.worldLabel(role, config) : "") +
        " · " + (copy.salaryLabel || "月薪") + " " + o.salary +
        (o.roleId ? (" · " + sim.formatCareerRankLabel(o.roleId, (o.jobRank != null ? o.jobRank : 1), config)) : "");
      risk.className = "hint";
      risk.textContent = (copy.riskLabel || "风险") + "：" + (o.risk || "");
      go.type = "button";
      go.className = "btn wide mt-8";
      go.textContent = copy.acceptButton || "入职";
      go.setAttribute("data-offer", o.id);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(risk);
      (function appendSeniors() {
        var line = sim.careerSeniorLine(co, config);
        var el;
        if (!line) return;
        el = doc.createElement("p");
        el.className = "hint";
        el.textContent = line;
        card.appendChild(el);
      })();
      card.appendChild(go);
      box.appendChild(card);
    });
  };

  ui.paintCareerHq = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var career, co, role, view, live, job, box, tickBtn, self, head, stats;
    var hopCard, hopList, hopApply, payEl, roleEl, nameEl, metaEl, xpEl;
    if (!state || !state.career) return;
    sim.ensureCareerExtras(state);
    career = state.career;
    co = sim.careerCompany(career.companyId, config);
    role = sim.careerRole(career.roleId, config);
    view = sim.careerProjectView(state, config);
    live = view.liveStats;
    stats = career.stats || {};
    ui.$("hq-name").textContent = career.characterName;
    ui.$("end-name").textContent = career.characterName;
    ui.$("hq-date").textContent = sim.dateText(state);
    (function setLabs() {
      var fundsLab = ui.$("hq-funds-lab");
      var fansLab = ui.$("hq-fans-lab");
      if (fundsLab) fundsLab.textContent = copy.savingsLabel || "积蓄";
      if (fansLab) fansLab.textContent = copy.fameLabel || "声望";
    })();
    ui.$("hq-funds").textContent = String(career.savings);
    payEl = ui.$("hq-pay-delta");
    if (payEl) {
      if (career.lastPay) {
        payEl.hidden = false;
        payEl.textContent = (copy.payDeltaPrefix || "+") + career.lastPay;
      } else {
        payEl.hidden = true;
        payEl.textContent = "";
      }
    }
    ui.$("hq-fans").textContent = String(career.fame);
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
    (function paintSkills() {
      var skillEl = ui.$("hq-player-skills");
      var bits;
      if (!skillEl || !sim.careerSkillLines) return;
      bits = sim.careerSkillLines(state, config);
      if (!bits.length) {
        skillEl.textContent = copy.skillEmpty || "";
        return;
      }
      skillEl.textContent = (copy.skillLabel || "熟练度") + " · " + bits.map(function (row) {
        return row.label + " " + (row.tier || "");
      }).join(" · ") + (copy.skillAllCta ? " · " + copy.skillAllCta : "");
    })();
    head = ui.$("hq-project-head");
    if (head) head.textContent = copy.projectHead || "在研作品";
    nameEl = ui.$("hq-project-name");
    metaEl = ui.$("hq-project-meta");
    xpEl = ui.$("hq-project-xp");
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
      if (xpEl) xpEl.textContent = "";
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
      if (xpEl) {
        xpEl.textContent = (copy.xpLabel || "工作室经验") + " · " +
          sim.contentName(config.content.genres, view.genreId) + " " + (view.genreTier || "") +
          " · " + sim.contentName(config.content.gameplay, view.gameplayId) + " " + (view.gameplayTier || "");
      }
    }
    job = ui.$("hq-career-job");
    if (job && sim.careerPromotionView) {
      var promo = sim.careerPromotionView(state, config);
      var titleLine = (copy.jobLabel || "职称") + " " + (promo.currentLabel || "");
      job.hidden = false;
      job.textContent = titleLine + (promo.gapLines && promo.gapLines.length
        ? " · " + promo.gapLines.join("；")
        : "");
    } else if (job) job.textContent = "";
    (function paintSeniors() {
      var el = ui.$("hq-seniors");
      var line;
      if (!el) return;
      line = sim.careerSeniorLine(co, config);
      el.textContent = line || "";
      el.hidden = !line;
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
    (function paintSiblings() {
      var sib = ui.$("hq-sib-studios");
      var views, lines, i, row, label, titleLabel;
      if (!sib || !sim.listCompanyStudioViews) {
        if (sib) sib.textContent = "";
        return;
      }
      views = sim.listCompanyStudioViews(state, config).filter(function (v) { return !v.mine; });
      if (!views.length) {
        sib.textContent = "";
        return;
      }
      lines = [];
      for (i = 0; i < views.length; i++) {
        row = views[i];
        label = sim.worldLabel(row.studio, config);
        if (row.inDevTitle) {
          titleLabel = sim.worldLabel(row.inDevTitle, config);
          lines.push(label + " · " + (copy.inDevLabel || "在研") + "《" + titleLabel + "》");
        } else if (row.selling) {
          titleLabel = sim.worldLabel(row.selling, config);
          lines.push(label + " · " +
            ((sim.isLiveOpsTitle && sim.isLiveOpsTitle(row.selling)
              ? (copy.liveopsActiveLabel || config.copy.liveopsActiveLabel)
              : (copy.onSaleLabel || config.copy.onSaleLabel)) || "在售") +
            "《" + titleLabel + "》");
        } else {
          lines.push(label + " · " + (copy.idleHint || "待命"));
        }
      }
      sib.textContent = (copy.siblingStudios || "本公司其他工作室") + "：" + lines.join("；");
    })();
    showNum("hq-live-p", live && live.program);
    showNum("hq-live-d", live && live.design);
    showNum("hq-live-a", live && live.art);
    showNum("hq-live-m", live && live.music);
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
      self = doc.createElement("span");
      self.className = "staff-chip";
      self.textContent = career.characterName + (role ? (" · " + sim.worldLabel(role, config)) : "") +
        (sim.careerJobTitleDisplay ? (" · " + sim.careerJobTitleDisplay(state, config)) : "");
      box.appendChild(self);
      (career.colleagues || []).forEach(function (s) {
        var chip = doc.createElement("span");
        var rr = sim.careerRole(s.roleId, config);
        var rankLabel = sim.formatCareerRankLabel
          ? sim.formatCareerRankLabel(s.roleId, s.jobRank != null ? s.jobRank : 1, config)
          : "";
        chip.className = "staff-chip";
        chip.textContent = s.n +
          (rr ? (" · " + sim.worldLabel(rr, config)) : "") +
          (rankLabel ? (" · " + rankLabel) : "");
        box.appendChild(chip);
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
    var sheet, head, hint;
    if (!state || !state.career || !sim.careerSkillSheet) return;
    sheet = sim.careerSkillSheet(state, config);
    head = ui.$("player-page-head");
    hint = ui.$("player-page-hint");
    if (head) head.textContent = copy.playerPageTitle || "玩家详情";
    if (hint) hint.textContent = copy.playerPageHint || "";
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
  };

  ui.paintResume = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var view, box, i, row, el, bits, credits;
    if (!state || !state.career || !sim.careerResumeView) return;
    view = sim.careerResumeView(state, config);
    credits = (view.credits || []).filter(function (c) { return c.shipped; });
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
          row.virtual ? (copy.resumeVirtual || "虚拟作") : "",
          row.supported ? (copy.resumeSupported || "后续支持") : "",
          row.score != null ? String(row.score) : "",
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
    if (sim.isCareerMode && sim.isCareerMode(state) && state.career) {
      copy = sim.careerCopy(config);
      career = state.career;
      role = sim.careerRole(career.roleId, config);
      co = sim.careerCompany(career.companyId, config);
      var settle = sim.careerSettlementView ? sim.careerSettlementView(state, config) : null;
      ui.$("end-name").textContent = (settle && settle.characterName) || career.characterName;
      ui.$("end-scale").textContent = (settle && settle.jobLabel) || (role ? sim.worldLabel(role, config) : "—");
      ui.$("end-fans").textContent = String((settle && settle.fame) != null ? settle.fame : (career.fame || 0));
      ui.$("end-games").textContent = String(settle ? settle.creditedCount : (career.credits || []).length);
      ui.$("end-series").textContent = (settle && settle.employer) || (co ? sim.worldLabel(co, config) : "—");
      ui.$("end-avg").textContent = String((settle && settle.honor) != null ? settle.honor : (career.honor || 0));
      ui.$("end-sales").textContent = String((settle && settle.savings) != null ? settle.savings : (career.savings || 0));
      function setLab(id, text) {
        var el = ui.$(id);
        if (el) el.textContent = text;
      }
      setLab("end-scale-label", copy.settleTitleLabel || "职称");
      setLab("end-fans-label", copy.settleFameLabel || "声望");
      setLab("end-games-label", copy.settleCreditsLabel || "署名作");
      setLab("end-series-label", copy.settleEmployerLabel || "最后东家");
      setLab("end-avg-label", copy.settleHonorLabel || "荣誉");
      setLab("end-sales-label", copy.settleSavingsLabel || "积蓄");
      return;
    }
    ui.$("end-scale").textContent = sim.scaleLabel(state.company.scale, config);
    ui.$("end-fans").textContent = String(state.company.fans);
    ui.$("end-games").textContent = String(state.released.length);
    ui.$("end-series").textContent = String(state.series.length);
    (function restoreStudioLabs() {
      function setLab(id, text) {
        var el = ui.$(id);
        if (el) el.textContent = text;
      }
      setLab("end-scale-label", "规模");
      setLab("end-fans-label", "粉丝");
      setLab("end-games-label", "作品");
      setLab("end-series-label", "系列");
      setLab("end-avg-label", "最高媒体均分");
      setLab("end-sales-label", "最高首发");
    })();
    var bestA = 0, bestS = 0, bestL = 0;
    state.released.forEach(function (g) {
      if (g.avg > bestA) bestA = g.avg;
      if (g.launchSales > bestS) bestS = g.launchSales;
      if (g.liveOps && g.liveOps.peak > bestL) bestL = g.liveOps.peak;
    });
    ui.$("end-avg").textContent = bestA ? String(bestA) : "—";
    ui.$("end-sales").textContent = bestS ? String(bestS) : "—";
    ui.$("end-live").textContent = bestL ? String(bestL) : "—";
    ui.$("end-console").textContent = state.company.ownConsole ? "摸到门槛了" : "本局没有";
    ui.$("brk-date").textContent = sim.dateText(state);
    ui.$("brk-funds").textContent = String(state.company.funds);
  };

  ui.paintHq = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    if (sim.isCareerMode && sim.isCareerMode(state)) {
      ui.paintCareerHq();
      return;
    }
    sim.ensureRivals(state, config);
    ui.$("hq-name").textContent = state.company.name;
    ui.$("end-name").textContent = state.company.name;
    ui.$("hq-date").textContent = sim.dateText(state);
    (function setStudioLabs() {
      var fundsLab = ui.$("hq-funds-lab");
      var fansLab = ui.$("hq-fans-lab");
      if (fundsLab) fundsLab.textContent = config.economy.currencyName || "资金";
      if (fansLab) fansLab.textContent = "粉丝";
    })();
    ui.$("hq-funds").textContent = String(state.company.funds);
    ui.$("hq-fans").textContent = String(state.company.fans);
    ui.$("hq-scale").textContent = sim.scaleLabel(state.company.scale, config);
    ui.$("hq-cap").textContent = "编制 " + state.staff.length + "/" + sim.maxStaff(state, config);
    ui.$("hq-plats-chip").textContent = "平台 " + sim.platformsNow(state, config).map(function (p) {
      return sim.displayName(p);
    }).join(" · ");
    ui.$("hq-ad").textContent = state.company.adOn ? "广告加持中：下一款发售会更好卖" : "本月没有广告加持";
    var tickBtn = ui.$("btn-tick");
    if (tickBtn && !ui.$("dlg-mask").classList.contains("on")) {
      tickBtn.disabled = state.phase !== "PLAYING";
    }
    var box = ui.$("hq-staff");
    box.textContent = "";
    var staffWarn = ui.$("hq-staff-warn");
    if (staffWarn) staffWarn.hidden = !!state.staff.length;
    state.staff.forEach(function (s) {
      var chip = doc.createElement("span");
      chip.className = "staff-chip";
      chip.textContent = s.n + " · Lv" + s.level +
        ((s.traits || []).length ? " · " + (s.traits || []).map(function (id) { return sim.traitName(id, config); }).join("/") : "");
      box.appendChild(chip);
    });
    var lives = state.released.filter(function (g) { return g.liveOps && g.liveOps.active; });
    ui.$("hq-dev-n").textContent = String(state.projects.length);
    var sumDev = ui.$("hq-sum-dev");
    if (sumDev) sumDev.classList.toggle("empty", !state.projects.length);
    ui.$("hq-dev-one").textContent = state.projects[0]
      ? (state.projects[0].title + " · " + sim.releaseTypeLabel(state.projects[0].releaseType, config) + " · 剩" + state.projects[0].monthsLeft + "月")
      : "还没有立项";
    ui.$("hq-live-n").textContent = String(lives.length);
    ui.$("hq-live-one").textContent = lives[0] ? lives[0].title : "暂无";
    ui.$("hq-ship-n").textContent = String(state.released.length);
    ui.$("hq-ship-one").textContent = state.released[0] ? state.released[0].title : "暂无";
    ui.$("studio-lock").style.display = state.company.scale === "large" ? "none" : "block";
    ui.$("studio-ok").style.display = state.company.scale === "large" ? "block" : "none";
    ui.$("hq-trend").textContent = sim.trendText(state.trend, config);
    var readyN = (state.readyToShip || []).length;
    var readyEl = ui.$("hq-ready");
    if (readyEl) {
      var readyCopy = (config.copy && config.copy.readyToShipLabel) || "待发售";
      readyEl.textContent = readyN
        ? (readyCopy + " " + readyN + " 部 · " + state.readyToShip[0].title + (readyN > 1 ? " 等" : "") + "，点发布才上架")
        : (readyCopy + "：无");
    }
    var chartEl = ui.$("hq-chart");
    if (chartEl) {
      var top = sim.monthlyChart(state, config)[0];
      var chartCopy = config.copy || {};
      if (top) {
        chartEl.hidden = false;
        chartEl.textContent = (chartCopy.chartTitle || "本月畅销榜") + " 1. " +
          (top.source === "player" ? (chartCopy.chartPlayerTag || "本公司") + " " : (top.pub ? top.pub + " " : "")) +
          "《" + top.title + "》 " + top.monthSales;
      } else {
        chartEl.hidden = true;
        chartEl.textContent = "";
      }
    }
    var mauEl = ui.$("hq-mau");
    if (mauEl) {
      var topMau = (state.rivalReleased || []).filter(function (g) { return g.mau > 0; })
        .sort(function (a, b) { return (b.mau || 0) - (a.mau || 0); })[0];
      if (topMau) {
        mauEl.hidden = false;
        mauEl.textContent = "《" + (topMau.title || topMau.series) + "》" +
          ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(topMau.mau);
      } else {
        mauEl.hidden = true;
        mauEl.textContent = "";
      }
    }
    ui.paintShare();
    ui.paintEnds();
    if (state.phase === "BANKRUPT") ui.show("sc-bankrupt");
    if (state.phase === "SETTLED") ui.show("sc-settled");
  };

  ui.paintStaticCopy = function () {
    var config = cfg();
    var n = config.staff.talentMarket.refreshCount;
    var capHint = config.company.scales.small.maxStaff + "/" + config.company.scales.medium.maxStaff;
    ui.$("market-head").textContent = "人才市场 · 本月 " + n + " 人";
    ui.$("market-hint").textContent = "编制 " + capHint + "。招满就不能再雇。特性入职就带，不靠培训。";
    var s2m = config.economy.relocateSmallToMedium;
    var m2l = config.economy.relocateMediumToLarge;
    ui.$("relocate-copy").textContent = "小工作室花 " + s2m + " 升中等（才能做长线）。中等再花 " + m2l + " 升大公司，才能开内部工作室、才有机会摸自研主机。";
    var state = st();
    var nextCost = !state || state.company.scale === "small" ? s2m : m2l;
    var nextLabel = !state || state.company.scale === "small" ? "中等" : "大公司";
    ui.$("btn-relocate").textContent = state && state.company.scale === "large"
      ? "已经是大公司"
      : ("花 " + nextCost + " 升到" + nextLabel);
    var ad = config.economy.advertising;
    ui.$("ad-copy").textContent = "花 " + ad.cost + "：立刻加粉丝，并加持下一款真正发售的那一部销量。发售后这次加持就没了。";
    var cal = config.calendar;
    var span = ui.$("boot-span");
    var copyC = sim.careerCopy ? sim.careerCopy(config) : {};
    var world = config.careerWorld || {};
    var tl = world.timeline || cal;
    if (span) span.textContent = copyC.bootPill || (tl.startYear + " — " + tl.endYear);
    var bootLead = ui.$("boot-lead");
    if (bootLead && copyC.bootLead) bootLead.textContent = copyC.bootLead;
    var nameLab = ui.$("boot-name-label");
    if (nameLab && copyC.nameLabel) nameLab.textContent = copyC.nameLabel;
    var startBtn = ui.$("btn-start");
    if (startBtn && copyC.startButton) startBtn.textContent = copyC.startButton;
    var intelBtn = ui.$("btn-sheet-intel");
    if (intelBtn && copyC.intel) intelBtn.textContent = copyC.intel;
    var tickBtnCopy = ui.$("btn-tick");
    if (tickBtnCopy && copyC.nextMonth) tickBtnCopy.textContent = copyC.nextMonth;
    var tgaHead = ui.$("tga-head");
    if (tgaHead && copyC.awardKicker) tgaHead.textContent = copyC.awardKicker;
    var tgaHint = ui.$("tga-hint");
    if (tgaHint) {
      tgaHint.textContent = copyC.awardsPageHint || (config.copy && config.copy.awardsHint) || tgaHint.textContent;
    }
    var tgaBtn = ui.$("dock-tga");
    if (tgaBtn && copyC.tgaEntry) tgaBtn.textContent = copyC.tgaEntry;
    var calDock = ui.$("dock-cal");
    if (calDock && copyC.calendarEntry) calDock.textContent = copyC.calendarEntry;
    var dimP = ui.$("hq-dim-p");
    var dimD = ui.$("hq-dim-d");
    var dimA = ui.$("hq-dim-a");
    var dimM = ui.$("hq-dim-m");
    if (dimP && copyC.dimProgram) dimP.textContent = copyC.dimProgram;
    if (dimD && copyC.dimDesign) dimD.textContent = copyC.dimDesign;
    if (dimA && copyC.dimArt) dimA.textContent = copyC.dimArt;
    if (dimM && copyC.dimMusic) dimM.textContent = copyC.dimMusic;
    var selfP = ui.$("hq-self-dim-p");
    var selfD = ui.$("hq-self-dim-d");
    var selfA = ui.$("hq-self-dim-a");
    var selfM = ui.$("hq-self-dim-m");
    if (selfP && copyC.dimProgram) selfP.textContent = copyC.dimProgram;
    if (selfD && copyC.dimDesign) selfD.textContent = copyC.dimDesign;
    if (selfA && copyC.dimArt) selfA.textContent = copyC.dimArt;
    if (selfM && copyC.dimMusic) selfM.textContent = copyC.dimMusic;
    var shareHint = ui.$("share-hint");
    if (shareHint) shareHint.textContent = (config.copy && config.copy.shareHint) || shareHint.textContent;
    var chartHead = ui.$("chart-head");
    if (chartHead && config.copy && config.copy.chartTitle) chartHead.textContent = config.copy.chartTitle;
    var chartHint = ui.$("chart-hint");
    if (chartHint && config.copy && config.copy.chartHint) chartHint.textContent = config.copy.chartHint;
    var bl = ui.$("media-baseline-label");
    if (bl && config.copy && config.copy.baselineSalesLabel) bl.textContent = config.copy.baselineSalesLabel;
    var sl = ui.$("media-sales-label");
    if (sl && config.copy && (config.copy.launchSalesReveal || config.copy.monthActualSalesLabel)) {
      sl.textContent = config.copy.launchSalesReveal || config.copy.monthActualSalesLabel;
    }
    var sh = ui.$("media-sales-hint");
    if (sh && config.copy && config.copy.mediaSalesHint) sh.textContent = config.copy.mediaSalesHint;
    var calHint = ui.$("calendar-hint");
    if (calHint && config.copy && config.copy.calendarHint) calHint.textContent = config.copy.calendarHint;
    var resumeDock = ui.$("dock-resume");
    if (resumeDock && copyC.resumeEntry) resumeDock.textContent = copyC.resumeEntry;
    var resumeL1 = ui.$("dock-resume-l1");
    if (resumeL1 && copyC.resumeEntry) resumeL1.textContent = copyC.resumeEntry;
    var playerL1 = ui.$("dock-player-l1");
    if (playerL1 && copyC.playerDockLabel) playerL1.textContent = copyC.playerDockLabel;
    var tgaL1 = ui.$("dock-tga-l1");
    if (tgaL1 && copyC.tgaEntry) tgaL1.textContent = copyC.tgaEntry;
    var resumeHead = ui.$("resume-head");
    if (resumeHead) resumeHead.textContent = copyC.resumeCredits || copyC.resumeTitle || "署名作品";
    var nameInput = ui.$("name-input");
    if (nameInput) {
      var defName = copyC.defaultName || config.company.defaultName;
      nameInput.setAttribute("placeholder", defName);
      if (!nameInput.value) nameInput.value = defName;
    }
  };

  ui.paintReleased = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var per = 4;
    var box = ui.$("released-list");
    box.textContent = "";
    if (!state.released.length) {
      var empty = doc.createElement("p");
      empty.className = "hint";
      empty.textContent = "还没有发售作品。";
      box.appendChild(empty);
    } else {
      var pages = Math.ceil(state.released.length / per);
      if (ui.session.uiPage.released >= pages) ui.session.uiPage.released = pages - 1;
      state.released.slice(ui.session.uiPage.released * per, ui.session.uiPage.released * per + per).forEach(function (g) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        var saleTag = "";
        if (g.releaseType === "boxed") {
          saleTag = g.onSale === false
            ? (" · " + ((config.copy && config.copy.offSaleLabel) || "已停售"))
            : (" · " + ((config.copy && config.copy.onSaleLabel) || "在售"));
        }
        var shownTitle = g.title;
        if (g.releaseType === "liveops" && sim.liveOpsUsesVersions && sim.liveOpsUsesVersions(g, config) && sim.liveOpsVersionLabel) {
          shownTitle = sim.liveOpsVersionLabel(g.title, sim.liveOpsCurrentVersion(g, config), config);
        }
        left.textContent = shownTitle + " · " + sim.releaseTypeLabel(g.releaseType, config) +
          (g.releaseType === "outsource"
            ? (" · 外包费 " + (g.outsourceFee || 0))
            : (g.releaseType === "boxed"
              ? (" · 均分 " + g.avg +
                " · " + ((config.copy && config.copy.baselineSalesLabel) || "基准") + " " + (g.baselineSales != null ? g.baselineSales : (g.launchSales || 0)) +
                " · " + ((config.copy && config.copy.monthActualSalesLabel) || "本月实销") + " " + (g.monthSales || 0) +
                saleTag)
              : (g.releaseType === "liveops"
                ? (" · 均分 " + g.avg +
                  " · " + ((config.copy && config.copy.liveopsPeakLabel) || "最高月收") + " " + ((g.liveOps && g.liveOps.peak) || 0) +
                  " · " + ((config.copy && config.copy.liveopsMonthsLabel) || "已运营") + " " + ((g.liveOps && g.liveOps.monthsLive) || 0) +
                  " · " + (g.liveOps && g.liveOps.active
                    ? ((config.copy && config.copy.liveopsActiveLabel) || "运营中")
                    : ((config.copy && config.copy.liveopsClosedLabel) || "已关服")))
                : (" · 均分 " + g.avg + " · 首发 " + (g.launchSales || g.sales || 0) + saleTag))));
        it.appendChild(left);
        box.appendChild(it);
      });
      ui.addPager(box, ui.session.uiPage.released, pages, function (p) {
        ui.session.uiPage.released = p; ui.paintReleased();
      });
    }
    var sb = ui.$("series-list");
    sb.textContent = "";
    if (!state.series.length) {
      var sh = doc.createElement("p");
      sh.className = "hint";
      sh.textContent = "还没有系列。均分够高会自动开。";
      sb.appendChild(sh);
      ui.paintReadyLists();
      return;
    }
    var sp = Math.ceil(state.series.length / per);
    if (ui.session.uiPage.series >= sp) ui.session.uiPage.series = sp - 1;
    state.series.slice(ui.session.uiPage.series * per, ui.session.uiPage.series * per + per).forEach(function (s) {
      var it = doc.createElement("div");
      it.className = "item";
      var left = doc.createElement("span");
      left.textContent = s.name + " · 作品 " + (s.gameIds ? s.gameIds.length : 0);
      it.appendChild(left);
      sb.appendChild(it);
    });
    ui.addPager(sb, ui.session.uiPage.series, sp, function (p) {
      ui.session.uiPage.series = p; ui.paintReleased();
    });
    ui.paintReadyLists();
  };

  ui.paintProject = function () {
    var state = st();
    var config = cfg();
    var list = (state && state.projects) || [];
    if (ui.session.uiPage.project >= list.length) ui.session.uiPage.project = Math.max(0, list.length - 1);
    var p = list[ui.session.uiPage.project];
    var host = ui.$("pj-card");
    var oldPager = host && host.querySelector(".pager");
    if (oldPager) oldPager.parentNode.removeChild(oldPager);
    ui.$("pj-title").textContent = p ? p.title : "没有在研";
    if (!p) {
      ui.$("pj-meta").textContent = "招人后去立项。所有工作室的在研会跟着同一次点月走。";
      ui.$("pj-bar").style.width = "0";
      ui.$("pj-p").textContent = ui.$("pj-s").textContent = ui.$("pj-a").textContent = ui.$("pj-m").textContent = "—";
      ui.$("pj-team").textContent = "";
      return;
    }
    ui.$("pj-meta").textContent = sim.contentName(config.content.genres, p.genreId) + " · " +
      sim.contentName(config.content.gameplay, p.gameplayId) + " · " +
      sim.contentName(config.content.platforms, p.platformId) + " · " +
      sim.releaseTypeLabel(p.releaseType, config) + " · 还剩 " + p.monthsLeft + " 月";
    ui.$("pj-bar").style.width = Math.round((1 - p.monthsLeft / p.totalMonths) * 100) + "%";
    ui.$("pj-p").textContent = String(p.stats.program);
    ui.$("pj-s").textContent = String(p.stats.script);
    ui.$("pj-a").textContent = String(p.stats.art);
    ui.$("pj-m").textContent = String(p.stats.music);
    var names = p.memberIds.map(function (id) { var s = sim.findStaff(state, id); return s ? s.n : ""; }).filter(Boolean);
    ui.$("pj-team").textContent = "制作人 " + ((sim.findStaff(state, p.producerId) || {}).n || "") + " · 成员 " + names.join("、");
    if (host) {
      ui.addPager(host, ui.session.uiPage.project, list.length, function (page) {
        ui.session.uiPage.project = page; ui.paintProject();
      });
    }
    ui.paintReadyLists();
  };

  ui.paintReadyLists = function () {
    var state = st();
    var config = cfg();
    var copy = (config && config.copy) || {};
    var hint = copy.readyToShipHint || "制作完成，尚未发布。";
    var btnText = copy.releaseButton || "发布";
    var emptyText = "没有待发售的游戏。";
    ["ready-hint", "released-ready-hint"].forEach(function (id) {
      var el = ui.$(id);
      if (el) el.textContent = hint;
    });
    function fill(boxId) {
      var box = ui.$(boxId);
      if (!box) return;
      box.textContent = "";
      var list = (state && state.readyToShip) || [];
      if (!list.length) {
        var empty = doc.createElement("p");
        empty.className = "hint";
        empty.textContent = emptyText;
        box.appendChild(empty);
        return;
      }
      list.forEach(function (p) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        left.textContent = p.title + " · " + sim.releaseTypeLabel(p.releaseType, config) +
          " · " + sim.contentName(config.content.platforms, p.platformId);
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "btn tiny";
        btn.setAttribute("data-release", p.id);
        btn.textContent = btnText;
        it.appendChild(left);
        it.appendChild(btn);
        box.appendChild(it);
      });
    }
    fill("pj-ready-list");
    fill("released-ready-list");
  };

  ui.paintMedia = function (rec) {
    rec = rec || (st() && st().lastMedia);
    ui.$("media-title").textContent = rec ? ("媒体评分 · " + rec.title) : "还没有发售记录";
    var box = ui.$("media-rows");
    box.textContent = "";
    if (!rec || !rec.media) {
      ui.$("media-quote").textContent = "";
      ui.$("media-avg").textContent = "—";
      var mb0 = ui.$("media-baseline");
      if (mb0) mb0.textContent = "—";
      ui.$("media-sales").textContent = "—";
      return;
    }
    rec.media.rows.forEach(function (r) {
      var row = doc.createElement("div");
      var l = doc.createElement("span");
      var b = doc.createElement("b");
      var q;
      row.className = "media-outlet";
      l.textContent = r.n;
      b.className = "stars";
      b.textContent = String(r.score);
      row.appendChild(l);
      row.appendChild(b);
      if (r.quote) {
        q = doc.createElement("p");
        q.className = "quote";
        q.textContent = r.quote;
        row.appendChild(q);
      }
      box.appendChild(row);
    });
    ui.$("media-quote").textContent = "";
    ui.$("media-avg").textContent = String(rec.avg);
    var mb = ui.$("media-baseline");
    if (mb) mb.textContent = rec.baselineSales != null ? String(rec.baselineSales) : "—";
    ui.$("media-sales").textContent = rec.launchSales != null
      ? String(rec.launchSales)
      : (rec.monthSales != null ? String(rec.monthSales) : "—");
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

  function scrollTgaYearChip(nav) {
    var onChip = nav.querySelector(".tga-year-chip.on");
    var scroller = nav.parentNode;
    if (!onChip || !scroller) return;
    function go() {
      var left = onChip.offsetLeft - (scroller.clientWidth - onChip.offsetWidth) / 2;
      scroller.scrollLeft = Math.max(0, left);
    }
    if (root.requestAnimationFrame) root.requestAnimationFrame(go);
    else go();
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
      var p = doc.createElement("p");
      p.className = "hint";
      p.textContent = copy.awardsHint || "每年 11 月过月时评选。窗口是去年 12 月到今年 11 月发售的游戏，对手大厂同期作品也参赛。";
      box.appendChild(p);
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
      var bb = doc.createElement("b"); bb.textContent = String(rec.baselineSales);
      br.appendChild(bl); br.appendChild(bb); nodes.push(br);
    }
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
      sb.textContent = String(rec.launchSales != null ? rec.launchSales : rec.monthSales);
      sq.appendChild(sb);
      sr.appendChild(sl);
      sr.appendChild(sq);
      nodes.push(sr);
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
