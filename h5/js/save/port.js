(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var latest = null;
  var cloudRevision = 0;
  var sequence = 0;
  var queue = Promise.resolve();
  var restorePromise = null;
  var restored = false;
  var blocked = false;
  var restoreIssue = "";
  var status = { kind: "idle", message: "" };
  var listener = null;

  function announce(kind, message) {
    status = { kind: kind, message: message };
    if (listener) listener(status);
  }

  function validState(st) {
    return !!(st && st.mode === "career" && st.saveVersion === 10 &&
      st.career && typeof st.career === "object" && !Array.isArray(st.career) &&
      typeof st.career.characterName === "string" && typeof st.career.roleId === "string" &&
      st.company && typeof st.company === "object" &&
      Number.isSafeInteger(st.rngSeed) && Number.isSafeInteger(st.rngCount) &&
      (st.phase === "OFFER" || st.phase === "PLAYING" || st.phase === "SETTLED") &&
      Number.isInteger(st.year) && Number.isInteger(st.month) &&
      ((st.year >= 1995 && st.year <= 2025 && st.month >= 1 && st.month <= 12) ||
       (st.year === 2026 && st.month === 1 && st.phase === "SETTLED")));
  }

  function normalizeLocal(value) {
    if (value && value.gdsSave && !value.formatVersion) value = value.gdsSave;
    if (!value) return null;
    if (value.formatVersion === 1 && validState(value.state)) {
      return {
        formatVersion: 1,
        state: value.state,
        cloudRevision: Number.isSafeInteger(value.cloudRevision) ? value.cloudRevision : 0,
        localSequence: Number.isSafeInteger(value.localSequence) ? value.localSequence : 0,
        savedAt: Number(value.savedAt) || 0,
        pending: !!value.pending
      };
    }
    if (validState(value)) {
      return { formatVersion: 1, state: value, cloudRevision: 0,
        localSequence: 0, savedAt: 0, pending: true };
    }
    restoreIssue = "检测到旧版或损坏的本机存档，原数据未删除。";
    return null;
  }

  function normalizeCloud(row) {
    if (!row || !row.saveJson) return null;
    var state;
    try { state = typeof row.saveJson === "string" ? JSON.parse(row.saveJson) : row.saveJson; }
    catch (e) { restoreIssue = "云端存档无法读取，原数据未删除。"; return null; }
    if (!validState(state)) {
      restoreIssue = "云端存档版本不兼容，原数据未删除。";
      return null;
    }
    if ((row.year != null && row.year !== state.year) ||
        (row.month != null && row.month !== state.month) ||
        (row.phase != null && row.phase !== state.phase)) {
      restoreIssue = "云端存档信息不一致，原数据未删除。";
      return null;
    }
    return { formatVersion: 1, state: state, cloudRevision: Number(row.revision) || 0,
      localSequence: 0, savedAt: Date.parse(row.updatedAt || "") || 0, pending: false };
  }

  async function syncOne(snapshot) {
    if (snapshot !== latest) return;
    var localOk = false;
    try { localOk = !!(GDS.bridge && await GDS.bridge.storageSet(snapshot)); }
    catch (e) { localOk = false; }
    if (snapshot !== latest) return;
    if (blocked) {
      announce("conflict", "云端有较新进度；本机档已保留，可选择载入云端。");
      return;
    }
    if (!(GDS.bridge && GDS.bridge.canCloud())) {
      announce(localOk ? "local" : "error", localOk ? "已存本机，云端待同步" : "本机保存失败，请检查存储空间");
      return;
    }
    announce("saving", "正在同步云端…");
    try {
      var result = await GDS.bridge.cloudPutSave(snapshot.state, cloudRevision);
      if (!result || !Number.isSafeInteger(Number(result.revision)) || Number(result.revision) <= cloudRevision) {
        throw new Error("云端未确认存档");
      }
      cloudRevision = Number(result.revision);
      if (latest === snapshot) {
        latest.cloudRevision = cloudRevision;
        latest.pending = false;
        try { await GDS.bridge.storageSet(latest); } catch (e) { /* 云端已成功 */ }
      } else if (latest) {
        latest.cloudRevision = cloudRevision;
        try { await GDS.bridge.storageSet(latest); } catch (e) { /* next queued write retries */ }
      }
      announce("saved", "云端已同步");
    } catch (error) {
      if (error && error.code === 409) {
        blocked = true;
        announce("conflict", "云端有较新进度；本机档已保留，可选择载入云端。");
      } else {
        announce("error", localOk ? "已存本机，云端同步失败，可重试" : "保存失败，请重试");
      }
    }
  }

  function enqueue(snapshot) {
    queue = queue.then(function () { return syncOne(snapshot); }).catch(function () {
      announce("error", "保存失败，请重试");
    });
    return queue;
  }

  GDS.save = {
    validState: validState,
    onStatus: function (fn) { listener = fn; if (listener) listener(status); },
    status: function () { return status; },
    restoreIssue: function () { return restoreIssue; },
    persist: function (st) {
      if (!validState(st)) {
        announce("error", "存档内容无效，未保存");
        return Promise.resolve();
      }
      sequence += 1;
      latest = { formatVersion: 1, state: st, cloudRevision: cloudRevision,
        localSequence: sequence, savedAt: Date.now(), pending: true };
      announce("saving", "正在保存…");
      return enqueue(latest);
    },
    retry: function () {
      if (blocked || !latest || !latest.pending) return Promise.resolve();
      return enqueue(latest);
    },
    loadCloud: async function () {
      if (!(GDS.bridge && GDS.bridge.canCloud())) throw new Error("云端不可用");
      var remote = normalizeCloud(await GDS.bridge.cloudGetSave());
      if (!remote) throw new Error(restoreIssue || "云端没有有效存档");
      await queue;
      if (!(await GDS.bridge.storageSet(remote))) throw new Error("本机无法保存云端进度");
      latest = remote;
      cloudRevision = remote.cloudRevision;
      sequence = 0;
      blocked = false;
      announce("saved", "已载入云端进度");
      return remote.state;
    },
    restoreOrNull: function () {
      if (restored) return Promise.resolve(latest ? latest.state : null);
      if (restorePromise) return restorePromise;
      restorePromise = (async function () {
        var local = null;
        var remote = null;
        try { local = normalizeLocal(GDS.bridge && await GDS.bridge.storageGet()); }
        catch (e) { restoreIssue = "本机存档无法读取，原数据未删除。"; }
        if (GDS.bridge && GDS.bridge.canCloud()) {
          try { remote = normalizeCloud(await GDS.bridge.cloudGetSave()); }
          catch (e) { if (!local) restoreIssue = "云端暂时无法读取。"; }
        }
        if (local && local.pending) {
          latest = local;
          cloudRevision = local.cloudRevision;
          if (remote && remote.cloudRevision > local.cloudRevision) {
            blocked = true;
            announce("conflict", "云端有较新进度；本机档已保留，可选择载入云端。");
          } else if (GDS.bridge && GDS.bridge.canCloud()) {
            announce("local", "已恢复本机进度，正在同步云端");
            enqueue(local);
          } else announce("local", "已恢复本机进度，云端待同步");
        } else if (remote && (!local || remote.cloudRevision >= local.cloudRevision)) {
          latest = remote;
          cloudRevision = remote.cloudRevision;
          announce("saved", "已恢复云端进度");
          try { await GDS.bridge.storageSet(remote); } catch (e) { /* 云端仍可读 */ }
        } else if (local) {
          latest = local;
          cloudRevision = local.cloudRevision;
          announce("local", "已恢复本机进度");
        } else if (restoreIssue) announce("error", restoreIssue);
        sequence = latest ? latest.localSequence : 0;
        restored = true;
        return latest ? latest.state : null;
      })();
      return restorePromise;
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
