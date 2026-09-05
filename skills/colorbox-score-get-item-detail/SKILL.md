---
name: score-getItemDetail
description: 查看评分对象的完整资料，包括基础信息、评分数据、页面资源与相关梗内容，用于搭建百科详情页。
---

# Usage

- JS Path: `window.ColorboxAI.score.getItemDetail(params)`

# Constraints

- 必须通过 window.ColorboxAI.score.getItemDetail({ itemId }) 调用，严禁直接手写接口 URL 或自行拼接 bridge。
- 仅支持虎扑 App 环境（Native Bridge）；纯 Web 环境不可用。
- itemId 必填，对应评分百科对象唯一 ID。
- 优先从 data.detail 读取名称、评分均值、是否可评分/可评论、封面图；从 data.pageResource 读取分享与跳转链接；从 data.topComponents / data.tabConfigs 读取页面模块配置。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| itemId | string | 是 | 评分百科对象 ID，例如 "382586"（也可传数字，会按字符串处理） |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码。200 表示成功，401 表示未登录，404 表示内容不存在，500 表示服务器错误 |
| message | string | 是 | 错误提示信息。当 code 不等于 200 时必须用于向用户友好提示 |
| data | object | 否 | 成功时返回的数据载荷 |
| data.detail | object | 否 | 评分对象详情主体 |
| data.detail.image | array | 否 | 封面图片 URL 列表 |
| data.detail.image[] | string | 否 | 数组元素 |
| data.detail.imageShape | string | 否 | 图片形状，例如 square |
| data.detail.imageSize | string | 否 | 图片尺寸标识，例如 pics_1x1 |
| data.detail.minScoreUserCountLimit | number | 否 | 展示评分所需的最小打分人数阈值 |
| data.detail.bizId | string | 否 | 业务对象 ID |
| data.detail.bizType | string | 否 | 业务类型，例如 encycl_item |
| data.detail.name | string | 否 | 对象名称 |
| data.detail.infoJson | object | 否 | 扩展信息 JSON，值多为字符串数组形式 |
| data.detail.scorePersonCount | number | 否 | 参与打分的人数 |
| data.detail.commentCount | number | 否 | 评论数 |
| data.detail.summedScorePersonCount | number | 否 | 累计打分人数 |
| data.detail.totalScore | number | 否 | 总分值 |
| data.detail.scoreAvg | number | 否 | 平均评分分值 |
| data.detail.scoreDistribution | object | 否 | 评分分布，键为分值，值为对应人数 |
| data.detail.scoreSummaryTrend | object / null | 否 | 评分汇总趋势，可能为 null |
| data.detail.scoreTabLocate | string / null | 否 | 评分 Tab 默认定位，可能为 null |
| data.detail.hottestComments | array | 否 | 最热评论文本列表 |
| data.detail.hottestComments[] | string | 否 | 数组元素 |
| data.detail.hotCommentModels | array | 否 | 热门评论模型列表 |
| data.detail.hotCommentModels[].commentUserId | number | 否 | 评论用户 ID |
| data.detail.hotCommentModels[].commentUserHeadImg | string | 否 | 评论用户头像 URL |
| data.detail.hotCommentModels[].commentUserName | string | 否 | 评论用户昵称 |
| data.detail.hotCommentModels[].commentContent | string | 否 | 评论内容 |
| data.detail.hotCommentModels[].commentId | string | 否 | 评论 ID |
| data.detail.hotCommentModels[].subjectId | string | 否 | 主题/帖子 ID |
| data.detail.hotCommentModels[].ancillaryContents | array | 否 | 评论附属内容 |
| data.detail.hotCommentModels[].ancillaryContents[] | object | 否 | 数组元素 |
| data.detail.hotCommentModels[].lightCount | number | 否 | 点亮/点赞数 |
| data.detail.hotCommentModels[].score | number | 否 | 该评论用户给出的评分 |
| data.detail.hotCommentModels[].parentCommentUserId | number / null | 否 | 父评论用户 ID，可能为 null |
| data.detail.hotCommentModels[].parentCommentUserName | string / null | 否 | 父评论用户昵称，可能为 null |
| data.detail.hotCommentModels[].parentCommentContent | string / null | 否 | 父评论内容，可能为 null |
| data.detail.hotCommentModels[].parentAncillaryContents | array / null | 否 | 父评论附属内容，可能为 null |
| data.detail.userScore | number | 否 | 当前登录用户打的分数，未打分为 0 |
| data.detail.status | number | 否 | 状态码 |
| data.detail.parentBizKeys | array | 否 | 父业务标识列表 |
| data.detail.parentBizKeys[] | string | 否 | 数组元素 |
| data.detail.canScore | boolean | 否 | 是否可评分 |
| data.detail.canComment | boolean | 否 | 是否可评论 |
| data.detail.showScore | boolean | 否 | 是否展示评分 |
| data.detail.exceedThreshold | boolean | 否 | 是否已超过评分展示阈值 |
| data.detail.bgColor | string | 否 | 背景色（十六进制） |
| data.detail.maskColor | string | 否 | 蒙层颜色（十六进制含透明度） |
| data.detail.scoreItemAttributes | object | 否 | 评分项属性配置 |
| data.detail.del | number | 否 | 是否删除，0 表示未删除 |
| data.detail.finalStatus | string | 否 | 最终审核状态，例如 PASS |
| data.detail.scoreItemNodeId | array | 否 | 评分项节点 ID 列表 |
| data.detail.scoreItemNodeId[] | number | 否 | 数组元素 |
| data.detail.createDt | string | 否 | 创建时间（ISO 时间字符串） |
| data.detail.uniqueItem | boolean | 否 | 是否唯一评分项 |
| data.detail.ipLocation | string | 否 | IP 归属地 |
| data.detail.publishTime | string | 否 | 发布时间 |
| data.detail.scoreColorDay | string | 否 | 日间模式评分颜色 |
| data.detail.scoreColorNight | string | 否 | 夜间模式评分颜色 |
| data.detail.scoreValueHighlight | boolean | 否 | 评分值是否高亮 |
| data.detail.relatedModelList | array | 否 | 关联模型列表 |
| data.detail.relatedModelList[] | object | 否 | 数组元素 |
| data.detail.bindTagThread | boolean | 否 | 是否绑定标签帖子 |
| data.detail.textLink | string / null | 否 | 文本链接，可能为 null |
| data.detail.itemId | number | 否 | 评分百科对象 ID |
| data.detail.itemType | string | 否 | 对象类型，例如 normal |
| data.detail.memeSubjectItem | array | 否 | 梗主题关联项 |
| data.detail.memeSubjectItem[] | object | 否 | 数组元素 |
| data.detail.hotStatements | array | 否 | 热门短评/观点列表 |
| data.detail.hotStatements[] | object | 否 | 数组元素 |
| data.detail.relatedInfo | object / null | 否 | 关联信息，可能为 null |
| data.pageResource | object | 否 | 页面资源与跳转链接配置 |
| data.pageResource.headerBgColorDay | string | 否 | 日间头部背景色 |
| data.pageResource.headerBgColorNight | string | 否 | 夜间头部背景色 |
| data.pageResource.titleColorDay | string | 否 | 日间标题颜色 |
| data.pageResource.titleColorNight | string | 否 | 夜间标题颜色 |
| data.pageResource.descColorDay | string | 否 | 日间描述颜色 |
| data.pageResource.descColorNight | string | 否 | 夜间描述颜色 |
| data.pageResource.pageCanShare | boolean | 否 | 页面是否可分享 |
| data.pageResource.commentCanShare | boolean | 否 | 评论是否可分享 |
| data.pageResource.showSearchButton | boolean | 否 | 是否展示搜索按钮 |
| data.pageResource.searchSchema | string / null | 否 | 搜索页跳转 schema，可能为 null |
| data.pageResource.shareUrl | string | 否 | 分享链接 |
| data.pageResource.scoreCommunityGuidelinesUrl | string | 否 | 评分社区公约链接 |
| data.pageResource.commentManagementUrl | string | 否 | 评论管理跳转 schema |
| data.pageResource.scoreEditUrl | string | 否 | 评分编辑跳转 schema |
| data.topComponents | array | 否 | 顶部组件列表（如梗列表 MEME_LIST） |
| data.topComponents[].id | string | 否 | 组件 ID，例如 MEME_LIST_0 |
| data.topComponents[].name | string | 否 | 组件名称，例如 梗列表 |
| data.topComponents[].index | number | 否 | 组件排序 |
| data.topComponents[].componentType | string | 否 | 组件类型，例如 MEME_LIST |
| data.topComponents[].config | object | 否 | 组件配置 |
| data.topComponents[].config.params | object | 否 | 组件请求参数，例如 itemId、pageSize |
| data.topComponents[].config.data | array | 否 | 组件数据列表 |
| data.topComponents[].config.data[].itemId | number | 否 | 梗对象 itemId |
| data.topComponents[].config.data[].bizType | string | 否 | 业务类型，例如 encycl_item |
| data.topComponents[].config.data[].bizId | string | 否 | 业务对象 ID |
| data.topComponents[].config.data[].name | string | 否 | 梗名称 |
| data.topComponents[].config.data[].desc | string | 否 | 梗描述文案 |
| data.topComponents[].config.data[].schema | string | 否 | 跳转 schema，例如 huputiyu://score/wiki?itemId=... |
| data.topComponents[].config.data[].hotCommentModels | array | 否 | 梗相关热评 |
| data.topComponents[].config.data[].hotCommentModels[] | object | 否 | 数组元素 |
| data.topComponents[].config.data[].image | array / null | 否 | 封面图列表，可能为 null |
| data.topComponents[].config.data[].image[] | string | 否 | 数组元素 |
| data.topComponents[].config.data[].videoDetail | object / null | 否 | 视频详情，可能为 null |
| data.topComponents[].config.hasMore | boolean | 否 | 是否还有更多 |
| data.topComponents[].config.moreDetailLink | string | 否 | 更多详情跳转 schema |
| data.topComponents[].config.addButton | object | 否 | 添加按钮配置 |
| data.topComponents[].config.addButton.addButtonTitle | string | 否 | 按钮文案 |
| data.topComponents[].config.addButton.addButtonLink | string | 否 | 按钮跳转链接 |
| data.tabConfigs | object | 否 | 页面 Tab 配置 |
| data.tabConfigs.showTab | boolean | 否 | 是否展示 Tab |
| data.tabConfigs.defaultTab | string | 否 | 默认选中的 Tab ID |
| data.tabConfigs.tabs | array | 否 | Tab 列表 |
| data.tabConfigs.tabs[].id | string | 否 | Tab ID |
| data.tabConfigs.tabs[].name | string | 否 | Tab 名称，例如 热议/赛程/资讯/讨论 |
| data.tabConfigs.tabs[].index | number | 否 | Tab 排序 |
| data.tabConfigs.tabs[].componentType | string | 否 | 组件类型，例如 DISCUSS_TAG、MATCH_SCHEDULE、NEWS、TAG_THREAD_LIST |
| data.tabConfigs.tabs[].config | object | 否 | Tab 组件配置与请求参数 |

# Examples

```javascript
window.ColorboxAI.score.getItemDetail({ itemId: "382586" }).then(res => { if (res.code === 200) { console.log(res.data.detail?.name, res.data.detail?.scoreAvg); } })
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