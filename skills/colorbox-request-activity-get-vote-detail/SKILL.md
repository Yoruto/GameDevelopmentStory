---
name: request-activity-getVoteDetail
description: 查看投票活动的完整信息，包括活动介绍、投票分组与候选选项，用于搭建投票玩法。
---

# Usage

- JS Path: `window.ColorboxAI.request.activity.getVoteDetail(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| activityId | string | 是 | 投票活动唯一ID，例如 "1" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.id | number | 否 | 活动ID |
| data.name | string | 否 | 活动名称 |
| data.startDt | string | 否 | 活动开始时间（如 "2026-07-17 14:50:44"） |
| data.endDt | string | 否 | 活动结束时间（如 "2026-07-19 23:59:59"） |
| data.userRemainVoteNum | number | 否 | 当前用户剩余投票次数 |
| data.promoteOptionCount | number | 否 | 推广/置顶选项数量 |
| data.groups | array | 否 | 投票分组（赛道）列表 |
| data.groups[].id | number | 否 | 分组ID |
| data.groups[].activityId | number | 否 | 所属活动ID |
| data.groups[].name | string | 否 | 分组名称 |
| data.groups[].pic | string | 否 | 分组图片 URL |
| data.groups[].selectedPic | string | 否 | 分组选中态图片 URL |
| data.groups[].voteNum | number / null | 否 | 分组总投票数（可能为 null） |
| data.groups[].userVoteNum | number / null | 否 | 当前用户在该分组的投票数（可能为 null） |
| data.groups[].allowMaxVoteNum | number | 否 | 该分组允许的最大投票数 |
| data.groups[].parentId | number | 否 | 父分组ID，0 表示顶级分组 |
| data.groups[].sort | number | 否 | 排序序号 |
| data.groups[].items | array / null | 否 | 该分组内的候选项列表（可能为 null，候选项通常挂在子分组下） |
| data.groups[].items[].id | number | 否 | 选项ID |
| data.groups[].items[].activityId | number | 否 | 所属活动ID |
| data.groups[].items[].groupId | number | 否 | 所属分组ID |
| data.groups[].items[].name | string | 否 | 选项名称 |
| data.groups[].items[].pic | string | 否 | 选项图片 URL |
| data.groups[].items[].voteNum | number | 否 | 该选项得票数 |
| data.groups[].items[].userVoteNum | number | 否 | 当前用户已投给该选项的票数 |
| data.groups[].items[].allowMaxVoteNum | number | 否 | 该选项允许的最大投票数 |
| data.groups[].items[].itemDesc | string / null | 否 | 选项描述（可能为 null） |
| data.groups[].items[].jumpUrl | string / null | 否 | 选项跳转链接（可能为 null） |
| data.groups[].subGroups | array | 否 | 子分组列表，结构与本分组相同，可继续嵌套 |
| data.status | string | 否 | 活动状态（如 ENDED 已结束、START 进行中） |

# Examples

```javascript
window.ColorboxAI.request.activity.getVoteDetail({ activityId: "1" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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