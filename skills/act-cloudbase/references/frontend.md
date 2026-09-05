# H5 前端

> 提示：页面产物**必须且仅在根目录 `h5/` 下生成**：`h5/index.html` 单一原生 HTML 文件 + 同目录的 css/js/图片等静态资源（相对路径引用，如 `./css/app.css`、`images/a.png`），严禁使用 Vue / React / Vite 脚手架。上传实时预览时整目录打包 zip（见 preview-qr.md）。

## 两阶段演进

1. **第 3 步（静态原型）**：在 `h5/index.html` 生成单一原生 HTML 文件。UI 顶部定义静态变量数据与纯前端模拟交互，不依赖网络与云 SDK，双击即可本地预览。
2. **第 4 步（真实接入）**：开发者确认后，在 `h5/index.html` 中将顶部静态变量与交互替换为 `ColorboxAI.cloud.request` 正式接口请求（保持 DOM 结构与样式不变）。

## 配置（部署后回写）

```html
<script>
  // 必须使用 queryGateway 查出的公网域名，并统一带上 /api 前缀！
  // 示例：https://<envId>-<appid>.<region>.app.tcloudbase.com/api
  window.ACTIVITY_API_BASE = "https://<域名>/api";
  window.ACTIVITY_ENV_ID = "<EnvId>";    // 腾讯云 EnvId（非 activity.alias）
</script>
```

## 登录与调 API（第 4 步接入）

1. `await ColorboxAI.cloud.auth({ envId })` 登录（或写接口用 `cloud.request` 时传 `auth: true`）
2. 调 `/posts` 等业务接口：**必须**走 `ColorboxAI.cloud.request`；公开读不带 auth；用户写 `auth: true`；**「我的数据」类读取（如 `GET /api/my/favorites`）同样要传 `auth: true`**（网关该路径配置了 EnableAuth，不传会被 401 拦截）

登录内部（虎扑 `x-hupu-token` → 鉴权中心一步 `/api/auth/login` → 直接返回 CloudBase Bearer）由 SDK `cloud.auth` 完成。H5 **不**处理 ticket、虎扑 token、body 里的 `puid`。

```javascript
async function apiGet(path) {
  // path 示例：'/posts'，拼接后为 https://<域名>/api/posts
  const res = await window.ColorboxAI.cloud.request({
    url: window.ACTIVITY_API_BASE + path,
  });
  if (res.statusCode !== 200 || res.code !== 0) {
    throw new Error(res.message || "请求失败");
  }
  return res.data;
}

async function apiPost(path, body) {
  // path 示例：'/posts' 或 '/posts/create'
  const res = await window.ColorboxAI.cloud.request({
    url: window.ACTIVITY_API_BASE + path,
    method: "POST",
    data: body,
    envId: window.ACTIVITY_ENV_ID,
    auth: true, // 无 Bearer 时自动 cloud.auth
  });
  if (res.statusCode === 401) throw new Error("请重新登录");
  if (res.statusCode !== 200 || res.code !== 0) {
    throw new Error(res.message || "请求失败");
  }
  return res.data;
}
```

## 页面结构演进

`h5/index.html` 的开发节奏：

```text
【第 3 步 静态原型】：
1. 顶部定义假数据变量（如 const candidates = [...]）
2. UI 绑定假数据，交互用纯前端方法（如 alert 或 简单内存操作）
3. 方便开发者双击查看与体验视觉流转

【第 4 步 真实接入】：
1. 替换静态变量与交互为 apiGet / apiPost (cloud.request)
2. 逻辑必须：公开读不强制 auth；用户写 auth: true；body 禁止 puid
```

## 技能使用统计（implement 收尾必做）

`h5/index.html` 完成真实接入后，必须在工作区根目录运行扫描脚本，把技能使用 JSON 写入 HTML 内嵌数据块（implement 硬门禁会校验）：

```bash
node skills/runbook/scripts/scan-skill-usage.mjs   # 原地更新 h5/index.html 内 <script type="application/json" id="colorbox-skill-usage"> 数据块
```

规则见 runbook 的 `references/skill-usage.md`：数据块里的技能 ID 必须来自工作区 `skills/` 下已交付技能，
且与 index.html 实际调用的 `window.ColorboxAI.*` 一一对应（声明必须真实调用、调用必须已声明）；
重复运行只原地更新同一 id 数据块，不会产生重复。

## 禁止

- body / query 传 `puid` 或用于标识用户的自定义字段
- H5 自行处理虎扑 token、ticket，或手写 `fetch` + `Authorization`
- 用 `ColorboxAI.request`（虎扑业务通道）调 CloudBase 活动网关
- 手拼 API 域名
