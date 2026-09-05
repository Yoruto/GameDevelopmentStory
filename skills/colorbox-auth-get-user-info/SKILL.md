---
name: auth-getUserInfo
description: 获取当前登录用户的基本资料（包含用户唯一标识 PUID、头像、昵称及 Token 等信息）。可用于登录态校验、页面个性化定制与特权判定。
---

# Usage

- JS Path: `window.ColorboxAI.auth.getUserInfo(params)`

# Constraints

- 必须使用 window.ColorboxAI.auth.getUserInfo() 接口进行异步调取
- 若当前用户未登录，接口返回的 data 可能为 null，业务端需做好未登录状态的引导（如去登录）
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码，成功为 200 |
| message | string | 是 | 提示信息 |
| data | object | 否 |  |
| data.islogin | number | 否 | 是否登录：1 为已登录，0 为未登录/游客 |
| data.puid | string | 否 | 用户唯一 ID（未登录为 null） |
| data.nickname | string | 否 | 用户昵称（未登录为 null） |
| data.avatar | string | 否 | 用户头像 URL 链接地址 |
| data.userHeadUrl | string | 否 | 用户头像 URL 链接地址（同 avatar） |
| data.authToken | string | 否 | 登录鉴权 Token 凭据（未登录为 null） |
| data.platform | string | 否 | 当前客户端平台：iOS / Android |
| data.night | number | 否 | 是否为夜间模式：1 为是，0 为否 |
| data.statusbar_hight | number | 否 | 状态栏高度（单位 px），用于顶部自定义标题栏避让刘海 |
| data.titlebar_hight | number | 否 | 标题栏高度（单位 px） |
| data.bottomSafeHeight | number | 否 | 底部安全区高度（单位 px，如 iPhone 全面屏通常为 34px） |

# Examples

```javascript
window.ColorboxAI.auth.getUserInfo().then(res => { if (res.code === 200 && res.data) { console.log("当前登录用户：", res.data.nickname); } else { console.log("当前未登录"); } });
```