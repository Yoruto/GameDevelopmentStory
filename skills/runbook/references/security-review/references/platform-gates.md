# 发布安全门禁与通用前端安全规则

> 本文件用于虎扑活动页发布包的只读静态安全审查。审查以 `review-package/.code-review/manifest.json`、包内源码和 scanner 证据为准，不执行代码、不联网、不读取超范围文件内容。

命中发布门禁的明确阻断项时，返回 `decision="blocked"`。没有明确违规，但缺少 API 白名单、域名归属、调用链、动态目标证据或通用前端安全链路证据时，返回 `decision="needs_review"`。发布安全门禁全部满足且未发现明显风险时，返回 `decision="passed"`。只报告能够从源码和上下文证明的问题；不要仅凭危险 API 名称、未知变量或缺少可选加固措施报问题。同一根因的重复命中应合并为一个 finding。

## 目录

- [1. 审查边界与决策](#1-审查边界与决策)
- [2. 发布安全门禁](#2-发布安全门禁)
  - [SR-000 文件与本地资源审查范围](#sr-000-文件与本地资源审查范围)
  - [SR-001 请求必须通过虎扑 Request SDK](#sr-001-请求必须通过虎扑-request-sdk)
  - [SR-002 远程资源域名必须为批准域名](#sr-002-远程资源域名必须为批准域名)
  - [SR-004 禁止动态代码执行](#sr-004-禁止动态代码执行)
  - [SR-005 禁止 iframe、弹窗、下载和站外跳转](#sr-005-禁止-iframe弹窗下载和站外跳转)
  - [SR-006 禁止敏感设备能力](#sr-006-禁止敏感设备能力)
- [3. 通用前端安全规则](#3-通用前端安全规则)
- [4. 改写与替代基线](#4-改写与替代基线)
- [5. 发布门禁扫描清单](#5-发布门禁扫描清单)

## 1. 审查边界与决策

| 项 | 要求 |
| --- | --- |
| 审查对象 | 已解包到 `review-package/` 的前端 zip 输入包 |
| 允许读取 | `.html`、`.htm`、`.js`、`.css`，扩展名大小写不敏感 |
| 禁止读取 | 图片、字体、音视频、WASM、JSON、SVG、TS/JSX/TSX/Vue/Svelte、source map、配置、依赖清单、无扩展名、本地 data 文件等超范围文件 |
| 远程 URL | 不按 SR-000 判断扩展名；必须继续按 SR-002 校验域名 |
| `blocked` | 存在高危或严重风险，或命中任一发布安全门禁阻断项 |
| `needs_review` | 存在低中风险、门禁人工复核项或通用前端安全疑点，尤其是公开 API、虎扑域名归属、`window.ColorboxAI.request` 调用链、请求频率/分页/错误处理无法完全确认 |
| `passed` | 未发现明显风险，发布安全门禁全部满足，且没有通用前端安全 findings |

审查证据必须包含文件路径、行号和短片段。对动态行为只在能够证明来源、入口和可触发路径时报告。

### Finding 分类

`type="security"` 只用于发布安全门禁分类：

- `请求 SDK 门禁`
- `资源范围门禁`
- `域名资源门禁`
- `动态代码执行门禁`
- `跳转/弹窗/下载门禁`
- `敏感设备能力门禁`

`type="common"` 只用于通用前端安全分类：

- `XSS / DOM 注入`
- `敏感信息泄露`
- `数据外传`
- `存储风险`
- `可疑混淆`
- `供应链风险`
- `审查不完整`

## 2. 发布安全门禁

### SR-000 文件与本地资源审查范围

| 项 | 规则 |
| --- | --- |
| 基线 | 只审查 `.html`、`.htm`、`.js`、`.css`。路径基于 manifest 中的包内相对路径，以及 URL 解析后规范化到 `review-package/` 内的本地引用路径 |
| 不读取 | `materialized: true`（旧字段 `included: true`）但扩展名超范围的文件；HTML/CSS/JS 引用的本地超范围资源；source map、字体、图片、音视频、WASM、JSON、SVG、TS/JSX/TSX、配置、依赖清单等 |
| 不阻断 | 不因文件超范围本身直接阻断；只记录路径、引用位置、扩展名和必要短证据 |
| 需要复核 | 超范围资源数量、类型或引用链路异常，导致无法确认发布包真实行为 |
| 路径处理 | 本地相对/绝对/`./`/`../`/URL 编码路径和 query/hash 后缀先规范化到 `review-package/` 内路径再判断扩展名；`../` 逃逸包根 → 阻断 |

### SR-001 请求必须通过虎扑 Request SDK

| 项 | 规则 |
| --- | --- |
| 基线 | 所有业务网络请求必须调用 `window.ColorboxAI.request(params)`；`channel: "bridge"` 表示优先走 App 内 HupuBridge / 父容器代理，不可用时 SDK 回退到 fetch |
| 阻断 | 直接使用 `fetch`、`XMLHttpRequest`、`axios`、`$.ajax`、`navigator.sendBeacon`、`WebSocket`、`EventSource` 等网络客户端发起业务请求 |
| 阻断 | 手动拼接请求 URL 绕过 `window.ColorboxAI.request`；调用私有、内部、测试、localhost、IP 字面量或非公开接口 |
| 阻断 | 对请求做无条件循环、无限轮询、错误后自动重试；列表/分页类接口连续自动翻页超过 5 页或未在无下一页时停止 |
| 不适用 | 不得仅因“未检测到 `window.ColorboxAI.request` 调用”报告请求 SDK 门禁；必须先证明存在业务网络请求，再判断是否绕过 SDK |
| 不适用 | 普通非网络 JSBridge / Native Bridge（`HupuBridge`、`er.base.*`、`er.navigate.*`），除非能证明其发起 HTTP/WebSocket/EventSource/Beacon 等业务网络请求 |
| 不适用 | tracker 埋点放行：如 `new Image(1, 1).src` 向 `//hermes.hupu.com/...gif` 发送 beacon、携带公开分析 key `a_key`；仍需按 SR-002 校验域名，并按通用规则确认无敏感数据外传 |
| 需要复核 | `request`、`http`、`apiClient` 等二次封装或压缩代码，当前包内无法证明最终调用 `window.ColorboxAI.request` |
| 需要复核 | 发现 `window.ColorboxAI.request`，但无法确认 `url` 是公开 API 或发布白名单接口 |
| 需要复核 | `setInterval`、`while`、递归、组件渲染副作用、自动翻页等模式包裹请求调用 |
| 替代方案 | 改为 `window.ColorboxAI.request({ url, method, headers, data, timeout })`，并确认接口为公开 API 或发布白名单接口 |

请求保护（同 URL/同接口限流、429、连续失败熔断、自动分页上限）由 SDK 运行时兜底，静态审查无需逐项核对运行时数值。

标准入口示例：

```javascript
window.ColorboxAI.request({
  url: "https://activity.hupu.com/api/info",
  method: "GET",
  data: { id: "123" }
});
```

### SR-002 远程资源域名必须为批准域名

| 项 | 规则 |
| --- | --- |
| 基线 | 远程资源 hostname 只允许 `hupu.com`、`hoopchina.com.cn`、`app.tcloudbase.com` 及其子域名 |
| 域名判断 | 必须解析 URL 的 hostname；协议相对 URL 按网络 URL 处理；`srcset` 逐项检查；严禁字符串包含判断（`hupu.com.evil.test`、`evil-hupu.com`、`hupu.com@evil.test` 均属外域） |
| 阻断 | `script`、`link`、`img`、`video`、`audio`、`source`、CSS `url(...)`、`@import` 或 JS 字符串 URL 引用了非批准域名 |
| 阻断 | 资源引用 `localhost`、回环 IP、内网 IP、测试域名、裸 IP 或用户可控域名 |
| 阻断 | 本地相对资源路径在 `review-package/` / manifest 内找不到对应文件 |
| 不阻断 | 本地相对资源路径存在但扩展名超出 SR-000 范围时，只记录审查边界，不读取内容，不仅因超范围直接阻断 |
| 不阻断 | tracker 模块向批准虎扑域名发送埋点 beacon；`a_key` 是公开分析 key，不作为域名门禁或密钥泄露问题单独报告 |
| 需要复核 | 域名看起来像批准域名但归属无法确认；动态拼接 host、环境变量 host 或配置下发 host |
| 替代方案 | 远程资源改为批准域名；本地资源打包进输入包并使用可解析相对路径 |

必须检查：

| 位置 | 属性或模式 |
| --- | --- |
| HTML | `src`、`href`、`srcset`、`poster`、`data`、`action`、`formaction`、`xlink:href`、`<base>`、meta refresh |
| CSS | `url()`、`image-set()`、`@import`、`@font-face src`、背景、滤镜、遮罩和光标资源 |
| JS | 请求 API、动态 `import()`、Worker、Service Worker，以及动态创建的 `script`、`link`、`img`、`iframe`、`audio`、`video`、`source`、`object`、`embed` |

### SR-004 禁止动态代码执行

| 项 | 规则 |
| --- | --- |
| 阻断 | `eval`、`new Function`、字符串形式 `setTimeout`/`setInterval` |
| 阻断 | 动态拼接或指向远程 URL 的动态 `import()` |
| 阻断 | 包含 `.wasm` 文件或调用 `WebAssembly.compile`/`WebAssembly.instantiate` 等 API；base64 解码后执行代码 |
| 需要复核 | 压缩 vendor 代码中存在可疑动态执行模式，且无法确认依赖来源是可信库 |
| 允许 | 静态 `import` 或可解析到包内本地 `.js` 文件的静态模块引用（仍需 SR-000/SR-002） |
| 替代方案 | 改写为静态分支、显式函数映射、静态模块导入或普通 JSON/对象配置 |

### SR-005 禁止 iframe、弹窗、下载和站外跳转

| 项 | 规则 |
| --- | --- |
| 阻断 | HTML 创建 `<iframe>`、`<frame>`、`<frameset>`、`<object>` 或 `<embed>` |
| 阻断 | `window.open`、`target="_blank"`（外部页面不得获得 `window.opener`）、弹窗库或类似行为 |
| 阻断 | `<a download>`、FileSaver 类下载、生成 blob 下载或程序化点击下载 |
| 阻断 | `location.href`/`location.assign`/`location.replace`、meta refresh 或表单提交跳转到非批准外部 URL |
| 阻断 | 可控 URL 未校验协议和 hostname 就用于跳转、打开窗口、iframe、表单提交或下载 |
| 需要复核 | 跳转目标动态拼接；路由包装器可跳转完整 URL 但无法证明目标受控；iframe sandbox 不清，尤其不可信 iframe 同时启用 `allow-scripts` 与 `allow-same-origin` |
| 替代方案 | 单页内视图切换；外部链接受控文本展示；表单提交用 JS 拦截后页内处理 |

### SR-006 禁止敏感设备能力

| 分类 | 禁止 API / 行为 | 替代方案 |
| --- | --- | --- |
| 定位 | `navigator.geolocation` | 用户手动选择/输入 |
| 剪贴板 | `navigator.clipboard`、`document.execCommand('copy'/'cut'/'paste')` | 展示可选中文本，引导手动复制 |
| 硬件连接 | `navigator.bluetooth`、`navigator.usb`、`navigator.hid`、`navigator.serial`、NFC、MIDI、XR | 移除 |
| 传感器 | `Accelerometer`、`Gyroscope`、`Magnetometer`、`DeviceOrientationEvent` | 触摸、鼠标或 Pointer Events |
| 屏幕 | 屏幕捕获或全屏 API（除非发布策略明确允许） | CSS 沉浸式布局实现视觉全屏 |
| 需要复核 | 第三方库封装了浏览器能力探测，实际运行时调用不清楚 | 说明调用链缺失，交给人工确认 |

## 3. 通用前端安全规则

通用规则用于补充发布门禁。报告时必须证明风险链路；不要只因出现危险 API 名称、未知变量或缺少可选加固措施报问题。

| 分类 | 阻断条件 | 不报告 / 复核边界 |
| --- | --- | --- |
| XSS / DOM 注入 | 未经可靠净化的可控数据进入 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、`srcdoc`、`dangerouslySetInnerHTML`、`v-html` 或 HTML 解析入口 | 不报告常量模板或完全受控静态字符串；不报告无法证明数据可控或缺少净化的危险 API 名称 |
| 消息与跨窗口通信 | 消息处理器在未精确校验 `event.origin`、`event.source` 和消息结构时执行跳转、DOM 写入、请求、存储、鉴权、下载等敏感操作；通过 `postMessage(..., "*")` 发送敏感数据 | 不要仅因存在 `message` 监听器报问题；必须证明消息内容会影响敏感操作 |
| 敏感信息与存储 | 前端硬编码有效密码、私钥、访问令牌、会话凭证或特权 API 密钥；敏感数据发送到外域或写入 URL、日志、错误上报；`localStorage`/`sessionStorage`/Cookie 明文持久化敏感凭证；JavaScript 创建认证 Cookie | 测试字符串、示例占位符、不可用凭证不报；tracker 仅存储自动生成的匿名追踪 ID（`_hp_tracer_clt`、`hp_tracker_clt`、`hp-tracer-session-id`）或向 `hermes.hupu.com` 发常规埋点不报，但不得包含访问令牌、手机号、openid、unionid、用户 ID 等敏感身份信息 |
| 其他客户端安全 | 可控键造成原型污染；可控路径造成路径越界；仅靠前端校验实施核心鉴权；使用 `Math.random()` 生成安全令牌、签名或验证码 | 必须证明安全边界依赖前端或数据进入危险 sink |

需要重点阅读上下文的可疑线索：

- 超长字符串、大段 base64、无意义变量混淆。
- 隐藏 iframe、动态拼接远程脚本/样式/资源 URL、外链脚本或远程模块加载链路来源不清。

## 4. 改写与替代基线

| 需求 | 推荐实现 |
| --- | --- |
| 发起业务请求 | `window.ColorboxAI.request({ url, method, headers, data, timeout })` |
| 页面状态切换 | 单页内 DOM/路由状态切换，不跳外链、不开新窗口 |
| 展示可复制内容 | 渲染为可选中文本，由用户手动复制 |
| 视觉全屏 | CSS 布局实现沉浸式页面，避免调用全屏 API |
| 动态逻辑 | 静态分支、函数映射、普通对象配置，避免字符串执行 |
| 本地资源 | 打包进输入包并使用可解析相对路径 |

## 5. 发布门禁扫描清单

扫描 HTML/HTM/JS/CSS，命中下列模式后必须结合上下文判断是否阻断或人工复核：

```text
fetch( / XMLHttpRequest / axios / $.ajax / navigator.sendBeacon
new WebSocket( / new EventSource( / new RTCPeerConnection(
window.ColorboxAI.request
setInterval( / setTimeout( / while ( / for (;;) / recursion / retry / nextPage
http:// / https:// / //
localhost / 127.0.0.1 / 0.0.0.0 / 10. / 172.16. / 192.168. / .test
eval( / new Function( / WebAssembly. / atob( / import(
<iframe / <frame / <frameset / <object / <embed
window.open( / target="_blank" / download / FileSaver / Blob(
location.href / location.assign( / location.replace( / meta http-equiv="refresh"
<form / action= / formaction=
navigator.geolocation / navigator.clipboard / document.execCommand(
navigator.bluetooth / navigator.usb / navigator.hid / navigator.serial
Accelerometer / Gyroscope / Magnetometer / DeviceOrientationEvent
getDisplayMedia / requestFullscreen / webkitRequestFullscreen
innerHTML / outerHTML / insertAdjacentHTML / document.write / srcdoc / dangerouslySetInnerHTML / v-html
postMessage( / addEventListener("message" / addEventListener('message'
localStorage / sessionStorage / document.cookie / Math.random(
__proto__ / constructor / prototype
```

允许保留的常见模式：

```text
window.ColorboxAI.request({ ... })         # 已证明最终走标准 SDK，且 URL 公开或在白名单中
HupuBridge / window.HupuBridge / er.base.* / er.navigate.*  # 普通非网络 JSBridge，不属于 SR-001
@hupu/tracker / sendEventByUrl / new Image(1, 1).src / hermes.hupu.com / a_key  # tracker 埋点放行；仍查外域和敏感数据外传
addEventListener(...)                      # 非 message 敏感操作，或 message 已校验 origin/source/结构
静态 import / 本地 script src               # 路径可解析到包内允许扩展名
静态模板字符串                              # 不含可控数据或已可靠净化
localStorage / sessionStorage / Cookie      # 不存储敏感凭证，不外传
_hp_tracer_clt / hp_tracker_clt / hp-tracer-session-id  # tracker 匿名追踪 ID，可用 localStorage/sessionStorage 存储；不得混入敏感身份信息
Canvas 2D / CSS 动画 / Pointer Events       # 不调用禁用设备能力
```
