---
name: navigate-to
description: 为按钮、图片和卡片配置站内、站外或 App 内页面跳转。当用户点击页面元素后前往指定活动页、内容页或外部链接时调用。
---

# Usage

- JS Path: `window.ColorboxAI.navigate.to(params)`

# Constraints

- 跳转 URL 必须由显式配置或常量提供，不要从用户输入直接拼接到跳转方法
- 外链必须使用 https://，相对路径仅用于当前活动页内资源或锚点跳转
- 必须使用 SDK 统一跳转 API，严禁自行使用 window.location.href 或 window.open 进行跳转以避免损坏路由完整性
- 如果按钮已有埋点，必须先调用 window.ColorboxAI.track 埋点方法，随后再执行跳转
- 不要在页面加载时自动跳转；跳转必须由用户点击等明确交互触发
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 需要跳转的目标 URL，如 https://... 或 huputiyu://... |
| target | string | 否 | 跳转目标窗口标识，如 _self 或 _blank，可选 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码，200 表示执行成功 |
| message | string | 是 | 提示信息 |

# Examples

```javascript
window.ColorboxAI.navigate.to({ url: "https://m.hupu.com" })
```

```javascript
window.ColorboxAI.navigate.to({ url: "huputiyu://bbs/postImg", target: "_self" })
```