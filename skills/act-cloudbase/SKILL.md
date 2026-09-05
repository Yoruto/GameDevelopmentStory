---
name: act-cloudbase
description: >-
  为活动页面提供数据存储能力：用户提交、报名、投票、留言等参与数据都能安全保存，页面可随时读取并展示，无需自行搭建服务器。
  在出现 Colorbox activity.json、需要开通/部署或再次调整活动 H5 后端，或用户要求在 CloudBase 上提供活动 API 时使用。
---

# Act CloudBase

读取 `activity.json`（活动身份）与 `credentials.json`（云环境凭据，可选）后：部署 PostgreSQL 数据表 + `activity_api` 云函数 + 网关 + H5 联动，冒烟后写 manifest。

> **提示**：活动云环境（EnvId、PostgreSQL 数据库、Custom 自定义登录）已由 Colorbox 平台提前自动开通并就绪，Agent 可直接从 `credentials.json` 中获取具体的 `envId` 与 `alias`（身份在 `activity.json`），无需再进行物理环境创建。
>
> 环境开通时平台会同时预置一套 **demo 基线**（`activity_api` 含 `/health`、公开读 + 受保护写示例、网关路由、`demo_items` 表），已接真实环境数据。Agent 的职责是**在基线上改造**，不是从零创建。

## 开发者沟通纪律（对开发者只发两种消息）

- **决策请求**：业务语言、带推荐、≤3 题；问题编号=决策 id（D1/D2…），禁止 Q0 等自创编号。
- **结果告知**：一句话业务结果（如「页面做好了，点链接预览」）。
- **动作黑名单**：分支、门禁、advance/confirm/decide、自检、决策树/前沿、EnvId、credentials.json、物理路径、候选环境数、MCP、云函数、PostgreSQL、路由、manifest 等机制词**不进开发者消息**；确认单只放可点击预览链接。
- **确认必须留证据**：每个开发者确认阶段（requirements/plan/security-review/deploy/deliver），收到开发者明确回复后先写 `activity/confirmations/<阶段>.md`（开发者原话），再 `state.py confirm <阶段>`；缺证据状态机会拒绝。自检类阶段（implement/test）的 confirm 是自检语义，但**进入 deploy（真实变更）前必须向开发者确认一次**，不能静默推进。
- **决策树先展示后落定**：提问前 `state.py present --frontier` 标记已展示，未展示的决策 `decide` 会被拒绝，禁止替开发者代答。

## 每轮状态（先查状态，再做）

- **先运行 `python3 skills/runbook/state.py current`** 拉取当前阶段、门禁与下一步命令，再开始本步工作。状态唯一来源是 `skills/runbook/PROCESS.md` + `skills/runbook/state.py`，不要凭印象猜阶段。
- 阶段细节按输出中的「读」列出的文档按需阅读，不要批量浏览无关文档。

## 身份（必懂）

```text
ColorboxAI.cloud.auth → Bearer
ColorboxAI.cloud.request → 网关验 token、注入 context
云函数只读 context 里的 puid 写 PostgreSQL 表
```

- Ticket / 私钥只在 Colorbox 与鉴权中心；H5 **只**调 `cloud.auth` / `cloud.request`，不接触 ticket，禁止手写 `fetch` 拼 Bearer
- 活动环境已由 Colorbox 后端全自动开启 Auth V2 自定义登录 provider（`custom`）并禁用传统密码登录
- 禁止 body/query 传 `puid`；业务数据使用 PostgreSQL 数据表

## 硬规则

- 身份与凭据分离：`activity.json` 只含活动身份（`activityId`、`activityName`、`alias`，非敏感，随仓库）；`credentials.json` 含云凭据（`envId`、`apiKey`、`stsCredentials`，敏感，gitignore，可按需轮换）
- **无 activity.json 也能运行状态机**（默认身份 `workspace`）；云凭据仅部署/冒烟阶段按需读取
- **平台预置 demo 基线**：环境开通即预置 `activity_api`（含 `/health`、公开读 + 受保护写示例）、网关路由与 `demo_items` 表，已接真实环境数据；Agent **在基线上改造**（改表 / 改函数 / 改路由），禁止另建第二套函数或表，demo 资源须原地改造或显式清理
- **第 3 步默认生成纯静态 H5**：在根目录 `h5/` 下生成 `h5/index.html` 单一原生 HTML 文件（css/js/图片等静态资源同放 `h5/` 下；严禁 Vue/React/Vite 脚手架），数据顶部写死演示，无网络依赖，双击即可本地预览
- **未收到开发者「确认」前**：禁止将 demo 基线改造为业务资源（SQL/云函数/路由）；确认前仅允许**验收基线**（health 200、无 token 写 401）
- **H5 上传前先打包 zip**：`update-activity-html.js` 零参数固定执行，把根目录 `h5/` 整目录打包成 zip 并**先写本地产物 `h5.zip`**，再 multipart 上传（含 css/js/图片等依赖资源，后台按与发布一致规则解压并落 OSS）；projectId / 后台地址 / token / env / 输出路径全部打包时写死
- **未收到用户对预览二维码的确认前**：禁止跑 `update-activity-html.js`
- **H5 禁止部署到 CloudBase 静态托管**：全程禁止使用 CloudBase 静态托管（`manageHosting`、`tcb hosting deploy`、`*.tcloudbaseapp.com` 静态托管域名）发布/上传 H5；「刷新环境明细 → 发现静态托管域名 → 上传 H5 获取真实线上地址」是错误路径，**一律不得执行**。H5 的线上地址/预览地址**唯一来源**是后台上传临时链接（`update-activity-html.js` → live-preview，OSS 域名 `activity-static.hupu.com`），见 [preview-qr.md](references/preview-qr.md)；CloudBase 环境明细中的静态域名仅作只读识别
- **MCP 鉴权规范**：与 CloudBase MCP 首次交互时，**必须**先使用 `credentials.json` 凭证执行 `auth(action="login_by_api_key")` 完成登录与环境绑定（严禁调用 `auth(action="start_auth")`，防止触发设备码扫码弹窗；凭据缺失时先向用户确认是否真的需要云服务）。
- **跨域硬规则**：所有面向 H5 浏览器跨域调用的网关路由必须开启跨域校验（`EnableSafeDomain: true`），网关据此按安全域名白名单注入 `Access-Control-Allow-Origin`，云函数禁止自设该头；白名单用 `envDomainManagement` 维护（来源 = H5 实际部署域名）。操作与验收见 [deploy.md](references/deploy.md) §B.4/§C。
- **性能与容量规范**：索引 / 热点写见 [database.md](references/database.md)「索引与写路径」；多实例内存态、读缓存、OPTIONS 见 [backend.md](references/backend.md)「云函数实例与状态」；冒烟见 [deploy.md](references/deploy.md) §C「性能冒烟补充」。
- **PostgreSQL 访问陷阱**：`app.rdb()` **无** `.rpc()`；`getClientCredential()` 在 accessKey 模式下返回**字符串**而非 `{ access_token }`；受保护写 500 / 用户表行数为 0 时查 [backend.md](references/backend.md)「常见陷阱」与「调用 PostgreSQL 函数（RPC）」；冒烟须做 apiKey Bearer 闭环（[deploy.md](references/deploy.md) §C 示例 3）。
- **禁用 UI 自动化测试**：本 Skill 的所有验证与冒烟测试仅允许使用命令行 `curl` 或 Node 脚本进行 HTTP 接口调用，**严禁调用 Chrome MCP / DevTools / Playwright 等工具做网页 UI/视觉回归测试**。
- 对外确认单禁止技术实现细节 → [plan-confirm.md](skills/runbook/references/plan-confirm.md)
- **写入纪律**：写文件命令禁止夹带删除/清理操作（`rm`、清空、覆盖清理），先写后清必须分两步；大文件（页面/脚本/SQL）先写骨架再分块填充，禁止一次性生成数百行后整段返工
- **部署目标纪律（先查后开）**：云服务=需要时，先运行 `skills/act-cloudbase/scripts/query-cloudbase.js`（只读）查询该 activityId 是否已有环境（`GET /api/v1/cloudbase/projects/:projectId`）——已有则运行 `skills/act-cloudbase/scripts/create-cloudbase.js` 直接复用其 `envId` 并写回 `credentials.json`，**禁止盲目重新开通/部署**；确无环境时 `create-cloudbase.js`（唯一开通入口）才调用 `POST /api/v1/cloudbase/projects/:projectId/activate` 开通并轮询。开通/部署是真实变更，**执行前必须先获得开发者确认**（deploy 阶段门禁，现有流程不变）。仅当平台开通不可用时，才用业务语言向开发者索取「环境链接/环境 ID」，禁止从候选环境列表猜测，禁止在目标未明确时执行任何部署动作
- **环境明细盘点（只读）**：部署前/后可用 `skills/act-cloudbase/scripts/query-cloudbase.js` 直接拉取环境现状（环境概要 / 网关路由 / 云函数 / PG 表结构，全只读），落盘 `env-detail.json`；等价后台接口 `GET /api/v1/cloudbase/projects/:projectId/inspect`，详见 [deploy.md](references/deploy.md) §A.3
- **开发者消息纪律**：对开发者的提问/确认单禁止 Q0/Q1 编号，禁止出现 EnvId、credentials.json、PostgreSQL、路由等实现词，一律用业务语言（「环境链接」「后台数据」）

## 工作流

```text
- [ ] 1. 读身份与凭据 (activity.json → activityId/alias；需要云时 credentials.json → envId)
- [ ] 2. 绑定环境并验收 demo 基线              → deploy.md §A
- [ ] 3. 业务计划与静态 H5 预览确认              → skills/runbook/references/plan-confirm.md
- [ ] 4. 在预置基线上改造后端与接入真实 API      → database.md + backend.md + frontend.md
- [ ] 5. 发布安全审查（decision=passed 才放行）  → skills/runbook/references/security-review/
- [ ] 6. 部署（含网关路由验收清单）             → deploy.md §B
- [ ] 7. 冒烟与规则对齐自检                      → deploy.md §C
- [ ] 8. 写 manifest（先清理测试资源再写）      → deploy.md §C
- [ ] 9. 审计通知
- [ ] 10. 预览二维码                            → preview-qr.md
```

每步先读链接文档再执行；下面是 Agent 必须知道的「做什么 / 何时停 / 完成标准」。

### 1. 读身份与凭据

- 根目录 `activity.json`（可选）声明活动身份：`activityId`、`activityName`、`alias`；无此文件时状态机以默认身份 `workspace` 运行。
- 需要云服务时（requirements 阶段确认「云服务=需要」），部署前读 `credentials.json`（可选）取已就绪的 `envId` / `apiKey` / `stsCredentials`；缺失则向用户确认，不臆造。
- 后续环境别名、活动 ID 都用 activity.json 的字段；脚本的 `PACKAGED_PROJECT_ID` 在技能包打包时已按该字段写死，AI 无需传参。

### 2. 工具准备与绑定已就绪环境

读 [deploy.md](references/deploy.md) **§A**：
1. 确认 CloudBase MCP (`cloudbase-mcp`) 服务具备运行条件（本 Skill 全流程不依赖 CloudBase CLI (`tcb`)）。
2. MCP 交互首动作调用 `auth` 完成登录与环境绑定：
   `auth(action="login_by_api_key", apiKey=creds.apiKey, apiKeyEnvId=creds.envId)`（creds 来自 credentials.json）
   一秒静默完成身份认证与 `ENV_READY` 就绪。随后**验收预置 demo 基线**（读 deploy.md §A 第 4 节：health 200、无 token 写 401）。在收到开发者确认前，不改造任何业务资源。

### 3. 业务计划与静态 H5 预览确认

读 [plan-confirm.md](skills/runbook/references/plan-confirm.md)，先判定**新建 vs 已有改造**：
- 新建（无基线）：在 `h5/index.html` 生成单一原生 HTML（数据写死），确认单附可点击 file 链接供开发者自行预览（**禁止调起浏览器/界面调试工具自测**），发完整业务确认单。
- 已有改造（index.html 已存在 / 开发者给了参考）：以现有 index.html 为基线改动，产出改动版 + `activity/plan/changes.md`（改动点清单：位置/原样/新样），确认单用「三问结构」：改了什么？没改什么？数据和规则受不受影响？

**停**：等开发者回复「确认」。未确认禁止进入第 4 步；开发者提修改后必须重新确认，前次确认作废，不要边做边改。

### 4. 在预置基线上改造后端与接入真实 API

确认后**不再**向开发者问技术方案。
1. 在预置基线上改造：复用 / 更名 `demo_items` 表（迁移 SQL 留档 `activity/migrations/<14位时间戳>_<name>.sql`）、改造 `activity_api` 云函数、调整网关路由（读 [database.md](references/database.md) + [backend.md](references/backend.md) + [deploy.md](references/deploy.md) **§B**）。
2. 将 `h5/index.html` 的静态变量与模拟操作替换为 `ColorboxAI.cloud.request` 正式接口，保持 DOM 与样式不变（读 [frontend.md](references/frontend.md)）。
3. **自检**：确保静态预览承诺的所有规则与数据（如限制次数、记录落库）在 PostgreSQL 数据库与云函数中均已真实实现；并按 [database.md](references/database.md)「索引与写路径」与 [backend.md](references/backend.md)「云函数实例与状态」自检索引、热点写、读缓存与内存态。

```text
activity/
├── migrations/                    ← database.md
├── cloudfunctions/activity_api/   ← backend.md（含 .cloudignore / package.json / scf_bootstrap / index.js）
├── h5/                          ← frontend.md（index.html + css/js/图片等静态资源）
└── activity.manifest.json         ← 先占位，第 8 步写全
```

| 固定约定 | 值 |
|----------|-----|
| 云函数 | `activity_api` |
| 网关前缀 | `/api` |
| 表/函数业务名 | snake_case，**不拼** activity id |

### 5. 发布安全审查

对 implement 产出的前端实现做**只读发布安全审查**，decision 为 `passed` 才允许部署。读
[security-review/SKILL.md](skills/runbook/references/security-review/SKILL.md) 与
[security-review/references/platform-gates.md](skills/runbook/references/security-review/references/platform-gates.md)（SR-000~SR-006 判定基线）：

1. 构建 staging 与 manifest：

   ```bash
   python3 skills/runbook/references/security-review/scripts/build-review-package.py
   ```

2. 运行确定性预扫描：

   ```bash
   python3 skills/runbook/references/security-review/scripts/preflight_scan.py activity/review-package
   ```

3. 围绕 scanner 候选证据做小窗口确认，按协议输出 `security_review_json_v1` JSON，并**原样落盘**为 `activity/security-review.json`。
4. `decision=passed` → `state.py confirm security-review` + `advance`；`decision=needs_review`（人工复核通过后可放行）或 `blocked` → `state.py reject` 回 implement 整改，禁止 advance 到部署。

本阶段只审查前端产物（`.html/.htm/.js/.css`），不执行/不构建/不联网；云函数安全由第 7 步冒烟覆盖。

### 6. 部署

读并执行 [deploy.md](references/deploy.md) **§B**：PostgreSQL 建表/迁移（MCP `managePgDatabase(action="applyMigration")`，含表级 `GRANT` 赋权，勿用 `execute` 跑建表 DDL）→ 云函数部署（MCP `manageFunctions`）→ 网关（MCP `manageGateway` 建路由，传 `upstreamResourceType="WEB_SCF"` 与 `enablePathTransmission=true`，**勿传** `type="HTTP"`；面向 H5 跨域调用的路由须开启跨域校验，见硬规则；独立路由依 EnableAuth 配置）→ 通过 `queryGateway(action="listRoutes")` 查真实网关域名并核对，回写 H5 的 `ACTIVITY_API_BASE` / `ACTIVITY_ENV_ID`。

### 7. 冒烟与规则对齐自检

读 [deploy.md](references/deploy.md) **§C**（含性能冒烟补充），按最简原则验证：

- 公开读（如 `GET /api/demo/list`） → 发送 curl 校验响应 HTTP 200
- 受保护写接口（如 `POST /api/demo/submit`） → 发送不带 Token 的 curl 请求，确认收到 HTTP 401 / `MISSING_CREDENTIALS` 网关拦截成功即可
- **禁用 UI 自动化**：冒烟验证阶段切勿调用 Chrome MCP / DevTools / 浏览器模拟器做网页渲染与交互回归，只通过标准 `curl` 或脚本进行接口校验。

### 8. 写 manifest

按 §C 写全 `activity/activity.manifest.json`（`metaActivityId`、`alias`、`envId`、`resources`、`publicBaseUrl`、`verification`）。冒烟通过则 `activity.status=verified`。 `publicBaseUrl` 必须是 `queryGateway(action="listRoutes")` 查出的 **HTTPSERVICE 网关域名**（如 `https://<envId>-<appid>.<region>.app.tcloudbase.com`），**严禁**填写 `*.tcloudbaseapp.com` 静态托管域名；H5 页面本身的线上地址不写入 manifest，以后台上传临时链接为准。

### 9. 审计通知

```bash
node skills/runbook/scripts/notify-dingtalk.mjs activity/activity.manifest.json
```

脚本调用 ai-game 服务（后台地址打包时已写死），由 ai-game 服务推送钉钉机器人审计通知；失败**不**回滚已部署资源。

### 10. 预览二维码

固定步骤。交付确认单中**先询问**是否生成（模板见 [deliver-confirm.md](skills/runbook/references/deliver-confirm.md)），未获确认禁止跑脚本。读 [preview-qr.md](references/preview-qr.md)：用户回复「确认」后再跑 `update-activity-html.js`，回传二维码路径与 previewUrl。**previewUrl 是临时链接，1 小时后自动失效**（后台清理 OSS 对象），仅供扫码看效果、**不代表上线**；真实文件在根目录 `h5/`（本地），正式版以部署上传到后台的为准。

> **线上地址唯一来源**：H5 的线上/预览地址一律以 `update-activity-html.js` 上传后台得到的 previewUrl（`activity-static.hupu.com` 临时链接）为准；**禁止**改用 CloudBase 静态托管域名或其他 CloudBase 域名回传开发者。

## 参考

- [references/deploy.md](references/deploy.md) — 环境、密钥、部署、冒烟、manifest
- [skills/runbook/](skills/runbook/) — 流程引擎（PROCESS.md 阶段定义 + state.py + references/requirements.md、thinking.md、plan-confirm.md + 发布安全审查 security-review/）
- [references/security-review/](skills/runbook/references/security-review/) — 发布安全审查（SKILL.md 协议 + platform-gates.md 基线 + preflight_scan.py + build-review-package.py）
- [references/plan-confirm.md](skills/runbook/references/plan-confirm.md) — 方案确认单
- [references/deliver-confirm.md](skills/runbook/references/deliver-confirm.md) — 交付确认单（部署完成 + 预览二维码询问）
- [references/database.md](references/database.md) — 表与迁移
- [references/backend.md](references/backend.md) — 云函数与路由契约
- [references/frontend.md](references/frontend.md) — H5 SDK 调用
- [references/preview-qr.md](references/preview-qr.md) — 实时预览二维码
