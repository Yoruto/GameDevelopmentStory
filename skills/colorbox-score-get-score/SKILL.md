---
name: score-getScore
description: 查看指定球员、装备等对象的平均评分和打分人数，便于在活动页展示该对象的打分情况。
---

# Usage

- JS Path: `window.ColorboxAI.score.getScore(params)`

# Constraints

- 必须通过 window.ColorboxAI.score.getScore(params) 接口，严禁直接拼凑网络接口 URL
- outBizType 和 outBizNo 均必填，且必须是合法的字符串标识
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| outBizType | string | 是 | 业务类型。常用可选值包括：nbaPlayer (NBA球员), cbaPlayer (CBA球员), equipment (运动装备), games (游戏), movie (电影影视), food (美食), school (高校) |
| outBizNo | string | 是 | 业务对象 ID，例如球员 ID |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 否 | 业务状态码，1 表示成功 |
| type | string | 否 | 响应类型，例如 COMMON |
| msg | string | 否 | 提示信息，例如 "成功" |
| success | boolean | 否 | 是否请求成功 |
| data | object | 否 | 评分数据主体 |
| data.nodeId | number | 否 | 当前评分节点 ID |
| data.linkNodes | array | 否 | 关联节点/面包屑导航列表 |
| data.linkNodes[].nodeId | number | 否 | 节点 ID |
| data.linkNodes[].parentNodeId | number / null | 否 | 父节点 ID，可能为 null |
| data.linkNodes[].level | number | 否 | 节点层级 |
| data.linkNodes[].desc | string | 否 | 节点描述/名称 |
| data.linkNodes[].target | string | 否 | 跳转目标类型，例如 GROUP |
| data.linkNodes[].outBizKey | string / null | 否 | 外部业务标识，可能为 null |
| data.linkNodes[].schema | string | 否 | 跳转 schema 链接 |
| data.groupInfo | object | 否 | 所属榜单/分组信息 |
| data.groupInfo.groupId | number | 否 | 分组 ID |
| data.groupInfo.nodeId | number | 否 | 分组对应节点 ID |
| data.groupInfo.groupName | string | 否 | 分组名称 |
| data.groupInfo.jumpUrl | string | 否 | 分组跳转链接 |
| data.groupInfo.publishNum | number | 否 | 已发布数量 |
| data.groupInfo.recommendDesc | string | 否 | 推荐描述 |
| data.groupInfo.publishTime | string | 否 | 发布时间（格式化字符串，如 07-13） |
| data.groupInfo.publishTimeTs | number | 否 | 发布时间戳（毫秒） |
| data.groupInfo.creatorUser | number | 否 | 创建者用户 ID |
| data.detail | object | 否 | 评分对象详情 |
| data.detail.image | array | 否 | 封面图片 URL 列表 |
| data.detail.image[] | string | 否 | 数组元素 |
| data.detail.imageShape | string | 否 | 图片形状，例如 rectangle（矩形）、square（正方形） |
| data.detail.imageSize | string | 否 | 图片尺寸标识，例如 cover_87x122 |
| data.detail.minScoreUserCountLimit | number | 否 | 展示评分所需的最小打分人数阈值 |
| data.detail.bizId | string | 否 | 业务对象 ID |
| data.detail.bizType | string | 否 | 业务类型，例如 movie_movie |
| data.detail.name | string | 否 | 评分对象名称 |
| data.detail.infoJson | object | 否 | 扩展信息 JSON，值多为字符串数组形式 |
| data.detail.infoJson.machineCanScore | array | 否 | 是否允许机器评分 |
| data.detail.infoJson.machineCanScore[] | string | 否 | 数组元素 |
| data.detail.infoJson.scoreCountThreshold | array | 否 | 展示评分的人数阈值 |
| data.detail.infoJson.scoreCountThreshold[] | string | 否 | 数组元素 |
| data.detail.infoJson.canScore | array | 否 | 是否可评分 |
| data.detail.infoJson.canScore[] | string | 否 | 数组元素 |
| data.detail.infoJson.ipLocation | string | 否 | IP 归属地 |
| data.detail.infoJson.showScoreTrend | array | 否 | 是否展示评分趋势 |
| data.detail.infoJson.showScoreTrend[] | string | 否 | 数组元素 |
| data.detail.infoJson.show | array | 否 | 展示时间戳 |
| data.detail.infoJson.show[] | string | 否 | 数组元素 |
| data.detail.infoJson.link | array | 否 | 关联链接 |
| data.detail.infoJson.link[] | string | 否 | 数组元素 |
| data.detail.infoJson.showScore | array | 否 | 是否展示评分 |
| data.detail.infoJson.showScore[] | string | 否 | 数组元素 |
| data.detail.infoJson.selfCategory | string | 否 | 自身分类，例如 movie |
| data.detail.infoJson.commentAudioMax | array | 否 | 语音评论最大时长（秒） |
| data.detail.infoJson.commentAudioMax[] | string | 否 | 数组元素 |
| data.detail.infoJson.selfBizType | string | 否 | 自身业务类型 |
| data.detail.infoJson.selfBizId | number | 否 | 自身业务 ID |
| data.detail.infoJson.ugcBtnDesc | array | 否 | UGC 按钮文案 |
| data.detail.infoJson.ugcBtnDesc[] | string | 否 | 数组元素 |
| data.detail.infoJson.operationCanScore | array | 否 | 运营是否允许评分 |
| data.detail.infoJson.operationCanScore[] | string | 否 | 数组元素 |
| data.detail.infoJson.distributionControl | array | 否 | 分发控制配置（JSON 字符串） |
| data.detail.infoJson.distributionControl[] | string | 否 | 数组元素 |
| data.detail.infoJson.commentAudioMin | array | 否 | 语音评论最小时长（秒） |
| data.detail.infoJson.commentAudioMin[] | string | 否 | 数组元素 |
| data.detail.infoJson.allowUgc | array | 否 | 是否允许 UGC |
| data.detail.infoJson.allowUgc[] | boolean | 否 | 数组元素 |
| data.detail.infoJson.cover_87x122 | array | 否 | 87x122 尺寸封面图 |
| data.detail.infoJson.cover_87x122[] | string | 否 | 数组元素 |
| data.detail.infoJson.canComment | array | 否 | 是否可评论 |
| data.detail.infoJson.canComment[] | string | 否 | 数组元素 |
| data.detail.infoJson.selfName | string | 否 | 自身名称 |
| data.detail.infoJson.commentSupport | array | 否 | 支持的评论类型，例如 AUDIO |
| data.detail.infoJson.commentSupport[] | string | 否 | 数组元素 |
| data.detail.infoJson.desc | array | 否 | 描述信息，例如上映日期 |
| data.detail.infoJson.desc[] | string | 否 | 数组元素 |
| data.detail.scorePersonCount | number | 否 | 参与打分的人数 |
| data.detail.commentCount | number | 否 | 评论数 |
| data.detail.summedCommentCount | number | 否 | 累计评论数（含子项） |
| data.detail.summedScorePersonCount | number | 否 | 累计打分人数（含子项） |
| data.detail.totalScore | number | 否 | 总分值 |
| data.detail.scoreAvg | number | 否 | 平均评分分值（0 - 10） |
| data.detail.scoreDistribution | object | 否 | 评分分布，键为分值，值为对应人数 |
| data.detail.scoreSummaryTrend | object / null | 否 | 评分汇总趋势，可能为 null |
| data.detail.scoreTabLocate | string | 否 | 评分 Tab 默认定位，例如 scoreDistribution |
| data.detail.hottestComments | array | 否 | 最热评论文本列表 |
| data.detail.hottestComments[] | string | 否 | 数组元素 |
| data.detail.hotCommentModels | array | 否 | 热门评论模型列表 |
| data.detail.hotCommentModels[].commentUserId | number | 否 | 评论用户 ID |
| data.detail.hotCommentModels[].commentUserHeadImg | string | 否 | 评论用户头像 URL |
| data.detail.hotCommentModels[].commentUserName | string | 否 | 评论用户昵称 |
| data.detail.hotCommentModels[].commentContent | string | 否 | 评论内容 |
| data.detail.hotCommentModels[].commentId | string | 否 | 评论 ID |
| data.detail.hotCommentModels[].subjectId | string | 否 | 主题/帖子 ID |
| data.detail.hotCommentModels[].ancillaryContents | array / null | 否 | 评论附属内容（图片/音频等） |
| data.detail.hotCommentModels[].ancillaryContents[].commentContentId | string | 否 | 附属内容 ID |
| data.detail.hotCommentModels[].ancillaryContents[].commentContent | string | 否 | 附属内容 URL |
| data.detail.hotCommentModels[].ancillaryContents[].commentContentType | string | 否 | 附属内容类型，例如 IMAGE、AUDIO |
| data.detail.hotCommentModels[].ancillaryContents[].durationInSec | number / null | 否 | 时长（秒），音频有效，否则为 null |
| data.detail.hotCommentModels[].lightCount | number | 否 | 点亮/点赞数 |
| data.detail.hotCommentModels[].score | number | 否 | 该评论用户给出的评分 |
| data.detail.hotCommentModels[].parentCommentUserId | number / null | 否 | 父评论用户 ID，可能为 null |
| data.detail.hotCommentModels[].parentCommentUserName | string / null | 否 | 父评论用户昵称，可能为 null |
| data.detail.hotCommentModels[].parentCommentContent | string / null | 否 | 父评论内容，可能为 null |
| data.detail.hotCommentModels[].parentAncillaryContents | array / null | 否 | 父评论附属内容，可能为 null |
| data.detail.tagCategoryList | array / null | 否 | 标签分类列表，可能为 null |
| data.detail.userScore | number | 否 | 当前登录用户打的分数，未打分为 0 |
| data.detail.userScoreAvg | number / null | 否 | 当前用户平均评分，可能为 null |
| data.detail.status | number | 否 | 状态码 |
| data.detail.items | array / null | 否 | 子评分项列表，可能为 null |
| data.detail.parentBizKeys | array | 否 | 父业务标识列表 |
| data.detail.parentBizKeys[] | string | 否 | 数组元素 |
| data.detail.mostChosenTags | array / null | 否 | 最常选择的标签，可能为 null |
| data.detail.canScore | boolean | 否 | 是否可评分 |
| data.detail.canComment | boolean | 否 | 是否可评论 |
| data.detail.bgColor | string | 否 | 背景色（十六进制） |
| data.detail.maskColor | string | 否 | 蒙层颜色（十六进制含透明度） |
| data.detail.scoreItemAttributes | object | 否 | 评分项属性配置，值多为字符串数组形式 |
| data.detail.scoreItemAttributes.machineCanScore | array | 否 | 是否允许机器评分 |
| data.detail.scoreItemAttributes.machineCanScore[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.scoreCountThreshold | array | 否 | 展示评分的人数阈值 |
| data.detail.scoreItemAttributes.scoreCountThreshold[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.canScore | array | 否 | 是否可评分 |
| data.detail.scoreItemAttributes.canScore[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.showScoreTrend | array | 否 | 是否展示评分趋势 |
| data.detail.scoreItemAttributes.showScoreTrend[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.showScore | array | 否 | 是否展示评分 |
| data.detail.scoreItemAttributes.showScore[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.commentAudioMax | array | 否 | 语音评论最大时长（秒） |
| data.detail.scoreItemAttributes.commentAudioMax[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.ugcBtnDesc | array | 否 | UGC 按钮文案 |
| data.detail.scoreItemAttributes.ugcBtnDesc[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.operationCanScore | array | 否 | 运营是否允许评分 |
| data.detail.scoreItemAttributes.operationCanScore[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.distributionControl | array | 否 | 分发控制配置（JSON 字符串） |
| data.detail.scoreItemAttributes.distributionControl[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.commentAudioMin | array | 否 | 语音评论最小时长（秒） |
| data.detail.scoreItemAttributes.commentAudioMin[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.allowUgc | array | 否 | 是否允许 UGC |
| data.detail.scoreItemAttributes.allowUgc[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.canComment | array | 否 | 是否可评论 |
| data.detail.scoreItemAttributes.canComment[] | string | 否 | 数组元素 |
| data.detail.scoreItemAttributes.commentSupport | array | 否 | 支持的评论类型 |
| data.detail.scoreItemAttributes.commentSupport[] | string | 否 | 数组元素 |
| data.detail.del | number | 否 | 是否删除，0 表示未删除 |
| data.detail.finalStatus | string | 否 | 最终审核状态，例如 PASS |
| data.detail.specialStyle | object / null | 否 | 特殊样式配置，可能为 null |
| data.detail.creatorId | number / null | 否 | 创建者 ID，可能为 null |
| data.detail.creatorName | string / null | 否 | 创建者名称，可能为 null |
| data.detail.creatorAvatar | string / null | 否 | 创建者头像，可能为 null |
| data.detail.bgImage | string / null | 否 | 背景图，可能为 null |
| data.detail.shareBgImage | string / null | 否 | 分享背景图，可能为 null |
| data.detail.scoreItemNodeId | array | 否 | 评分项节点 ID 列表 |
| data.detail.scoreItemNodeId[] | number | 否 | 数组元素 |
| data.detail.createDt | string | 否 | 创建时间（ISO 时间字符串） |
| data.detail.permissions | array | 否 | 权限列表 |
| data.detail.permissions[] | string | 否 | 数组元素 |
| data.detail.allowUgc | boolean | 否 | 是否允许 UGC 添加评分对象 |
| data.detail.ugcBtnDesc | string | 否 | UGC 按钮文案，例如"添加评分对象" |
| data.detail.scoreResources | object | 否 | 评分资源配置 |
| data.detail.visible | boolean / null | 否 | 是否可见，可能为 null |
| data.detail.videoDetail | object / null | 否 | 视频详情，可能为 null |
| data.detail.parentBizKey | string / null | 否 | 父业务标识，可能为 null |
| data.detail.typeMapping | object / null | 否 | 类型映射，可能为 null |
| data.detail.uniqueItem | boolean | 否 | 是否唯一评分项 |
| data.detail.ipLocation | string | 否 | IP 归属地 |
| data.detail.publishTime | string | 否 | 发布时间（格式化字符串，如 06-23） |
| data.detail.scoreColorDay | string | 否 | 日间模式评分颜色（十六进制） |
| data.detail.scoreColorNight | string | 否 | 夜间模式评分颜色（十六进制） |
| data.detail.scoreValueHighlight | boolean | 否 | 评分值是否高亮 |
| data.detail.relatedModelList | array | 否 | 关联模型列表 |
| data.detail.relatedModelList[] | object | 否 | 数组元素 |
| data.detail.poiBizKey | string / null | 否 | POI 业务标识，可能为 null |
| data.detail.shareBizKey | string / null | 否 | 分享业务标识，可能为 null |
| data.detail.distance | number / null | 否 | 距离，可能为 null |
| data.detail.bindTagThread | boolean | 否 | 是否绑定标签帖子 |
| data.detail.textLink | string / null | 否 | 文本链接，可能为 null |
| data.detail.itemId | number | 否 | 评分项 ID |
| data.detail.itemType | string | 否 | 评分项类型，例如 normal |
| data.detail.showScore | boolean | 否 | 是否展示评分 |
| data.detail.resourceMark | string / null | 否 | 资源标记，可能为 null |
| data.detail.resourceDetail | object / null | 否 | 资源详情，可能为 null |
| data.detail.resourceConfig | object / null | 否 | 资源配置，可能为 null |
| data.detail.commentConfig | object | 否 | 评论配置 |
| data.detail.commentConfig.commentAudioSupport | boolean | 否 | 是否支持语音评论 |
| data.detail.commentConfig.commentAudioMax | number | 否 | 语音评论最大时长（秒） |
| data.detail.commentConfig.commentAudioMin | number | 否 | 语音评论最小时长（秒） |
| data.detail.hotStatements | array | 否 | 热门短评/观点列表 |
| data.detail.hotStatements[] | object | 否 | 数组元素 |
| data.detail.deepTalk | object | 否 | AI 深度聊天（问 AI）配置 |
| data.detail.deepTalk.needShow | boolean | 否 | 是否展示入口 |
| data.detail.deepTalk.iconDay | string | 否 | 日间模式图标 URL |
| data.detail.deepTalk.iconNight | string | 否 | 夜间模式图标 URL |
| data.detail.deepTalk.iconName | string | 否 | 入口名称，例如"问AI" |
| data.detail.deepTalk.guideName | string / null | 否 | 引导文案，可能为 null |
| data.detail.deepTalk.guideNameSubtitle | string / null | 否 | 引导副标题 |
| data.detail.deepTalk.guideOutTime | number | 否 | 引导消失时间（秒） |
| data.detail.deepTalk.guideStayTime | number | 否 | 引导停留时间（秒） |
| data.detail.deepTalk.replyAiShow | boolean | 否 | 回复中是否展示 AI 入口 |
| data.detail.deepTalk.replyGuideName | string / null | 否 | 回复引导文案，可能为 null |
| data.parent | object / null | 否 | 父节点信息，可能为 null |
| data.hasSubNodes | boolean | 否 | 是否存在子节点 |
| data.subNodes | array / null | 否 | 子节点列表，可能为 null |
| data.pageResource | object | 否 | 页面资源与跳转链接配置 |
| data.pageResource.showSearchButton | boolean | 否 | 是否展示搜索按钮 |
| data.pageResource.searchSchema | string | 否 | 搜索页跳转 schema |
| data.pageResource.shareUrl | string | 否 | 分享链接 |
| data.pageResource.scoreCommunityGuidelinesUrl | string | 否 | 评分社区公约链接 |
| data.pageResource.scoreEditUrl | string | 否 | 评分编辑跳转 schema |
| data.pageResource.scoreItemSupplementUrl | string | 否 | 评分对象补充跳转 schema |
| data.pageResource.commentManagementUrl | string | 否 | 评论管理跳转 schema |
| data.pageResource.uniqueItemSearchSchema | string / null | 否 | 唯一评分项搜索 schema，可能为 null |
| data.location | object / null | 否 | 定位信息，可能为 null |
| data.showTabs | boolean | 否 | 是否展示 Tab 切换 |

# Examples

```javascript
window.ColorboxAI.score.getScore({ outBizType: "nbaPlayer", outBizNo: "12345" })
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