---
name: request-match-getTabDetailScheduleList
description: 查看赛程各场次的详细信息，并可获取每场比赛关联的评分对象，方便活动页挂载打分入口。
---

# Usage

- JS Path: `window.ColorboxAI.request.match.getTabDetailScheduleList(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| params | object | 否 | 透传给赛程接口的查询参数 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.result | object | 否 | 赛程列表及关联的 scoreItemKey |
| data.result.anchorMatchId | string | 否 | 定位用比赛 ID（无则为空字符串） |
| data.result.dayGameData | array | 否 | 按天分组的赛程列表 |
| data.result.dayGameData[].dayTime | string | 否 | 日期（如 2026-07-01） |
| data.result.dayGameData[].dateBlock | string | 否 | 日期展示文案（如 7月1日 周三） |
| data.result.dayGameData[].matchData | array | 否 | 当天场次列表 |
| data.result.dayGameData[].matchData[].businessType | string | 否 | 业务类型（如 common_match） |
| data.result.dayGameData[].matchData[].matchId | string | 否 | 比赛唯一 ID |
| data.result.dayGameData[].matchData[].uniqueKey | string | 否 | 唯一键（如 common_match:1441778164564949622） |
| data.result.dayGameData[].matchData[].subMatchBusinessType | string | 否 | 子业务类型（如 common_match） |
| data.result.dayGameData[].matchData[].matchType | string | 否 | 比赛类型（如 against 对阵） |
| data.result.dayGameData[].matchData[].matchStatus | string | 否 | 比赛状态（如 COMPLETED） |
| data.result.dayGameData[].matchData[].matchStatusDesc | string | 否 | 比赛状态文案（如 已结束） |
| data.result.dayGameData[].matchData[].matchStartTimeStamp | string | 否 | 开赛时间戳（毫秒字符串） |
| data.result.dayGameData[].matchData[].matchStartDate | string | 否 | 开赛日期（如 2026-07-01） |
| data.result.dayGameData[].matchData[].liveRoomLink | string | 否 | 直播间跳转 schema |
| data.result.dayGameData[].matchData[].extraPhotoLink | string | 否 | 额外图片链接（无则为空字符串） |
| data.result.dayGameData[].matchData[].matchIntroduction | string | 否 | 赛事介绍文案 |
| data.result.dayGameData[].matchData[].matchName | string | 否 | 项目名称（如 女单、男双） |
| data.result.dayGameData[].matchData[].matchDesc | string | 否 | 比赛描述（可能为 null） |
| data.result.dayGameData[].matchData[].scoreCountText | string | 否 | 评分人数文案（如 69人评分） |
| data.result.dayGameData[].matchData[].againstInfo | object | 否 | 对阵信息 |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos | array | 否 | 对阵双方成员列表 |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberName | string | 否 | 成员名称（如球员名、组合名） |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberLogo | string | 否 | 成员头像/Logo URL |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberBaseScore | string | 否 | 基础比分（字符串，如 "3"、"0"） |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberExtraScore | string | 否 | 额外比分（可能为 null） |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberBigScore | string | 否 | 大比分（可能为 null） |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberId | string | 否 | 成员唯一 ID |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberType | string | 否 | 成员类型（无则为空字符串） |
| data.result.dayGameData[].matchData[].againstInfo.memberInfos[].memberDesc | string | 否 | 成员描述（无则为空字符串） |
| data.result.dayGameData[].matchData[].againstInfo.winnerMemberId | string | 否 | 获胜方成员 ID |
| data.result.dayGameData[].matchData[].midGameStageInfo | object | 否 | 中场阶段信息（可能为 null） |
| data.result.dayGameData[].matchData[].scoreItemInfo | object | 否 | 评分卡片信息（可能为 null） |
| data.result.dayGameData[].matchData[].scoreItemInfo.logo | string | 否 | 评分对象头像 URL |
| data.result.dayGameData[].matchData[].scoreItemInfo.name | string | 否 | 评分对象名称 |
| data.result.dayGameData[].matchData[].scoreItemInfo.scoreNum | string | 否 | 评分数值（如 "9.4"） |
| data.result.dayGameData[].matchData[].scoreItemInfo.hotComment | string | 否 | 热评文案 |
| data.result.dayGameData[].matchData[].scoreItemInfo.scoreCountText | string | 否 | 评分人数文案（如 "55人评分"） |
| data.result.dayGameData[].matchData[].scoreItemInfo.jumpLink | string | 否 | 评分详情跳转 schema |
| data.result.dayGameData[].matchData[].scoreItemInfo.teamLogo | string | 否 | 队伍 Logo（可能为 null） |
| data.result.dayGameData[].matchData[].scoreItemInfo.scoreOutBizType | string | 否 | 评分业务类型（如 common_sports_second） |
| data.result.dayGameData[].matchData[].scoreItemInfo.scoreOutBizNo | string | 否 | 评分业务号 |
| data.result.dayGameData[].matchData[].customDescInfo | object | 否 | 自定义描述信息（可能为 null） |
| data.result.dayGameData[].matchData[].extraInfo | object | 否 | 扩展信息（可能为 null） |
| data.result.dayGameData[].matchData[].subscribeInfo | object | 否 | 订阅提醒信息 |
| data.result.dayGameData[].matchData[].subscribeInfo.showSubscribe | boolean | 否 | 是否展示订阅入口 |
| data.result.dayGameData[].matchData[].subscribeInfo.didSubscribe | boolean | 否 | 是否已订阅（可能为 null） |
| data.result.dayGameData[].matchData[].subscribeInfo.subScribeTitle | string | 否 | 订阅标题文案 |
| data.result.dayGameData[].matchData[].subscribeInfo.subScribeType | string | 否 | 订阅类型（如 matchNotice） |
| data.result.dayGameData[].matchData[].subscribeInfo.subScribeScene | string | 否 | 订阅场景（如 commonMatchNotice） |
| data.result.dayGameData[].matchData[].subscribeInfo.subScribeBizType | string | 否 | 订阅业务类型（如 commonMatch） |
| data.result.dayGameData[].matchData[].subscribeInfo.subScribeDesc | string | 否 | 订阅描述（如项目名） |
| data.result.dayGameData[].matchData[].lastReqTimeStamp | number | 否 | 最近请求时间戳（毫秒） |
| data.result.dayGameData[].matchData[].liveSourceInfos | array | 否 | 直播源列表（无直播时为空数组） |
| data.result.dayGameData[].matchData[].liveSourceInfos[] | object | 否 | 数组元素 |
| data.result.dayGameData[].matchData[].scoreItemKey | object | 否 | 评分对象 Key，用于关联评分数据 |
| data.result.dayGameData[].matchData[].scoreItemKey.outBizNo | string | 否 | 外部业务号 |
| data.result.dayGameData[].matchData[].scoreItemKey.outBizType | string | 否 | 外部业务类型（如 common_sports_first） |

# Examples

```javascript
window.ColorboxAI.request.match.getTabDetailScheduleList({}).then(res => { if (res.code === 200) { console.log(res.data); } })
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