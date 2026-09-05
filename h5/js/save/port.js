(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var previewCache = null;

  GDS.save = {
    persist: async function (st) {
      previewCache = st;
      if (GDS.bridge) await GDS.bridge.storageSet(st);
      if (!(GDS.bridge && GDS.bridge.canCloud())) return;
      try {
        await GDS.bridge.cloudPutSave(st);
      } catch (e) { /* 预览或未开通时不打断游玩 */ }
    },
    restoreOrNull: async function () {
      if (GDS.bridge && GDS.bridge.canCloud()) {
        try {
          var row = await GDS.bridge.cloudGetSave();
          if (row && row.saveJson) {
            return typeof row.saveJson === "string" ? JSON.parse(row.saveJson) : row.saveJson;
          }
        } catch (e) { /* 再试缓存 */ }
      }
      if (previewCache) return previewCache;
      if (GDS.bridge) return GDS.bridge.storageGet();
      return null;
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
