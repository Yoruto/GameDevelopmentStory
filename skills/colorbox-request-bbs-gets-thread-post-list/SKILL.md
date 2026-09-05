---
name: request-bbs-getsThreadPostList
description: 获取帖子下的评论与回复列表，支持分页和排序，用于评论区展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.bbs.getsThreadPostList(params)`

# Constraints

- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| tid | string | 是 | 帖子唯一ID（thread ID），例如 "640720803" |
| fid | string | 否 | 板块唯一ID（forum ID），例如 "1389" |
| page | number | 否 | 页码，从 1 开始，默认为 1 |
| sort | number | 否 | 排序类型，默认为 0 |
| order | string | 否 | 排序顺序：asc（正序）或 desc（倒序），默认为 "asc" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.list | array | 否 | 回复列表数据 |
| data.list[].pid | string | 否 | 回复唯一ID |
| data.list[].puid | string | 否 | 回复用户唯一ID |
| data.list[].content | string | 否 | 回复内容文本/HTML |
| data.list[].create_time | string | 否 | 回复创建时间戳（秒） |
| data.list[].via | string | 否 | 回复来源/客户端标识 |
| data.list[].attr | object | 否 | 回复属性信息 |
| data.list[].attr.audit_status | string | 否 | 审核状态 |
| data.list[].light_count | number | 否 | 亮评/点赞数 |
| data.list[].allLightCount | number | 否 | 总点亮数 |
| data.list[].ancillaryContents | object / null | 否 | 附属内容信息，可能为空 |
| data.list[].quote_light_count | number | 否 | 被引用回复的点亮数 |
| data.list[].check_reply_info | object | 否 | 查看回复信息 |
| data.list[].check_reply_info.num | number | 否 | 回复数量 |
| data.list[].check_reply_info.type | number | 否 | 回复类型 |
| data.list[].quote | array / null | 否 | 引用回复列表，可能为空 |
| data.list[].quote[].header | array / null | 否 | 引用头部文案数组 |
| data.list[].quote[].header[] | string | 否 | 引用头部文案 |
| data.list[].quote[].content | string | 否 | 引用内容文本/HTML |
| data.list[].quote[].togglecontent | string / null | 否 | 引用内容折叠态文案 |
| data.list[].quote[].pid | string / null | 否 | 被引用回复ID |
| data.list[].quote[].puid | string / null | 否 | 被引用用户唯一ID |
| data.list[].quote[].attr | object / null | 否 | 被引用回复属性信息 |
| data.list[].quote[].attr.audit_status | string | 否 | 审核状态 |
| data.list[].quote[].ancillaryContents | object / null | 否 | 被引用回复附属内容信息，可能为空 |
| data.list[].quote[].containsAi | number / null | 否 | 被引用回复是否包含 AI 内容，0/1 |
| data.list[].smallcontent | string | 否 | 回复内容短文案 |
| data.list[].togglecontent | string | 否 | 回复内容折叠态文案 |
| data.list[].floor | number | 否 | 楼层数 |
| data.list[].time | string | 否 | 友好时间显示，如 "5天前" |
| data.list[].userName | string | 否 | 回复用户昵称 |
| data.list[].userImg | string | 否 | 回复用户头像链接 |
| data.list[].quote_deleted | number | 否 | 引用内容是否已删除，0/1 |
| data.list[].groupid | string / null | 否 | 用户分组 ID，可能为空 |
| data.list[].certuser | object / null | 否 | 认证用户信息，可能为空 |
| data.list[].certurl | string / null | 否 | 认证跳转链接，可能为空 |
| data.list[].cert_info | object / null | 否 | 认证信息，可能为空 |
| data.list[].cert_url | string / null | 否 | 认证链接，可能为空 |
| data.list[].viainfo | object / null | 否 | 来源信息，可能为空 |
| data.list[].badgeOpen | number | 否 | 勋章展示开关，0/1 |
| data.list[].badgeImgUrl | string / null | 否 | 勋章图片链接，可能为空 |
| data.list[].selfRecommend | number | 否 | 是否自荐/自推荐，0/1 |
| data.list[].grantDto | object | 否 | 送礼/赞赏聚合信息 |
| data.list[].grantDto.detailDtoList | array | 否 | 送礼/赞赏明细列表 |
| data.list[].grantDto.detailDtoList[] | object | 否 | 送礼/赞赏明细项 |
| data.list[].grantDto.totalCoins | number | 否 | 累计金币数 |
| data.list[].grantDto.totalUsers | number | 否 | 累计送礼/赞赏用户数 |
| data.list[].grantDto.showGiftIconMinCount | number | 否 | 展示礼物图标的最小数量阈值 |
| data.list[].giftList | array | 否 | 礼物列表 |
| data.list[].giftList[] | object | 否 | 礼物项 |
| data.list[].ornament | string / null | 否 | 头像挂件/装饰图片链接，可能为空 |
| data.list[].badge | string / null | 否 | 勋章图片链接，可能为空 |
| data.list[].badgeName | string / null | 否 | 勋章名称，可能为空 |
| data.list[].badgeBgImg | string / null | 否 | 勋章背景图链接，可能为空 |
| data.list[].badgeForwardUrl | string / null | 否 | 勋章跳转链接，可能为空 |
| data.list[].adminsInfo | object / null | 否 | 管理员信息，可能为空 |
| data.list[].location | string | 否 | 回复用户IP属地 |
| data.list[].nftInfo | object / null | 否 | NFT 信息，可能为空 |
| data.list[].vipInfo | object / null | 否 | 会员信息，可能为空 |
| data.list[].containsAi | number | 否 | 回复是否包含 AI 内容，0/1 |
| data.list[].deepTalkReply | boolean | 否 | 是否深度讨论回复 |
| data.all_page | number | 否 | 总页数 |
| data.ad_page_id | string | 否 | 广告页标识 |
| data.firstReply | object / null | 否 | 首条回复信息，可能为空 |
| data.issueFirstReplyHCoin | boolean | 否 | 是否发放首评 H 币 |
| data.extInfo | object / null | 否 | 扩展信息，可能为空 |

# Examples

```javascript
window.ColorboxAI.request.bbs.getsThreadPostList({ tid: "640720803", page: 1 }).then(res => { if (res.code === 200) { console.log(res.data); } })
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