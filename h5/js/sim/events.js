(function (root) {
  var sim = root.GDS.sim;

  // 公司档的世界事件系统（随机池/历史事件/五种效果族）已随经营局移除。
  // 这个入口保留给 UI 的抉择分支：生涯模式下直接转发给生涯事件结算。
  sim.resolveEventChoice = function (state, eventId, optionId, config) {
    if (state && state.mode === "career" && sim.resolveCareerEventChoice) {
      return sim.resolveCareerEventChoice(state, eventId, optionId, config);
    }
    return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
