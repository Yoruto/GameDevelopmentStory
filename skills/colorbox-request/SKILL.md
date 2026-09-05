---
name: request
description: 在活动页中向指定接口发起通用的 HTTP 请求，支持配置自定义方法、请求头与请求体数据。由 SDK 统一进行跨域与转发调度，可选走 Native Bridge 通道。
---

# Usage

- JS Path: `window.ColorboxAI.request(params)`

# Constraints

- 严禁自行使用 window.fetch 或 XMLHttpRequest，必须使用统一的 window.ColorboxAI.request 接口以避免跨域失败
- 所有包含机密敏感信息的请求必须在安全风控允许下进行
- channel 为 bridge 时依赖 App 内 HupuBridge（或 iframe 父容器代理）；纯 Web 环境会自动回退 fetch
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 需要请求的接口 URL 链接，支持 HTTP/HTTPS 协议 |
| method | string | 否 | HTTP 请求方法，例如 "GET", "POST", "PUT", "DELETE"，默认为 "GET" |
| headers | object | 否 | 自定义请求头，以键值对表示，可选 |
| data | object | 否 | 请求体数据对象；GET 时作为 query 参数，POST 时作为请求体，可选 |
| timeout | number | 否 | 超时时间限制（单位：毫秒），可选 |
| channel | string | 否 | 请求通道。fetch 为 Web 请求（默认）；bridge 为 Native 请求（hupu.common.request），仅 App / Bridge 可用，不可用时自动回退 fetch |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| statusCode | number | 是 | 响应的 HTTP 状态码，例如 200 |
| data | object | 是 | 响应的 JSON 数据体，可能为任何 JSON 对象或结构 |
| headers | object | 是 | 响应头信息 |

# Examples

```javascript
window.ColorboxAI.request({ url: "https://activity.hupu.com/api/info", method: "GET" }).then(res => { console.log(res.data); })
```

```javascript
window.ColorboxAI.request({ url: "https://bbs.mobileapi.hupu.com/1/8.2.53/threads/getsThreadPostList", method: "GET", channel: "bridge", data: { tid: "640720803" } }).then(res => { console.log(res.data); })
```

# Frontend Request Guard

| 策略 | 默认值 |
| --- | --- |
| 同请求在途合并窗口 | 不启用（0ms） |
| GET 缓存 TTL | 不启用（0ms） |
| 请求超时 | 8000ms |
| 单能力最大并发 | 不限制 |
| 单能力分钟调用上限 | 不限制 |
| 同 URL 窗口调用上限 | 20 次 / 10000ms（超过限制排队等待） |
| 同页面同接口窗口调用上限（去掉 query/hash 参数） | 20 次 / 5000ms（首次超过限制返回 429，后续同窗口请求静默丢弃，异常日志只上报一次） |
| 连续失败熔断 | 3 次失败后熔断 30000ms |
| 自动分页建议上限 | 5 页 |