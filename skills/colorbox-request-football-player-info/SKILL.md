---
name: request-football-playerInfo
description: 查看足球球员的基础资料，包括年龄、位置、国籍、俱乐部与身价，用于球员卡片展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.playerInfo(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| playerId | string | 是 | 球员唯一ID，例如 "84899" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.type | string | 否 | 资料类型（如 "player"） |
| data.newId | string | 否 | 球员新ID |
| data.oldId | string | 否 | 球员旧ID |
| data.teamId | string | 否 | 所属俱乐部ID |
| data.teamLogo | string | 否 | 俱乐部队徽图片 URL |
| data.teamName | string | 否 | 俱乐部名称（如 曼城） |
| data.playerId | string | 否 | 球员唯一ID |
| data.name | string | 否 | 球员中文名（如 哈兰德） |
| data.enName | string | 否 | 球员英文名（如 E. B. Håland） |
| data.newsTag | string | 否 | 资讯标签名（如 埃林-布朗特-哈兰德） |
| data.avatar | string | 否 | 球员头像图片 URL |
| data.worth | number | 否 | 球员身价数值 |
| data.currency | string | 否 | 身价货币单位（如 欧元） |
| data.headerDayBg | string | 否 | 日间头图背景色（如 #5C95C5） |
| data.headerNightBg | string | 否 | 夜间头图背景色（如 #5C95C5） |
| data.headerColor | string | 否 | 头图文字颜色（如 white） |
| data.foot | string | 否 | 惯用脚（如 左脚） |
| data.position | string | 否 | 场上位置（如 前锋） |
| data.age | string | 否 | 年龄（字符串，如 "26"） |
| data.height | number | 否 | 身高（厘米） |
| data.weight | number | 否 | 体重（公斤） |
| data.birthday | string | 否 | 生日（如 "2000.07.21"） |
| data.birthdaySeconds | number | 否 | 生日时间戳（秒） |
| data.nationality | string | 否 | 国籍（如 挪威） |
| data.nationLogo | string | 否 | 国旗图片 URL |
| data.shirtNumber | string | 否 | 球衣号码（字符串，如 "9"） |
| data.isGoalKeeper | boolean | 否 | 是否为守门员 |
| data.encyclItemId | string | 否 | 百科条目ID |

# Examples

```javascript
window.ColorboxAI.request.football.playerInfo({ playerId: "84899" }).then(res => { if (res.code === 200) { console.log(res.data.name, res.data.teamName, res.data.position); } })
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