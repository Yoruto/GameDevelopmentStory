---
name: cloud-auth
description: 使用当前虎扑登录态向鉴权中心一步换取活动 CloudBase 环境的 Bearer accessToken（服务端完成 ticket + signin/custom），并通过 storage 持久化存储 Session。活动页访问需登录的云函数网关接口前调用。
---

# Usage

- JS Path: `window.ColorboxAI.cloud.auth(params)`

# Constraints

- 必须使用 window.ColorboxAI.cloud.auth({ envId })，禁止 H5 自行处理 ticket、私钥或直连 signin/custom
- envId 必须是活动环境的腾讯云 EnvId
- 拿到 accessToken 后，需登录的云接口请用 window.ColorboxAI.cloud.request，勿用手写 fetch 拼 Authorization
- 公开读接口可不调用本方法
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| envId | string | 是 | 活动 CloudBase 环境 ID（腾讯云 EnvId，非 alias） |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码，成功为 200 |
| message | string | 是 | 提示信息 |
| data | object | 否 |  |
| data.accessToken | string | 否 | CloudBase Bearer accessToken |
| data.expiresIn | number | 否 | 有效期（秒） |
| data.envId | string | 否 | 活动环境 EnvId |
| data.customUserId | string | 否 | 自定义登录用户 ID（通常为虎扑 puid） |

# Examples

```javascript
window.ColorboxAI.cloud.auth({ envId: window.ACTIVITY_ENV_ID }).then(res => { if (res.code === 200) console.log(res.data.accessToken); });
```