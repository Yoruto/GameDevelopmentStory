---
name: request-bbs-detail
description: 查看帖子的标题、正文、作者、话题与互动数据，用于帖子详情页展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.bbs.detail(params)`

# Constraints

- 优先从 data.moduleConfigList.title.moduleContent.title 读取帖子标题；兼容旧版扁平字段 data.title。
- 优先从 data.moduleConfigList.content.moduleContent.content 读取帖子正文 HTML；兼容旧版扁平字段 data.content。
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| tid | string | 是 | 帖子唯一ID，例如 "123456" |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.basicInfo | object | 否 | 帖子基础信息 |
| data.basicInfo.fid | number | 否 | 论坛版块 ID |
| data.basicInfo.topicCategoryName | string | 否 | 话题分类名称 |
| data.basicInfo.author | object | 否 | 作者信息 |
| data.basicInfo.author.puid | number | 否 | 作者 PUID |
| data.basicInfo.author.name | string | 否 | 作者昵称 |
| data.basicInfo.author.nftInfo | object | 否 | NFT 信息 |
| data.basicInfo.author.nftInfo.assetAmount | number / null | 否 | NFT 资产数量，可能为 null |
| data.basicInfo.author.nftInfo.assetCate | string / null | 否 | NFT 资产分类，可能为 null |
| data.basicInfo.author.nftInfo.assetId | string / null | 否 | NFT 资产 ID，可能为 null |
| data.basicInfo.author.nftInfo.assetTitle | string / null | 否 | NFT 资产标题，可能为 null |
| data.basicInfo.author.nftInfo.assetType | string / null | 否 | NFT 资产类型，可能为 null |
| data.basicInfo.author.nftInfo.contentUrl | string / null | 否 | NFT 内容 URL，可能为 null |
| data.basicInfo.author.nftInfo.hasNFT | boolean / null | 否 | 是否拥有 NFT，可能为 null |
| data.basicInfo.author.nftInfo.id | number / string / null | 否 | NFT 记录 ID，可能为 null |
| data.basicInfo.author.nftInfo.ownerPuid | number / null | 否 | NFT 拥有者 PUID，可能为 null |
| data.basicInfo.author.nftInfo.shardId | number / string / null | 否 | NFT 分片 ID，可能为 null |
| data.basicInfo.author.nftInfo.shardNo | number / string / null | 否 | NFT 分片序号，可能为 null |
| data.basicInfo.author.nftInfo.shardUniqueCode | string / null | 否 | NFT 分片唯一编码，可能为 null |
| data.basicInfo.topicName | string | 否 | 话题名称 |
| data.basicInfo.topic_id | number | 否 | 话题 ID |
| data.basicInfo.tid | number | 否 | 帖子 ID |
| data.basicInfo.relation | number | 否 | 当前用户与作者关系状态 |
| data.basicInfo.status | number | 否 | 帖子状态 |
| data.basicInfo.isAuthor | boolean | 否 | 当前用户是否为作者 |
| data.cardList | array | 否 | 帖子卡片列表 |
| data.cardList[] | object | 否 | 帖子卡片项 |
| data.containsAi | number | 否 | 是否包含 AI 内容，0/1 |
| data.containsPodcast | boolean / null | 否 | 是否包含播客，可能为 null |
| data.contentStyleType | number / string / null | 否 | 正文样式类型，可能为 null |
| data.contentType | number | 否 | 内容类型 |
| data.deepTalk | object | 否 | 深聊/问 AI 引导信息 |
| data.deepTalk.guideName | string | 否 | 深聊引导标题 |
| data.deepTalk.guideNameSubtitle | string | 否 | 深聊引导副标题 |
| data.deepTalk.guideOutTime | number | 否 | 引导消失时间，单位秒 |
| data.deepTalk.guideStayTime | number | 否 | 引导停留时间，单位秒 |
| data.deepTalk.iconDay | string | 否 | 日间模式图标 URL |
| data.deepTalk.iconName | string | 否 | 图标名称 |
| data.deepTalk.iconNight | string | 否 | 夜间模式图标 URL |
| data.deepTalk.needShow | boolean | 否 | 是否展示深聊入口 |
| data.deepTalk.replyAiShow | boolean | 否 | 是否展示回复 AI 引导 |
| data.deepTalk.replyGuideName | string | 否 | 回复区 AI 引导文案 |
| data.enableCorrect | number | 否 | 是否开启纠错，0/1 |
| data.giftCacheDtoList | array | 否 | 礼物缓存列表 |
| data.giftCacheDtoList[] | object | 否 | 礼物缓存项 |
| data.guideWords | string / null | 否 | 引导文案，可能为 null |
| data.hcoinThreadDTO | object | 否 | H 币/礼物聚合信息 |
| data.hcoinThreadDTO.detailDtoList | array | 否 | H 币/礼物明细列表 |
| data.hcoinThreadDTO.detailDtoList[] | object | 否 | H 币/礼物明细项 |
| data.hcoinThreadDTO.hcoinReplyDTOMap | object / null | 否 | 回复维度 H 币信息映射，可能为 null |
| data.hcoinThreadDTO.showGiftIconMinCount | number | 否 | 展示礼物图标的最小数量阈值 |
| data.hcoinThreadDTO.tid | number / null | 否 | 帖子 ID，可能为 null |
| data.hcoinThreadDTO.totalCoins | number | 否 | 累计 H 币数量 |
| data.hcoinThreadDTO.totalUsers | number | 否 | 累计参与用户数 |
| data.location | string | 否 | 作者 IP 属地/地理位置，可能为空字符串 |
| data.marketThreadFlag | boolean | 否 | 是否营销帖 |
| data.moduleConfigList | object | 否 | 帖子详情模块配置 |
| data.moduleConfigList.jfb | object | 否 | 九分半模块 |
| data.moduleConfigList.jfb.moduleContent | object / null | 否 | 模块内容，可能为 null |
| data.moduleConfigList.jfb.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.jfb.moduleShow | boolean / null | 否 | 是否展示模块，可能为 null |
| data.moduleConfigList.topic | object | 否 | 话题模块 |
| data.moduleConfigList.topic.moduleContent | object | 否 | 话题模块内容 |
| data.moduleConfigList.topic.moduleContent.tags | array | 否 | 话题标签列表 |
| data.moduleConfigList.topic.moduleContent.tags[].logo | string | 否 | 话题图标 URL |
| data.moduleConfigList.topic.moduleContent.tags[].name | string | 否 | 话题名称 |
| data.moduleConfigList.topic.moduleContent.tags[].topic_category | string | 否 | 话题分类名称 |
| data.moduleConfigList.topic.moduleContent.tags[].topic_id | number | 否 | 话题 ID |
| data.moduleConfigList.topic.moduleContent.tags[].unlight | number | 否 | 话题未点亮/关注状态标识 |
| data.moduleConfigList.topic.moduleContent.tags[].url | string | 否 | 话题跳转链接/Schema |
| data.moduleConfigList.topic.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.topic.moduleShow | boolean | 否 | 是否展示模块 |
| data.moduleConfigList.redpacket | object | 否 | 红包模块 |
| data.moduleConfigList.redpacket.moduleContent | object | 否 | 红包模块内容 |
| data.moduleConfigList.redpacket.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.redpacket.moduleShow | boolean | 否 | 是否展示模块 |
| data.moduleConfigList.title | object | 否 | 标题模块 |
| data.moduleConfigList.title.moduleContent | object | 否 | 标题模块内容 |
| data.moduleConfigList.title.moduleContent.merge_title | string | 否 | 合并标题，可能为空字符串 |
| data.moduleConfigList.title.moduleContent.title | string | 否 | 帖子标题 |
| data.moduleConfigList.title.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.title.moduleShow | boolean | 否 | 是否展示模块 |
| data.moduleConfigList.user | object | 否 | 用户模块 |
| data.moduleConfigList.user.moduleContent | object | 否 | 用户模块内容 |
| data.moduleConfigList.user.moduleContent.enableSendMsg | boolean | 否 | 是否允许私信 |
| data.moduleConfigList.user.moduleContent.header | string | 否 | 用户头像 URL |
| data.moduleConfigList.user.moduleContent.name | string | 否 | 用户昵称 |
| data.moduleConfigList.user.moduleContent.nftInfo | object | 否 | NFT 信息 |
| data.moduleConfigList.user.moduleContent.nftInfo.assetAmount | number / null | 否 | NFT 资产数量，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.assetCate | string / null | 否 | NFT 资产分类，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.assetId | string / null | 否 | NFT 资产 ID，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.assetTitle | string / null | 否 | NFT 资产标题，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.assetType | string / null | 否 | NFT 资产类型，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.contentUrl | string / null | 否 | NFT 内容 URL，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.hasNFT | boolean / null | 否 | 是否拥有 NFT，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.id | number / string / null | 否 | NFT 记录 ID，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.ownerPuid | number / null | 否 | NFT 拥有者 PUID，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.shardId | number / string / null | 否 | NFT 分片 ID，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.shardNo | number / string / null | 否 | NFT 分片序号，可能为 null |
| data.moduleConfigList.user.moduleContent.nftInfo.shardUniqueCode | string / null | 否 | NFT 分片唯一编码，可能为 null |
| data.moduleConfigList.user.moduleContent.ornament | string | 否 | 头像挂件 URL |
| data.moduleConfigList.user.moduleContent.puid | number | 否 | 用户 PUID |
| data.moduleConfigList.user.moduleContent.time | string | 否 | 帖子发布时间展示文案 |
| data.moduleConfigList.user.moduleContent.type | number | 否 | 用户/作者类型 |
| data.moduleConfigList.user.moduleContent.view | number | 否 | 浏览数 |
| data.moduleConfigList.user.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.user.moduleShow | boolean | 否 | 是否展示模块 |
| data.moduleConfigList.content | object | 否 | 正文内容模块 |
| data.moduleConfigList.content.moduleContent | object | 否 | 正文模块内容 |
| data.moduleConfigList.content.moduleContent.content | string | 否 | 帖子正文 HTML 字符串 |
| data.moduleConfigList.content.moduleContent.description | string | 否 | 帖子摘要/描述文案 |
| data.moduleConfigList.content.moduleName | string | 否 | 模块名称 |
| data.moduleConfigList.content.moduleShow | boolean | 否 | 是否展示模块 |
| data.podcastInfo | object / null | 否 | 播客信息，可能为 null |
| data.replies | number | 否 | 回复数 |
| data.searchWords | array | 否 | 正文命中的搜索词/实体词列表 |
| data.searchWords[].extraData | object | 否 | 搜索词扩展数据 |
| data.searchWords[].extraData.itemId | string | 否 | 实体项 ID |
| data.searchWords[].extraData.itemType | string | 否 | 实体项类型 |
| data.searchWords[].fromIndex | number | 否 | 命中词在正文中的起始位置 |
| data.searchWords[].jumpUrl | string | 否 | 点击跳转链接/Schema |
| data.searchWords[].name | string | 否 | 命中词名称 |
| data.searchWords[].toIndex | number | 否 | 命中词在正文中的结束位置 |
| data.tagInfoList | array | 否 | 标签信息列表 |
| data.tagInfoList[] | object | 否 | 标签信息项 |
| data.templateId | number | 否 | 模板 ID |
| data.templateType | number | 否 | 模板类型 |
| data.topicPushingFlag | boolean | 否 | 是否话题推送 |
| data.videoTranscodeState | number / string / null | 否 | 视频转码状态，可能为 null |
| data.video_info | object / null | 否 | 视频信息，可能为 null |
| data.visibleRange | string | 否 | 可见范围，如 ALL_SEE |
| data.title | string | 否 | 兼容旧版扁平字段：帖子标题 |
| data.content | string | 否 | 兼容旧版扁平字段：帖子正文 HTML 字符串 |
| data.author | string | 否 | 兼容旧版扁平字段：作者昵称/账号名称 |
| data.avatar | string | 否 | 兼容旧版扁平字段：作者头像 URL，可能为空字符串 |
| data.replyCount | number | 否 | 兼容旧版扁平字段：回复数量 |
| data.lightReplyCount | number | 否 | 兼容旧版扁平字段：亮评数量 |
| data.recommends | number | 否 | 兼容旧版扁平字段：推荐/点亮数量 |
| data.fid | number / string | 否 | 兼容旧版扁平字段：论坛版块 ID；接口缺失时可能为空字符串 |
| data.forumName | string | 否 | 兼容旧版扁平字段：论坛版块名称，可能为空字符串 |
| success | boolean | 否 | 接口业务是否成功 |

# Examples

```javascript
window.ColorboxAI.request.bbs.detail({ tid: "12345" }).then(res => { if (res.code === 200) { console.log(res.data.moduleConfigList?.title?.moduleContent?.title || res.data.title); } })
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