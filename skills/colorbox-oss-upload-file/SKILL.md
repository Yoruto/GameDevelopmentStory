---
name: oss-uploadFile
description: 支持在活动页内通过拍照、相册选择或合成二进制，将文件或图片直传至 Hupu OSS 并获取可用 CDN 地址。适用于用户上传头像、活动晒图、截图分享及二进制文件存证。
---

# Usage

- JS Path: `window.ColorboxAI.oss.uploadFile(params)`

# Constraints

- 必须且仅允许使用 window.ColorboxAI.oss.uploadFile(params) 接口，严禁在业务端直接引入 ali-oss 或手写上传逻辑
- 入参 file 必须为标准的 HTML5 File 或 Blob 对象
- 上传过程中需要妥善处理加载等待状态（如展示 Loading），并防范请求失败或文件过大等边界情况，给予用户良好反馈
- 上传限制：支持单文件最大 10MB，支持主流图片、视频和二进制包文件。
- 本接口在 App 内运行依赖用户登录态。若用户未登录，接口会返回“未登录或登录态失效”错误，业务端需捕获该异常并引导用户去登录。

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| file | object | 是 | 待上传的 HTML5 File 或 Blob 对象 |
| filename | string | 否 | 自定义文件名，可选 |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| downloadUrl | string | 是 | 上传成功后的 CDN 访问绝对链接 |
| name | string | 是 | 上传成功后的文件名 |

# Examples

```javascript
window.ColorboxAI.oss.uploadFile({ file: fileObj, filename: "avatar.png" }).then(res => { console.log(res.downloadUrl); }).catch(err => { console.error("上传失败", err.message); })
```