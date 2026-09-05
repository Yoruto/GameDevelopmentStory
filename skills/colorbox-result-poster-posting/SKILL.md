---
name: result-poster-posting
description: 使用 OSS 文件上传和虎扑发帖编辑器，创建可运行的结果海报生成与一键发帖 H5 页面；适用于“实现一个带结果海报发帖功能”“把结果生成海报并分享”等请求，不用于仅下载图片或静态展示海报。
metadata:
  required-skills:
    - colorbox-oss-upload-file
    - colorbox-request-bbs-open-post-editor
---

# 带结果海报发帖功能

当用户提出“实现一个带结果海报发帖功能”或同义需求时，生成真实可运行的原生 H5：把页面中的结果数据绘制成分享海报，上传到 Hupu OSS，并在用户主动点击后唤起虎扑发帖编辑器预填标题、正文和海报图片。

## 必须使用的能力

- `colorbox-oss-upload-file`：只使用 `window.ColorboxAI.oss.uploadFile({ file, filename })` 上传 `Blob`/`File`，读取返回的 `downloadUrl`。
- `colorbox-request-bbs-open-post-editor`：只使用 `window.ColorboxAI.request.bbs.openPostEditor({ title, content, imageUrl, topicId?, tagId? })` 唤起发帖。

禁止业务代码直接使用 `fetch`、`axios`、`XMLHttpRequest`、`ali-oss`、`location.href` 或手写 `huputiyu://` Schema。不要把图片 Base64 直接塞进发帖参数，必须先上传并传 CDN URL。

## 实施要求

1. 阅读 [references/api-contract.md](references/api-contract.md)，复制 `example/index.html` 到活动的 `h5/index.html`，替换结果字段、活动标题和可选的专区/话题参数。页面必须是原生 HTML/CSS/JS，可双击打开，不引入 Vue/React/Vite。
2. 将结果数据集中在一个可替换的 `result` 对象中（例如排名、积分、百分位、用户昵称、日期）。所有文字绘制到 Canvas 前做长度截断或换行，避免海报溢出；同时提供可读的 DOM 文本结果，保证无 Canvas 或上传失败时页面仍可用。
3. 可在页面初始化时生成本地海报预览；上传和唤起发帖编辑器必须由用户点击“发帖分享”触发。使用 `canvas.toBlob()` 生成 `image/png` Blob，设置稳定的海报尺寸和清晰度；Blob 为空时停止流程并提示重试。
4. 上传前展示 Loading，调用 OSS 技能并检查返回值和 `downloadUrl`；处理 SDK 不可用、文件过大、网络失败和取消状态，失败时不得唤起发帖编辑器或伪造成功提示。
5. 上传成功后，只有在用户主动点击分享动作时调用发帖编辑器。标题和正文使用结果数据生成，正文中不要写入 Token、PUID 或内部 URL；`imageUrl` 使用 OSS 返回的绝对 CDN URL。检查返回 `code`，不等于 200 时展示返回的 `message`。
6. 分享按钮需要防重复点击：单次流程使用状态机（idle → rendering → uploading → opening → done/error），上传或编辑器调用进行中时禁用按钮；出现 408、429、503 或技能返回错误时停止，不要自动重试或循环唤起。
7. 对昵称、结果文本和服务端错误进行 HTML 转义或使用 `textContent`；不把用户输入拼入 HTML、URL Schema 或任意脚本。海报图片只接受本地 Canvas 产物或可信 OSS 返回值。
8. 本地双击模板时允许使用静态演示结果并显示“演示模式”；在虎扑 App 内验证真实上传和发帖。成功、失败和取消都要给用户明确反馈，并保留海报预览。

## 交付检查

- 页面有结果卡片、Canvas 海报预览、生成/重生成按钮和发帖分享按钮。
- SDK 不可用时，页面仍能展示结果和本地海报；分享动作给出可理解的降级提示。
- 上传严格使用 `ColorboxAI.oss.uploadFile`，发帖严格使用 `ColorboxAI.request.bbs.openPostEditor`；没有自定义网络请求或手写 Schema。
- 依赖技能随 `result-poster-posting` 一起打包，且交付说明包含图片上传成功后的 CDN URL 使用方式、发帖参数和失败行为。
