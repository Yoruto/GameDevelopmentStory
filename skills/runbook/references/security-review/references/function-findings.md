# 前端功能 Findings

> 本文件只定义 `type="function"` 的 findings。功能可用性问题不得触发 `blocked`，但命中后必须让最终 `decision` 至少为 `needs_review`。

## 审查边界

- 只基于 manifest、scanner 证据和 HTML/HTM/JS/CSS 小窗口上下文报告；不运行页面、不做视觉截图、不访问网络。
- 功能 finding 关注用户能否在移动端、键盘、辅助技术和异常状态下稳定完成基础操作。
- 只报告源码可证明的可用性缺陷；不要因为缺少产品文案、视觉稿、埋点、A/B 配置、后端接口语义等无法从包内确认的事项报 finding。
- 功能 finding 的 `severity` 通常为 `low` 或 `medium`；只有明确导致页面初始化失败、核心交互不可触达或表单无法提交的源码缺陷才使用 `high`。不得使用 `critical`。无论严重级别如何，命中后都进入人工复核，不直接阻断发布。

## 分类

`type="function"` 的 `findings[].category` 只能使用下列中文分类名称：

- `移动端适配`
- `交互语义`
- `可访问性`
- `运行稳定性`
- `状态容错`

## 业界基线

- 移动端页面应声明 viewport，并使用响应式布局，避免依赖固定桌面宽度或不可缩放视口。
- 交互控件应使用符合语义的 HTML 元素；按钮行为用 `<button>`，导航行为用有效 `<a href>`。
- 可访问性至少满足 WCAG 2.2 的基础要求：键盘可达、焦点可见、控件有可感知名称、表单有标签，交互元素具备正确的名称、角色和值（Name, Role, Value）。
- 触控目标应具备足够尺寸和间距，避免移动端误触；图标按钮必须有可访问名称。
- 本地存储、URL 参数、接口响应和 DOM 查询都应按不可信输入处理，提供缺省值、空值保护和异常兜底。

## 规则

| 线索 | 分类 | 报告条件 | 建议边界 |
| --- | --- | --- | --- |
| HTML 缺少 `<meta name="viewport">` | `移动端适配` | 文件是页面入口或完整 HTML 文档 | 建议补充 `width=device-width, initial-scale=1`，避免移动端缩放或布局异常 |
| viewport 使用 `user-scalable=no`、`maximum-scale=1` 等禁止缩放配置 | `移动端适配` | 页面没有明确无障碍豁免依据 | 建议允许用户缩放，避免低视力用户无法放大内容 |
| CSS 使用固定大宽度、绝对定位铺满、`overflow:hidden` 隐藏主体，导致小屏可能裁切内容 | `移动端适配` | 可见 `width: 750px/1200px`、固定横向布局或主体禁滚动 | 建议使用响应式单位、断点、弹性布局和安全区适配 |
| 未处理 `env(safe-area-inset-*)` 的底部/顶部固定操作区 | `移动端适配` | 固定按钮、底栏、弹窗靠近屏幕边缘 | 建议为 iOS 安全区预留 padding，避免被系统手势区遮挡 |
| `<a href="#">`、`href="javascript:void(0)"`、无效 `href` 承担按钮行为 | `交互语义` | 元素触发弹窗、提交、切换状态等非导航操作 | 建议改为 `<button type="button">`，或阻止默认跳转并补齐键盘语义 |
| `<button>` 缺少 `type` 且位于表单内 | `交互语义` | 上下文存在 `<form>`，按钮并非提交按钮 | 建议显式设置 `type="button"`，避免误触发表单提交 |
| 交互元素只有 `onclick`，没有键盘可触达语义 | `交互语义` | 非 button/a/input 元素绑定点击，如 `<div onclick>` | 建议使用原生交互元素；必要时补 `role`、`tabindex` 和键盘事件 |
| 图标按钮、空文本按钮、仅背景图按钮缺少 `aria-label` 或可见文本 | `可访问性` | 控件可点击但没有可感知名称 | 建议补充可见文本或 `aria-label`，满足 Name, Role, Value |
| `<img>` 缺少 `alt`，且不是纯装饰图 | `可访问性` | 图片传达内容、按钮含义、活动规则或奖品信息 | 建议补充语义化 `alt`；纯装饰图可用空 `alt=""` |
| `<input>`、`select`、`textarea` 缺少关联 `<label>` / `aria-label` / `aria-labelledby` | `可访问性` | 表单控件需要用户输入或选择 | 建议建立显式 label 关联，避免辅助技术无法理解输入目的 |
| 焦点样式被 `outline: none` 移除且无替代样式 | `可访问性` | 作用于 button/a/input 或全局 focus 规则 | 建议提供清晰 `:focus-visible` 样式，保持键盘焦点可见 |
| 弹窗、抽屉、遮罩打开后未见焦点管理或关闭入口 | `可访问性` | 可见 modal/dialog 结构、遮罩层或 `aria-modal` | 建议打开时聚焦弹窗，关闭后还原焦点，并提供 Esc/关闭按钮 |
| `document.querySelector(...).addEventListener(...)` 或 `getElementById(...).addEventListener(...)` 未见空值保护 | `运行稳定性` | DOM 查询结果直接链式调用或直接解引用 | 建议先判断元素存在，避免 DOM 结构变化导致运行时报错 |
| 入口初始化依赖 `document.body`、目标节点或模板节点，但脚本可能在 DOM 解析前执行 | `运行稳定性` | 脚本位于 head 且无 `defer`/DOMContentLoaded，或直接查找后操作节点 | 建议使用 `defer`、`DOMContentLoaded` 或将脚本放到 body 末尾 |
| 接口响应、URLSearchParams、dataset、localStorage 值直接解构/访问深层属性 | `状态容错` | 未见默认值、可选链、类型检查或异常路径 | 建议增加 schema/字段校验、默认值和空状态渲染 |
| 直接 `JSON.parse(localStorage...)` / `JSON.parse(sessionStorage...)` 未见异常处理 | `状态容错` | 解析结果影响初始化、渲染或核心交互 | 建议加 try/catch 和默认值，避免脏数据导致页面初始化失败 |
| Promise、async 请求或资源加载缺少 `.catch` / `try/catch` / 错误 UI | `状态容错` | 失败会影响核心内容、按钮状态或页面初始化 | 建议提供失败态、重试入口或降级内容；若涉及业务请求安全，仍按 SR-001 复核 |

## 不报告边界

- 不因缺少完整 WCAG 合规声明、没有自动化 a11y 测试、没有视觉稿适配说明而报告。
- 不因装饰性图片使用 `alt=""`、静态展示区没有键盘事件、无表单页面没有 label 而报告。
- 不把功能可用性问题写成安全风险；`recommendation` 应使用“建议优化”或“建议人工确认可用性影响”，不得写“阻断发布”。

## 扫描线索

```text
<meta name="viewport"
user-scalable=no / maximum-scale=1
width: 750px / width: 1200px / min-width / overflow: hidden
position: fixed / safe-area-inset
<a href="#" / <a href="javascript:void(0)" / onclick=
<button / type=
role= / tabindex=
aria-label / aria-labelledby / aria-modal
<img / alt=
<input / <select / <textarea / <label
outline: none / :focus / :focus-visible
dialog / modal / overlay / mask / drawer
document.querySelector(...).addEventListener
document.getElementById(...).addEventListener
DOMContentLoaded / defer
URLSearchParams / dataset / localStorage / sessionStorage
JSON.parse(localStorage. / JSON.parse(sessionStorage.
.then( / await / catch(
```

## 资料来源

- https://www.w3.org/TR/wcag/
- https://www.w3.org/WAI/WCAG22/quickref/
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Text_labels_and_names
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
