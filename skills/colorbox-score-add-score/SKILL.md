---
name: score-addScore
description: 让用户对指定球员、装备等对象进行打分（1-10 分），用于活动页收集用户评价。
---

# Usage

- JS Path: `window.ColorboxAI.score.addScore(params)`

# Constraints

- 必须通过 window.ColorboxAI.score.addScore(params) 接口，严禁直接手写 POST 接口 URL
- score 必须是 1 到 10 之间的数值，source 为选填字段
- 未登录状态下，提交评分可能会返回未登录错误，需做好登录兜底提示
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| outBizType | string | 是 | 业务类型。常用可选值包括：nbaPlayer (NBA球员), cbaPlayer (CBA球员), equipment (运动装备), games (游戏), movie (电影影视), food (美食), school (高校) |
| outBizNo | string | 是 | 业务对象 ID，例如球员 ID |
| score | number | 是 | 打分分值，范围 1 - 10 之间 |
| source | string | 否 | 来源渠道标识，可选 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否提交成功 |
| message | string | 否 | 错误信息或成功提示 |

# Examples

```javascript
window.ColorboxAI.score.addScore({ outBizType: "nbaPlayer", outBizNo: "12345", score: 9.5 })
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