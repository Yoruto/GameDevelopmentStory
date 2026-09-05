---
name: request-activity-listByBizKeys
description: 批量获取球员、装备等业务对象的评分数据与打分明细，一次请求即可覆盖多个对象，方便活动页统一展示。
---

# Usage

- JS Path: `window.ColorboxAI.request.activity.listByBizKeys(params)`

# Constraints

- 必须通过 window.ColorboxAI.request.activity.listByBizKeys(params) 接口，严禁直接拼凑网络接口 URL
- bizKeys 必须为非空数组
- 请求接口数据必须使用 window.ColorboxAI.request 能力及其子能力发起，禁止使用 fetch、axios、XMLHttpRequest、第三方请求库或其它自定义请求方式。
- 数据能力调用必须避免无条件循环、无限轮询和重复渲染触发；同一参数的返回结果应优先保存在组件状态中复用。
- 列表/分页类接口连续自动翻页最多 5 页，必须在无下一页、返回空列表或达到页数上限时停止。
- SDK 前端已启用请求保护：默认不限制单能力并发和分钟调用量，不启用相同请求在途合并或 GET 短缓存；同 URL 在 10000ms 内最多 20 次；同一页面同接口（去掉 query/hash 参数后相同即为同一接口）在 5000ms 内最多 20 次，首次超过限制返回 429，后续同窗口请求静默丢弃，且同一窗口内只上报一次异常日志。不要自行循环重试或重复触发请求，若接口真实返回 408、429 或 503 等错误码，必须停止继续请求并给用户友好提示。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| bizKeys | array | 是 | 待查询的业务对象列表。数组内每个对象需包含 outBizType（请求侧业务分类，常用：nbaPlayer、cbaPlayer、equipment、games、movie、food、school；返回 data[].bizType 为更细粒度类型，如 movie_movie、movie_role）和 outBizNo（业务对象 ID） |
| querySubItemLimit | number | 否 | 子项查询限制数，默认为 1 |
| queryHasLight | boolean | 否 | 是否查询亮评，默认为 false |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 否 | 状态码，1 表示成功 |
| type | string | 否 | 返回类型，如 COMMON |
| msg | string | 否 | 提示信息，如“成功” |
| success | boolean | 否 | 是否成功 |
| data | array | 否 | 评分项列表，每个元素对应一个查询的业务对象 |
| data[].bizType | string | 否 | 业务类型，如 movie_movie、movie_role |
| data[].bizId | string | 否 | 业务对象ID |
| data[].name | string | 否 | 评分对象名称 |
| data[].pic | string | 否 | 封面图片 URL |
| data[].coverStyle | string | 否 | 封面样式，如 rectangle（矩形） |
| data[].desc | string | 否 | 描述文案，如上映日期、角色饰演信息 |
| data[].behave | string / null | 否 | 行为标识，可能为 null |
| data[].score | number | 否 | 平均评分 |
| data[].canScore | boolean | 否 | 当前是否可评分 |
| data[].showScore | boolean | 否 | 是否展示评分 |
| data[].scoreCountThreshold | number | 否 | 评分展示所需的最少评分人数阈值 |
| data[].scoreValueHighlight | boolean | 否 | 评分值是否高亮展示 |
| data[].scoreColorDay | string | 否 | 评分日间模式颜色（十六进制） |
| data[].scoreColorNight | string | 否 | 评分夜间模式颜色（十六进制） |
| data[].scorePersonCount | number | 否 | 评分人数 |
| data[].scoreCount | number | 否 | 评分次数 |
| data[].comment | object / null | 否 | 该评分项的热评，可能为 null |
| data[].comment.subjectId | string | 否 | 评论所属主题ID |
| data[].comment.commentId | string | 否 | 评论ID |
| data[].comment.commentContent | string | 否 | 评论原始文本内容 |
| data[].comment.processCommentContent | string | 否 | 处理后的评论展示文本（含 [图片] 等占位标记） |
| data[].comment.ancillaryContents | array | 否 | 评论附属内容列表（图片/音频等），可能为空数组 |
| data[].comment.ancillaryContents[].commentContentId | string | 否 | 附属内容ID |
| data[].comment.ancillaryContents[].commentContent | string | 否 | 附属内容值，如图片 URL |
| data[].comment.ancillaryContents[].commentContentType | string | 否 | 附属内容类型，如 IMAGE、AUDIO |
| data[].comment.ancillaryContents[].durationInSec | number / null | 否 | 时长（秒），仅音频类型有值，否则为 null |
| data[].comment.contentColorDay | string | 否 | 评论文本日间模式颜色（十六进制） |
| data[].comment.contentColorNight | string | 否 | 评论文本夜间模式颜色（十六进制） |
| data[].comment.lightCount | number | 否 | 评论点亮（点赞）数 |
| data[].comment.userId | number | 否 | 评论用户ID |
| data[].comment.username | string | 否 | 评论用户名（可能为空字符串） |
| data[].comment.hasLight | boolean | 否 | 当前用户是否已点亮该评论 |
| data[].schema | string | 否 | 跳转到评分详情的 schema 链接 |
| data[].hexColor | string | 否 | 主题背景色（十六进制） |
| data[].maskColor | string | 否 | 蒙层颜色（含透明度的十六进制） |
| data[].commentCount | number | 否 | 评论数 |
| data[].summedCommentCount | number | 否 | 累计评论数（含子项） |
| data[].itemId | number | 否 | 评分项ID |
| data[].resourceMark | string / null | 否 | 资源标记，可能为 null |
| data[].resourceDetail | object / null | 否 | 资源详情，可能为 null |
| data[].allowAudio | boolean | 否 | 是否允许音频评论 |
| data[].playNum | number / null | 否 | 播放数，可能为 null |
| data[].scoreItemSupplementUrl | string / null | 否 | 评分项补充/编辑链接，可能为 null |
| data[].creatorId | number / null | 否 | 创建者ID，可能为 null |
| data[].creatorName | string / null | 否 | 创建者名称，可能为 null |
| data[].creatorAvatar | string / null | 否 | 创建者头像 URL，可能为 null |
| data[].subItems | array / null | 否 | 子评分项列表；无子项时为 null。子项结构与父项相同，可继续嵌套（schema 仅展开一层） |
| data[].subItems[].bizType | string | 否 | 业务类型，如 movie_movie、movie_role |
| data[].subItems[].bizId | string | 否 | 业务对象ID |
| data[].subItems[].name | string | 否 | 评分对象名称 |
| data[].subItems[].pic | string | 否 | 封面图片 URL |
| data[].subItems[].coverStyle | string | 否 | 封面样式，如 rectangle（矩形） |
| data[].subItems[].desc | string | 否 | 描述文案，如上映日期、角色饰演信息 |
| data[].subItems[].behave | string / null | 否 | 行为标识，可能为 null |
| data[].subItems[].score | number | 否 | 平均评分 |
| data[].subItems[].canScore | boolean | 否 | 当前是否可评分 |
| data[].subItems[].showScore | boolean | 否 | 是否展示评分 |
| data[].subItems[].scoreCountThreshold | number | 否 | 评分展示所需的最少评分人数阈值 |
| data[].subItems[].scoreValueHighlight | boolean | 否 | 评分值是否高亮展示 |
| data[].subItems[].scoreColorDay | string | 否 | 评分日间模式颜色（十六进制） |
| data[].subItems[].scoreColorNight | string | 否 | 评分夜间模式颜色（十六进制） |
| data[].subItems[].scorePersonCount | number | 否 | 评分人数 |
| data[].subItems[].scoreCount | number | 否 | 评分次数 |
| data[].subItems[].comment | object / null | 否 | 该评分项的热评，可能为 null |
| data[].subItems[].comment.subjectId | string | 否 | 评论所属主题ID |
| data[].subItems[].comment.commentId | string | 否 | 评论ID |
| data[].subItems[].comment.commentContent | string | 否 | 评论原始文本内容 |
| data[].subItems[].comment.processCommentContent | string | 否 | 处理后的评论展示文本（含 [图片] 等占位标记） |
| data[].subItems[].comment.ancillaryContents | array | 否 | 评论附属内容列表（图片/音频等），可能为空数组 |
| data[].subItems[].comment.ancillaryContents[].commentContentId | string | 否 | 附属内容ID |
| data[].subItems[].comment.ancillaryContents[].commentContent | string | 否 | 附属内容值，如图片 URL |
| data[].subItems[].comment.ancillaryContents[].commentContentType | string | 否 | 附属内容类型，如 IMAGE、AUDIO |
| data[].subItems[].comment.ancillaryContents[].durationInSec | number / null | 否 | 时长（秒），仅音频类型有值，否则为 null |
| data[].subItems[].comment.contentColorDay | string | 否 | 评论文本日间模式颜色（十六进制） |
| data[].subItems[].comment.contentColorNight | string | 否 | 评论文本夜间模式颜色（十六进制） |
| data[].subItems[].comment.lightCount | number | 否 | 评论点亮（点赞）数 |
| data[].subItems[].comment.userId | number | 否 | 评论用户ID |
| data[].subItems[].comment.username | string | 否 | 评论用户名（可能为空字符串） |
| data[].subItems[].comment.hasLight | boolean | 否 | 当前用户是否已点亮该评论 |
| data[].subItems[].schema | string | 否 | 跳转到评分详情的 schema 链接 |
| data[].subItems[].hexColor | string | 否 | 主题背景色（十六进制） |
| data[].subItems[].maskColor | string | 否 | 蒙层颜色（含透明度的十六进制） |
| data[].subItems[].commentCount | number | 否 | 评论数 |
| data[].subItems[].summedCommentCount | number | 否 | 累计评论数（含子项） |
| data[].subItems[].itemId | number | 否 | 评分项ID |
| data[].subItems[].resourceMark | string / null | 否 | 资源标记，可能为 null |
| data[].subItems[].resourceDetail | object / null | 否 | 资源详情，可能为 null |
| data[].subItems[].allowAudio | boolean | 否 | 是否允许音频评论 |
| data[].subItems[].playNum | number / null | 否 | 播放数，可能为 null |
| data[].subItems[].scoreItemSupplementUrl | string / null | 否 | 评分项补充/编辑链接，可能为 null |
| data[].subItems[].creatorId | number / null | 否 | 创建者ID，可能为 null |
| data[].subItems[].creatorName | string / null | 否 | 创建者名称，可能为 null |
| data[].subItems[].creatorAvatar | string / null | 否 | 创建者头像 URL，可能为 null |
| data[].subItems[].subItems | array / null | 否 | 更深层子评分项列表，结构同父项，可继续嵌套；无子项时为 null |

# Examples

```javascript
window.ColorboxAI.request.activity.listByBizKeys({ bizKeys: [{ outBizType: "nbaPlayer", outBizNo: "12345" }] })
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