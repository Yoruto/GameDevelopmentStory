---
name: social-share
description: 唤起原生分享面板，支持分享微信、微博。当页面需要进行社交平台分享时引导 AI 调用。
---

# Usage

- JS Path: `window.ColorboxAI.social.share(params)`

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分享标题 |
| link | string | 是 | 分享链接 URL，必须是 http/https 开头的完整链接 |
| text | string | 否 | 可选，分享的副标题/描述文本 |
| imageUrl | string | 否 | 可选，分享卡片的缩略图图片 URL |

# Returns

- Type: `Promise<void>`

# Examples

```javascript
window.ColorboxAI.bridge.device.share({ title: "活动开始啦", link: window.location.href, text: "快来一起参与投票赢大奖吧！", imageUrl: "https://example.com/thumb.png" });
```