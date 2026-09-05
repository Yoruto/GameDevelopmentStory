---
name: request-bbs-replyPost
description: 在 App 内直接回复社区帖子，只需提供目标帖子和回复内容，即可完成回帖互动。
---

# Usage

- JS Path: `window.ColorboxAI.request.bbs.replyPost(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.bbs.replyPost({ tid, content }) 调用，且仅支持虎扑 App 环境；禁止直接使用 fetch、axios、XMLHttpRequest、第三方请求库或自行拼接 bridge。
- 虎扑回帖底层请求方法必须为 POST，严禁使用 GET 发起回帖提交。
- 回帖接口 URL 默认使用 /1/${version}/bbsreplyapi/reply/v1/app/create；iOS 环境自动改为 /3/${version}/bbsreplyapi/reply/v1/app/create。
- iOS 环境调用 hupu.common.request 时必须在 method 同级传 postContentType: "application/json"；非 iOS 环境不传该字段。
- tid 为目标帖子 ID，content 为回帖内容字符串；调用前请先校验内容非空，再根据返回的 code/message 给用户做友好提示。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| tid | string | 是 | 目标帖子 ID，例如 "640720803" |
| content | string | 是 | 回帖内容字符串，不能为空 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |

# Examples

```javascript
window.ColorboxAI.request.bbs.replyPost({ tid: "640720803", content: "支持一下，写得很好。" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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