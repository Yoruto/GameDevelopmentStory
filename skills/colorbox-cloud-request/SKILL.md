---
name: cloud-request
description: 向活动 CloudBase 网关发起 HTTP 请求。若本地已有 cloud.auth 登录态，自动附加 Authorization Bearer；需登录的写接口可传 auth:true + envId 自动先登录。
---

# Usage

- JS Path: `window.ColorboxAI.cloud.request(params)`

# Constraints

- CloudBase 活动接口必须使用 window.ColorboxAI.cloud.request，禁止手写 fetch 拼 Bearer
- 公开读可不传 auth；用户写接口传 auth:true 且提供 envId
- body / query 禁止传 puid 或任何客户端自报身份字段
- 普通虎扑业务接口继续用 window.ColorboxAI.request，不要混用
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 完整请求 URL（通常为 ACTIVITY_API_BASE + path） |
| method | string | 否 | HTTP 方法，支持 GET / POST，默认 GET |
| headers | object | 否 | 自定义请求头，可选 |
| data | object | 否 | 请求数据；GET 作为 query，POST 作为 JSON body，可选 |
| envId | string | 否 | 活动 EnvId；auth 为 true 或需要自动登录时必填 |
| auth | boolean | 否 | 是否要求登录。true 时若无 Bearer 会先调用 cloud.auth；默认 false |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| statusCode | number | 是 | HTTP 状态码 |
| code | number | 否 | 业务 code（若响应体含 code） |
| message | string | 否 | 提示信息 |
| data | object | 否 | 响应 data 字段或完整 JSON |

# Examples

```javascript
window.ColorboxAI.cloud.request({ url: window.ACTIVITY_API_BASE + "/candidates" }).then(res => console.log(res.data));
```

```javascript
window.ColorboxAI.cloud.request({ url: window.ACTIVITY_API_BASE + "/vote", method: "POST", data: { candidateId: "xxx" }, envId: window.ACTIVITY_ENV_ID, auth: true }).then(res => console.log(res));
```