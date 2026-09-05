---
name: request-match-queryAllDiagramInfoById
description: 查看赛事积分榜与对阵晋级数据，用于展示赛事的排名和晋级形势。
---

# Usage

- JS Path: `window.ColorboxAI.request.match.queryAllDiagramInfoById(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| standingsId | string | 是 | 积分榜ID，例如 "9" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.standingsName | string | 否 | 积分榜名称 |
| data.standingsDesc | string | 否 | 积分榜描述（可能为 null） |
| data.dimensionDetails | array | 否 | 积分榜维度定义列表（表头列） |
| data.dimensionDetails[].dimensionId | number | 否 | 维度ID |
| data.dimensionDetails[].dimensionName | string | 否 | 维度名称（如年龄、国籍、积分、排名变化） |
| data.dimensionDetails[].showPercent | boolean | 否 | 是否以百分比展示 |
| data.dimensionDetails[].sort | number | 否 | 维度展示排序 |
| data.dimensionDetails[].defaultSortField | boolean | 否 | 是否为默认排序字段 |
| data.groupDetails | array | 否 | 积分榜分组列表 |
| data.groupDetails[].groupId | number | 否 | 分组ID |
| data.groupDetails[].groupName | string | 否 | 分组名称 |
| data.groupDetails[].details | array | 否 | 该分组下的成员行列表 |
| data.groupDetails[].details[].memberId | string | 否 | 成员ID |
| data.groupDetails[].details[].memberLandingUrl | string | 否 | 成员跳转链接（如百科页） |
| data.groupDetails[].details[].memberLogo | string | 否 | 成员头像/Logo URL |
| data.groupDetails[].details[].extraMemberId | string | 否 | 附加成员ID（可能为 null） |
| data.groupDetails[].details[].memberName | string | 否 | 成员名称 |
| data.groupDetails[].details[].extraMemberName | string | 否 | 附加成员名称（可能为 null） |
| data.groupDetails[].details[].sort | number | 否 | 排序序号 |
| data.groupDetails[].details[].showSort | string | 否 | 展示用排名文案 |
| data.groupDetails[].details[].dimensionDetails | array | 否 | 该成员各维度的值列表 |
| data.groupDetails[].details[].dimensionDetails[].dimensionId | number | 否 | 维度ID，对应 dimensionDetails 中的维度 |
| data.groupDetails[].details[].dimensionDetails[].dimensionImage | string | 否 | 维度配图 URL（如国旗、排名变化箭头，可能为 null 或空字符串） |
| data.groupDetails[].details[].dimensionDetails[].dimensionValue | string | 否 | 维度展示值 |
| data.groupDetails[].configInfos | array | 否 | 分组配置信息（可能为空数组） |

# Examples

```javascript
window.ColorboxAI.request.match.queryAllDiagramInfoById({ standingsId: "9" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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