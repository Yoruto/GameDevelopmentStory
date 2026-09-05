# 云函数与网关

固定名 **`activity_api`**，HTTP 监听 **9000**，网关前缀 **`/api`**。部署步骤见 [deploy.md](deploy.md)。

平台已预置 demo 基线 `activity_api`（`GET /api/health` 公开、公开读示例 `GET /api/demo/list`、受保护写示例 `POST /api/demo/submit`），下方模板与其形态一致；Agent 在基线上改造。

## 请求链路

```text
H5 → Gateway (验证 Bearer) → activity_api (注入 Context) → PostgreSQL 数据库
```

- **公开读**：网关路由配置 `auth=false`（放开匿名/公开读取）
- **用户写 / 动作**：网关路由配置 `auth=true`（网关强校验 Bearer 凭证，校验通过后解密并注入 `x-cloudbase-context`）
- 云函数**严禁**在代码中自行解析 Bearer Token；身份鉴权**完全信任网关注入的 context**。

## 路由与 EnableAuth 配置指南

腾讯云 HTTP 网关按 **Path（路径）** 粒度配置 `enableAuth` 开关，**无法对同一 Path 按 GET / POST 拆分不同的鉴权策略**。为了避免公开读与登录写混合在同一个 Path 导致网关上下文缺失，请遵循以下规范：

| 路由模式 | 示例路径 | 网关 `enableAuth` | 适用场景与最佳实践 |
|---|---|---|---|
| **公开读** | `/api/posts` (GET)<br>`/api/candidates` (GET) | `false` | 所有人无需登录即可拉取列表；网关不拦截也不注入上下文 |
| **动作写（推荐）** | `/api/posts/create` (POST)<br>`/api/votes/submit` (POST) | `true` | **强烈推荐读写分离路径**！网关会自动校验/解密 Bearer Token 并注入 `x-cloudbase-context` |
| **我的数据** | `/api/my/posts` (GET) | `true` | 查询当前登录用户的数据，网关自动解密并注入 `x-cloudbase-context` |

## 读 puid (网关注入 Context 标准算法)

云函数中的 `readPuid(req)` 函数**仅从网关注入的 `x-cloudbase-context` 中提取用户 ID**（网关在 `enableAuth: true` 时会自动解密 Base64/Gzip 并注入）。详细实现参考文末精炼云函数模版示例。

- **硬性禁止**：禁止 body/query 传 `puid`；禁止在云函数内自行解析 `Authorization` 响应头；禁止接触 ticket / 虎扑 token。

## 访问 PostgreSQL 数据库

PG 模式环境（`RuntimeBackends.postgresql === true`）下，业务数据**只用 PostgreSQL**，禁止 NoSQL 的 `app.database()` / `db.collection()`。

**主线（官方推荐 & 运行时必备）**：使用 `@cloudbase/node-sdk` 的 `app.rdb()` 初始化并访问 PostgreSQL 数据库（平台预置的 demo 基线已具备读写权限，云函数内免密访问，无需配置额外凭证）：

```js
const tcb = require("@cloudbase/node-sdk");
const accessKey = process.env.COLORBOX__ACCESS_KEY;

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID,
  accessKey: accessKey,
});
const rdb = app.rdb({ database: "public" });
```

`app.rdb()` 是 Supabase / PostgREST 风格链式查询：
- 读：`rdb.from("<table>").select(...).eq(...).order(...).limit(...)`
- 写：`rdb.from("<table>").insert([...])` / `.upsert(...)`
- 计数：`rdb.from("<table>").select("*", { count: "exact" }).gt(...)`

### ⚠️ 常见陷阱：`app.rdb()` **没有** `.rpc()`

`@cloudbase/node-sdk` 的 `app.rdb()` 底层是 **MySqlClient**（PostgREST 风格表访问），**仅暴露 `.from()`**，**不存在** Supabase 文档里的 `rdb.rpc("function_name", args)`。

若在云函数中直接写 `await rdb.rpc(...)`，运行时会抛出：

```text
TypeError: rdb.rpc is not a function
```

云函数 catch 后通常映射为 **HTTP 500 + `internal server error`**，真实堆栈只在 CLS 日志里。典型表现：

| 现象 | 含义 |
|------|------|
| `GET /api/market` 等**只读表查询**正常 | 只用了 `rdb.from()`，未触达 RPC |
| `POST /api/notice/accept`、`GET /api/my/*` 等**写/用户态读** 500 | 业务代码调了 `rdb.rpc` 或等价缺失 |
| 用户行为表（`notice_acceptances`、`user_wallets` 等）行数长期为 **0** | 带登录态的写路径从未成功 |
| H5 乐观 UI 提示「已进入；云端确认暂未保存」 | 前端 `accept` 失败，多为上述 500，与虎扑登录无关 |

**推荐做法（按优先级）**：

1. **优先用表操作替代函数**：`insert` / `upsert` + 唯一约束做幂等；复杂原子逻辑在 Migration 里用触发器或单次 `managePgDatabase` 运维脚本，运行时仍走 `rdb.from()`。
2. **确需调用 PostgreSQL 函数时**：走 PostgREST HTTP `POST /v1/rdb/rest/rpc/{function_name}`（见下文「调用 PostgreSQL 函数（RPC）」），**禁止**假设 SDK 自带 `.rpc()`。
3. **冒烟必须做登录态闭环**（见 [deploy.md](deploy.md) §C 示例 3）：仅测「无 Token → 401」**无法**发现 `rdb.rpc is not a function`。

### 调用 PostgreSQL 函数（RPC）

Migration 中若定义了 `create function public.<name>(...)`，云函数侧须通过 **RDB REST** 调用，不能写 `rdb.rpc()`。

**端点**：

```text
POST https://{envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/{function_name}
```

**请求头**（与 SDK `rdb.from()` 一致）：

- `Authorization: Bearer <服务凭据>`
- `X-Db-Instance: default`
- `Accept-Profile: public`（或你的 schema）
- `Content-Profile: public`
- `Content-Type: application/json`

**Body**：函数参数 JSON 对象（键名与函数参数名一致，如 `{"p_puid":"123"}`）。

**服务凭据（必读）**：活动云函数使用 `accessKey` 初始化（`COLORBOX__ACCESS_KEY`）时，`app.auth().getClientCredential()` **直接返回 accessKey 字符串**，**不是** `{ access_token: "..." }`。错误写法会导致 `Authorization: Bearer undefined`，RDB REST 返回 **401**——易被误判为「用户未登录」。

```js
// ❌ accessKey 模式下 access_token 为 undefined
const { access_token } = await app.auth().getClientCredential();

// ✅ 兼容字符串与对象，并回退环境变量
async function getRdbServiceToken() {
  const credential = await app.auth().getClientCredential();
  if (typeof credential === "string" && credential.trim()) return credential.trim();
  if (credential?.access_token?.trim()) return credential.access_token.trim();
  const key = process.env.COLORBOX__ACCESS_KEY;
  if (typeof key === "string" && key.trim()) return key.trim();
  const err = new Error("数据库服务凭据不可用");
  err.statusCode = 500;
  throw err;
}

function toBearerToken(token) {
  const t = String(token).trim();
  return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
}
```

SDK 的 `rdb.from()` 在 `token` 为空时会**自动回退 `accessKey`**（见 `openapicommonrequester`）；手写 `fetch` 调用 RPC **没有该回退**，必须显式带上正确凭据。

**可复用 `callRpc` 模板**（挂到 `rdb.rpc` 以兼容业务代码）：

```js
const RDB_DATABASE = "public";

function buildRdbRestUrl(pathSuffix) {
  const envId = process.env.CLOUDBASE_ENV_ID;
  return `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest${pathSuffix}`;
}

async function callRpc(functionName, args = {}) {
  const serviceToken = await getRdbServiceToken();
  const response = await fetch(buildRdbRestUrl(`/rpc/${encodeURIComponent(functionName)}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: toBearerToken(serviceToken),
      "X-Db-Instance": "default",
      "Accept-Profile": RDB_DATABASE,
      "Content-Profile": RDB_DATABASE,
    },
    body: JSON.stringify(args),
  });
  const raw = await response.text();
  let body = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* 保留原文 */ }
  if (!response.ok) {
    const message = (body?.message || body?.error || raw) || `RPC ${functionName} failed (${response.status})`;
    const err = new Error(message);
    // 内部 RDB 鉴权失败映射为 500，避免与用户未登录 401 混淆
    err.statusCode = response.status >= 400 && response.status < 500 && response.status !== 401 ? 400 : 500;
    throw err;
  }
  return { data: body };
}

// 业务侧可继续写 rdb.rpc("ensure_user_wallet", { p_puid: puid })
rdb.rpc = callRpc;
```

**401 vs 500 归因**：

| 响应 | 常见原因 |
|------|----------|
| 网关 401 `MISSING_CREDENTIALS` | H5 未带 Bearer / Token 过期 |
| 云函数 401 `unauthorized` / `请先登录` | 路由 `enableAuth: true` 但无 `x-cloudbase-context` |
| 云函数 500 `internal server error` | `rdb.rpc is not a function`、SQL/权限错误、或 RPC 凭据错误被映射为 500 |
| 带 Bearer 仍 401（修复 RPC 后偶发） | 检查是否 `Bearer undefined`（见上） |

PostgreSQL 函数定义与 GRANT 见 [database.md](database.md)「PostgreSQL 函数（RPC）」。

**硬性防错与安全规范**：
- **严禁使用字符串拼接 SQL (`escapeSql`)**：任何动态字符串拼接（如 `'${value}'`）都会绕过 PostgreSQL Prepared Statement 预编译执行计划，导致 CPU 暴涨并带来 SQL 注入隐患。
- **管控面接口限制 (`executePGSql`)**：`@cloudbase/manager-node` 的 `executePGSql` 仅用于后台运维或 Migration，底层是 HTTP REST API 转发，**禁止在高频运行时 HTTP 云函数中用作常规 CRUD 接口**。

## 云函数实例与状态（多实例与高并发性能规范）

云函数在预置并发 / 高并发下会运行**多个实例**，模块级变量（`Set` / `Map` / 定时器）只对当前实例可见：

- **禁止**用模块级状态做并发控制、幂等或全局唯一（如防重入 `Set`）；多实例下必然失效。
- **公开读高频接口必须加 TTL 内存微缓存**：针对排行榜、热门列表、配置数据等高频读取场景，使用极简 TTL 内存微缓存兜底（容忍 3~5 秒短暂延时），可削掉数据库 95% 以上的高并发读负载：
  - **✅ 适用场景**：公共排行榜 Top 50、公共动态列表、活动规则与配置。
  - **❌ 绝对禁区**：写路径与资格判定（如抽奖资格、库存扣减，必须在库内原子完成，严禁内存判定）；个人私密数据（如个人资料/记录，避免多实例跨用户数据污染）；强实时交易数据。

```js
// 极简 TTL 内存微缓存函数 (仅适用于公开只读高频接口)
function createMemoryCache(ttlMs = 5000) {
  let cacheData = null;
  let lastFetchTime = 0;
  return (fetcher) => async () => {
    const now = Date.now();
    if (cacheData && (now - lastFetchTime < ttlMs)) {
      return cacheData;
    }
    cacheData = await fetcher();
    lastFetchTime = now;
    return cacheData;
  };
}
```

- **读写解耦（Write API 轻量化）**：`POST` 写接口（如发帖、提交分数、报名）在完成数据库写锁更新后，**必须直接返回成功**（如 `{ code: 0, message: "success" }`）。**严禁在写接口内部同步调用耗时的全表扫描或名次计算逻辑**；前端如需更新数据，应通过独立的读接口异步获取。
- 连接初始化（`tcb.init` / `app.rdb()`）在模块顶层做一次，禁止每请求重建。
- `Access-Control-Allow-Origin` 由网关按安全域名白名单统一注入（**前提：路由已开启跨域校验 `EnableSafeDomain: true`**，见 [deploy.md](deploy.md) §B.4），函数禁止自设；`OPTIONS` 直接返回 204。
- 状态流转（报名 / 订单 / 任务）用乐观锁（`update ... where <期望值>`）或唯一约束防重入，失败返回幂等结果。

## 骨架结构

```text
activity/cloudfunctions/activity_api/
├── .cloudignore       ← 必须创建！排除 node_modules，避免 Zip 打包超 1.5MB 限制
├── index.js
├── package.json
└── scf_bootstrap
```

**.cloudignore**

```text
node_modules
*.log
.DS_Store
```

**package.json**：`"engines": { "node": ">=18.15" }`，依赖 `@cloudbase/node-sdk` `^3.16.0`（主线 `app.rdb()`）；仅当改用 `executePGSql` 备用途径时，依赖改为 `@cloudbase/manager-node`。

**scf_bootstrap**（创建后必须本地执行 `chmod +x scf_bootstrap` 赋予可执行权限，否则云端容器启动报 443）：

```bash
#!/bin/bash
export PORT=9000
exec node index.js
```

## 精炼云函数模版示例 (`index.js`)

以下是供 AI 模仿的极简、干净且标准落地的 `activity_api` 原生 Node.js HTTP 9000 端口服务模版：

```js
const http = require("http");
const tcb = require("@cloudbase/node-sdk");
const zlib = require("zlib");

const app = tcb.init({ env: process.env.CLOUDBASE_ENV_ID });
const rdb = app.rdb({ database: "public" });

// 1. 剥离网关前缀 /api
function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

// 2. 网关 enableAuth: true 时解密并读取用户 puid
function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) {
    const err = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
  let buf = Buffer.from(String(raw).trim(), "base64");
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
  }
  const ctx = JSON.parse(buf.toString("utf8"));
  const puid = ctx.customUserId || ctx.userId || ctx.uid;
  if (!puid) {
    const err = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(puid);
}

// 3. TTL 内存微缓存助手 (用于公开读高频接口)
function createMemoryCache(ttlMs = 5000) {
  let cacheData = null;
  let lastFetchTime = 0;
  return (fetcher) => async () => {
    const now = Date.now();
    if (cacheData && (now - lastFetchTime < ttlMs)) {
      return cacheData;
    }
    cacheData = await fetcher();
    lastFetchTime = now;
    return cacheData;
  };
}

// 示例：为 demo 列表添加 5 秒 TTL 读缓存
const getDemoListCached = createMemoryCache(5000)(async () => {
  const result = await rdb
    .from("demo_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return result.data || [];
});

// 4. 解析请求 JSON Body
function getJsonBody(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
  });
}

async function handle(req, res) {
  // CORS：Access-Control-Allow-Origin 由网关按安全域名白名单统一注入，函数禁止自设
  const cors = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const path = apiPath(req);

  try {
    // 健康检查 (公开读，网关 enableAuth: false)
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "ok" }));
    }

    // 公开读接口：获取列表 (网关 enableAuth: false，走 5 秒 TTL 读缓存兜底)
    if (req.method === "GET" && path === "/demo/list") {
      const data = await getDemoListCached();
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "success", data }));
    }

    // 用户写接口：发帖/提交动作 (网关 enableAuth: true 独立条目注入上下文；读写解耦，写完即返)
    if (req.method === "POST" && path === "/demo/submit") {
      const puid = readPuid(req);
      const body = await getJsonBody(req);
      
      const record = {
        puid: puid,
        title: body.title || "无标题",
        content: body.content || "",
        created_at: new Date().toISOString()
      };

      const { data: dbData, error: dbError } = await rdb.from("demo_items").insert([record]);
      if (dbError) {
        const err = new Error(`Database Insert Failed: ${dbError.message || JSON.stringify(dbError)}`);
        err.statusCode = 500;
        throw err;
      }

      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "success", data: record }));
    }

    res.writeHead(404, cors);
    return res.end(JSON.stringify({ code: 404, message: "not found" }));
  } catch (err) {
    console.error("[Activity API Error]", err);
    const statusCode = err.statusCode || 500;
    // 4xx 业务/鉴权异常保留友善提示，5xx 内部/数据库错误统一脱敏，防止泄露底层 SQL 与敏感结构
    const userMessage = statusCode < 500 ? (err.message || "bad request") : "internal server error";
    res.writeHead(statusCode, cors);
    return res.end(JSON.stringify({ code: statusCode, message: userMessage }));
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
```
