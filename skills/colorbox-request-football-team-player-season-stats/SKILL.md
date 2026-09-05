---
name: request-football-teamPlayerSeasonStats
description: 按赛季查看球队阵容球员的技术统计，用于赛季球员数据展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.teamPlayerSeasonStats(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.football.teamPlayerSeasonStats({ teamId, seasonId }) 调用，严禁直接拼凑网络接口 URL。
- teamId 对应接口参数 newId；seasonId 必填，应从 teamSeasonYear 的 competitions 中选择；无需传 oldId。
- 建议先调用 request.football.teamSeasonYear 获取赛季与联赛列表，再把选中的 seasonId 传入本能力。
- 成功时 data 为球员数组；可按 position / isGoalkeeper 分组展示，并从 stats 中按 groupName 聚合进攻/防守等数据。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| teamId | string | 是 | 球队唯一 ID（接口 newId），例如 "655" |
| seasonId | string | 是 | 赛季联赛 ID，来自 request.football.teamSeasonYear 返回的 competitions[].seasonId，例如 "54032" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | array | 否 | 球队该赛季阵容球员及统计列表 |
| data[].playerId | number | 否 | 球员 ID |
| data[].gdcId | number / null | 否 | GDC ID，可能为 null |
| data[].name | string | 否 | 球员中文名 |
| data[].avatar | string | 否 | 球员头像 URL |
| data[].position | string | 否 | 场上位置，例如 前锋、中场、后卫、守门员 |
| data[].isGoalkeeper | boolean | 否 | 是否守门员 |
| data[].age | number | 否 | 年龄 |
| data[].number | string / number / null | 否 | 球衣号码，可能为 null |
| data[].country | string | 否 | 国籍 |
| data[].stats | array | 否 | 该球员在指定赛季的统计项列表 |
| data[].stats[].statsId | number | 否 | 统计项 ID，例如 1 表示进球 |
| data[].stats[].name | string | 否 | 统计项名称，例如 进球、助攻、出场时间 |
| data[].stats[].group | number | 否 | 统计分组 ID，例如 40 进攻、41 防守、42 组织、43 纪律、44 守门员 |
| data[].stats[].groupName | string | 否 | 统计分组名称，例如 进攻、防守、组织、纪律、守门员 |
| data[].stats[].value | string | 否 | 统计值文案，例如 10、40.35%、1938' |

# Examples

```javascript
window.ColorboxAI.request.football.teamSeasonYear({ teamId: "655" }).then(yearRes => { const seasonId = yearRes.data?.[1]?.competitions?.[0]?.seasonId; return window.ColorboxAI.request.football.teamPlayerSeasonStats({ teamId: "655", seasonId }); }).then(res => { if (res.code === 200) { console.log(res.data?.[0]?.name, res.data?.[0]?.stats); } })
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