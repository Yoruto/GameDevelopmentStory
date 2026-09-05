---
name: request-basketball-playerInfo
description: 查看篮球球员的基础资料与属性信息，用于球员卡片和详情展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.basketball.playerInfo(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| playerId | string | 是 | 球员唯一ID，例如 "1305275826765299712" |
| leagueType | string | 是 | 联赛类型：CBA 或 NBA |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.player | object | 否 | 球员详细属性集合 |
| data.player.playerId | string | 否 | 球员唯一ID |
| data.player.name | string | 否 | 球员中文名（如 乔丹-米奇） |
| data.player.alias | string | 否 | 球员别名（如 米奇） |
| data.player.teamLinkUrl | string | 否 | 球队详情跳转链接 |
| data.player.teamDayColor | string | 否 | 球队日间主题色（十六进制，无 # 前缀） |
| data.player.teamNightColor | string | 否 | 球队夜间主题色（十六进制，无 # 前缀） |
| data.player.teamLogoLink | string | 否 | 球队队徽图片 URL |
| data.player.age | string | 否 | 年龄（字符串） |
| data.player.lastSeason | string | 否 | 上赛季信息（可能为 null） |
| data.player.wage | string | 否 | 工资（可能为 null） |
| data.player.salary | string | 否 | 薪资（可能为 null） |
| data.player.salaryRank | string | 否 | 薪资排名（可能为 null） |
| data.player.country | string | 否 | 国籍（如 美国） |
| data.player.nativePlace | string | 否 | 籍贯（可能为 null） |
| data.player.sameCountryCount | number | 否 | 同国籍球员数（可能为 null） |
| data.player.sameNativePlaceCount | number | 否 | 同籍贯球员数（可能为 null） |
| data.player.sameCollegeCount | number | 否 | 同大学球员数（可能为 null） |
| data.player.draftRound | number | 否 | NBA 选秀轮次（可能为 null） |
| data.player.draftPick | number | 否 | NBA 选秀顺位（可能为 null） |
| data.player.cbaDraftYear | number | 否 | CBA 选秀年份（可能为 null） |
| data.player.cbaDraftTeamId | string | 否 | CBA 选秀球队ID |
| data.player.cbaDraftRound | number | 否 | CBA 选秀轮次（可能为 null） |
| data.player.cbaDraftPick | number | 否 | CBA 选秀顺位（可能为 null） |
| data.player.contractDetails | string | 否 | NBA 合同详情（可能为 null） |
| data.player.cbaContractDetails | string | 否 | CBA 合同详情（可能为 null） |
| data.player.deathTime | string | 否 | 去世时间（可能为 null） |
| data.player.deathDate | string | 否 | 去世日期（可能为 null） |
| data.player.playerLink | string | 否 | 球员详情跳转链接（可能为 null） |
| data.player.teamName | string | 否 | 当前球队简称（如 青岛） |
| data.player.teamInfoList | array | 否 | 球员所属球队信息列表 |
| data.player.teamInfoList[].teamId | string | 否 | 球队ID |
| data.player.teamInfoList[].leagueType | string | 否 | 联赛类型（如 CBA、NBA） |
| data.player.teamInfoList[].teamName | string | 否 | 球队简称 |
| data.player.teamInfoList[].teamFullName | string | 否 | 球队全称 |
| data.player.teamInfoList[].bbr | string | 否 | 球队 BBR 标识 |
| data.player.teamInfoList[].dayColor | string | 否 | 日间主题色 |
| data.player.teamInfoList[].nightColor | string | 否 | 夜间主题色 |
| data.player.teamInfoList[].shirtNumber | string | 否 | 球衣号码（可能为 null） |
| data.player.teamInfoList[].logoLink | string | 否 | 队徽图片 URL |
| data.player.nbaGdcId | number | 否 | NBA GDC ID（可能为 null） |
| data.player.cbaGdcId | number | 否 | CBA GDC ID（可能为 null） |
| data.player.gid | number | 否 | 内部 gid |
| data.player.info | string | 否 | 额外说明信息（可能为 null） |
| data.player.encyclItemId | number | 否 | 百科词条ID |
| data.player.leaveTeam | boolean | 否 | 是否已离队 |
| data.player.countryPhoto | string | 否 | 国旗图片 URL |
| data.player.eng_name | string | 否 | 英文全名 |
| data.player.first_name | string | 否 | 英文名 |
| data.player.last_name | string | 否 | 英文姓 |
| data.player.nick | string | 否 | 昵称（可能为 null） |
| data.player.photo | string | 否 | 球员头像小图 URL |
| data.player.big_photo | string | 否 | 球员头像大图 URL |
| data.player.number | string | 否 | 球衣号码（如 "55"） |
| data.player.position | string | 否 | 场上位置（如 中锋） |
| data.player.birth_date | string | 否 | 出生日期（如 1994年07月09日） |
| data.player.nba_first_year | number | 否 | NBA 首秀年份（可能为 null） |
| data.player.cba_first_year | number | 否 | CBA 首秀年份 |
| data.player.height | number | 否 | 身高（米，如 2.03） |
| data.player.weight | number | 否 | 体重（公斤，如 107） |
| data.player.draft_year | number | 否 | 选秀年份（可能为 null） |
| data.player.draft_team_id | string | 否 | 选秀球队ID |
| data.player.high_school | string | 否 | 高中（可能为 null） |
| data.player.college_school | string | 否 | 大学（可能为 null） |
| data.player.wingspan | number | 否 | 臂展（可能为 null） |
| data.player.standing_reach | number | 否 | 站立摸高（可能为 null） |
| data.player.territorial_pick | number | 否 | 地区选秀标记 |
| data.player.team_id | string | 否 | 球队ID（可能为 null） |
| data.pageTab | array | 否 | 球员页 Tab 列表 |
| data.pageTab[].title | string | 否 | Tab 标题（如 数据、投篮、生涯） |
| data.pageTab[].pageLink | string | 否 | Tab 路径（如 /data、/shot） |
| data.pageTab[].show | boolean | 否 | 是否展示该 Tab |
| data.tagId | string | 否 | 关联话题标签ID（可能为 null） |
| data.tagName | string | 否 | 关联话题标签名（可能为 null） |
| data.tagViewCount | number | 否 | 话题浏览数（可能为 null） |
| data.tagThreadCount | number | 否 | 话题帖子数（可能为 null） |

# Examples

```javascript
window.ColorboxAI.request.basketball.playerInfo({ playerId: "1305275826765299712", leagueType: "CBA" }).then(res => { if (res.code === 200) { console.log(res.data.player); } })
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