---
name: lottery-draw
description: 使用活动数据存储和 OSS 文件上传创建可运行的抽卡 H5 页面；适用于“实现一个抽卡功能”“做抽卡/扭蛋/卡池页面”等请求，不用于仅展示静态卡片、离线随机示例或现金博彩/提现玩法。
metadata:
  required-skills:
    - act-cloudbase
    - colorbox-cloud-request
    - colorbox-oss-upload-file
---

# 抽卡功能模版

当用户提出“实现一个抽卡功能”或同义需求时，生成真实可运行的移动端原生 H5，而不是 UI 草图。页面应展示卡池、稀有度、概率和剩余次数，允许用户在服务端确认后抽卡，并提供用户主动上传抽卡结果图/头像等可选素材。默认面向活动积分或免费次数，不实现现金下注、提现或可兑换现金的博彩机制。

## 必须使用的能力

- `act-cloudbase`：在预置的 `activity_api` 和 `demo_items` 基线上改造 PostgreSQL 表、事务 RPC、云函数和 `/api` 网关，保存卡池配置、卡片库存、用户次数与抽卡明细。
- `colorbox-cloud-request`：通过 `window.ColorboxAI.cloud.request` 访问公开和抽卡接口。
- `colorbox-oss-upload-file`：只在用户主动选择文件后调用 `window.ColorboxAI.oss.uploadFile`，把返回的 HTTPS CDN 地址作为可选 `proofUrl` 传给抽卡接口。

## 实施顺序

1. 先阅读 `example/migrations/20260828220000_create_draw.sql` 和 `example/README.md`，在 `act-cloudbase` 预置的 `activity_api` / `demo_items` 基线上改造，保留环境、权限、CORS 和迁移留档约定。
2. 复制 `example/index.html` 到活动的 `h5/index.html`，替换活动 ID、卡池 ID、标题和网关地址。页面必须是单一原生 HTML/CSS/JS，可双击打开，不引入 Vue、React、Vite 或运行时打包器。
3. 公开读取卡池配置和最近公开结果，以及次数、记录和抽卡动作，都使用 `window.ColorboxAI.cloud.request`；由服务端从网关注入的上下文识别请求用户并校验业务参数。禁止页面直接 `fetch`、拼接 Bearer、提交用户身份字段或从 URL 接受用户身份。
4. 抽卡按钮在请求期间禁用并采用 `idle -> drawing -> success/error` 状态。请求只提交 `{ poolId, drawCount, proofUrl? }`；服务端从网关注入的 `x-cloudbase-context` 读取用户，校验活动时间、次数、批量上限、卡池白名单与 `X-Request-Id` 幂等键，再以事务原子扣减库存并写入明细。
5. 页面必须覆盖加载中、空卡池、网络失败、活动未开始/已结束、次数不足、库存不足和重复请求状态。错误优先展示服务端 `message`，不得用本地随机结果伪造线上成功。
6. 概率展示必须来自服务端配置并明确“仅供展示”；稀有度与保底规则用业务语言说明。服务端使用数据库事务内的安全随机源，返回 `drawId`、卡片信息、剩余次数和保底进度，避免返回内部随机种子。
7. 上传素材只在用户点击文件选择后执行：限制图片 MIME（JPEG/PNG/WebP）和 10MB 大小，调用 `window.ColorboxAI.oss.uploadFile({ file, filename })`，检查 `downloadUrl` 是绝对 `https://` URL 后才把它用于抽卡请求。上传失败不能继续抽卡，也不能自动重试或伪造成功。
8. 交付前按 `act-cloudbase` 完成迁移、函数、网关和接口冒烟；真实接入完成后，在工作区根目录运行 `node skills/runbook/scripts/scan-skill-usage.mjs`，让 `h5/index.html` 的技能使用声明与实际 SDK 调用一致。

## 示例目录

`example/` 是可直接参考的最小完整实现，不是第二套独立能力：

- `example/index.html`：原生移动端抽卡页面，包含公开卡池、次数/记录、单抽/十连、上传素材和完整状态处理。
- `example/cloudfunctions/activity_api/`：固定 `activity_api` HTTP 云函数示例，提供 `/health`、`/pool`、`/draw/quota`、`/draw/results` 和 `/draw`。
- `example/migrations/20260828220000_create_draw.sql`：复用 `demo_items` 作为卡池配置，并创建卡片、用户额度、抽卡会话和明细表；事务 RPC 负责加权抽取、库存扣减和幂等。

复制示例时，先替换页面中的活动环境配置，再根据实际奖品和次数规则调整种子数据；不要把示例中的演示结果或环境占位符作为生产回退。

## 抽卡规则

- 默认单抽/十连的 `drawCount` 范围是 1 到 10，服务端再次校验，不接受前端传入的用户 ID、库存或随机结果。
- 概率按卡片 `weight` / 卡池总权重计算，仅供展示；库存耗尽的卡片不参与抽取。所有扣减和明细写入在同一事务中完成。
- `X-Request-Id` 必须是 RFC4122 UUID；同一用户、卡池和请求 ID重试时返回原抽卡会话，不重复扣次数或库存。
- 默认每个用户拥有卡池配置的免费次数；同分/保底等业务规则需要在页面和服务端同时说明，不能只在前端实现。
- 公开接口不返回用户身份和私密明细；涉及用户数据的接口只从 `x-cloudbase-context` 获取请求上下文。

完成后应留下活动的 `h5/index.html`、迁移 SQL、`activity_api` 云函数改造记录和活动 manifest，并说明真实网关 URL、概率来源、次数限制、幂等策略及异常降级行为。`example/` 中的文件用于参考，不应直接作为活动线上资源发布。
