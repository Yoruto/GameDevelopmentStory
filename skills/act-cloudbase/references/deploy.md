# 部署

对应 SKILL 第 2、5、6、7 步（环境就绪、部署、冒烟、manifest）。

## A. 工具初始化、MCP 绑定与鉴权就绪（第 2 步）

本 Skill 采用 **CloudBase 官方 MCP (`cloudbase-mcp`)** 全量管控工具链，**不依赖 CloudBase CLI (`tcb`)**：
- **MCP 工具 (`cloudbase-mcp`)**：负责云资源盘点、PostgreSQL 结构与数据表校验、云函数构建部署、网关路由建立等全部操作。

### 1. CloudBase MCP 服务就绪说明

本 Skill 遵循腾讯云官方 **[自有品牌模式（无 CAM 依赖企业级 AI 平台方案）](https://docs.cloudbase.net/quick-start/enterprise-ai-platform-no-cam)**。
* **安装/运行方式**：环境若未预装，可通过 `npm install -g @cloudbase/cloudbase-mcp` 安装，或在配置文件中通过 `npx -y @cloudbase/cloudbase-mcp@latest` 启动。**包名是 `@cloudbase/cloudbase-mcp`，不是 `@cloudbase/mcp-server`**。
* **版本要求（已实测 2.25.6）**：`manageGateway` 支持 `upstreamResourceType` 与 `enablePathTransmission`（顶层或 `route` 内均可，见 §B.4）。

> **MCP 使用边界（全流程一律 MCP，无 CLI）**：本 Skill 不安装、不调用 `tcb` CLI。所有操作——建表/迁移（`managePgDatabase(action="applyMigration")`）、云函数部署与删除（`manageFunctions`）、路由增删（`manageGateway`）、资源盘点（`envQuery`/`queryGateway`/`queryFunctions`）、删 PG 表（`managePgDatabase(applyMigration)`）——均走 MCP 完成。

### 2. CloudBase 官方 MCP 静默鉴权绑定

工作区 `credentials.json` 中已打包好了该项目绑定的 `envId` 及管理员级 `apiKey`（`KeyType: "api_key"`）；旧工作区可从 `meta.json` 兼容读取。

#### 部署目标：先查后开（有环境直接复用，无环境才开通）

部署目标处理按「**先查后开**」执行，禁止一上来就开通/部署：

1. **先查（只读）**：运行 `node skills/act-cloudbase/scripts/query-cloudbase.js` 查询该 activityId 是否已有环境（`GET /api/v1/cloudbase/projects/:projectId`，绝不开通）；或直接检查 `credentials.json`——已有 `envId` 即视为已有环境
2. **有环境**：运行 `node skills/act-cloudbase/scripts/create-cloudbase.js` 直接复用并绑定，脚本把 `envId` / `apiKey` / `stsCredentials` 合并写回 `credentials.json` 后退出；环境正在创建时轮询等待，不重复开通
3. **无环境**：运行 `node skills/act-cloudbase/scripts/create-cloudbase.js`（唯一开通入口）调用 `POST /api/v1/cloudbase/projects/:projectId/activate` 开通并轮询直到 `activated`（`--force` 仅用于既有环境失败/已销毁时强制重开）
4. **确认前置**：开通/部署是真实变更，运行开通脚本前必须先获得开发者确认（runbook deploy 阶段门禁，现有流程不变）；后台地址（`DEFAULT_API`）、代理 token（`PACKAGED_SHAPER_TOKEN`）与活动 projectId（`PACKAGED_PROJECT_ID`）都在技能包打包时已写死进脚本，**脚本零参数固定执行**，AI 无需传参、无需读环境变量、无需再读 `credentials.json`/`activity.json`
5. **身份未绑定即拒绝**：技能包未绑定活动（`PACKAGED_PROJECT_ID` 占位符未替换，或为旧工作区默认值 `workspace`）时，`query-cloudbase.js`/`create-cloudbase.js` 会直接报错退出，**绝不使用默认身份开通云环境**；此时应回平台重新下载绑定活动的技能包
5. 脚本不可用/后台接口拒绝时，才回退为业务语言向开发者索取「环境链接/环境 ID」
6. **后台不可达≠向开发者索取**：`query-cloudbase.js`/`create-cloudbase.js` 报 `fetch failed` 时，先确认后台服务在线后再重试，自愈后才允许走「平台开通不可用」回退；禁止把「后台未启动」这类可自愈问题当作需要开发者提供环境的问题抛给开发者
7. **只读≠完成**：`query-cloudbase.js` 查到「无已有环境」不是终点——开通需在开发者确认后运行 `create-cloudbase.js`（唯一开通入口）触发 activate 并轮询直至 activated；禁止把只读查询结果当完成，也禁止跳过开通直接问开发者要环境

Agent 读取 `credentials.json`（凭据缺失则向用户确认是否需要云服务）后，**首动作必须**使用 `auth` 工具完成登录与环境绑定：

```text
auth(action="login_by_api_key", apiKey=creds.apiKey, apiKeyEnvId=creds.envId)  # creds 来自 credentials.json
```

> **重要提示**：
> 1. **首次登录绑定**：与 CloudBase MCP 首次交互时，必须先调用 `auth(action="login_by_api_key")` 完成登录与目标环境绑定（后续无需重复登录）。
> 2. **严禁调用 `auth(action="start_auth")`**：禁止弹出 Device Code 浏览器扫码提示，破坏无感体验。
> 3. 在第 3 步（静态原型预览阶段），**无需调用任何后端或部署工具**，切勿在未收到开发者确认前触发云资源部署。

| 写入 | 内容 |
|------|------|
| `activity.json` | `alias`（身份） |
| `credentials.json` | `envId` / `apiKey`（云凭据） |
| manifest / H5 / 函数 env | `alias`；`envId` / `CLOUDBASE_ENV_ID` = EnvId |

### 3. 环境明细拉取（`query-cloudbase.js`，只读，先查后开前/后均可）

部署前先盘点目标环境现状，避免盲目建资源；部署后复查环境状态也走同一脚本：

```bash
node skills/act-cloudbase/scripts/query-cloudbase.js
```

- 零参数固定执行：`projectId`（`PACKAGED_PROJECT_ID`）、代理 token（`PACKAGED_SHAPER_TOKEN`）、后台地址（`DEFAULT_API`）均在技能包打包时写死，脚本不读 `activity.json`/`credentials.json` 解析身份；未绑定活动时直接报错退出；脚本直接调后台 `GET /api/v1/cloudbase/projects/:projectId/inspect` 拉取明细
- 拉取内容（全部实时、逐项容错，单项失败不阻塞整体）：
  - **环境概要**：`DescribeEnvs` 过滤出该 env 的 `Status`/`Alias`/`Region`/套餐/PostgreSQL 实例/存储桶/静态域名（静态域名仅作只读识别，**严禁**用于部署 H5 或作为线上地址，见 SKILL.md 硬规则「H5 禁止部署到 CloudBase 静态托管」）
  - **网关路由**：`DescribeHTTPServiceRoute` → 每个域名的 `Path`、`upstreamResourceType`、`upstreamResourceName`、`EnableAuth`、`EnableSafeDomain`、`EnablePathTransmission`
  - **云函数**：SCF `ListFunctions`（若账号无 SCF 管控权限自动退化为「网关路由上游 + 平台记录快照」）
  - **数据库表结构**：`ExecutePGSql` 查 `information_schema.columns`，按 `schema.table` 分组列出每张表的列名/类型/可空/默认值；已过滤平台托管/系统级表（`auth` / `storage` / `cloudbase_migrations` schema，以及 `public` 下的 `pg_stat_statements`、`tencentdb_*_probe_table` 等），只保留业务表，避免干扰
- 结果固定落盘 `env-detail.json`，stdout 输出摘要
- 腾讯云凭据由后台统一持有（与后端 `tencent-cloud-client` 一致），本地脚本不读任何密钥/环境变量，直接请求后台 `GET /api/v1/cloudbase/projects/:projectId/inspect` 即可
- 该模式**只读**，不触发任何开通/变更

### 4. 自定义登录与鉴权就绪

Colorbox 后端系统在环境创建/开通时，由服务端自动完成环境登录方式治理：
1. **自动启用 Auth V2 自定义登录 (`custom`)**；
2. **物理关停传统账号密码登录与匿名登录**。

无须手动配置 Provider，Skill 侧只需校验换票入口：

**验收（换票入口）**

通过 HTTP POST 探测：`https://<活动EnvId>.api.tcloudbasegateway.com/auth/v1/signin/custom`（带 `provider_id: "custom"` 及非法 ticket）。
期望响应**不是** `provider not found`，应为无效 ticket 类错误（如 `INVALID_ARGUMENT`）。

### 5. 预置 demo 基线验收（绑定后必做）

环境开通时平台已用超级权限预置 demo 基线，已接真实环境数据：

- 云函数 `activity_api`：`GET /api/health`（公开）、公开读示例 `GET /api/demo/list`、受保护写示例 `POST /api/demo/submit`（`readPuid` + 写 `demo_items`）
- 网关：`/api/health`（`auth=false` 路径透传）、`/api/demo/list`（`auth=false` 路径透传）、`/api/demo/submit`（`auth=true` 路径透传）
- PostgreSQL：`demo_items` 表（含 `puid` 列与 GRANT）

验收基线可用：

```bash
# 1. 公开读 /health：期望 HTTP 200
curl -s "https://<真实网关域名>/api/health"
# 2. 受保护写：不带 Token，期望 401 / MISSING_CREDENTIALS
curl -s -X POST "https://<真实网关域名>/api/demo/submit" -H "Content-Type: application/json" -d '{}'
```

- 记录基线接口形态（`/api/health`、`/api/demo/list`、`/api/demo/submit`），确认与上文一致
- 验收通过后等待开发者确认；确认前**不得**将基线改造为业务资源

---

## B. 部署上线（第 5 步）

只在已绑定 `envId` 的环境操作。预置基线已有函数 / 表 / 路由，一律**原地更新**（`updateFunctionCode`、复用或更名表、`manageGateway(updateRoute)` 调整路由），禁止另建重复资源。

### 1. 盘点环境资源 (MCP)

```text
queryEnv(action="info", envId=creds.envId)
queryFunctions(action="listFunctions")
queryGateway(action="getAccess")   # 若已有函数
```

### 2. 确保 PostgreSQL 数据库表 (MCP / DDL SQL)

校验和创建 PostgreSQL 数据表。
确保：计划表与 SQL 迁移脚本在 `activity/migrations/<14位时间戳>_<name>.sql` 中定义，并用 MCP `managePgDatabase(action="applyMigration", migrationName, migrationVersion, sql, confirm=true)` 应用；用户行为表包含 `puid` 字段与 `GRANT` 权限。规则与定义见 [database.md](database.md)。

### 3. 部署云函数 (MCP)

创建/更新 `scf_bootstrap` 后，**部署前必须先在本地赋予可执行权限**：`chmod +x <.../cloudfunctions/activity_api/scf_bootstrap>`。

使用 `manageFunctions` 部署 `activity_api` 云函数（包含必要环境变量）：

```text
manageFunctions(
  action="createFunction",
  func.name="activity_api",
  func.type="HTTP",
  func.runtime="Nodejs18.15",
  functionRootPath="<.../cloudfunctions 绝对路径>",
  func.envVariables={
    CLOUDBASE_ENV_ID: "<creds.envId>",
    BUSINESS_ACTIVITY_ID: "<activity.activityId>",
    COLORBOX__ACCESS_KEY: "<creds.accessKey>"
  }
)
```

已存在 → `updateFunctionCode`。**不要传** `protocolType`。代码契约见 [backend.md](backend.md)。

### 4. 确保 HTTP 网关与服务路径 (MCP 全流程控制)

网关路由的建置全部由 MCP 完成：`manageGateway(action="createRoute")` 建路由：

⚠️ **核心硬规则（必读）**：
- **所有独立的业务接口路由（无论是公开读还是用户动作/写）都必须在网关显式配置单独的路由条目！**
- **所有面向 H5 浏览器跨域调用的路由必须开启跨域校验（`EnableSafeDomain: true`）**：开启后网关校验 `Origin` 是否在安全域名白名单内，命中则自动注入 `Access-Control-Allow-Origin`（云函数禁止自设该头）；不开启时网关不做任何 CORS 处理，浏览器预检会报 `No 'Access-Control-Allow-Origin' header`。安全域名白名单用 `envDomainManagement` 维护（来源 = H5 实际部署域名，如 `activity-static.hupu.com`）。⚠️ `manageGateway` 不暴露 `EnableSafeDomain` 字段（传入会被静默丢弃），须用 `callCloudApi(service="tcb", action="ModifyHTTPServiceRoute", params={ EnvId, Domain: { Domain: "<HTTPSERVICE专属域名>", AccessType: "DIRECT", Routes: [{ Path: "<路由Path>", EnableSafeDomain: true }] } })` 增量开启，或以控制台「HTTP 网关 → 路由 → 跨域校验」开启，最后用 `queryGateway(action="listRoutes")` 核对。
- **区分 `enableAuth` 逻辑配置**：
  - **公开读路径**（如 `/api` 根基准、`/api/candidates` 列表）：网关路由显式配置为 `enableAuth: false` / `auth: false`；
  - **用户写/动作路径**（如 `/api/posts` 发帖、`/api/records` 提交）：网关路由显式配置为 `enableAuth: true` / `auth: true`（必须单独条目，触发网关解密 Bearer 并自动注入 `x-cloudbase-context`，否则云函数会因缺失上下文报 401）。

1. **MCP 创建初始网关路由**：
   每一个独立 Path 显式创建，区分 `auth` 标志；**每条必须传 `upstreamResourceType: "WEB_SCF"`** 并开启 `enablePathTransmission: true`（勿传 `type: "HTTP"`，那是 `manageFunctions` 的云函数类型参数）：

   ⚠️ **域名识别与绑定硬规则（重要）**：
   - 必须先调用 `queryGateway(action="listRoutes")` 查出环境中的所有默认域名，优先锁定 `DomainType: "HTTPSERVICE"` 类型的网关专属域名（例如 `<envId>-<appid>.<region>.app.tcloudbase.com`）；
   - 调用 `manageGateway` 时，**必须显式提供 `domain` 参数**（指定为 `HTTPSERVICE` 类型的域名，切勿省去 `domain` 参数，防止默认误绑定至 `STATIC_STORE` 静态托管域名导致控制台“HTTP 网关”管理面板显示“暂无数据”）；
   - **仅对 `HTTPSERVICE` 网关域名建路由**；`STATIC_STORE` 静态托管域名只作只读识别，**禁止**在其上创建路由、上传 H5 或作为线上地址（H5 线上地址唯一来源是后台上传临时链接，见 [preview-qr.md](preview-qr.md)）。

   ```text
   manageGateway(action="createRoute", domain="<HTTPSERVICE专属域名>", targetName="activity_api", path="/api", auth=false, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
   manageGateway(action="createRoute", domain="<HTTPSERVICE专属域名>", targetName="activity_api", path="/api/posts", auth=true, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
   manageGateway(action="createRoute", domain="<HTTPSERVICE专属域名>", targetName="activity_api", path="/api/records", auth=true, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
   ```

   ⚠️ **防错提醒**：调用 `manageGateway` 时**必须显式提供 `upstreamResourceType: "WEB_SCF"`**（MCP 实际参数名）。如果误传 `type: "HTTP"` 或省略 `upstreamResourceType`，底层网关可能将类型设为 `SCF`（事件函数）而非 `WEB_SCF`（Web函数），导致网关返回 403 或策略阻断。

2. **HTTP 网关路由创建 (MCP 全流程控制)**：
   网关路由建置一律通过 MCP `manageGateway(action="createRoute")` 完成。

#### 路由验收清单（部署后必查）

`queryGateway(action="listRoutes")` 拉全量路由逐条核对：

- 每条业务路由 `enableAuth` 与预期一致：公开读 `false`、用户动作 / 写 `true`
- 所有 `WEB_SCF` 路由 `enablePathTransmission: true`
- 每条面向 H5 浏览器跨域调用的路由 `EnableSafeDomain: true`（`queryGateway` 返回字段核对；若为 `false`，用 `ModifyHTTPServiceRoute` 增量开启后复查）
- 无指向不存在函数的 stale 路由（如 `/test-*`）；发现残留路由先清理
- 通配域名（`*`）上的路由符合预期，避免与具体域名重复配置导致鉴权行为不一致
- 基础 `/api` 路由 `auth=false` 仅作公开读入口；**每个写路径必须有独立 `auth=true` 条目**，不得依赖 `/api` 兜底

### 5. 回写 H5 与 Manifest

- H5：`ACTIVITY_API_BASE`（必须通过 `queryGateway(action="listRoutes")` 动态读取真实的 HTTP 网关域名，例如 `https://<envId>-<appid>.<region>.app.tcloudbase.com`，切勿静态拼接 `<envId>.service.tcloudbase.com`）、`ACTIVITY_ENV_ID`（EnvId）
- manifest：`publicBaseUrl`、路由、`alias`、`envId`

公网 Base 域名必须通过 `queryGateway(action="listRoutes")` 获取线上的真实域名，不可通过拼接模版假设。**`publicBaseUrl` 只填 HTTPSERVICE 网关域名（`*.app.tcloudbase.com`），严禁填写 `*.tcloudbaseapp.com` 静态托管域名**；H5 页面本身的线上/预览地址不来自 CloudBase 任何域名，唯一来源是后台上传临时链接（`update-activity-html.js` → live-preview，`activity-static.hupu.com`）。H5 鉴权与 `cloud.request` 见 [frontend.md](frontend.md)。

---

## C. 冒烟与 manifest（第 6–7 步）

> **网关生效提示**：
> 使用 `manageGateway(action="createRoute")` 创建新路由后，网关通常需要 30 秒至 3 分钟同步生效，测试前请静默缓冲。

冒烟测试遵循**精简高效验证原则**：
1. **公开读接口（不需要用户信息）**：发送请求校验响应 `HTTP 200` 及数据。
2. **写/动作接口（需要 Token）**：无需伪造复杂 Token，只需发送**不带 Token 的请求**，确认网关成功拦截（响应 `HTTP 401` / `403` 或 `MISSING_CREDENTIALS`），证明 Token 拦截逻辑已生效即可。
3. **（进阶，强烈建议）登录态读写闭环**：用 `credentials.json` 的 `apiKey` 直接作为 `Authorization: Bearer` 请求受保护接口，验证「写→读」数据链路真实贯通（网关会为 apiKey 注入 context，云函数可读出 puid）。**注意**：最低冒烟（1+2）测不出下列问题，闭环测试才能兜住，见下方示例 3：
   - `executePGSql` Rows 解析错误导致「静默空数据」
   - **`rdb.rpc is not a function`**（公开读正常、受保护写 **500**）
   - RPC 凭据错误（`Bearer undefined` → 内部 401，易被当成用户未登录）
   - 闭环后应用 `queryPgDatabase` 查用户行为表行数（如 `demo_items`、`notice_acceptances`）确认 **≥1**，行数长期为 0 说明写路径未打通
4. **跨域（CORS）校验（浏览器直连场景必查）**：用 `curl -i -H "Origin: https://<H5实际部署域名>"` 分别请求 OPTIONS 预检与真实 GET/POST，**断言响应头包含 `access-control-allow-origin: <H5域名>`**。缺失即路由未开启跨域校验（`EnableSafeDomain=false`），需按 §B.4 修复后复测；这也同时验证安全域名白名单是否覆盖该来源。`<H5实际部署域名>` 指后台上传临时链接域名（`activity-static.hupu.com`）或网关域名，**不是** CloudBase 静态托管域名（`*.tcloudbaseapp.com`）。

### 冒烟测试 curl 三个标准示例

**示例 1：公开读接口测试（无需 Token，期望 HTTP 200）**

```bash
curl -s -H "Origin: https://<queryGateway查出的真实域名>" "https://<queryGateway查出的真实域名>/api/demo/list"
```

**示例 2：受保护写接口测试（不带 Token 请求，确认网关拦截生效，期望 HTTP 401 / 403 / MISSING_CREDENTIALS）**

```bash
curl -s -X POST "https://<queryGateway查出的真实域名>/api/demo/submit" \
  -H "Origin: https://<queryGateway查出的真实域名>" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试内容"}'
```

**示例 3：登录态读写闭环（apiKey 作 Bearer，期望写读一致 HTTP 200）**

```bash
KEY=$(node -e "console.log(require('./credentials.json').apiKey)")
# 1. 受保护写：apiKey 作 Bearer，期望 HTTP 200
curl -s -X POST "https://<queryGateway查出的真实域名>/api/demo/submit" \
  -H "Authorization: Bearer $KEY" \
  -H "Origin: https://<queryGateway查出的真实域名>" \
  -H "Content-Type: application/json" \
  -d '{"title":"smoke-test-'"$(date +%s)"'"}'
# 2. 公开读：确认该记录已落库（列表出现对应 title）
curl -s -H "Origin: https://<queryGateway查出的真实域名>" "https://<queryGateway查出的真实域名>/api/demo/list"
# 3. 冒烟后清理测试行：managePgDatabase(action="execute", confirm=true) 删除该 puid/title 的测试数据
```

### 性能冒烟补充

公开读热路径（排行榜 / 列表 / 计数）重复请求，确认有缓存兜底且响应稳定：

```bash
for i in 1 2 3; do curl -s -o /dev/null -w "%{time_total}\n" "https://<真实网关域名>/api/<公开读路径>"; done
```

- 代码自检：严禁使用 `escapeSql` 或动态 SQL 字符串拼接；运行时 CRUD 统一使用 `app.rdb()` 链式查询；**禁止**直接写 `rdb.rpc()`（SDK 无此方法，见 [backend.md](backend.md)「常见陷阱」）
- 高并发自检：公开读热路径（如排行榜、列表）必须包裹 TTL 内存微缓存兜底（见 [backend.md](backend.md)）
- 逻辑自检：`POST` 写接口完成后直接返回成功，严禁在写接口内强行同步跑全表扫描或名次计算
- 迁移自检：高频过滤字段及个人名次查询字段（`score DESC, updated_at ASC`）已建立联合索引（见 [database.md](database.md)「索引与写路径」）

### 清理测试资源（写 manifest 前必做）

一环境一活动：冒烟通过后、写 manifest 前，清理开发期残留：

- 删除联调 / 压测遗留的测试云函数与 `/test-*` 网关路由
- 删除与活动无关的测试表
- 若因联调需要保留，**必须**在 manifest `resources` 中显式标记为测试资源，不得默认残留
- demo 基线若未改造为业务资源：移除 `/api/demo/*` 路由与 `demo_items` 表，不得残留

清完复查：`queryFunctions(action="listFunctions")` 与 `queryGateway(action="listRoutes")` 确认无残留。

### manifest

写入 `activity/activity.manifest.json`，含 `metaActivityId`、`alias`、`envId`、`resources`、`publicBaseUrl`、`verification.ok`；通过则 `activity.status=verified`。

**完整 `activity.manifest.json` Example：**

```json
{
  "metaActivityId": "project-ai-1785240704074",
  "alias": "ai-1785240704074",
  "envId": "ai-1785240704074-d5ely6b2040addc",
  "resources": {
    "functions": [
      "activity_api"
    ],
    "gatewayRoutes": [
      "/api",
      "/api/posts/create"
    ]
  },
  "publicBaseUrl": "https://ai-1785240704074-d5ely6b2040addc-1252166086.ap-shanghai.app.tcloudbase.com",
  "verification": {
    "ok": true,
    "healthChecked": true,
    "postsReadChecked": true,
    "postsWriteChecked": true
  },
  "activity": {
    "status": "verified"
  }
}
```

---

## 排障

| 现象 | 处理 |
|------|------|
| `ZipFile 上传不能大于 1.5MB` | 在云函数根目录新增 `.cloudignore` 忽略 `node_modules`，依赖在线构建；或改用 `--deployMode zip` |
| `permission denied for table <table_name>` | 数据库新建表缺乏表级赋权。在 DDL 迁移文件末尾补全 `GRANT ALL ON TABLE public.<table_name> TO PUBLIC;` 及 `anon, authenticated, service_role` 赋权（见 [database.md](database.md)） |
| `scf:CreateFunction has no permission` | API Key 缺乏腾讯云底层 SCF 的通用创建函数 CAM 权限；需在 CAM 添加权限，或由平台控制台预建函数 |
| 网关对所有路径返回 **HTTP 443**（`x-cloudbase-upstream-status-code: 443`） | 云函数容器启动失败：最常见是 `scf_bootstrap` 未 `chmod +x`，或备用 `executePGSql` 写法把 `app.database` 误写成 `app.database()`（manager-node 里是 getter 属性）。用 `queryFunctions(getFunctionDownloadUrl)` 下载代码包 + 本地 `node --check` / 本地 require 复现定位 |
| 接口返回 200 但数据恒为空 / 列表读不到 | `executePGSql` 的 `Rows` 是「与 `Columns` 对齐的值数组 JSON」不是对象数组，按字段名直接取值会静默为空；用 Columns+index 对齐解析（见 [backend.md](backend.md)） |
| `queryFunctions(listFunctionLogs)` 报 `tcb:GetFunctionLogs` 无权限 | API Key 缺乏 `tcb:GetFunctionLogs` CAM 权限属正常限制。在开发排查阶段可临时在云函数 catch 块中返回 `err.message` / `err.stack`，排查完毕后再恢复生产级脱敏 |
| ticket / 密钥失败 | 确认 Colorbox 系统开通时 `apiKey` 正常生成与分配 |
| `provider not found` / 自定义登录未启用 | 检查鉴权中心配置及 `custom` 登录 provider 开启状态 |
| H5 401 / 未带 Bearer | 确认前端走 `cloud.auth` / `cloud.request({ auth:true })`，勿用手写 fetch |
