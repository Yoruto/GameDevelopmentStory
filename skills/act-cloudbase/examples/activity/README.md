# CloudBase 活动 Demo 说明与配置指南

本示例目录 (`examples/activity/`) 提供了一套完整且经过测试验证的 CloudBase 活动 H5 前后端完整范例，包含发帖/列表 H5 页面 (`h5/index.html`)、Node.js 9000 端口 HTTP 云函数 (`cloudfunctions/activity_api/index.js`) 以及配置清单模版 (`activity.manifest.json`)。

---

## 目录结构

```text
examples/activity/
├── cloudfunctions/
│   └── activity_api/
│       ├── .cloudignore       ← 忽略 node_modules 打包
│       ├── index.js          ← 原生 Node.js HTTP 9000 端口云函数，集成 PostgreSQL 数据落库
│       ├── package.json      ← Node.js 18 依赖声明
│       └── scf_bootstrap     ← 容器启动可执行入口 (chmod +x)
├── h5/
│   └── index.html            ← 单一原生 H5 页面 (连接真实 Gateway API)，css/js/图片等静态资源同放 h5/ 下
├── activity.manifest.json    ← 部署验证清单
└── README.md                 ← 配置与部署操作说明
```

---

## 核心配置硬规则 (必读)

### 1. 网关路由拆分配置 (`enableAuth`)

**硬性要求：所有独立的业务接口路由（无论是公开读还是用户动作写）都必须在网关显式配置单独的路由条目！**

| 接口 Path | 动作类型 | 网关 enableAuth 配置 | 作用说明 |
|----------|----------|-------------------|----------|
| `/api` / `/api/health` | 公开读 | `false` | 放开匿名访问，无需登录即可获取健康状态 |
| `/api/demo/list` | 公开读 | `false` | 放开匿名访问，拉取列表 |
| `/api/demo/submit` | 用户写 (提交) | `true` | **关键**：网关检验 Bearer 票后，自动注入解密后的用户上下文 `x-cloudbase-context` 到请求头 |

⚠️ **原理说明**：
- 如果没有为写入路径（如 `/api/demo/submit`）单独配置 `enableAuth: true` 网关路由，CloudBase 网关不会解密 Token 也不会注入 `x-cloudbase-context`。
- 云函数中的 `readPuid(req)` 尝试读取 `x-cloudbase-context` 时就会引发 `401 unauthorized: invalid user in context`。

---

## 云函数配置与部署步骤

### 步骤 1：本地赋权
```bash
chmod +x cloudfunctions/activity_api/scf_bootstrap
```

### 步骤 2：使用 MCP 部署云函数
调用 `manageFunctions`：
```json
{
  "action": "createFunction",
  "func": {
    "name": "activity_api",
    "type": "HTTP",
    "runtime": "Nodejs18.15",
    "envVariables": {
      "CLOUDBASE_ENV_ID": "<credentials.json 的 envId>",
      "BUSINESS_ACTIVITY_ID": "<activity.json 的 activityId>",
      "COLORBOX__ACCESS_KEY": "<meta.accessKey>"
    }
  },
  "functionRootPath": "<cloudfunctions绝对路径>"
}
```

### 步骤 3：创建网关入口与独立路由策略

使用 MCP `manageGateway` 为每一个独立 Path 创建网关路由（区分 `auth` 标志，并开启路径透传 `enablePathTransmission: true`）：

```text
manageGateway(action="createRoute", targetName="activity_api", path="/api", auth=false, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
manageGateway(action="createRoute", targetName="activity_api", path="/api/demo/list", auth=false, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
manageGateway(action="createRoute", targetName="activity_api", path="/api/demo/submit", auth=true, upstreamResourceType="WEB_SCF", enablePathTransmission=true)
```

> ⚠️ **跨域**：上述路由均面向 H5 浏览器跨域调用，须开启跨域校验（`EnableSafeDomain: true`），操作与验收见 deploy.md §B.4；漏开会报 `No 'Access-Control-Allow-Origin' header`。

---

## 冒烟验证命令

```bash
# 1. 验证公开读健康检查 (HTTP 200)
curl -s https://<网关域名>/api/health

# 2. 验证公开读 demo 列表 (HTTP 200)
curl -s https://<网关域名>/api/demo/list

# 3. 验证未鉴权写接口返回 401 拦截
curl -s -i -X POST https://<网关域名>/api/demo/submit \
  -H "Content-Type: application/json" \
  -d '{"title":"测试提交"}'

# 4. 验证合法 Token / 测试 Header 写入成功 (HTTP 200)
TEST_CTX=$(node -e 'console.log(Buffer.from(JSON.stringify({ customUserId: "test_user_001" })).toString("base64"))')
curl -s -X POST https://<网关域名>/api/demo/submit \
  -H "X-CloudBase-Context: $TEST_CTX" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试成功","content":"示例测试内容"}'
```
