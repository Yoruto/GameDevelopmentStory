---
name: request-football-liveRoomNewsList
description: 获取比赛直播间的图文资讯流，包括标题、封面与互动数据，用于直播间资讯 Tab 展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.football.liveRoomNewsList(params)`

# Constraints

- 业务渲染列表从 res.data.result 读取，分页游标使用上一页 data.result 最后一项的 nid。
- 必须根据返回的 code 判断是否成功；code 等于 200 后再读取 data.result。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| matchId | string | 是 | 比赛唯一 ID，例如 "3512534" |
| newsId | string | 否 | 分页游标，取上一页 data.result 数组最后一项的 nid；首页不传或传 "0" |
| matchType | string | 否 | 赛事类型/业务分类，默认 football；部分通用赛事可传 common_match |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.errorCode | string | 否 | 业务错误码；成功时通常为空字符串 |
| data.errorMsg | string | 否 | 业务错误信息；成功时通常为空字符串 |
| data.result | array | 否 | 足球直播间资讯 Tab 列表 |
| data.result[].nid | string | 否 | 资讯/新闻唯一 ID，分页时可取列表最后一项的该字段作为 newsId |
| data.result[].tid | string | 否 | 关联帖子/话题 ID |
| data.result[].type | string | 否 | 内容展示类型，如 IMG_TEXT、IMAGE_TOP_TEXT_BOTTOM、VIDEO |
| data.result[].title | string | 否 | 资讯标题 |
| data.result[].img | string | 否 | 封面图 URL |
| data.result[].replies | number | 否 | 回复数 |
| data.result[].lights | number | 否 | 亮评/点亮数 |
| data.result[].link | string | 否 | 资讯跳转链接，如 kanqiu://bbs/topic/{tid} |
| data.result[].linkType | string / null | 否 | 链接类型，可能为 null |
| data.result[].badge | array | 否 | 角标列表，可能为空数组 |
| data.result[].badge[] | object | 否 | 角标项 |
| data.result[].publishTime | string | 否 | 发布时间，格式如 "2026-07-21 11:55:43" |
| data.result[].addTime | number | 否 | 添加/发布时间戳，单位秒 |
| data.result[].oldNewsId | string / null | 否 | 旧版新闻 ID，可能为 null |
| data.result[].top | boolean | 否 | 是否置顶 |
| data.result[].pv | number / string / null | 否 | 浏览量/PV，可能为 null |
| data.result[].gifList | array / null | 否 | 动图列表，可能为 null |
| data.result[].gifList[] | object | 否 | 动图项 |
| data.result[].read | string | 否 | 已读标识，通常与 nid 相同 |
| data.result[].showComment | number | 否 | 是否展示评论，1 表示展示，0 表示不展示 |
| data.success | boolean | 否 | 业务是否成功 |
| data.traceId | string / null | 否 | 链路追踪 ID，可能为 null |
| data.hostName | string | 否 | 服务节点主机名 |
| data.msg | string | 否 | 返回消息，成功时可能为空字符串 |
| data.status | number | 否 | 业务状态码，200 表示成功 |

# Examples

```javascript
window.ColorboxAI.request.football.liveRoomNewsList({ matchId: "3512534" }).then(res => { if (res.code === 200) { console.log(res.data.result); } })
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