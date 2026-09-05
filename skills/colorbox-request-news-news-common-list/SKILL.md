---
name: request-news-newsCommonList
description: 获取赛事导航页（如 FIFA、NBA、CBA）的新闻列表，支持分页，用于资讯首页展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.news.newsCommonList(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| source | string | 是 | 请求来源标识，默认可传 "nav_category_news" |
| tagCode | string | 是 | 赛事标识 TagCode，如 "fifa" (足球世界杯) 等 |
| newsId | string | 否 | 用于分页的分界新闻ID，上一页返回结果中最后一个新闻的 nid，不传则默认为第一页。 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.newsCommonItems | array | 否 | 首页资讯新闻列表 |
| data.newsCommonItems[].newsType | string | 否 | 列表项类型，固定为 "news_common" |
| data.newsCommonItems[].recommendBaseScore | number / null | 否 | 推荐基础分，可能为 null |
| data.newsCommonItems[].data | object | 否 | 新闻条目详情数据 |
| data.newsCommonItems[].data.newsType | string | 否 | 新闻类型，固定为 "news_common" |
| data.newsCommonItems[].data.newsMarkInfos | array | 否 | 新闻角标列表，可能为空数组 |
| data.newsCommonItems[].data.newsMarkInfos[].text | string | 否 | 标记文案，如 "置顶" |
| data.newsCommonItems[].data.newsMarkInfos[].url | string | 否 | 日间标记图片 URL |
| data.newsCommonItems[].data.newsMarkInfos[].nightUrl | string | 否 | 夜间标记图片 URL |
| data.newsCommonItems[].data.newsMarkInfos[].width | number | 否 | 标记图片宽度 |
| data.newsCommonItems[].data.newsMarkInfos[].height | number | 否 | 标记图片高度 |
| data.newsCommonItems[].data.showHotReply | boolean | 否 | 是否展示热门回复标识 |
| data.newsCommonItems[].data.top | boolean | 否 | 是否置顶 |
| data.newsCommonItems[].data.newsContentLabel | string | 否 | 新闻内容标签，如 "图文新闻"、"跳转新闻-普通" |
| data.newsCommonItems[].data.linkUrl | string | 否 | 跳转链接（kanqiu:// 或 huputiyu:// 协议） |
| data.newsCommonItems[].data.iconInfo | object / null | 否 | 新闻图标信息；无图标时为 null |
| data.newsCommonItems[].data.iconInfo.iconName | string | 否 | 图标名称，如 "置顶"、"热门" |
| data.newsCommonItems[].data.iconInfo.iconUrl | string | 否 | 日间图标 URL |
| data.newsCommonItems[].data.iconInfo.iconNightUrl | string | 否 | 夜间图标 URL |
| data.newsCommonItems[].data.customLabelInfo | object / null | 否 | 自定义标签信息；无标签时为 null |
| data.newsCommonItems[].data.customLabelInfo.labelName | string | 否 | 标签名称，如 "虎扑辩论赛"、"闲谈播客" |
| data.newsCommonItems[].data.newsDescribeInfo | object | 否 | 新闻描述信息（回复数摘要等） |
| data.newsCommonItems[].data.newsDescribeInfo.describeInfo | string | 否 | 描述文案，如 "6 回复"、"JRs热议中" |
| data.newsCommonItems[].data.nid | string | 否 | 新闻 ID，可用于分页游标 |
| data.newsCommonItems[].data.tid | string | 否 | 关联帖子/话题 ID |
| data.newsCommonItems[].data.newsContentType | string | 否 | 内容类型，如 "IMG_TEXT"（图文）、"LINK"（跳转） |
| data.newsCommonItems[].data.title | string | 否 | 新闻标题 |
| data.newsCommonItems[].data.image | string | 否 | 新闻封面图 URL |
| data.newsCommonItems[].data.showComment | number | 否 | 是否展示评论，1 表示展示，0 表示不展示 |
| data.newsCommonItems[].data.replyCount | number | 否 | 回复数 |
| data.newsCommonItems[].data.lightReplyCount | number | 否 | 亮回复数 |
| data.newsCommonItems[].data.publishTime | string | 否 | 发布时间，ISO 8601 格式，如 "2026-07-21T20:18:28.000+08:00" |
| data.ad_page_id | string | 否 | 广告页标识，如 "nba.news" |
| data.reqNo | string | 否 | 本次请求流水号 |

# Examples

```javascript
window.ColorboxAI.request.news.newsCommonList({ source: "nav_category_news", tagCode: "fifa" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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