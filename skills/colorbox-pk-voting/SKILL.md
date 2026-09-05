---
name: pk-voting
description: 使用活动数据存储、CloudBase 请求与 OSS 文件上传创建可运行的移动端 PK 投票 H5；适用于双选对战、方案二选一和候选人 PK 投票，不用于静态投票图片、后台报表或现金博彩。
metadata:
  required-skills:
    - act-cloudbase
    - colorbox-cloud-request
    - colorbox-oss-upload-file
---

# PK 投票功能模板

当用户提出“实现一个 PK 投票功能”或同义需求时，交付一个真实可运行的移动端原生 H5。页面展示两个候选项的票数与进度，允许用户在规则允许时投票，并在服务端确认后刷新结果。

必须组合以下能力：

- `act-cloudbase`：复用活动的 `activity_api` 云函数、PostgreSQL 和 `/api` 网关保存对阵配置、投票明细与汇总票数。
- `colorbox-cloud-request`：安全访问公开读取、投票状态和投票接口。
- `colorbox-oss-upload-file`：用户主动选择应援图或投票凭证时，使用 `window.ColorboxAI.oss.uploadFile` 上传 `Blob`/`File`，成功后把 CDN URL 作为可选的 `proofUrl` 提交；不自建上传接口。

## 实施顺序

1. 先阅读 `example/migrations/20260828220000_create_pk_vote.sql` 和 `example/README.md`，在 `act-cloudbase` 预置的 `activity_api` 基线上改造。保留环境、网关鉴权、CORS、迁移留档和 `x-cloudbase-context` 身份约定，不创建第二个云函数。
2. 复制 `example/index.html` 到活动的 `h5/index.html`。替换活动环境 ID、网关返回的真实 API 地址、对阵 ID 和标题；页面必须是单一原生 HTML/CSS/JS，可双击打开，不引入 Vue、React、Vite 或运行时打包器。
3. 页面先公开读取对阵和票数，再使用 `window.ColorboxAI.cloud.request` 读取投票状态和提交投票；由服务端从网关注入的上下文识别请求用户并校验业务参数。禁止页面直接 `fetch`、拼接 Bearer、提交用户身份字段或从 URL 接受活动身份。
4. 应援图上传只在用户主动选择文件后执行。先校验图片类型且不超过 10 MB，再调用 `window.ColorboxAI.oss.uploadFile({ file, filename })`；只有 `downloadUrl` 是绝对 `https://` URL 时才保存为 `proofUrl`。上传失败不伪造成功、不自动重试。
5. 投票请求只提交业务字段 `{ matchId, side, proofUrl? }`。服务端从网关注入的 context 取得用户身份，在一个数据库事务中校验对阵时间、状态、side 白名单和重复投票，再写入明细并递增汇总票数。写接口内不扫描整张投票表。
6. 页面覆盖加载、空数据、网络失败、上传中、投票中、已投票、活动未开始/已结束和重复投票状态。错误优先展示服务端 `message`；HTTP `401/409/429/5xx` 给出可执行提示，不能把乐观更新当成服务端成功。
7. 候选名称、描述、错误信息和图片地址都视为外部数据。使用 `textContent`/DOM 属性渲染，图片只接受绝对 `https://` 地址。按钮在请求期间禁用，避免重复投票和上传。
8. 本地 `file://` 双击预览可使用内置演示数据；部署页面不得用演示数据掩盖配置或接口错误。上线前应用迁移、部署固定 `activity_api`、创建读写鉴权匹配的网关入口，并把 `queryGateway` 返回的实际 URL 写入 H5 和活动 manifest。

## 示例目录

- `example/index.html`：保留附件简洁视觉风格的原生移动端投票页，包含公开结果、用户状态、投票、可选应援图上传和完整状态处理。
- `example/cloudfunctions/activity_api/`：固定 `activity_api` HTTP 云函数，提供 `/health`、公开对阵/结果、用户投票状态和事务投票路由。
- `example/migrations/20260828220000_create_pk_vote.sql`：对阵、候选项、投票明细、索引、权限、演示数据和原子投票 RPC。
- `example/README.md`：接口契约、网关鉴权拆分、配置和冒烟检查。

## 业务与数据约束

- 默认每个用户每场只能投一票，由 `(match_id, puid)` 唯一约束保证；如业务允许每日多票，应在迁移与 RPC 中增加业务日期维度，不能用进程内内存计数代替数据库约束。
- 公开读取只按指定 `matchId` 查询一条对阵和两条候选记录；结果读取使用候选表中的汇总票数，不在请求时聚合整张投票明细。
- `proofUrl` 仅作为可选业务附件，必须是长度受限的 HTTPS URL，不作为投票身份凭据。
- 候选项 `side` 只能为 `left` 或 `right`；活动开始、结束和冻结状态以服务端时间与数据库配置为准。
- 生产环境需要在上传链路或服务端补充图片内容安全检查；客户端 MIME/大小校验不能替代服务端校验。

## 交付标准

- `h5/index.html`：两个候选项、票数/百分比、投票动作、当前用户状态、可选应援图上传、状态提示和移动端适配。
- `activity/migrations/<14位时间戳>_*.sql`：对阵、候选项、投票明细、原子投票 RPC、必要索引/唯一约束、显式 `GRANT` 和 RLS 处理。
- `activity/cloudfunctions/activity_api/`：固定 `activity_api` 函数；用户身份只从 `x-cloudbase-context` 读取。
- `activity/activity.manifest.json`：记录实际环境、表、数据库例程、函数、网关 URL、权限和冒烟结果。

完成后说明真实对阵 ID、投票限制、截止时间、网关读写鉴权配置、应援图用途和异常降级行为。`example/` 只作可复制参考，不直接作为活动线上资源发布。
