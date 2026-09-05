---
name: request-football-coachInfo
description: 查看球队主教练的基本资料，包括头像、年龄、国籍、所属球队与常用阵型，用于教练卡片展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.coachInfo(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.football.coachInfo({ teamId }) 调用，严禁直接拼凑网络接口 URL。
- teamId 对应接口参数 newId；type 固定为 team；无需传 oldId。
- 优先从返回数据读取 name、avatar、teamName、formation、nation、encycl 相关展示字段。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| teamId | string | 是 | 球队唯一 ID（接口 newId），例如 "655" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.id | string | 否 | 教练 ID |
| data.name | string | 否 | 教练中文名，例如 安多尼·伊劳拉 |
| data.newsTag | string | 否 | 资讯标签名，例如 安多尼-伊劳拉 |
| data.oldId | string | 否 | 教练旧 ID |
| data.enName | string | 否 | 教练英文名，例如 Andoni Iraola |
| data.avatar | string | 否 | 教练头像 URL |
| data.teamId | number | 否 | 所属球队 ID |
| data.teamLogo | string | 否 | 所属球队队徽 URL |
| data.teamName | string | 否 | 所属球队名称，例如 利物浦 |
| data.age | number | 否 | 年龄 |
| data.nation | string | 否 | 国籍，例如 西班牙 |
| data.nationLogo | string | 否 | 国旗图片 URL |
| data.headerDayBg | string | 否 | 日间头部背景色，例如 #CC2929 |
| data.headerNightBg | string | 否 | 夜间头部背景色 |
| data.headerColor | string | 否 | 头部文字颜色，例如 white |
| data.formation | string | 否 | 常用阵型，例如 4-2-3-1 |
| data.describe | string / null | 否 | 教练简介，可能为 null |
| data.session | string / null | 否 | 执教场次相关信息，可能为 null |
| data.rate | string / number / null | 否 | 评分/胜率相关信息，可能为 null |

# Examples

```javascript
window.ColorboxAI.request.football.coachInfo({ teamId: "655" }).then(res => { if (res.code === 200) { console.log(res.data.name, res.data.formation, res.data.teamName); } })
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