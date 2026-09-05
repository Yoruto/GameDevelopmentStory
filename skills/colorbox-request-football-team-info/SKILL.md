---
name: request-football-teamInfo
description: 获取球队主页的基础资料，包括队名、队徽、身价、主场与专区入口，用于搭建球队主题页。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.teamInfo(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.football.teamInfo({ teamId }) 调用，严禁直接拼凑网络接口 URL。
- teamId 对应接口参数 newId；type 固定为 team。
- 优先从返回数据读取 name、logo、worth、arena、encyclItemId、prefectureName 等字段。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| teamId | string | 是 | 球队唯一 ID（接口 newId），例如 "910" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.type | string | 否 | 资料类型，固定为 team |
| data.newId | string | 否 | 球队新 ID |
| data.oldId | string | 否 | 球队旧 ID |
| data.teamId | string | 否 | 球队 ID，通常与 newId 相同 |
| data.name | string | 否 | 球队中文名，例如 阿森纳 |
| data.enName | string | 否 | 球队英文名，例如 Arsenal |
| data.logo | string | 否 | 队徽图片 URL |
| data.worth | number | 否 | 球队身价数值 |
| data.currency | string | 否 | 身价货币单位，例如 欧元 |
| data.prefectureId | number | 否 | 专区 ID |
| data.prefectureName | string | 否 | 专区名称，例如 阿森纳专区 |
| data.prefectureJrNumber | number | 否 | 专区关注/JRS 人数 |
| data.prefectureLogo | string | 否 | 专区 Logo URL |
| data.headerDayBg | string | 否 | 日间头部背景色，例如 #CC2929 |
| data.headerNightBg | string | 否 | 夜间头部背景色 |
| data.headerColor | string | 否 | 头部文字颜色，例如 white |
| data.headerImg | string / null | 否 | 头部背景图，可能为 null |
| data.address | string | 否 | 球队所在地，例如 英格兰 伦敦 |
| data.officialWeb | string | 否 | 官网地址 |
| data.arena | string | 否 | 主场球馆名称 |
| data.capacity | number | 否 | 主场容量 |
| data.year | number | 否 | 建队年份 |
| data.isNational | boolean | 否 | 是否国家队 |
| data.fifaRank | number / null | 否 | FIFA 排名，可能为 null |
| data.isFollowTeam | boolean | 否 | 当前用户是否已关注该球队 |
| data.encyclItemId | number | 否 | 关联评分百科对象 ID |

# Examples

```javascript
window.ColorboxAI.request.football.teamInfo({ teamId: "910" }).then(res => { if (res.code === 200) { console.log(res.data.name, res.data.logo, res.data.worth); } })
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