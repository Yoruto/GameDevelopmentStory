// 本地兜底桥：没有虎扑/Colorbox 宿主时（file:// 直开、任意静态托管）提供存档与放行审计。
// 只在 window.ColorboxAI 缺失时安装——平台内运行时官方桥（bridge/colorbox.js）已就位，本文件不覆盖。
// 契约与 colorbox.js 对齐：hasBox / canCloud / isPreview / auditText / ensureCloud /
// cloudGetSave / cloudPutSave / storageGet / storageSet。
(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var win = typeof window !== "undefined" ? window : root;

  // 官方宿主在 → 官方桥负责，本文件不接管（index.html 中本文件在 colorbox.js 之后加载）。
  if (win.ColorboxAI) return;

  var KEY = "gdsSave";

  function ls() {
    try { return win.localStorage || null; } catch (e) { return null; }
  }

  GDS.bridge = {
    hasBox: function () { return false; },
    canCloud: function () { return false; },
    isPreview: function () { return true; },
    auditText: async function () {
      // 本地无审核服务，直接放行（起名不走平台审核）。
      return { ok: true, preview: true };
    },
    ensureCloud: async function () { return false; },
    cloudGetSave: async function () { return null; },
    cloudPutSave: async function () { return false; },
    storageSet: async function (st) {
      var store = ls();
      if (!store) return;
      try { store.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 隐私模式/配额满，不打断游玩 */ }
    },
    storageGet: async function () {
      var store = ls();
      if (!store) return null;
      try {
        var raw = store.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
