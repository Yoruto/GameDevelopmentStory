---
name: request-kog-playbyplay
description: 获取王者荣耀比赛的实时赛况，包括对阵双方、队徽、比分与赛制信息，用于展示比赛结果与进展。
---

# Usage

- JS Path: `window.ColorboxAI.request.kog.playbyplay(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| battleId | string | 是 | 比赛对局唯一ID，例如 "1543468880035840" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.scoreboard | object | 否 | 计分板信息 |
| data.scoreboard.bo | number | 否 | 几局制对决（如 5） |
| data.scoreboard.status | object | 否 |  |
| data.scoreboard.status.id | number | 否 |  |
| data.scoreboard.status.desc | string | 否 | 比赛状态描述（如 已结束） |
| data.scoreboard.liveSourceInfos | array | 否 | 直播源信息列表（可能为 null） |
| data.scoreboard.liveSourceInfos[].liveSourceName | string | 否 | 直播源名称 |
| data.scoreboard.liveSourceInfos[].liveSourceUrl | string | 否 | 直播源跳转 URL |
| data.scoreboard.specimenInfos | array | 否 | 集锦信息列表 |
| data.scoreboard.specimenInfos[].specimensName | string | 否 | 集锦名称 |
| data.scoreboard.specimenInfos[].specimensUrl | string | 否 | 集锦跳转 URL |
| data.scoreboard.schedule_at | number | 否 | 开赛时间戳（秒） |
| data.scoreboard.team1_win_count | number | 否 | 战队1胜场数 |
| data.scoreboard.team2_win_count | number | 否 | 战队2胜场数 |
| data.scoreboard.sportName | string | 否 | 赛事名称（如 KPL夏季赛） |
| data.scoreboard.matchTypeName | string | 否 | 阶段名称（如 第一轮-第二轮） |
| data.scoreboard.team1_name | string | 否 | 战队1名称（如 重庆狼队） |
| data.scoreboard.team1_logo | string | 否 | 战队1队徽 URL |
| data.scoreboard.team1_link | string | 否 | 战队1详情跳转链接 |
| data.scoreboard.team2_name | string | 否 | 战队2名称（如 上海EDG.M） |
| data.scoreboard.team2_logo | string | 否 | 战队2队徽 URL |
| data.scoreboard.team2_link | string | 否 | 战队2详情跳转链接 |
| data.refresh_time | number | 否 | 刷新间隔时间（秒） |

# Examples

```javascript
window.ColorboxAI.request.kog.playbyplay({ battleId: "1543468880035840" }).then(res => { if (res.code === 200) { console.log(res.data.scoreboard.team1_name + " vs " + res.data.scoreboard.team2_name); } })
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