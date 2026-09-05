---
name: request-news-playerNewsList
description: 获取指定球员的最新资讯，支持翻页加载更多，用于球员资讯流展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.news.playerNewsList(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| playerId | string | 是 | 球员ID，例如 "1901000000473842" (篮球) 或 "30389" (足球) |
| newsId | string | 否 | 用于分页的分界新闻ID，取上一页 data 数组最后一项的 nid，不传则默认为第一页。 |
| page | number | 否 | 当前页码，仅篮球分类分页时有效，不传则默认为第一页。 |
| category | string | 是 | 赛事类别：basketball(篮球) 或 football(足球) |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.data | array | 否 | 新闻资讯列表 |
| data.data[].nid | string | 否 | 新闻唯一 ID，分页游标取列表最后一项的该字段 |
| data.data[].tid | string | 否 | 关联帖子/话题 ID |
| data.data[].type | string | 否 | 内容展示类型，如 IMG_TEXT（图文）、VIDEO（视频）、LINK（跳转） |
| data.data[].title | string | 否 | 新闻标题 |
| data.data[].img | string | 否 | 封面图 URL |
| data.data[].replies | number | 否 | 回复数 |
| data.data[].lights | number | 否 | 亮评数 |
| data.data[].link | string | 否 | 跳转链接，如 kanqiu://bbs/topic/{tid} |
| data.data[].linkType | string / null | 否 | 链接类型；type 为 LINK 时可能为 "POST"，其余多为 null |
| data.data[].badge | array | 否 | 角标列表，可能为空数组 |
| data.data[].badge[] | object | 否 | 数组元素 |
| data.data[].publishTime | string | 否 | 发布时间，格式如 "2026-07-20 17:40:56" |
| data.data[].addTime | number | 否 | 发布时间戳（秒） |
| data.data[].oldNewsId | string / null | 否 | 旧版新闻 ID，可能为 null |
| data.data[].top | boolean | 否 | 是否置顶 |
| data.data[].pv | number / null | 否 | 浏览量，可能为 null |
| data.data[].gifList | array / null | 否 | 动图列表，可能为 null |
| data.data[].gifList[] | object | 否 | 数组元素 |
| data.data[].read | string | 否 | 已读标识，通常与 nid 相同 |
| data.data[].showComment | number | 否 | 是否展示评论，1 表示展示 |
| data.nextPage | number | 否 | 下一页页码；用于篮球分页的 page 参数 |

# Examples

```javascript
window.ColorboxAI.request.news.playerNewsList({ playerId: "1901000000473842", category: "basketball" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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