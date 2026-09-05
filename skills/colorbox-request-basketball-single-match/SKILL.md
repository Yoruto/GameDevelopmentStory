---
name: request-basketball-singleMatch
description: 获取篮球比赛的实时赛况，包括对阵双方、队徽、比分和比赛状态，用于展示比赛结果与进展。
---

# Usage

- JS Path: `window.ColorboxAI.request.basketball.singleMatch(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| matchId | string | 是 | 比赛唯一ID，例如 "1500260599135731712" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.projectId | string | 否 | 项目ID（内部字段，通常为 null） |
| data.version | string | 否 | 版本号（内部字段，通常为 null） |
| data.traceId | string | 否 | 链路追踪ID（内部字段，通常为 null） |
| data.matchId | string | 否 | 比赛唯一ID |
| data.matchStatus | string | 否 | 比赛状态（如 COMPLETED, LIVE, NOT_STARTED 等） |
| data.homeScore | number | 否 | 主队得分 |
| data.awayScore | number | 否 | 客队得分 |
| data.homeTeamId | string | 否 | 主队ID |
| data.awayTeamId | string | 否 | 客队ID |
| data.homeTeamName | string | 否 | 主队简称（中文） |
| data.awayTeamName | string | 否 | 客队简称（中文） |
| data.homeTeamEngName | string | 否 | 主队英文名（可能为 null） |
| data.awayTeamEngName | string | 否 | 客队英文名（可能为 null） |
| data.homeTeamLogo | string | 否 | 主队队徽图片 URL |
| data.awayTeamLogo | string | 否 | 客队队徽图片 URL |
| data.homeTeamDayColor | string | 否 | 主队日间主题色（十六进制，无 # 前缀） |
| data.awayTeamDayColor | string | 否 | 客队日间主题色（十六进制，无 # 前缀） |
| data.homeTeamNightColor | string | 否 | 主队夜间主题色 |
| data.awayTeamNightColor | string | 否 | 客队夜间主题色 |
| data.homeTeamSpareColor | string | 否 | 主队备用主题色 |
| data.awayTeamSpareColor | string | 否 | 客队备用主题色 |
| data.homeFrontTeam | boolean | 否 | 主队是否为前置展示队伍 |
| data.snapshotVersion | number | 否 | 数据快照版本号 |
| data.leagueType | string | 否 | 联赛类型（如 CBA, NBA） |
| data.competitionType | string | 否 | 赛事类型（如 CBA） |
| data.competitionTypeCn | string | 否 | 赛事类型中文名（如 CBA） |
| data.competitionStageType | string | 否 | 比赛阶段类型（如 PLAYOFF、REGULAR） |
| data.competitionStageDesc | string | 否 | 比赛阶段描述（如 季后赛、常规赛） |
| data.gdcId | number | 否 | GDC 数据中心比赛ID |
| data.beginTime | number | 否 | 比赛开始时间（纳秒时间戳） |
| data.homeGdcId | number | 否 | 主队 GDC ID |
| data.awayGdcId | number | 否 | 客队 GDC ID |
| data.homeFouls | number | 否 | 主队犯规数 |
| data.homeSurplusPause | number | 否 | 主队剩余暂停次数 |
| data.awayFouls | number | 否 | 客队犯规数 |
| data.awaySurplusPause | number | 否 | 客队剩余暂停次数 |
| data.matchStatusChinese | string | 否 | 比赛状态中文描述（如 已结束、直播中、未开始） |
| data.homeRank | number | 否 | 主队排名 |
| data.awayRank | number | 否 | 客队排名 |
| data.homeArea | string | 否 | 主队地区（可能为 null） |
| data.awayArea | string | 否 | 客队地区（可能为 null） |
| data.frontEndMatchStatus | object | 否 | 前端比赛状态 |
| data.frontEndMatchStatus.id | number | 否 | 状态ID |
| data.frontEndMatchStatus.desc | string | 否 | 状态描述（如 已结束） |
| data.matchTimeScheduleStatus | string | 否 | 比赛时间安排状态（如 SCHEDULED） |
| data.attendance | number | 否 | 观众人数（可能为 null） |
| data.season | string | 否 | 赛季（如 2025-2026） |
| data.memo | string | 否 | 备注信息（可能为 null） |
| data.arenaCity | string | 否 | 比赛场馆所在城市（可能为 null） |
| data.chinaStartTime | number | 否 | 中国时区开赛时间（毫秒时间戳） |
| data.usaStartTime | number | 否 | 美国时区开赛时间（毫秒时间戳，可能为 null） |
| data.matchTime | string | 否 | 比赛时间字符串（如 "2026-05-07 20:00:00"） |
| data.costTime | number | 否 | 比赛耗时（可能为 null） |
| data.currentQuarter | number | 否 | 当前节数 |
| data.round | number | 否 | 轮次 |
| data.winTeamName | string | 否 | 获胜队伍简称 |
| data.openChat | boolean | 否 | 是否开启聊天 |
| data.openLive | boolean | 否 | 是否开启直播 |
| data.openCasino | boolean | 否 | 是否开启竞猜 |
| data.playerscorecount | number | 否 | 球员评分人数（可能为 null） |
| data.liveOption | string | 否 | 直播方式（如 ARTIFICIAL 人工） |
| data.lid | string | 否 | 联赛ID |
| data.matchTvList | array | 否 | 电视转播列表 |
| data.matchVideoList | array | 否 | 比赛视频列表 |
| data.liveUrl | string | 否 | 直播间跳转链接 |
| data.iconText | string | 否 | 角标文案（如 "5.8万"） |
| data.score | string | 否 | 比赛评分（如 "5.8万评分"） |
| data.scoreNumber | number | 否 | 评分人数 |
| data.sectionEndTime | string | 否 | 各节结束时间（JSON 字符串） |
| data.homeBigScore | number | 否 | 主队大比分 |
| data.awayBigScore | number | 否 | 客队大比分 |
| data.isSubscribe | number | 否 | 是否已订阅（0/1） |
| data.homeTeamAttention | number | 否 | 主队关注状态（可能为 null） |
| data.awayTeamAttention | number | 否 | 客队关注状态（可能为 null） |
| data.shareImg | string | 否 | 分享图片 URL |
| data.showSubscribe | boolean | 否 | 是否展示订阅按钮 |
| data.didSubscribe | boolean | 否 | 是否已订阅 |
| data.subScribeTitle | string | 否 | 订阅标题 |
| data.subScribeType | string | 否 | 订阅类型（如 matchNotice） |
| data.subScribeScene | string | 否 | 订阅场景（如 basketballMatchNotice） |
| data.subScribeBizType | string | 否 | 订阅业务类型（如 basketballMatch） |
| data.subScribeDesc | string | 否 | 订阅描述（如 "深圳 vs 浙江"） |
| data.liveRoomMsgConfig | object | 否 | 直播间消息配置 |
| data.liveRoomMsgConfig.polling | object | 否 | 轮询配置 |
| data.liveRoomMsgConfig.polling.open | boolean | 否 | 是否开启轮询 |
| data.liveRoomMsgConfig.polling.inProgressIntervalInMillSeconds | number | 否 | 进行中轮询间隔（毫秒） |
| data.liveRoomMsgConfig.polling.notInProgressIntervalInMillSeconds | number | 否 | 非进行中轮询间隔（毫秒） |
| data.liveRoomMsgConfig.mqtt | object | 否 | MQTT 配置 |
| data.liveRoomMsgConfig.mqtt.open | boolean | 否 | 是否开启 MQTT |
| data.supportLiveActivity | boolean | 否 | 是否支持灵动岛实时活动 |
| data.matchSpecimens | array | 否 | 比赛样本数据（可能为 null） |
| data.homeLink | string | 否 | 主队详情跳转链接 |
| data.awayLink | string | 否 | 客队详情跳转链接 |
| data.iosliveActivityCode | string | 否 | iOS 实时活动编码（可能为 null） |
| data.is_login | number | 否 | 是否登录（0/1） |
| data.is_jrs | boolean | 否 | 是否为极速版 |
| data.night | number | 否 | 是否夜间模式（0/1） |
| data.client | string | 否 | 客户端标识（可能为 null） |
| data.league_en | string | 否 | 联赛英文标识（如 cba） |
| data.league_name | string | 否 | 联赛名称（如 CBA） |
| data.ad_inside_pop | object | 否 | 内部广告弹窗配置 |
| data.ad_inside_pop.ad_type | number | 否 | 广告类型 |
| data.ad_inside_pop.is_ad | number | 否 | 是否为广告（0/1） |
| data.ad_inside_pop.position | number | 否 | 广告位置 |

# Examples

```javascript
window.ColorboxAI.request.basketball.singleMatch({ matchId: "1500260599135731712" }).then(res => { if (res.code === 200) { console.log(res.data.homeTeamName + " vs " + res.data.awayTeamName); } })
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