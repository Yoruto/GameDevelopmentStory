---
name: request-football-teamSeasonYear
description: 查看球队各赛季的年度列表及参与的联赛/杯赛，用于赛季切换与赛事入口。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.teamSeasonYear(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.football.teamSeasonYear({ teamId }) 调用，严禁直接拼凑网络接口 URL。
- teamId 对应接口参数 newId；type 固定为 team。
- 成功时 data 为赛季数组；优先用 data[0] 作为当前/最新赛季，从其 competitions 读取联赛与 seasonId。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| teamId | string | 是 | 球队唯一 ID（接口 newId），例如 "655" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | array | 否 | 球队各赛季年度及关联联赛列表 |
| data[].name | string | 否 | 赛季短名，例如 25/26 |
| data[].fullName | string | 否 | 赛季全名，例如 2025-2026 |
| data[].year | object | 否 | 赛季年份信息 |
| data[].year.start | string | 否 | 开始年份，例如 2025 |
| data[].year.end | string | 否 | 结束年份，例如 2026 |
| data[].year.fullYearName | string | 否 | 短年份名，例如 25/26 |
| data[].year.realFullYearName | string | 否 | 完整年份名，例如 2025-2026 |
| data[].competitions | array | 否 | 该赛季关联的赛事列表 |
| data[].competitions[].competitionId | number | 否 | 赛事 ID，例如 81 |
| data[].competitions[].competitionName | string | 否 | 赛事名称，例如 英超、欧冠、足总杯 |
| data[].competitions[].seasonId | number | 否 | 该赛事在对应赛季的 seasonId |
| data[].competitions[].competitionType | string | 否 | 赛事类型，例如 LEAGUE、INTERCONTINENTAL_CUP、DOMESTIC_CUP、UNKNOWN |

# Examples

```javascript
window.ColorboxAI.request.football.teamSeasonYear({ teamId: "655" }).then(res => { if (res.code === 200) { console.log(res.data?.[0]?.fullName, res.data?.[0]?.competitions); } })
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