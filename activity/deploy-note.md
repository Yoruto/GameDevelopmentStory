# 本轮销量平衡改动的部署自检

> 历史只读自检，针对下文 SHA-256 指定的旧 H5 包。海报等后续改动未包含在该包中；当前阶段为 `implement`，安全审查需重新执行，本文不能作为当前发布批准。见 [current-status.md](current-status.md)。

- 沿用已激活的 `app-3c72f55c0c-d3gc5cvnta9f232c1` 云环境。改动位于 H5 模拟逻辑、数值配置和发售页；云函数、数据库表和网关路由无需改写。
- `h5/index.html` 已指向该环境的实际 HTTPSERVICE 网关，`/api/health` 和两条存档路由指向现有 `activity_api`；读写路由鉴权与路径透传配置符合现状。
- 2026-09-26 只读验收：`GET /api/health` 返回 200，带 `https://activity-static.hupu.com` Origin 时返回同源 CORS 头；不带 Token 的 `POST /api/save/upsert` 返回 401。
- 前端发布包已在 `activity/review-package` 固定，SHA-256 为 `3820160dcddf39bcab68a97eda06419d3bb21fde353946f9abb34dc6dd3f7d37`，安全审查结论为 passed。
- 当前云环境仍有原 demo 路由 `/api/demo/list`、`/api/demo/submit` 和表 `public.demo_items`。它们未被本轮 H5 调用；部署清单要求在正式写 manifest 前清理。

本轮 H5 尚未上传或发布，等待部署阶段的开发者确认。
