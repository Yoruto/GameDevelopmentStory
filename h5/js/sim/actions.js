(function (root) {
  var sim = root.GDS.sim;
  var MSG = {};
  MSG[sim.ERR.EVENT_NOT_FOUND] = "找不到这个事件";
  MSG[sim.ERR.EVENT_NOT_CHOICE] = "这个事件不用做选择";
  MSG[sim.ERR.EVENT_OPTION_INVALID] = "没有这个选项";
  MSG[sim.ERR.CAREER_ROLE_INVALID] = "先选一个擅长岗位";
  MSG[sim.ERR.CAREER_OFFER_NOT_FOUND] = "这份 offer 已经不在了";
  MSG[sim.ERR.CAREER_NOT_CAREER] = "这一局不是个人生涯";
  MSG[sim.ERR.CAREER_ALREADY_HIRED] = "已经入职了";
  MSG[sim.ERR.CAREER_BUSY] = "在研中途不能走";
  MSG[sim.ERR.CAREER_HOP_WAIT] = "今年已经申请过，明年再试";
  MSG[sim.ERR.CAREER_HOP_NO_PICK] = "先选一家再申请";
  MSG[sim.ERR.CAREER_INVITE_NOT_FOUND] = "这份邀请已经不在了";
  MSG[sim.ERR.CAREER_NOT_JOINABLE] = "这家现在不招人";
  MSG[sim.ERR.CAREER_PROMOTE_LOCKED] = "现在还不能晋升";
  MSG[sim.ERR.CAREER_LINE_LOCKED] = "这条事件线现在不能开";
  MSG[sim.ERR.CAREER_FOUNDER_LOCKED] = "本版不能自己开公司";

  sim.errorMessage = function (error) {
    return MSG[error] || error;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
