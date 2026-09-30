# CloudBase 请求通道核对（2026-09-29）

## 已确认

- `h5/js/bridge/colorbox.js` 的云端存档读取、分段读取和写入均调用 `window.ColorboxAI.cloud.request`；个人读档与写档传入 `envId` 和 `auth: true`。
- `skills/colorbox-cloud-request/SKILL.md` 明确要求 CloudBase 活动接口使用 `window.ColorboxAI.cloud.request`，普通虎扑业务接口才使用 `window.ColorboxAI.request`；`skills/act-cloudbase/references/frontend.md` 也明确禁止用通用 `request` 调 CloudBase 活动网关。
- `skills/colorbox-request/SKILL.md` 载有通用 `request` 的同 URL 限流、同接口限流和连续失败熔断策略；`colorbox-cloud-request` 的契约没有声明这些策略，也没有声明它会委托给通用 `request`。
- 本地 H5 仅调用宿主提供的 `window.ColorboxAI`，未打包 SDK 实现或运行时版本。两个能力 manifest 的 `version: 1` 是技能包版本，不能当作宿主 SDK 版本。
- 应用层云端写入由 `h5/js/save/port.js` 的队列串行执行；分段读取由 `saveChunks <= 8` 限定；失败后提示用户手动重试，没有无限自动重试。

## 尚需宿主证据

- 获取实际注入的 ColorboxAI SDK 版本及对应实现、发布说明或平台维护方确认，核对 `cloud.request` 是否委托 `request`，或是否有等效的限流、熔断与错误处理。
- 在真实宿主环境确认 `cloud.request` 的调用结果与保护行为；本工作区的实现阶段禁止使用浏览器调试工具，且本地没有可供静态复核的 SDK 包。

## 结论

当前应用对 CloudBase 网关使用了能力契约指定的正确 API；直接改成 `window.ColorboxAI.request` 会违反活动接入契约并丢失自动登录语义。宿主运行时保护链路及 SDK 版本尚未得到可核验证据，发布安全审查应标为 `needs_review`，直至补齐宿主证据。
