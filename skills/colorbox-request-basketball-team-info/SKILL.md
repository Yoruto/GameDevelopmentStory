---
name: request-basketball-teamInfo
description: 获取球队主页的基础资料，包括队名、队徽、主题色、主场与专区入口，用于搭建球队主题页。
---

# Usage

- JS Path: `window.ColorboxAI.request.basketball.teamInfo(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.basketball.teamInfo({ teamId, leagueType }) 调用，严禁直接拼凑网络接口 URL。
- leagueType 仅支持 nba / cba。
- 优先从 data.info 读取队名、队徽、主题色；从 data.thread 读取专区信息；从 data.encyclItemId 读取百科对象 ID。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| teamId | string | 是 | 球队唯一 ID，例如 "1901000000501288" |
| leagueType | string | 是 | 联赛类型：nba 或 cba（大小写均可） |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.info | object | 否 | 球队基础 Header 信息 |
| data.info.tid | string | 否 | 球队内部 tid，例如 "10" |
| data.info.teamId | string | 否 | 球队唯一 ID |
| data.info.name | string | 否 | 球队简称，例如 骑士 |
| data.info.full_name | string | 否 | 球队全称，例如 克里夫兰骑士 |
| data.info.en_name | string | 否 | 球队英文名，例如 Cavaliers |
| data.info.arena | string | 否 | 主场球馆名称 |
| data.info.background | string / null | 否 | 背景图，可能为 null |
| data.info.dayColor | string | 否 | 日间主题色（十六进制，无 # 前缀） |
| data.info.nightColor | string | 否 | 夜间主题色（十六进制，无 # 前缀） |
| data.info.rank | string / number / null | 否 | 排名，可能为 null |
| data.info.wins | number / null | 否 | 胜场，可能为 null |
| data.info.losses | number / null | 否 | 负场，可能为 null |
| data.info.homeWins | number / null | 否 | 主场胜场，可能为 null |
| data.info.homeLosses | number / null | 否 | 主场负场，可能为 null |
| data.info.awayWins | number / null | 否 | 客场胜场，可能为 null |
| data.info.awayLosses | number / null | 否 | 客场负场，可能为 null |
| data.info.area | string / null | 否 | 赛区，可能为 null |
| data.info.logoLink | string | 否 | 队徽图片 URL |
| data.info.teamLinkUrl | string | 否 | 球队详情跳转 schema |
| data.thread | object | 否 | 球队专区信息 |
| data.thread.name | string | 否 | 专区名称，例如 骑士专区 |
| data.thread.bbs_tid | number | 否 | 论坛专区 tid |
| data.thread.bbs_tpid | number | 否 | 论坛话题/版块 tpid |
| data.thread.followedUserNum | number | 否 | 专区关注人数 |
| data.is_follow | number | 否 | 当前用户是否已关注，1 表示已关注，0 表示未关注 |
| data.team_tab | string | 否 | 数据 Tab 文案 |
| data.team_tab_url | string | 否 | 数据 Tab 跳转链接 |
| data.salary_tab | string | 否 | 薪资 Tab 文案 |
| data.salary_tab_show | boolean | 否 | 是否展示薪资 Tab |
| data.salary_tab_url | string / null | 否 | 薪资 Tab 跳转链接，可能为 null |
| data.history_tab | string | 否 | 资料 Tab 文案 |
| data.history_tab_show | boolean | 否 | 是否展示资料 Tab |
| data.history_tab_url | string / null | 否 | 资料 Tab 跳转链接，可能为 null |
| data.season_tab | string | 否 | 赛季 Tab 文案 |
| data.season_tab_show | boolean | 否 | 是否展示赛季 Tab |
| data.season_tab_url | string / null | 否 | 赛季 Tab 跳转链接，可能为 null |
| data.encyclItemId | number | 否 | 关联评分百科对象 ID |

# Examples

```javascript
window.ColorboxAI.request.basketball.teamInfo({ teamId: "1901000000501288", leagueType: "nba" }).then(res => { if (res.code === 200) { console.log(res.data.info?.name, res.data.info?.logoLink); } })
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