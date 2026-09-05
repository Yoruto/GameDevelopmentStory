---
name: request-bbs-openPostEditor
description: 从活动页唤起发帖页面，并自动填入标题、正文和图片，方便用户快速参与内容创作。
---

# Usage

- JS Path: `window.ColorboxAI.request.bbs.openPostEditor(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.bbs.openPostEditor(params) 方法唤起发帖，严禁直接手写 location.href 或 Schema
- 若包含图片 imageUrl，建议先使用 oss.uploadFile 上传获得 CDN 地址，再传入发帖参数
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 否 | 发布的目标专区 ID，可选 (例如 "85") |
| tagId | string | 否 | 发布的目标话题 ID，可选 (例如 "152660") |
| topicName | string | 否 | 专区名称，可选 (例如 "数码区") |
| tagName | string | 否 | 话题名称，可选 (例如 "虎扑有奖活动") |
| title | string | 否 | 预填的帖子标题，可选 |
| content | string / array | 否 | 预填的帖子正文段落，支持普通文本字符串或富文本段落数组（含文本和链接），可选 |
| imageUrl | string | 否 | 预填的图片 URL 链接，可选 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码，200 表示成功构建并拉起 |
| message | string | 是 | 说明信息 |
| schema | string | 是 | 生成的 native schema 协议地址 |

# Examples

```javascript
window.ColorboxAI.request.bbs.openPostEditor({ title: "测试发帖", content: "这是预填的帖子内容..." })
```

```javascript
window.ColorboxAI.request.bbs.openPostEditor({ topicId: "85", title: "测试发帖", content: "这是预填的帖子内容..." })
```

```javascript
window.ColorboxAI.request.bbs.openPostEditor({ topicId: "85", title: "图文发帖", content: [{ type: "paragraph", content: [{ type: "text", text: "说不出的我爱你：" }, { type: "link", attrs: { href: "https://bbs.hupu.com", title: "Joyflower 玫瑰" } }] }] })
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