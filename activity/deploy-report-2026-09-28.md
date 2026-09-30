# 部署记录（2026-09-28）

- 开发者确认：“确认审查通过，继续部署”。复用项目 `app_3c72f55c0c` 已绑定的 CloudBase 环境 `app-3c72f55c0c-d3gc5cvnta9f232c1`；没有创建新环境。
- 本轮 P1 数据一致性与生涯平衡改动没有后端接口或函数代码变更，现有 `activity_api` 函数继续服务 `game_saves`。前端 `ACTIVITY_API_BASE` 和 `ACTIVITY_ENV_ID` 与实际网关一致。
- 通过 CloudBase MCP 移除未使用的 `/api/demo/list`、`/api/demo/submit` 两条路由；确认 `demo_items` 为 0 行后，用迁移 `20260928145301_remove_demo_items` 删除空表。迁移任务 `task-03cbaaaf` 成功，并出现在远端迁移历史。现存业务路由为 `/api/health`、`/api/my/save`、`/api/save/upsert`，均指向 `WEB_SCF activity_api`，开启路径透传和安全域名校验；写入/个人读档路径开启网关鉴权。
- 真实网关冒烟：`GET /api/health` 返回 200；无令牌 `POST /api/save/upsert` 返回 401 `MISSING_CREDENTIALS`；从 `https://activity-static.hupu.com` 发起的 POST 预检返回 204，并带相同 Origin 的允许跨域头。
- 资源清单见 [activity.manifest.json](activity.manifest.json)。本轮未上传 H5；`h5/` 的新前端仍是本地待交付版本。临时预览上传与二维码按工作区交付阶段的单独确认流程进行，临时链接不代表正式上线。

## 前端性能整改复核

- 开发者对更新后的发布安全审查回复“没问题”，已记录于 `security-review` 阶段。
- 本次只调整 `h5/index.html`、`h5/js/ui/dom.js`、`paint.js` 和 `reveal.js`；CloudBase 函数、路由、数据库与前端 API 配置无需变更。
- 只读环境盘点确认复用 `app-3c72f55c0c-d3gc5cvnta9f232c1`，保留 1 个函数、3 条业务路由和 `public.game_saves`。
- 真实网关复核：`GET /api/health` 为 200；无令牌 `POST /api/save/upsert` 为 401；来自 `https://activity-static.hupu.com` 的 OPTIONS 预检为 204，允许来源与请求头符合预期。
- 本次未执行云资源变更，更新后的 H5 仍待交付阶段按流程上传。

## 2026-09-29 前端计时器整改复核

- 本轮仅调整 tooltip 位置计算及揭晓计时器的隐藏页暂停与恢复，后端函数、路由、数据库及 H5 接口配置均未变更。
- 只读盘点确认继续复用既有正常环境，保留 1 个函数、3 条路由及 `public.game_saves`。
- 网关复核：`GET /api/health` 为 200；无令牌 `POST /api/save/upsert` 为 401；H5 来源的 OPTIONS 预检为 204，并返回匹配的允许来源。
- 本次未执行云资源变更，也未上传 H5。
