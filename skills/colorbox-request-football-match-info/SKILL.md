---
name: request-football-matchInfo
description: 获取足球比赛的实时赛况，包括对阵双方、队徽、比分和比赛状态，用于展示比赛结果与进展。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.matchInfo(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| matchId | string | 是 | 比赛唯一ID，例如 "3512534" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.date | string | 否 | 比赛日期时间（如 "2026-07-10 04:00:00"） |
| data.matchId | number | 否 | 比赛唯一ID |
| data.oldMatchId | number | 否 | 旧比赛ID（可能为 null） |
| data.competitionName | string | 否 | 赛事名称（如 世界杯） |
| data.competitionShortName | string | 否 | 赛事简称（如 世界杯） |
| data.gdcLid | string | 否 | GDC 联赛ID |
| data.league | boolean | 否 | 是否为联赛 |
| data.stageName | string | 否 | 阶段名称（如 1/4决赛） |
| data.round | number | 否 | 轮次 |
| data.homeLogo | string | 否 | 主队队徽图片 URL |
| data.homeTeamId | number | 否 | 主队ID |
| data.oldHomeTeamId | number | 否 | 旧主队ID |
| data.homeTeamName | string | 否 | 主队名称（如 法国） |
| data.homeTeamShortNameEn | string | 否 | 主队英文简称（如 France） |
| data.homeScore | number | 否 | 主队比分 |
| data.homeOutScore | number | 否 | 主队常规时间外比分（加时/点球） |
| data.awayLogo | string | 否 | 客队队徽图片 URL |
| data.awayTeamId | number | 否 | 客队ID |
| data.oldAwayTeamId | number | 否 | 旧客队ID |
| data.awayTeamName | string | 否 | 客队名称（如 摩洛哥） |
| data.awayTeamShortNameEn | string | 否 | 客队英文简称（如 Morocco） |
| data.awayScore | number | 否 | 客队比分 |
| data.awayOutScore | number | 否 | 客队常规时间外比分（加时/点球） |
| data.win | string | 否 | 胜负标识 |
| data.matchResult | string | 否 | 比赛结果（如 HOME_TEAM 主队胜） |
| data.status | string | 否 | 比赛状态标识（如 END, LIVE 等） |
| data.statusDesc | string | 否 | 比赛状态描述（如 已结束、未开始） |
| data.thirdPCStatus | string | 否 | 第三方比赛状态（如 COMPLETED） |
| data.matchPeriod | string | 否 | 比赛阶段（如 SECOND_HALF 下半场） |
| data.periodBeginTime | number | 否 | 当前阶段开始时间（秒时间戳） |
| data.stageBeginTime | number | 否 | 阶段开始时间（秒时间戳） |
| data.periodBeginTimeStr | string | 否 | 阶段时间描述（如 "已结束 16851'"） |
| data.venueDTO | object | 否 | 比赛场馆信息 |
| data.venueDTO.venueId | number | 否 | 场馆ID |
| data.venueDTO.name | string | 否 | 场馆名称 |
| data.venueDTO.enName | string | 否 | 场馆英文名称 |
| data.refereeDTO | object | 否 | 主裁判信息 |
| data.refereeDTO.refereeId | number | 否 | 裁判ID |
| data.refereeDTO.name | string | 否 | 裁判姓名 |
| data.matchDesc | string | 否 | 比赛描述（如 "世界杯 1/4决赛"） |
| data.dateDesc | string | 否 | 比赛时间描述（如 "07月10日 04:00"） |
| data.twoRoundsDesc | string | 否 | 两回合赛制描述 |
| data.matchTvList | array | 否 | 电视转播列表（可能为 null） |
| data.isShowMatchTv | number | 否 | 是否展示电视转播（0/1） |
| data.pollTimeSeconds | number | 否 | 轮询间隔（秒） |
| data.competitionBg | string | 否 | 赛事背景图 URL |
| data.matchLiveUrl | string | 否 | 直播间跳转链接 |
| data.matchVideo | object | 否 | 比赛视频信息（可能为 null） |
| data.minMatchStatus | object | 否 | 小状态（细分比赛状态） |
| data.minMatchStatus.id | number | 否 | 状态ID |
| data.minMatchStatus.txt | string | 否 | 状态文案 |
| data.minMatchStatus.desc | string | 否 | 状态描述 |
| data.minMatchStatus.used | number | 否 | 使用标识 |
| data.bigMatchStatus | object | 否 | 大状态（粗分比赛状态） |
| data.bigMatchStatus.id | number | 否 | 状态ID |
| data.bigMatchStatus.txt | string | 否 | 状态文案 |
| data.bigMatchStatus.desc | string | 否 | 状态描述 |
| data.bigMatchStatus.used | number | 否 | 使用标识 |
| data.index | number | 否 | 索引（可能为 null） |
| data.openTeamPage | number | 否 | 是否开启球队主页（0/1） |
| data.pv | string | 否 | 评分/浏览量文案（如 "19.5万评分"） |
| data.supportLiveActivity | boolean | 否 | 是否支持灵动岛实时活动 |
| data.iosliveActivityCode | string | 否 | iOS 实时活动编码（可能为 null） |
| data.homeTeamPenalty | number | 否 | 主队点球数 |
| data.awayTeamPenalty | number | 否 | 客队点球数 |
| data.homeTeamScore | number | 否 | 主队得分 |
| data.awayTeamScore | number | 否 | 客队得分 |
| data.homeTeamLogo | string | 否 | 主队队徽图片 URL |
| data.awayTeamLogo | string | 否 | 客队队徽图片 URL |
| data.draw | boolean | 否 | 是否平局 |
| data.homeWin | boolean | 否 | 主队是否获胜 |
| data.awayWin | boolean | 否 | 客队是否获胜 |

# Examples

```javascript
window.ColorboxAI.request.football.matchInfo({ matchId: "3512534" }).then(res => { if (res.code === 200) { console.log(res.data.homeTeamName + " vs " + res.data.awayTeamName); } })
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