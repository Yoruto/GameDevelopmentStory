(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var ui = GDS.ui = GDS.ui || {};
  var doc = root.document;

  ui.$ = function (id) {
    return doc.getElementById(id);
  };

  ui.toast = function (msg) {
    var el = ui.$("toast");
    el.textContent = msg;
    el.style.display = "block";
    root.setTimeout(function () { el.style.display = "none"; }, 2200);
  };

  ui.session = {
    state: null,
    pendingName: "",
    pendingRole: "",
    pitchPick: { genre: "", play: "", plat: "" },
    uiPage: { fire: 0, released: 0, series: 0, live: 0, genre: 0, play: 0, rival: 0, project: 0, chart: 0 },
    tickPages: [],
    tickStep: 0,
    dlgHook: { mode: null, onOk: null, onCancel: null }
  };

  ui.config = function () {
    return GDS.CONFIG;
  };

  ui.addPager = function (host, page, pages, onChange) {
    if (pages <= 1) return;
    var row = doc.createElement("div");
    row.className = "pager";
    var prev = doc.createElement("button");
    prev.type = "button";
    prev.textContent = "上页";
    prev.disabled = page <= 0;
    prev.addEventListener("click", function () { onChange(page - 1); });
    var lab = doc.createElement("span");
    lab.textContent = (page + 1) + "/" + pages;
    var next = doc.createElement("button");
    next.type = "button";
    next.textContent = "下页";
    next.disabled = page >= pages - 1;
    next.addEventListener("click", function () { onChange(page + 1); });
    row.appendChild(prev); row.appendChild(lab); row.appendChild(next);
    host.appendChild(row);
  };

  ui.fillDlgExtra = function (nodes) {
    var extra = ui.$("dlg-extra");
    extra.textContent = "";
    (nodes || []).forEach(function (n) { extra.appendChild(n); });
  };

  ui.openDlg = function (opts) {
    opts = opts || {};
    var hook = ui.session.dlgHook;
    hook.mode = opts.mode || "once";
    hook.onOk = opts.onOk || null;
    hook.onCancel = opts.onCancel || null;
    var dlg = ui.$("dlg");
    dlg.className = "dlg dlg-" + (opts.kind || "info");
    ui.$("dlg-kicker").textContent = opts.kicker || (opts.kind === "event" ? "本月事件" : (opts.kind === "confirm" ? "请确认" : "提示"));
    ui.$("dlg-title").textContent = opts.title || "";
    ui.$("dlg-body").textContent = opts.body || "";
    ui.fillDlgExtra(opts.nodes || []);
    ui.$("dlg-ok").textContent = opts.okText || "确定";
    ui.$("dlg-cancel").textContent = opts.cancelText || "取消";
    ui.$("dlg-cancel").classList.toggle("off", !opts.cancel);
    ui.$("dlg-ok").classList.toggle("off", !!opts.hideOk);
    ui.$("dlg-actions").classList.toggle("off", !!opts.hideActions);
    ui.$("dlg-mask").classList.add("on");
  };

  ui.closeDlg = function () {
    ui.$("dlg-mask").classList.remove("on");
    ui.session.dlgHook.mode = null;
    ui.session.dlgHook.onOk = null;
    ui.session.dlgHook.onCancel = null;
  };

  ui.l2Open = function () {
    return ui.$("dock-ops").classList.contains("on") || ui.$("dock-intel").classList.contains("on");
  };

  ui.syncDock = function () {
    var dock = ui.$("dock-shell");
    if (!dock) return;
    var boot = ui.$("sc-boot").classList.contains("on") ||
      (ui.$("sc-role") && ui.$("sc-role").classList.contains("on")) ||
      (ui.$("sc-offer") && ui.$("sc-offer").classList.contains("on"));
    dock.classList.toggle("off", boot);
    var hq = ui.$("sc-hq").classList.contains("on");
    var sheet = ui.l2Open();
    ui.$("btn-dock-back").classList.toggle("off", hq && !sheet);
    ui.$("dock-l1").classList.toggle("off", !hq || sheet);
    ui.$("dock-sub-slot").classList.toggle("off", hq);
    ui.$("btn-tick").classList.toggle("off", !hq);
  };

  ui.closeDockSheets = function () {
    ["dock-ops", "dock-intel"].forEach(function (id) {
      var el = ui.$(id);
      if (el) el.classList.remove("on");
    });
    ["btn-sheet-ops", "btn-sheet-intel"].forEach(function (id) {
      var el = ui.$(id);
      if (el) el.classList.remove("on");
    });
    ui.syncDock();
  };

  ui.toggleDockSheet = function (name) {
    var panel = name === "ops" ? ui.$("dock-ops") : ui.$("dock-intel");
    var already = panel.classList.contains("on");
    ["dock-ops", "dock-intel"].forEach(function (id) { ui.$(id).classList.remove("on"); });
    ["btn-sheet-ops", "btn-sheet-intel"].forEach(function (id) { ui.$(id).classList.remove("on"); });
    if (!already) {
      panel.classList.add("on");
      ui.$(name === "ops" ? "btn-sheet-ops" : "btn-sheet-intel").classList.add("on");
    }
    ui.syncDock();
  };

  ui.show = function (id) {
    var all = doc.querySelectorAll(".scene");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("on");
    ui.$(id).classList.add("on");
    if (id !== "sc-hq") ui.closeDockSheets();
    else ui.syncDock();
  };

  ui.showPreviewFlag = function () {
    var on = GDS.bridge && GDS.bridge.isPreview();
    ["preview-flag-boot", "preview-flag-hq"].forEach(function (id) {
      var el = ui.$(id);
      if (el) el.classList.toggle("on", !!on);
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
