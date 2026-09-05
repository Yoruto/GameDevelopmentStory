---
name: leaderboard-template
description: 使用活动数据存储创建可运行的移动端排行榜 H5 页面；适用于“实现一个排行榜功能”“做积分榜/排名榜”等请求，不用于仅展示静态榜单图片或后台报表。
metadata:
  required-skills:
    - act-cloudbase
    - colorbox-cloud-request
---

# 排行榜功能模版

当用户提出“实现一个排行榜功能”或同义需求时，使用本技能生成一个真实可运行的活动 H5，而不是只给出 UI 草图。页面必须同时组合：

- `act-cloudbase`（活动数据存储）：负责 PostgreSQL 数据表、云函数和网关接口。
- `colorbox-cloud-request`：负责安全访问榜单接口。

## 实施顺序

1. 先阅读 `example/migrations/20260828210000_create_leaderboard.sql` 和 `example/README.md`，在 `act-cloudbase` 预置的 `activity_api` / `demo_items` 基线上改造，保留环境、权限、CORS 和迁移留档约定。不要另建第二套云函数。
2. 复制 `example/index.html` 到活动的 `h5/index.html`，按活动名称、接口前缀和业务字段调整。页面必须是原生 HTML/CSS/JS，可双击打开；不要引入 Vue、React、Vite 或运行时打包器。
3. 页面初始化时使用 `window.ColorboxAI.cloud.request` 读取公开榜单；`code !== 200` 时用返回的 `message` 提示。禁止手写 Bearer、直接调用 `fetch` 或把虎扑 Token 写入页面。
4. 所有 CloudBase 请求必须使用 `window.ColorboxAI.cloud.request`，并由服务端校验请求上下文和业务参数。页面不得提交用户身份字段或自行拼接鉴权信息。
5. 页面至少提供：榜单前 3 名突出展示、可扫描的排名列表、加载中/空榜/失败状态。若活动页面产生新成绩，提交接口只接受服务端可验证的业务事件；提交成功后重新读取榜单。
6. 所有服务端返回值都要检查 HTTP 状态和业务 `code`（兼容 `0` 与 `200`）；错误优先展示服务端 `message`，不要吞掉错误或伪造成功提示。渲染昵称、活动名称等外部数据前进行 HTML 转义。
7. 交付前按 `act-cloudbase` 的流程完成迁移、函数、网关和接口冒烟；静态预览阶段可以使用模板中的本地演示数据，但上线前必须切换到真实接口并移除会掩盖服务端错误的生产降级。

## 示例目录

`example/` 是可直接参考的最小完整实现，不是第二套独立能力：

- `example/index.html`：原生移动端排行榜页面，包含榜单读取、加载/空榜/失败状态，以及 CloudBase 请求调用。
- `example/cloudfunctions/activity_api/`：`activity_api` HTTP 云函数示例，提供 `/health`、`/leaderboard`、`/leaderboard/me` 和 `/leaderboard/submit`，由网关上下文完成请求校验。
- `example/migrations/20260828210000_create_leaderboard.sql`：复用 `demo_items` 为 `leaderboard_entries` 的 PostgreSQL 迁移，包含最高分幂等写入函数、索引、权限和 RLS 处理。

复制示例时，先替换页面中的活动环境配置，再根据实际成绩来源决定是否保留 `/leaderboard/submit`；不要把示例中的演示成绩或环境占位符作为生产回退。

## 排名规则

- 默认按 `score DESC, updated_at ASC, id ASC` 排序；同分时先达到分数的用户优先，规则应在页面中明确说明。
- 榜单接口必须限制 `limit`（默认 50，最大 100），不得返回全表。
- “我的名次”使用索引友好的 `COUNT(*) + 1` 统计比分高的行，禁止 `RANK() OVER` 全表窗口排序。
- 写接口只接收业务分数或服务端可验证的事件结果，并在云函数中完成范围校验和限频。
- 高频积分不可通过对同一榜单行无限更新实现；优先使用明细事件表或带唯一约束的幂等 upsert，并在云函数中做范围校验和限频。

## 可复用资源

- [example/README.md](example/README.md)：示例目录说明、接口契约和部署前检查项；需要调整活动后端时阅读。
- [example/migrations/20260828210000_create_leaderboard.sql](example/migrations/20260828210000_create_leaderboard.sql)：可参考的 PostgreSQL 榜单迁移。
- [example/cloudfunctions/activity_api/index.js](example/cloudfunctions/activity_api/index.js)：可参考的 `activity_api` 云函数实现。
- [example/index.html](example/index.html)：可运行的原生 H5 模板；生成页面时复制并替换配置与文案。

完成后应留下 `h5/index.html`、迁移 SQL、云函数改造记录和活动 manifest，并说明真实榜单接口、同分规则及异常降级行为。`example/` 中的文件用于参考，不应直接作为活动线上资源发布。
