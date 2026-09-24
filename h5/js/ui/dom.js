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
    startRoll: null,
    rollsLeft: null,
    uiPage: {},
    tickPages: [],
    tickStep: 0,
    tgaYear: null,
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
    if (ui.stopReveal) ui.stopReveal();
    ui.$("dlg-mask").classList.remove("on");
    ui.session.dlgHook.mode = null;
    ui.session.dlgHook.onOk = null;
    ui.session.dlgHook.onCancel = null;
  };

  ui.l2Open = function () {
    var intel = ui.$("dock-intel");
    return !!(intel && intel.classList.contains("on"));
  };

  ui.syncDock = function () {
    var dock = ui.$("dock-shell");
    if (!dock) return;
    var boot = ui.$("sc-boot").classList.contains("on") ||
      (ui.$("sc-offer") && ui.$("sc-offer").classList.contains("on"));
    dock.classList.toggle("off", boot);
    var hq = ui.$("sc-hq").classList.contains("on");
    var sheet = ui.l2Open();
    ui.$("btn-dock-back").classList.toggle("off", hq && !sheet);
    ui.$("dock-l1").classList.toggle("off", !hq || sheet);
    ui.$("dock-sub-slot").classList.toggle("off", hq);
    // 履历整合进自身：在「自身」页的 dock 空槽放履历入口
    (function fillSubSlot() {
      var sub = ui.$("dock-sub-slot");
      var playerOn = ui.$("sc-player").classList.contains("on");
      if (!sub) return;
      if (playerOn && !sub.getAttribute("data-filled")) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "career-only";
        b.textContent = "履历";
        b.addEventListener("click", function () {
          if (!ui.session.state) return;
          if (ui.paintResume) ui.paintResume();
          ui.show("sc-resume");
        });
        sub.textContent = "";
        sub.appendChild(b);
        sub.setAttribute("data-filled", "1");
      } else if (!playerOn && sub.getAttribute("data-filled")) {
        sub.textContent = "";
        sub.removeAttribute("data-filled");
      }
    })();
    ui.$("btn-tick").classList.toggle("off", !hq);
    if (ui.$("dock-ticks")) ui.$("dock-ticks").classList.toggle("off", !hq);
  };

  ui.closeDockSheets = function () {
    var intel = ui.$("dock-intel");
    if (intel) intel.classList.remove("on");
    var btn = ui.$("btn-sheet-intel");
    if (btn) btn.classList.remove("on");
    ui.syncDock();
  };

  ui.toggleDockSheet = function (name) {
    var panel = ui.$("dock-intel");
    var btn = ui.$("btn-sheet-intel");
    if (!panel || !btn) return;
    var already = panel.classList.contains("on");
    panel.classList.remove("on");
    btn.classList.remove("on");
    if (!already) {
      panel.classList.add("on");
      btn.classList.add("on");
    }
    ui.syncDock();
  };

  ui.show = function (id) {
    var target = ui.$(id);
    if (!target) return;
    var wasOn = target.classList.contains("on");
    // 目标 scene 已是当前 scene 时跳过 add，避免移动端 WebView（X5 / 老 Blink /
    // WebKit）把同步 remove+add 视为新动画，重放 .scene.on { animation: scene-in }
    // 造成主界面 translateY(6px)→0 跳一下又还原（桌面 Chromium 优化掉了，所以重
    // 放只在真机上能复现）。
    var all = doc.querySelectorAll(".scene");
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== target) all[i].classList.remove("on");
    }
    if (!wasOn) target.classList.add("on");
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
