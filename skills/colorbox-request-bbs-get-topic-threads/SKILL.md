---
name: request-bbs-getTopicThreads
description: 查看论坛专区或话题下的最新帖子，用于话题广场与专区内容流。
---

# Usage

- JS Path: `window.ColorboxAI.request.bbs.getTopicThreads(params)`

# Constraints

- 接口原始信封中的 code/internalCode/msg/success 会由 ColorboxAI 标准化为 code/message；业务渲染字段从 res.data 读取。
- 分页加载结束判定：当返回数据中的 nextPage 字段为 false 时，代表没有更多数据；下一页游标使用 cursor 传给 lastCursor。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| topic_id | string | 是 | 专区/话题唯一 ID，例如 "85" |
| tab_type | number | 否 | Tab 类型，如 2 代表最新回复，默认 2 |
| page | number | 否 | 页码，从 1 开始，默认为 1 |
| stamp | number | 否 | 时间戳，默认为 0 |
| lastCursor | string | 否 | 最后一项游标，用于分页 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.nextPage | boolean | 否 | 是否还有下一页；false 表示没有更多数据 |
| data.next_page | number | 否 | 兼容旧分页字段；优先使用 nextPage 判断是否还有更多数据 |
| data.stamp | number / null | 否 | 分页时间戳/服务端返回的列表标记，可能为 null |
| data.total | number / null | 否 | 总数，接口可能返回 null |
| data.list | array | 否 | 帖子列表数据 |
| data.list[].tid | number | 否 | 帖子唯一 ID |
| data.list[].title | string | 否 | 帖子标题 |
| data.list[].summary | string | 否 | 帖子摘要/正文截断内容，可能为空字符串 |
| data.list[].puid | number | 否 | 发帖人 PUID |
| data.list[].fid | number | 否 | 论坛版块 ID |
| data.list[].replies | number | 否 | 回复数 |
| data.list[].repliesDesc | string / null | 否 | 回复数展示文案，可能为 null |
| data.list[].userName | string | 否 | 发帖人昵称 |
| data.list[].userHeader | string | 否 | 发帖人头像 URL |
| data.list[].time | string | 否 | 帖子展示时间，如 "07-19" |
| data.list[].createTime | number | 否 | 发帖时间戳 |
| data.list[].lastPostTime | number | 否 | 最后回复/更新时间戳 |
| data.list[].recommendCount | number | 否 | 推荐/亮了数量 |
| data.list[].shareNum | number | 否 | 分享数 |
| data.list[].topicId | number | 否 | 帖子所属话题/专区 ID |
| data.list[].topicName | string | 否 | 帖子所属话题/专区名称 |
| data.list[].topicIcon | string | 否 | 帖子所属话题/专区图标 URL |
| data.list[].topThread | boolean | 否 | 是否置顶帖 |
| data.list[].specialIdentifyPics | string / null | 否 | 特殊标识图片 URL，可能为 null |
| data.list[].nightSpecialIdentifyPics | string / null | 否 | 夜间模式特殊标识图片 URL，可能为 null |
| data.list[].specialIdentifyPicsWidth | number / null | 否 | 特殊标识图片宽度，可能为 null |
| data.list[].specialIdentifyPicsHeight | number / null | 否 | 特殊标识图片高度，可能为 null |
| data.list[].videoThread | boolean | 否 | 是否视频帖 |
| data.list[].jumpUrl | string | 否 | 帖子跳转 Schema/链接 |
| data.list[].video | object / null | 否 | 视频信息；非视频帖为 null |
| data.list[].video.duration | number | 否 | 视频时长，单位秒 |
| data.list[].video.vid | number | 否 | 视频 ID |
| data.list[].video.img | string | 否 | 视频封面 URL |
| data.list[].video.size | number | 否 | 视频大小，单位字节 |
| data.list[].video.width | number | 否 | 视频宽度 |
| data.list[].video.play_num | number | 否 | 播放数 |
| data.list[].video.url | string | 否 | 视频播放 URL |
| data.list[].video.bullet_comment_num | number | 否 | 弹幕数 |
| data.list[].video.height | number | 否 | 视频高度 |
| data.list[].video.humanDuration | string | 否 | 格式化视频时长，如 "4:04" |
| data.list[].video.humanSize | string | 否 | 格式化视频大小，如 "29MB" |
| data.list[].picList | array | 否 | 图片列表 |
| data.list[].picList[].url | string | 否 | 图片 URL |
| data.list[].picList[].is_gif | number | 否 | 是否 GIF，0 表示否，1 表示是 |
| data.list[].picList[].width | number | 否 | 图片宽度 |
| data.list[].picList[].height | number | 否 | 图片高度 |
| data.list[].picList[].type | string | 否 | 图片类型，如 common |
| data.list[].picList[].videoUrl | string / null | 否 | 图片关联视频 URL，可能为 null |
| data.list[].containPic | boolean | 否 | 是否包含图片 |
| data.list[].lightReplyResult | object / null | 否 | 亮评信息；无亮评时为 null |
| data.list[].lightReplyResult.lightReplyData | object | 否 | 亮评内容 |
| data.list[].lightReplyResult.lightReplyData.pid | number | 否 | 亮评回复 ID |
| data.list[].lightReplyResult.lightReplyData.tid | number | 否 | 亮评所属帖子 ID |
| data.list[].lightReplyResult.lightReplyData.aid | number / null | 否 | 亮评 aid，可能为 null |
| data.list[].lightReplyResult.lightReplyData.puid | number | 否 | 亮评用户 PUID |
| data.list[].lightReplyResult.lightReplyData.username | string | 否 | 亮评用户昵称 |
| data.list[].lightReplyResult.lightReplyData.user_ip | string | 否 | 亮评用户 IP |
| data.list[].lightReplyResult.lightReplyData.via | number | 否 | 亮评来源端标识 |
| data.list[].lightReplyResult.lightReplyData.content | string | 否 | 亮评内容 |
| data.list[].lightReplyResult.lightReplyData.quote | object / null | 否 | 引用回复信息；无引用时为 null |
| data.list[].lightReplyResult.lightReplyData.quote.rerferInfo | object | 否 | 被引用用户信息（接口字段名为 rerferInfo） |
| data.list[].lightReplyResult.lightReplyData.quote.rerferInfo.username | string | 否 | 被引用用户昵称 |
| data.list[].lightReplyResult.lightReplyData.quote.rerferInfo.puid | number | 否 | 被引用用户 PUID |
| data.list[].lightReplyResult.lightReplyData.quote.content | string | 否 | 被引用回复内容 |
| data.list[].lightReplyResult.lightReplyData.quote.togglecontent | string / null | 否 | 折叠/展开内容，可能为 null |
| data.list[].lightReplyResult.lightReplyData.quote.attr | string | 否 | 引用回复扩展属性序列化字符串 |
| data.list[].lightReplyResult.lightReplyData.quote.videoInfo | object / null | 否 | 引用回复视频信息，可能为 null |
| data.list[].lightReplyResult.lightReplyData.quote.ancillaryContents | array / null | 否 | 引用回复附属内容，可能为 null |
| data.list[].lightReplyResult.lightReplyData.quote.pid | number | 否 | 被引用回复 ID |
| data.list[].lightReplyResult.lightReplyData.create_time | number | 否 | 亮评创建时间戳 |
| data.list[].lightReplyResult.lightReplyData.update_info | string | 否 | 亮评更新信息 |
| data.list[].lightReplyResult.lightReplyData.attr | string | 否 | 亮评扩展属性序列化字符串 |
| data.list[].lightReplyResult.lightReplyData.score | number | 否 | 亮评分数 |
| data.list[].lightReplyResult.lightReplyData.checkReplyInfo | object | 否 | 亮评检查/回复状态信息 |
| data.list[].lightReplyResult.lightReplyData.checkReplyInfo.type | number | 否 | 状态类型 |
| data.list[].lightReplyResult.lightReplyData.checkReplyInfo.num | number | 否 | 状态数量 |
| data.list[].lightReplyResult.lightReplyData.light_count | number | 否 | 亮了数量 |
| data.list[].lightReplyResult.lightReplyData.allLightCount | number | 否 | 总亮了数量 |
| data.list[].lightReplyResult.lightReplyData.videoInfo | object / null | 否 | 亮评视频信息，可能为 null |
| data.list[].lightReplyResult.lightReplyData.header | string | 否 | 亮评用户头像 URL |
| data.list[].lightReplyResult.lightReplyData.header_big | string | 否 | 亮评用户大头像 URL |
| data.list[].lightReplyResult.lightReplyData.header_small | string | 否 | 亮评用户小头像 URL |
| data.list[].lightReplyResult.lightReplyData.groupId | number | 否 | 用户组 ID |
| data.list[].lightReplyResult.lightReplyData.picInfos | array | 否 | 亮评图片信息列表 |
| data.list[].lightReplyResult.lightReplyData.ancillaryContents | array / null | 否 | 亮评附属内容，可能为 null |
| data.list[].lightReplyResult.total | number | 否 | 亮评总数 |
| data.list[].timeFormatter | string / null | 否 | 时间格式化结果，可能为 null |
| data.list[].contentType | number | 否 | 内容类型 |
| data.list[].voteThread | boolean | 否 | 是否投票帖 |
| data.list[].voteIdList | array | 否 | 投票 ID 列表 |
| data.list[].voteList | array / null | 否 | 投票信息列表，可能为 null |
| data.list[].showIcon | string / null | 否 | 展示图标 URL，可能为 null |
| data.list[].showIconNight | string / null | 否 | 夜间模式展示图标 URL，可能为 null |
| data.list[].certIconUrl | string / null | 否 | 认证图标 URL，可能为 null |
| data.list[].certTitle | string / null | 否 | 认证标题，可能为 null |
| data.list[].filterWords | array / null | 否 | 过滤词列表，可能为 null |
| data.list[].containsPodcast | boolean / null | 否 | 是否包含播客，可能为 null |
| data.list[].podcastInfo | object / null | 否 | 播客信息，可能为 null |
| data.list[].isDraw | boolean | 否 | 是否抽奖帖 |
| data.cursor | string | 否 | 下一页请求游标，加载更多时传给 lastCursor |

# Examples

```javascript
window.ColorboxAI.request.bbs.getTopicThreads({ topic_id: "85", page: 1 }).then(res => { if (res.code === 200) { console.log(res.data); } })
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