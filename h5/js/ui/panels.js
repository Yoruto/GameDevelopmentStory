(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;

  function cfg() { return GDS.CONFIG; }
  function st() { return ui.session.state; }

  ui.paintLiveops = function () {
    var state = st();
    var config = cfg();
    var box = ui.$("liveops-list");
    box.textContent = "";
    if (!state) return;
    var lives = state.released.filter(function (g) { return g.liveOps && g.liveOps.active; });
    if (!lives.length) {
      var h = doc.createElement("h2"); h.textContent = "长线运营";
      var p = doc.createElement("p");
      p.textContent = state.company.scale === "small"
        ? "小工作室不能立项长线。升到中等再来。"
        : "还没有在运营的长线。立项选「长线运营」，发售后转入维护。无人占编 = 关服。";
      box.appendChild(h); box.appendChild(p);
      return;
    }
    if (ui.session.uiPage.live >= lives.length) ui.session.uiPage.live = lives.length - 1;
    var g = lives[ui.session.uiPage.live];
    var card = doc.createElement("div");
    card.className = "card";
    var name = doc.createElement("div"); name.className = "name"; name.textContent = g.title;
    var hint = doc.createElement("p"); hint.className = "hint";
    hint.textContent = sim.contentName(config.content.genres, g.genreId) + " · 已运营 " + g.liveOps.monthsLive + " 月 · 最高月收 " + (g.liveOps.peak || 0);
    card.appendChild(name); card.appendChild(hint);
    var keepers = g.liveOps.maintainerIds || [];
    var rev = sim.liveOpsRevenue(g, config);
    [["本月预估收入", String(rev)], ["固定开支", String(config.liveOps.monthlyCost)], ["维护", keepers.map(function (id) {
      var s = sim.findStaff(state, id); return s ? s.n : id;
    }).join("、") || "无人"]].forEach(function (pair) {
      var row = doc.createElement("div"); row.className = "row item";
      var l = doc.createElement("span"); l.textContent = pair[0];
      var b = doc.createElement("b"); b.textContent = pair[1];
      row.appendChild(l); row.appendChild(b); card.appendChild(row);
    });
    var hint2 = doc.createElement("p"); hint2.className = "hint";
    hint2.textContent = "至少 1 人占编。人撤走或不安排 = 关服。";
    card.appendChild(hint2);
    var idle = state.staff.filter(function (s) { return s.status === "idle"; });
    idle.slice(0, 3).forEach(function (s) {
      var btn = doc.createElement("button");
      btn.className = "btn ghost mt-6";
      btn.textContent = "安排 " + s.n;
      btn.addEventListener("click", function () {
        var ids = (g.liveOps.maintainerIds || []).concat([s.id]);
        ui.applySim(sim.assignLiveOps(state, g.id, ids, config), s.n + " 去维护 " + g.title, function () {
          ui.paintLiveops(); ui.paintHq();
        });
      });
      card.appendChild(btn);
    });
    var grid = doc.createElement("div"); grid.className = "grid2 mt-8";
    var leave = doc.createElement("button"); leave.className = "btn ghost"; leave.textContent = "撤走维护";
    leave.addEventListener("click", function () {
      ui.openDlg({
        kind: "confirm",
        kicker: "长线",
        title: "撤走维护？",
        body: "人撤走后「" + g.title + "」会立刻关服，并扣罚金。",
        cancel: true,
        okText: "撤走",
        onOk: function () {
          ui.applySim(sim.shutdownLiveOps(state, g.id, config), "已关服", function () {
            ui.paintLiveops(); ui.paintHq();
          });
        }
      });
    });
    var close = doc.createElement("button"); close.className = "btn danger"; close.textContent = "主动关服";
    close.addEventListener("click", function () {
      ui.openDlg({
        kind: "confirm",
        kicker: "长线",
        title: "主动关服？",
        body: "「" + g.title + "」会立刻终止运营，并扣罚金。",
        cancel: true,
        okText: "关服",
        onOk: function () {
          ui.applySim(sim.shutdownLiveOps(state, g.id, config), "已关服", function () {
            ui.paintLiveops(); ui.paintHq();
          });
        }
      });
    });
    grid.appendChild(leave); grid.appendChild(close); card.appendChild(grid);
    box.appendChild(card);
    ui.addPager(box, ui.session.uiPage.live, lives.length, function (p) {
      ui.session.uiPage.live = p; ui.paintLiveops();
    });
  };

  ui.paintStudio = function () {
    var state = st();
    var config = cfg();
    ui.$("studio-lock-text").textContent = "只有大公司才能成立。现在是" + (state ? sim.scaleLabel(state.company.scale, config) : "—") + "。负责人默认当制作人，点月时一起推进。";
    if (!state || state.company.scale !== "large") return;
    var leads = ui.$("studio-leads");
    leads.textContent = "";
    state.staff.filter(function (s) { return s.status === "idle" || s.isStudioLead; }).forEach(function (s, i) {
      var ch = doc.createElement("span");
      ch.className = "chip" + (i === 0 ? " on" : "");
      ch.textContent = s.n;
      ch.setAttribute("data-lead", s.id);
      ch.addEventListener("click", function () {
        leads.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on");
      });
      leads.appendChild(ch);
    });
    var list = ui.$("studio-list");
    list.textContent = "";
    state.studios.forEach(function (stdo) {
      var card = doc.createElement("div");
      card.className = "card";
      var nm = doc.createElement("div"); nm.className = "name"; nm.textContent = stdo.name;
      var lead = sim.findStaff(state, stdo.leadId);
      var proj = state.projects.filter(function (p) { return p.studioId === stdo.id; })[0];
      var p = doc.createElement("p");
      p.textContent = "负责人 / 制作人：" + (lead ? lead.n : "空") + " · 在研：" + (proj ? proj.title : "无");
      card.appendChild(nm); card.appendChild(p); list.appendChild(card);
    });
  };

  ui.paintMarket = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var cloned = sim.clone(state);
    sim.refreshMarket(cloned, config, false);
    if (JSON.stringify(cloned.talentMarket) !== JSON.stringify(state.talentMarket || [])) {
      ui.session.state = cloned;
      state = cloned;
    } else {
      state.talentMarket = cloned.talentMarket;
      state.talentStamp = cloned.talentStamp;
    }
    var m = ui.$("market-list");
    m.textContent = "";
    (state.talentMarket || []).forEach(function (c) {
      var card = doc.createElement("div");
      card.className = "card";
      var nm = doc.createElement("b");
      nm.textContent = c.n + " · Lv" + c.level;
      var line = doc.createElement("p");
      line.className = "hint";
      line.textContent = "月薪 " + c.salary;
      var btn = doc.createElement("button");
      btn.className = "btn ghost wide";
      btn.textContent = "雇佣";
      btn.addEventListener("click", function () {
        ui.applySim(sim.hire(ui.session.state, c.id, config), "雇到了 " + c.n, function () {
          ui.paintHq(); ui.paintMarket();
        });
      });
      card.appendChild(nm); card.appendChild(line); card.appendChild(btn);
      m.appendChild(card);
    });
    var f = ui.$("fire-list");
    f.textContent = "";
    if (!state.staff.length) {
      var none = doc.createElement("p");
      none.className = "hint";
      none.textContent = "还没有在职员工。";
      f.appendChild(none);
      return;
    }
    var per = 4;
    var pages = Math.ceil(state.staff.length / per);
    if (ui.session.uiPage.fire >= pages) ui.session.uiPage.fire = pages - 1;
    state.staff.slice(ui.session.uiPage.fire * per, ui.session.uiPage.fire * per + per).forEach(function (s) {
      var row = doc.createElement("div");
      row.className = "item";
      var left = doc.createElement("span");
      left.textContent = s.n + " · Lv" + s.level;
      var btn = doc.createElement("button");
      btn.className = "btn ghost";
      btn.textContent = "辞退";
      btn.addEventListener("click", function () {
        ui.applySim(sim.fire(ui.session.state, s.id, config), "已辞退 " + s.n, function () {
          ui.paintHq(); ui.paintMarket();
        });
      });
      row.appendChild(left); row.appendChild(btn);
      f.appendChild(row);
    });
    ui.addPager(f, ui.session.uiPage.fire, pages, function (p) {
      ui.session.uiPage.fire = p; ui.paintMarket();
    });
  };

  ui.paintChipPage = function (box, names, pageKey, pickKey) {
    var per = 6;
    var pages = Math.max(1, Math.ceil(names.length / per));
    if (ui.session.uiPage[pageKey] >= pages) ui.session.uiPage[pageKey] = pages - 1;
    if (!ui.session.pitchPick[pickKey] || names.indexOf(ui.session.pitchPick[pickKey]) < 0) {
      ui.session.pitchPick[pickKey] = names[0] || "";
    }
    var page = ui.session.uiPage[pageKey];
    box.textContent = "";
    names.slice(page * per, page * per + per).forEach(function (name) {
      var s = doc.createElement("span");
      s.className = "chip" + (name === ui.session.pitchPick[pickKey] ? " on" : "");
      s.textContent = name;
      s.addEventListener("click", function () {
        ui.session.pitchPick[pickKey] = name;
        var all = box.querySelectorAll(".chip");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("on");
        s.classList.add("on");
      });
      box.appendChild(s);
    });
    ui.addPager(box, page, pages, function (p) {
      ui.session.uiPage[pageKey] = p; ui.paintPitch();
    });
  };

  ui.chips = function (box, list, pickKey) {
    if (pickKey) {
      if (!ui.session.pitchPick[pickKey] || list.indexOf(ui.session.pitchPick[pickKey]) < 0) {
        ui.session.pitchPick[pickKey] = list[0] || "";
      }
    }
    box.textContent = "";
    list.forEach(function (name, i) {
      var selected = pickKey ? name === ui.session.pitchPick[pickKey] : i === 0;
      var s = doc.createElement("span");
      s.className = "chip" + (selected ? " on" : "");
      s.textContent = name;
      s.addEventListener("click", function () {
        if (pickKey) ui.session.pitchPick[pickKey] = name;
        var all = box.querySelectorAll(".chip");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("on");
        s.classList.add("on");
      });
      box.appendChild(s);
    });
  };

  ui.paintPitch = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    ui.paintChipPage(ui.$("genre-box"), sim.unlocked(config.content.genres, state.year).map(function (x) {
      return sim.displayName(x);
    }), "genre", "genre");
    ui.paintChipPage(ui.$("gameplay-box"), sim.unlocked(config.content.gameplay, state.year).map(function (x) {
      return sim.displayName(x);
    }), "play", "play");
    ui.chips(ui.$("plat-box"), sim.platformsNow(state, config).map(function (x) {
      return sim.displayName(x);
    }), "plat");
    var hint = ui.$("pitch-hint");
    if (hint) hint.textContent = (config.copy && config.copy.pitchHint) || hint.textContent;
    doc.querySelectorAll("[data-type]").forEach(function (el) {
      var t = el.getAttribute("data-type");
      el.textContent = sim.releaseTypeLabel(t, config);
    });
    doc.querySelectorAll("[data-cyc]").forEach(function (el) {
      var c = el.getAttribute("data-cyc");
      var label = c === "short" ? "短" : (c === "long" ? "长" : "中");
      el.textContent = label + " " + sim.cycleMonths(c, config) + " 月";
    });
    var empty = ui.$("pitch-empty-warn");
    if (empty) empty.hidden = state.staff.length > 0;
    var t = ui.$("pitch-team");
    t.textContent = "";
    state.staff.forEach(function (s) {
      var ch = doc.createElement("span");
      ch.className = "chip";
      ch.textContent = s.n + " · Lv" + s.level;
      ch.setAttribute("data-sid", s.id);
      if (s.status !== "idle") {
        ch.style.opacity = ".4";
      } else {
        ch.addEventListener("click", function () { ch.classList.toggle("on"); });
      }
      t.appendChild(ch);
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
