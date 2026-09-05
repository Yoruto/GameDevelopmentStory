---
name: security-checkAudit
description: 在用户提交文本内容或触发图片生成前，调用风控接口进行敏感内容安全检测。支持敏感词检测，自动识别未登录状态并统一返回 code、message 与 data 结构。
---

# Usage

- JS Path: `window.ColorboxAI.security.checkAudit(params)`

# Constraints

- 必须且只能通过 window.ColorboxAI.security.checkAudit(content) 接口进行敏感词检测，严禁直接手写原始风控接口 URL
- 未登录时，返回 { code: 401, message: "用户未登录", data: null }；前端应及时拦截提交并提示用户登录
- 校验正常请求成功时，返回 { code: 200, message: "success", data: boolean }，其中 data 为 true 代表安全通过，data 为 false 代表包含敏感内容需予以拦截提示
- 接口异常或网络超时等系统级错误时，返回 { code: 500, message: "请求失败", data: null }，需做好友好兜底提示

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| content | string | 是 | 待检测的文本内容字符串 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码：200 成功，401 未登录，500 异常 |
| message | string | 是 | 提示信息 |
| data | boolean | 否 | 是否安全通过，true 表示安全，false 表示包含敏感拦截 |

# Examples

```javascript
window.ColorboxAI.security.checkAudit("测试文本").then(res => { if (res.code === 200 && res.data === true) { console.log("通过"); } })
```