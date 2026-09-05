---
name: request-basketball-teamSalaryInfo
description: 查看球队薪资帽概览与球员多年薪资明细，用于呈现球队薪资结构与空间。
---

# Usage

- JS Path: `window.ColorboxAI.request.basketball.teamSalaryInfo(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.basketball.teamSalaryInfo({ teamId, leagueType }) 调用，严禁直接拼凑网络接口 URL。
- leagueType 仅支持 nba / cba。
- 优先从 data.salaryGeneralViewPlate 读取总薪资/薪资空间/奢侈税概览；从 data.salaryPlayerTable 读取球员多年薪资；seasonSalaryInfos 与 seasonSalaryHeads 一一对应。
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
| data.projectId | number | 否 | 项目 ID |
| data.version | string | 否 | 接口版本号，例如 7.5.60 |
| data.salaryGeneralViewPlate | array | 否 | 薪资概览板块列表 |
| data.salaryGeneralViewPlate[].leftTitle | string | 否 | 左侧标题，例如 总薪资、需缴纳奢侈税 |
| data.salaryGeneralViewPlate[].title | string | 否 | 卡片标题，例如 总薪资、薪资空间、奢侈税 |
| data.salaryGeneralViewPlate[].value | string | 否 | 卡片主数值，例如 2.421亿、-8747万 |
| data.salaryGeneralViewPlate[].allianceRankingNum | number | 否 | 联盟排名 |
| data.salaryGeneralViewPlate[].allianceRankingUrl | string | 否 | 联盟排名跳转链接 |
| data.salaryGeneralViewPlate[].items | array | 否 | 卡片明细项列表 |
| data.salaryGeneralViewPlate[].items[].name | string | 否 | 明细名称，例如 阵容占据薪资、工资帽 |
| data.salaryGeneralViewPlate[].items[].value | string | 否 | 明细数值文案，例如 2.259亿 |
| data.salaryPlayerTable | object | 否 | 球员多年薪资表 |
| data.salaryPlayerTable.seasonSalaryHeads | array | 否 | 赛季表头列表，例如 2025-26赛季 |
| data.salaryPlayerTable.seasonSalaryHeads[] | string | 否 | 数组元素 |
| data.salaryPlayerTable.items | array | 否 | 球员薪资行列表 |
| data.salaryPlayerTable.items[].playerName | string | 否 | 球员中文名 |
| data.salaryPlayerTable.items[].playerId | string | 否 | 球员唯一 ID |
| data.salaryPlayerTable.items[].playerAvatarUrl | string | 否 | 球员头像 URL |
| data.salaryPlayerTable.items[].age | string | 否 | 年龄文案，例如 29岁 |
| data.salaryPlayerTable.items[].signedUsing | string / null | 否 | 签约条款，可能为 null |
| data.salaryPlayerTable.items[].isOutgoing | boolean / null | 否 | 是否即将离队，可能为 null |
| data.salaryPlayerTable.items[].seasonSalaryInfos | array | 否 | 按 seasonSalaryHeads 顺序排列的各赛季薪资 |
| data.salaryPlayerTable.items[].seasonSalaryInfos[].restrictedType | string / null | 否 | 自由球员限制类型，例如 UFA、RFA；无限制时为 null |
| data.salaryPlayerTable.items[].seasonSalaryInfos[].salaryOption | string / null | 否 | 合同选项说明，例如 球员选项、球队选项、非完全保障；无为 null |
| data.salaryPlayerTable.items[].seasonSalaryInfos[].seasonSalary | string | 否 | 该赛季薪资文案，例如 4639万；无合同为 "-" |
| data.lastModifyDate | string | 否 | 最近修改时间文案，例如 2025年11月03日 18:08 |
| data.lastUpdateDate | string | 否 | 最近更新时间（ISO 字符串） |

# Examples

```javascript
window.ColorboxAI.request.basketball.teamSalaryInfo({ teamId: "1901000000501288", leagueType: "nba" }).then(res => { if (res.code === 200) { console.log(res.data.salaryGeneralViewPlate, res.data.salaryPlayerTable?.items); } })
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