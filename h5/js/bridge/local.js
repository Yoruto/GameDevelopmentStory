// 本地兜底桥：没有虎扑/Colorbox 宿主时（file:// 直开、任意静态托管）提供存档。
// 只在 window.ColorboxAI 缺失时安装——平台内运行时官方桥（bridge/colorbox.js）已就位，本文件不覆盖。
// 契约与 colorbox.js 对齐：hasBox / canCloud / isPreview / posterUserId /
// ensureCloud / cloudGetSave / cloudPutSave / storageGet / storageSet。
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
    posterUserId: async function () { return "我"; },
    ensureCloud: async function () { return false; },
    cloudGetSave: async function () { return null; },
    cloudPutSave: async function () { return false; },
    storageSet: async function (st) {
      var store = ls();
      if (!store) return false;
      try { store.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
    },
    storageGet: async function () {
      var store = ls();
      if (!store) return null;
      var raw = store.getItem(KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); }
      catch (e) { return { corruptLocalSave: true }; }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
