---
name: user-feedback
description: 为活动 H5 接入统一的用户反馈提交能力，使用当前虎扑登录态将反馈安全写入公共反馈服务。适用于意见反馈、问题上报、体验建议等需要用户提交文本反馈的场景。
---

# 用户反馈

为活动页面增加用户反馈入口。反馈统一写入平台公共反馈环境，开发者只负责页面表单和提交交互，不创建数据库、云函数或网关。

## Usage

- JS Path: `window.ColorboxAI.cloud.request(params)`

## 固定服务配置

```javascript
const FEEDBACK_CONFIG = Object.freeze({
  apiBase: "https://feedback-public-d8fnf79rd0e395c3-1252166086.ap-shanghai.app.tcloudbase.com/api",
  envId: "feedback-public-d8fnf79rd0e395c3",
  applicationId: "<从 activity.json 注入当前 activityId>",
});
```

- `applicationId` 必须来自技能包根目录 `activity.json.activityId`，构建页面时写入静态配置。
- 禁止从 URL、表单、localStorage 或用户输入读取、覆盖 `applicationId`。
- 不使用活动自己的 `ACTIVITY_ENV_ID` / `ACTIVITY_API_BASE`；反馈服务是所有活动、所有部署环境（dev/sit/stg/prod）共用的同一套公共环境，禁止按部署拆分或改写 envId / 网关地址。
- EnvId 和网关地址是公开路由标识，不是凭据；页面中禁止出现 ApiKey、ticket、STS 或私钥。

## 接入流程

1. 在页面中提供“用户反馈”入口、反馈文本框、剩余字数、提交按钮和结果提示。
2. 前端校验 trim 后内容为 1–2000 个 Unicode 字符。
3. 提交前调用 `window.ColorboxAI.auth.getUserInfo()` 读取当前用户昵称与头像；未登录则引导登录，不要手写昵称/头像。
4. 提交时调用 `window.ColorboxAI.cloud.request`，传 `auth: true` 和反馈环境 `envId`。
5. 请求成功后清空输入并提示已提交；失败时按 HTTP 状态给出可执行提示。
6. 提交期间禁用按钮，防止用户连续点击。

只允许提交以下 JSON：

```json
{
  "applicationId": "app_0123456789",
  "content": "反馈正文",
  "nickname": "用户昵称",
  "avatarUrl": "https://example.com/avatar.png"
}
```

- `nickname`、`avatarUrl` 取自 `getUserInfo()` 的 `data.nickname` 与 `data.avatar`（或 `data.userHeadUrl`）；有值则提交，空值可省略字段。
- 禁止提交 `puid`、联系方式、token 或其他字段。用户 PUID 由认证网关注入，客户端不得自报身份。
- `nickname` / `avatarUrl` 仅作展示快照，不是身份断言；服务端会校验长度，且 `avatarUrl` 必须为 `https://`。

## 推荐实现

```javascript
function feedbackContentLength(value) {
  return Array.from(value.trim()).length;
}

async function submitUserFeedback(rawContent) {
  const content = rawContent.trim();
  const length = feedbackContentLength(content);

  if (length < 1 || length > 2000) {
    throw new Error("请输入 1–2000 个字符的反馈内容");
  }

  const userInfo = await window.ColorboxAI.auth.getUserInfo();
  if (userInfo.code !== 200 || !userInfo.data || userInfo.data.islogin !== 1) {
    throw new Error("请先登录后再提交反馈");
  }

  const nickname =
    typeof userInfo.data.nickname === "string" ? userInfo.data.nickname.trim() : "";
  const avatarUrlRaw =
    (typeof userInfo.data.avatar === "string" && userInfo.data.avatar.trim()) ||
    (typeof userInfo.data.userHeadUrl === "string" && userInfo.data.userHeadUrl.trim()) ||
    "";

  const data = {
    applicationId: FEEDBACK_CONFIG.applicationId,
    content,
  };
  if (nickname) data.nickname = nickname;
  if (avatarUrlRaw.startsWith("https://")) data.avatarUrl = avatarUrlRaw;

  const response = await window.ColorboxAI.cloud.request({
    url: `${FEEDBACK_CONFIG.apiBase}/feedback`,
    method: "POST",
    data,
    envId: FEEDBACK_CONFIG.envId,
    auth: true,
  });

  if (response.statusCode === 201 && response.code === 0) {
    return response.data;
  }

  if (response.statusCode === 401) {
    throw new Error("登录状态已失效，请重新登录后提交");
  }
  if (response.statusCode === 413) {
    throw new Error("反馈内容过长，请精简后提交");
  }
  if (response.statusCode === 429) {
    throw new Error("提交过于频繁，请稍后再试");
  }
  if (response.statusCode === 400) {
    throw new Error(response.message || "反馈内容不符合要求");
  }
  throw new Error("提交结果暂不确定，请稍后在确认未成功后再试");
}
```

必须使用 `ColorboxAI.cloud.request`，禁止手写 `fetch`、拼接 `Authorization` 或直接调用鉴权中心。`auth: true` 会在需要时自动完成 `cloud.auth` 登录。

## 服务契约

| 项目 | 约定 |
| --- | --- |
| 方法 | `POST` |
| 路径 | `/api/feedback` |
| 鉴权 | 必须登录；网关 `EnableAuth=true` |
| 成功 | HTTP `201`，`code=0`，`data={ id, createdAt }` |
| 参数错误 | HTTP `400` |
| 未登录/登录失效 | HTTP `401` |
| Body 超过 16 KiB | HTTP `413` |
| 同一用户、同一应用 10 分钟超过 5 次 | HTTP `429` |
| 服务异常 | HTTP `5xx` |

服务端会再次校验 `applicationId`、正文长度、昵称/头像格式、请求体大小和限频。客户端校验只用于改善体验，不能替代服务端约束。

## 交互与可靠性要求

- 文本框必须有可见标签；错误提示使用 `aria-live` 或等价可访问方式。
- 以 `Array.from(content.trim()).length` 统计 Unicode 字符，不用 UTF-16 的 `string.length` 作为 2000 字符判断。
- 提交按钮在请求进行中显示加载态并禁用；请求结束后恢复。
- 仅在明确收到 HTTP 201 后显示成功。
- 接口当前不提供客户端幂等键。网络超时或 5xx 时不要自动重试，避免重复反馈；提示用户稍后确认后再试。
- 429 不自动重试，不做倒计时连发。
- 不在 console、埋点、错误日志或本地存储记录完整反馈正文、PUID、Bearer 或服务端返回的内部信息。

## 不要做

- 不为每个活动创建反馈表、反馈云函数或反馈网关。
- 不把反馈提交到 `colorbox-shaper-api` 的后台查询接口。
- 不开放用户端反馈列表或查询其他用户反馈。
- 不允许页面传入 `puid`，也不通过用户资料接口获取 PUID 后写入 body。
- 不将“提交成功”与埋点成功、页面关闭等非服务端结果绑定。
- 不让用户在表单中编辑昵称或头像；只使用 `getUserInfo()` 快照。

## 完成自检

- `applicationId` 来自 `activity.json.activityId`，且匹配 `app_[0-9a-f]{10}`。
- 请求目标是固定反馈网关和反馈 EnvId，不是当前活动 CloudBase 环境。
- 实际调用 `window.ColorboxAI.cloud.request`，`auth: true`；body 仅含 `applicationId`、`content`，以及可选的 `nickname`、`avatarUrl`。
- 昵称/头像来自 `getUserInfo()`，非表单输入。
- 1、2000、2001 字符边界提示正确；空白内容不可提交。
- 201、400、401、413、429、5xx 均有明确且不泄密的用户提示。
- 请求期间不可重复点击，超时/5xx 不自动重试。
