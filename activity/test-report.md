# P0 存档与安全验收（2026-09-27）

当前结论：**P0 存档与安全专项通过。** 本报告只覆盖本轮 P0；全项目规则回归仍需另行完成，不能据此确认 test 阶段的全部门禁。

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 前端发布安全静态审查 | 通过 | `activity/security-review.json`：30 个文件，decision=passed |
| 云端目标与路由 | 通过 | 已绑定环境；读写存档独立路由，均开启鉴权、跨域校验和路径透传；前端 EnvId 与网关匹配 |
| 网关健康与匿名拦截 | 通过 | `/api/health` 200；匿名 GET `/api/my/save`、POST `/api/save/upsert` 均 401；跨域预检 204 |
| 登录态写入、读回、版本冲突 | 通过 | 临时有效生涯档写入 200、读回内容与 revision 一致、旧 revision 再写 409；测试记录已删除，复查为空 |
| 本机待同步、断线重试、冲突、重开 | 本地测试通过 | `node tests/run-save-tests.js`：58 项通过，覆盖上述路径 |
| 角色名提交前检测 | 静态核对通过 | `h5/js/ui/app.js` 调用 `auditText` 成功后才创建新局；平台桥在正式云配置下检测失败不放行 |
| 关闭后自动进入已有进度 | 静态核对通过 | `bootRestore.then` 现在对有效存档调用 `enterSaved(saved)`，分别进入 OFFER、PLAYING、SETTLED 页面；检测到本机与云端冲突时停在开局页供玩家选择 |

本机修改后验证：`node --check h5/js/ui/app.js` 通过；`node tests/run-save-tests.js` 的 58 项检查通过；`node tests/run-sim-tests.js` 的 137 项检查通过；重新生成审查包后的发布安全审查为 passed。遵照流程未使用浏览器自动化；实际用户跨设备的界面体验留待发布后手动验收。

## P1 数据一致性、生涯平衡与本次云端部署回归（2026-09-28）

当前结论：**本次本地规则回归与真实网关最低冒烟全部通过。** 前端 H5 仍未上传，真机体验不在本次自动测试的结论内。部署资源及变更见 [deploy-report-2026-09-28.md](deploy-report-2026-09-28.md)。

| 需求与检查项 | 结果 | 证据 |
| --- | --- | --- |
| 数据一致性：当月新增销量、累计销量、月榜、12 月至次年 11 月奖项窗口、海报署名总销量去重及数据不完整时不显示伪总数 | 通过 | `node tests/run-sim-tests.js` 中固定人工预期回归样例；详见 `data-consistency-report.md` |
| 生涯规则：四岗位成长、晋升、制作人、五条可选事件线的触发及结局可达性 | 通过 | 142 项模拟规则测试；固定种子 32 × 四岗位 × 两策略共 256 局完成，调参前后同种子对照见 `balance-audit-2026-09-27.md` |
| 远程事件选择在队列待处理时不提前结束事件线 | 通过 | `tests/cases/case-10-lines-colleagues.js` 回归用例；修复前失败、修复后通过，包含在 142 项中 |
| 本地与云端存档状态、冲突、断线重试与重开 | 通过 | `node tests/run-save-tests.js`：58 项通过；此前已做登录态写入、读回及旧 revision 409 闭环，测试记录已清理；本轮后端函数代码未变 |
| 角色名输入的内容安全默认规则 | 通过 | 延续 P0 静态核对：正式云配置下 `auditText` 检测失败不放行；本轮未改输入链路 |
| 生涯配置完整性 | 通过 | `python3 scripts/validate_career_world.py`：0 错误；2 条既有章节覆盖提醒，非本轮新增错误 |
| 云端资源 | 通过 | 既有 `activity_api` 和 `public.game_saves` 保留；三条业务路由均指向 `WEB_SCF`，鉴权、跨域校验、路径透传与预期一致；demo 路由及空表已清理 |
| 网关公开健康 | 通过 | 本次清理后 `GET /api/health`：HTTP 200，`Origin: https://activity-static.hupu.com` 获允许跨域头 |
| 无令牌个人读档与写档 | 通过 | `GET /api/my/save`、`POST /api/save/upsert`：均 HTTP 401；写档返回 `MISSING_CREDENTIALS` |
| 浏览器跨域预检 | 通过 | `OPTIONS /api/save/upsert`：HTTP 204，允许 `https://activity-static.hupu.com`、`POST`、`authorization,content-type` |
| 公开接口响应稳定性 | 通过 | 连续三次 `GET /api/health` 均 HTTP 200，耗时约 0.218、0.195、0.152 秒；仅是小样本冒烟，不作为容量指标 |
| 发布前端静态安全 | 通过 | 新审查包 30 个文件，`activity/security-review.json` 为 `passed`，包哈希与开发者确认的审查包一致 |

未运行浏览器自动化。正式云环境中已登录用户的跨设备界面操作、手机单手操作和海报保存仍需前端上传后由开发者手动验收；这不改变以上规则测试与接口冒烟的通过结论。

## 前端性能整改回归（2026-09-28）

当前结论：**本轮修改涉及的功能、权限与静态性能检查全部通过。** 上述数据一致性、生涯规则、存档与内容安全结论继续适用；本轮没有修改对应逻辑。

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 脚本加载与依赖顺序 | 通过 | 29 个外部脚本均在 `<head>` 中使用 `defer`；逐项核对本地路径存在，保持原执行顺序 |
| 弹窗布局 | 通过 | `node tests/run-dialog-size-tests.js`：4 项通过；三个尺寸档位与锁定高度检查通过 |
| 揭晓交互与定时器 | 通过 | `node tests/run-reveal-tests.js`：6 项通过；`clearTimers`、单项 `clearInterval`、离开场景和页面时的清理路径已静态核对 |
| 滚动与提示框布局 | 通过 | 揭晓滚动以 `requestAnimationFrame` 合并并在结束或重置时取消待执行帧；提示框读取锚点和提示框尺寸后统一写入位置 |
| JS 语法与发布包 | 通过 | `dom.js`、`paint.js`、`reveal.js` 均通过 `node --check`；31 个前端文件的审查结论见 `activity/security-review.json`，`decision=passed` |
| 网关健康与权限 | 通过 | 当前环境 `/api/health` 返回 200；无令牌 `/api/save/upsert` 返回 401；H5 来源的 OPTIONS 预检返回 204，并包含允许来源与请求头 |

本轮遵守工作区门禁，未运行浏览器自动化；首屏渲染指标和帧率尚无实测数据，交付后可由开发者在目标设备观察。

## 2026-09-29 布局与隐藏页计时器复核

当前结论：**本轮源码静态核对、相关回归测试和真实接口冒烟通过。** 既有生涯、存档与内容安全规则未改动，沿用前述专项验收结果。

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 弹窗尺寸 | 通过 | 每次调用先缓存视口高度，写入测量样式后仅读取一次自然高度；弹窗尺寸测试 4 项通过 |
| tooltip 定位 | 通过 | 点击时只读取一次锚点矩形，按视口位置选择上下方后统一写入样式；最长天赋说明 48 字，未引入滚动或缩放高频回调 |
| 揭晓滚动 | 通过 | `scrollExtra` 在动画帧内合并滚动，结束时至多补做一次定位；关闭和隐藏时取消待执行帧 |
| 隐藏页计时器 | 静态核对通过 | `visibilitychange` 隐藏时清理当前 interval/timeout 并保留剩余时间，恢复可见时重新调度；`pagehide` 和关闭对话框时清空任务。揭晓交互测试 6 项通过 |
| 大配置文件 | 通过 | 赋值部分可用 `JSON.parse` 解析为 11 个顶层字段的纯数据对象；`eval`、`new Function`、`WebAssembly`、`fetch`、动态 `import` 与 URL/域名形式字符串定点检查均为 0 |
| 发布安全 | 通过 | 31 个前端文件、39 条预扫描候选的审查结论为 `passed`；审查包摘要见 `activity/security-review.json` |
| 接口权限与跨域 | 通过 | `/api/health` 返回 200；未登录个人读档与写档均返回 401；H5 来源预检为 204 且返回匹配的允许来源 |

工作区测试门禁禁止浏览器自动化；移动端帧率及隐藏后恢复的真实浏览器时序未做设备实测。

## 2026-09-30 当前工作树本地回归

本节只记录这次文档整理时实际运行的本地检查。前文各时点的测试数量与安全审查结果保留原记录，不代表当前工作树已经通过发布安全审查或宿主验收。

| 检查 | 结果 |
| --- | --- |
| `node tests/run-sim-tests.js` | 153 项通过；包含终章排程、11 月颁奖、12 月结尾和读档回归 |
| `node tests/run-save-tests.js` | 59 项通过 |
| `python3 scripts/validate_career_world.py` | 0 错误；史诗作、回国线章节覆盖共 2 条既有提醒 |
| `node tests/run-dialog-size-tests.js` | 4 项通过 |
| `node tests/run-reveal-tests.js` | 8 项通过 |
| `node tests/run-player-identity-tests.js` | 通过 |

当前 H5 仍未在此轮发布，真实宿主 SDK 版本与 `cloud.request` 的请求保护行为也未核实。发布安全审查需对当前构建重新执行；详情见 [request-sdk-audit-2026-09-29.md](request-sdk-audit-2026-09-29.md)。
