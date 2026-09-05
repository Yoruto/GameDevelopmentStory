---
name: request-news-subjectNews
description: 获取专题（Subject）下的关联新闻列表，用于专题页资讯展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.news.subjectNews(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| newsId | string | 是 | 新闻帖唯一ID，例如 "22224850" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.nid | string | 否 | 专题 ID |
| data.signboard | string | 否 | 专题标识文案，如 "专题" |
| data.title | string | 否 | 专题标题 |
| data.img | string | 否 | 专题封面图 URL |
| data.replies | number | 否 | 专题总评论数 |
| data.lights | number | 否 | 专题总亮评/点赞数 |
| data.newsCount | number | 否 | 专题关联新闻总数 |
| data.groups | array | 否 | 按场次/主题划分的新闻分组列表 |
| data.groups[].orderBy | string | 否 | 分组排序序号，如 "1" |
| data.groups[].title | string | 否 | 分组标题，如 "奇才92-88爵士" |
| data.groups[].news | array | 否 | 该分组下的新闻列表 |
| data.groups[].news[].nid | string | 否 | 新闻 ID |
| data.groups[].news[].tid | string | 否 | 帖子/话题 ID |
| data.groups[].news[].type | string | 否 | 新闻类型，如 "IMG_TEXT" |
| data.groups[].news[].title | string | 否 | 新闻标题 |
| data.groups[].news[].img | string | 否 | 封面图 URL |
| data.groups[].news[].replies | number | 否 | 评论数 |
| data.groups[].news[].lights | number | 否 | 亮评/点赞数 |
| data.groups[].news[].link | string | 否 | 跳转链接（如 kanqiu://bbs/topic/...） |
| data.groups[].news[].linkType | string / null | 否 | 链接类型（可能为 null） |
| data.groups[].news[].badge | array | 否 | 角标列表 |
| data.groups[].news[].badge[] | object | 否 | 数组元素 |
| data.groups[].news[].publishTime | string | 否 | 发布时间，如 "2026-07-10 11:08:58" |
| data.groups[].news[].addTime | number | 否 | 添加时间戳 |
| data.groups[].news[].oldNewsId | string | 否 | 旧新闻 ID |
| data.groups[].news[].top | boolean | 否 | 是否置顶 |
| data.groups[].news[].pv | number / null | 否 | 阅读量（可能为 null） |
| data.groups[].news[].gifList | array / null | 否 | GIF 列表（可能为 null） |
| data.groups[].news[].read | string | 否 | 已读标识，通常与 nid 相同 |
| data.groups[].news[].showComment | number | 否 | 是否展示评论，1 表示展示 |
| data.share | object | 否 | 分享信息 |
| data.share.url | string | 否 | 分享落地页 URL |
| data.share.summary | string | 否 | 分享摘要 |
| data.share.img | string | 否 | 分享图片 URL |
| data.share.title | string | 否 | 分享标题 |

# Examples

```javascript
window.ColorboxAI.request.news.subjectNews({ newsId: "22224850" }).then(res => { if (res.code === 200) { console.log(res.data); } })
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