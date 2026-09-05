# 上传 H5 实时预览二维码

对应 SKILL 第 10 步。第 7–9 步（冒烟 + manifest + 审计）完成后执行；在 deliver 阶段交付确认单的「可选下一步」里**先询问**是否需要生成二维码，收到开发者明确确认后再执行（runbook deliver 阶段门禁一致：先问后做）。

> **H5 线上地址唯一来源**：H5 的线上/预览地址一律通过本脚本（后台上传 `live-preview`，OSS 域名 `activity-static.hupu.com`）获取。**全程禁止**使用 CloudBase 静态托管部署 H5（`manageHosting` / `tcb hosting deploy` / `*.tcloudbaseapp.com` 静态托管域名）；CloudBase 环境明细里的静态域名仅供只读识别，不得上传、绑定或回传开发者。

## 门禁

未收到用户「确认」前：禁止跑脚本、禁止生成二维码。询问动作在 deliver 交付确认单的「可选下一步」里完成（见 deliver-confirm.md），**不单独另发一轮消息**。

**确认内容**（暂不上传可直接说）：

```text
即将上传实时预览并生成虎扑 Schema 二维码，请确认。
- 预览链接是**临时链接，1 小时后自动失效**，仅供扫码看效果，**不代表上线**
回复「确认」后开始；暂不上传请直接说。
```

## 命令

```bash
# 零参数固定执行：projectId / html=./h5 / env=sit / 本地产物=h5.zip / 输出=preview-qr.png / 后台地址 / token 全部打包时写死
# 脚本先把 ./h5 打包成 ./h5.zip 写本地（index.html + css/js/图片等依赖资源），再以 multipart 上传（含依赖资源，后台按与发布一致规则解压落 OSS）
# 一次请求直出：后台在 JSON 响应内返回 qrcodeDataUrl（base64 PNG），脚本自动解码并校验 PNG 魔数后写入 ./preview-qr.png，
# 不依赖 CDN 二次下载、无需 --format；未绑定活动身份时脚本直接报错退出
node act-cloudbase/scripts/update-activity-html.js
```

完成后回传本地二维码路径，以及脚本输出的 `previewUrl` / `schema`（若有）。

## 临时链接说明（回传 previewUrl 时必须同时告知）

- previewUrl 是**临时预览链接，1 小时后失效**：后台会在上传 1 小时后删除 OSS 预览对象，链接随即 404。
- 预览**不等于上线**：真实文件在根目录 `h5/`（本地），正式对外可用需要完成部署并上传到后台（deliver 阶段已部署的才是正式版）。
- **线上地址唯一来源**：回传开发者的线上/预览地址只能是本脚本输出的 `previewUrl`（`activity-static.hupu.com` 临时链接）；**禁止**改用 CloudBase 静态托管域名（`*.tcloudbaseapp.com`）或其他 CloudBase 域名。
- 预览二维码与「确认交付」分开：确认单里先问、收到回复后再跑脚本；未获开发者确认前禁止跑脚本。
