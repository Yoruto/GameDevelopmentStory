---
name: closeWebview
description: 在虎扑 App 内关闭当前活动页 WebView。适用于提交成功、任务完成、用户点击关闭按钮等明确交互后的页面收起场景。
---

# Usage

- JS Path: `window.ColorboxAI.closeWebview(params)`

# Constraints

- 必须使用 window.ColorboxAI.closeWebview({ channel: "bridge" })，严禁直接调用 window.HupuBridge、webkit.messageHandlers、androidBridge 或自行拼接 Bridge 参数
- 底层固定调用 hupu.ui.pageclose，并通过 Colorbox AI shell bridge 代理链路执行
- 只允许在用户点击关闭、完成、返回等明确交互后调用，禁止页面加载后自动关闭 WebView
- 调用前如果需要埋点，必须先调用 window.ColorboxAI.track(params)，再调用 closeWebview
- 非 App / 无 Bridge 环境可能不会真正关闭页面，业务代码需做好 Web 预览环境下的降级表现
- 必须根据返回的 code 判断是否成功，若 code 不等于 200，必须使用返回的 message 对用户进行友好提示（如 Toast 或弹窗）。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | 否 | 调用通道，固定使用 bridge。默认值为 bridge，可显式传入 "bridge"。 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| code | number | 是 | 状态码，200 表示已发起关闭 WebView 的 Bridge 调用 |
| message | string | 是 | 提示信息 |
| data | object | 否 | Bridge 调用信息 |
| data.channel | string | 否 | 实际调用通道，固定为 bridge |
| data.method | string | 否 | 底层 Native Bridge 方法名，固定为 hupu.ui.pageclose |
| data.bridgeResult | object | 否 | 客户端 Bridge 回调结果；WebView 关闭成功时可能不会返回有效值 |

# Examples

```javascript
window.ColorboxAI.closeWebview({ channel: "bridge" }).then(res => { if (res.code !== 200) { console.warn(res.message); } })
```

```javascript
function handleDoneClick() { window.ColorboxAI.track({ act: "click", blk: "BMC001", pos: "T1" }); window.ColorboxAI.closeWebview({ channel: "bridge" }); }
```