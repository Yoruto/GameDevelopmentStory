---
name: request-basketball-teamPlayerList
description: 查看篮球球队的当前阵容、球员赛季场均数据以及管理层/教练组信息，用于阵容与球员卡片展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.basketball.teamPlayerList(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.basketball.teamPlayerList({ teamId, leagueType }) 调用，严禁直接拼凑网络接口 URL。
- leagueType 仅支持 nba / cba；未传 competitionType / competitionLeagueType 时默认与 leagueType 一致。
- 优先从 data.list 读取阵容球员；从 data.offical 读取管理层/教练组；从 data.players_stats_glossary 读取数据字段中英文对照。
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
| competitionType | string | 否 | 赛事类型，默认与 leagueType 相同，例如 nba |
| competitionLeagueType | string | 否 | 赛事联赛类型，默认与 leagueType 相同，例如 nba |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.info | object | 否 | 球队基础摘要信息 |
| data.info.teamId | string | 否 | 球队唯一 ID |
| data.info.tid | string / null | 否 | 球队内部 tid，可能为 null |
| data.info.name | string | 否 | 球队简称 |
| data.info.full_name | string | 否 | 球队全称 |
| data.info.en_name | string | 否 | 球队英文缩写/名称 |
| data.info.salary_title | string | 否 | 薪资列标题，例如 薪水(美元) |
| data.info.arena_title | string | 否 | 主场标题文案 |
| data.info.logo_link | string | 否 | 队徽图片 URL |
| data.info.arena | string | 否 | 主场球馆名称 |
| data.info.rank_title | string | 否 | 战绩标题文案 |
| data.list | array | 否 | 球队阵容球员列表 |
| data.list[].playerId | string | 否 | 球员唯一 ID |
| data.list[].homeUrl | string | 否 | 球员详情页 H5 链接 |
| data.list[].player_id | number / null | 否 | 球员内部数字 ID，可能为 null |
| data.list[].player_name | string | 否 | 球员中文名 |
| data.list[].player_header | string | 否 | 球员头像小图 URL |
| data.list[].player_header_big | string | 否 | 球员头像大图 URL |
| data.list[].number | string | 否 | 球衣号码 |
| data.list[].position | string | 否 | 场上位置，例如 后卫、中锋 |
| data.list[].salary | string | 否 | 薪资数值字符串，可能为空 |
| data.list[].salary_str | string | 否 | 薪资展示文案，例如 46394100万 |
| data.list[].is_injured | number | 否 | 是否受伤，0 表示未受伤 |
| data.list[].game_played_start | string | 否 | 出场/首发，例如 18/18 |
| data.list[].min | string | 否 | 场均时间 |
| data.list[].pts | string | 否 | 场均得分 |
| data.list[].reb | string | 否 | 场均篮板 |
| data.list[].asts | string | 否 | 场均助攻 |
| data.list[].fgp | string | 否 | 投篮命中率，例如 45% |
| data.list[].tpp | string | 否 | 三分命中率 |
| data.list[].ftp | string | 否 | 罚球命中率 |
| data.list[].oreb | string | 否 | 场均前板 |
| data.list[].dreb | string | 否 | 场均后板 |
| data.list[].stl | string | 否 | 场均抢断 |
| data.list[].to | string | 否 | 场均失误 |
| data.list[].blk | string | 否 | 场均盖帽 |
| data.list[].pf | string | 否 | 场均犯规 |
| data.offical | array | 否 | 管理层/教练组列表（接口字段名为 offical） |
| data.offical[].id | string | 否 | 人员 ID |
| data.offical[].eng_name | string | 否 | 英文名 |
| data.offical[].name | string | 否 | 中文名 |
| data.offical[].birth_date | string / null | 否 | 出生日期，可能为 null |
| data.offical[].page_link | string | 否 | 详情跳转链接/schema |
| data.offical[].photo | string | 否 | 头像 URL |
| data.offical[].category_name | string | 否 | 职位中文名，例如 主教练、总经理 |
| data.offical[].category | string | 否 | 职位类型，例如 MAIN_COACH、GENERAL_MANAGER、OPERATION_MANAGER |
| data.players_stats_glossary | array | 否 | 球员数据字段中英文对照，通常为 [英文 key 数组, 中文文案数组] |
| data.players_stats_glossary[] | array | 否 | 数组元素 |

# Examples

```javascript
window.ColorboxAI.request.basketball.teamPlayerList({ teamId: "1901000000501288", leagueType: "nba" }).then(res => { if (res.code === 200) { console.log(res.data.list?.length, res.data.list?.[0]?.player_name); } })
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