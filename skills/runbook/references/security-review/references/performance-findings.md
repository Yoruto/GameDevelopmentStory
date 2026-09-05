# 前端性能 Findings

> 本文件只定义 `type="performance"` 的 findings。性能问题不得触发 `blocked`，但命中后必须让最终 `decision` 至少为 `needs_review`。

## 审查边界

- 只基于 manifest、scanner 证据和 HTML/HTM/JS/CSS 小窗口上下文报告；不运行页面、不跑 Lighthouse、不启动浏览器、不读取图片/字体/视频等超范围资源内容。
- 只报告从源码可证明的性能风险；不要因为缺少构建产物压缩、CDN 配置、HTTP 缓存头、服务端压缩等无法从包内源码确认的事项报 finding。
- 性能 finding 的 `severity` 通常为 `low` 或 `medium`；只有会稳定卡死主线程、造成页面不可交互或明显首屏阻塞的源码模式才使用 `high`。不得使用 `critical`。无论严重级别如何，命中后都进入人工复核，不直接阻断发布。
- 如果同一根因影响多个文件，合并为一个 finding，并在 `impact` 中说明代表性位置。

## 分类

`type="performance"` 的 `findings[].category` 只能使用下列中文分类名称：

- `资源加载性能`
- `主线程执行性能`
- `渲染与布局性能`
- `动画性能`

## 业界基线

- Core Web Vitals 关注 LCP（Largest Contentful Paint）、INP（Interaction to Next Paint）和 CLS（Cumulative Layout Shift）。静态审查不能给出指标分数，但应识别会拖慢首屏、阻塞交互或造成布局偏移的代码模式。
- 首屏关键资源应优先、明确、可预测地加载；非关键脚本应延后执行，图片和 iframe 等非首屏资源应懒加载。
- 主线程应避免长任务、同步阻塞循环、未节流的高频事件处理和无停止条件的轮询。
- DOM 读写应批处理，避免在循环或高频回调中交替触发布局读取和样式写入。
- 动画应优先使用 `transform` 和 `opacity`，避免 `transition: all`、大范围阴影/滤镜、频繁改动布局属性。

## 规则

| 线索 | 分类 | 报告条件 | 建议边界 |
| --- | --- | --- | --- |
| 非模块 `<script src>` 缺少 `defer` / `async`，尤其位于首屏 HTML 或关键内容前 | `资源加载性能` | 脚本不是内联初始化必需代码，且没有证据表明必须阻塞解析 | 建议添加 `defer`、`async` 或改为 `type="module"`；需要保序时优先 `defer` |
| 首屏关键图片、字体、CSS 或脚本依赖远程资源且未见 `preload`、`preconnect`、`fetchpriority` 等优先级提示 | `资源加载性能` | 资源明显参与首屏渲染，如 hero 图、关键字体、首屏 CSS | 建议对关键资源使用 `preload`、`fetchpriority="high"` 或 `preconnect`；不要对大量资源滥用高优先级 |
| 非首屏图片、iframe 或长列表图片未见 `loading="lazy"` | `资源加载性能` | 从 DOM 结构能判断资源位于折叠区、列表尾部或非首屏模块 | 建议添加懒加载；首屏 LCP 图片不建议懒加载 |
| 图片缺少 `width` / `height` 或 CSS 中无稳定尺寸/宽高比 | `渲染与布局性能` | 该图片在布局流中占位，尺寸可能加载后才确定 | 建议声明宽高或 `aspect-ratio`，减少 Cumulative Layout Shift |
| `scroll`、`resize`、`touchmove`、`wheel` 监听器执行 DOM 查询、布局读取、网络请求、复杂循环，且缺少节流/防抖/`requestAnimationFrame`/`passive` | `主线程执行性能` | 命中行或附近上下文可见高频回调内存在昂贵操作 | 建议加节流、防抖、`requestAnimationFrame` 或 `{ passive: true }` |
| `setInterval`、短周期轮询、递归 `setTimeout` 未见停止条件或清理逻辑 | `主线程执行性能` | 定时器会在页面生命周期内持续运行，或回调包含 DOM/请求/复杂计算 | 建议增加停止条件、页面隐藏时暂停、销毁时清理；若包裹业务请求，仍按 SR-001 复核安全风险 |
| 大量同步循环、递归、排序/过滤/JSON 处理位于入口初始化或交互回调中 | `主线程执行性能` | 上下文显示数据规模可能来自列表、接口或存储，且没有分片/异步让步 | 建议拆分任务、缓存结果、延后非关键计算或使用 Web Worker；不要因小常量循环单独报告 |
| 循环或高频回调中读取 `offsetWidth`、`offsetHeight`、`getBoundingClientRect()`、`scrollTop` 等布局信息，并交替写 style/class | `渲染与布局性能` | 能看到读写交错或每帧重复读取布局 | 建议拆分读写阶段、缓存布局值，避免强制同步布局 |
| 入口或交互路径频繁追加/删除大量 DOM 节点，或逐项写入 `innerHTML`/`appendChild` | `渲染与布局性能` | 可见列表渲染、批量节点操作或循环 DOM 写入 | 建议使用 `DocumentFragment`、批量模板、虚拟列表或分页渲染 |
| CSS `transition: all`、动画影响 `width`、`height`、`top`、`left`、`margin`、`box-shadow`、`filter` 等昂贵属性 | `动画性能` | 作用于首屏大量元素、列表项或高频状态变化 | 建议限定动画属性，优先 `transform`/`opacity`，减少重排和重绘 |
| `will-change` 大范围或长期常驻 | `动画性能` | 对大量元素或全局类设置，且没有状态化启停 | 建议仅在动画前短时间启用，动画结束后移除 |

## 不报告边界

- 不因没有 service worker、没有 HTTP/2、没有 CDN、没有缓存头、没有压缩配置而报告，除非包内源码明确配置了反模式。
- 不因单个小图没有懒加载、单个静态常量循环、少量 DOM 操作、开发注释中的 API 名称而报告。
- 不把性能问题写成安全风险；`recommendation` 应使用“建议优化”或“建议人工确认优化影响”，不得写“阻断发布”。

## 扫描线索

```text
<script src=
defer / async / type="module"
preload / preconnect / fetchpriority
loading="lazy"
<img / width= / height= / aspect-ratio
addEventListener("scroll" / addEventListener('scroll'
addEventListener("resize" / addEventListener('resize'
addEventListener("touchmove" / addEventListener('touchmove'
addEventListener("wheel" / addEventListener('wheel'
requestAnimationFrame / debounce / throttle / passive
setInterval( / setTimeout(
while ( / for ( / JSON.parse(
getBoundingClientRect( / offsetWidth / offsetHeight / clientWidth / clientHeight / scrollTop
appendChild( / innerHTML / classList / style.
transition: all / animation / will-change / filter / box-shadow
```

## 资料来源

- https://web.dev/articles/optimize-lcp/
- https://web.dev/articles/optimize-inp/
- https://web.dev/articles/optimize-cls/
- https://web.dev/articles/efficiently-load-third-party-javascript/
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/HTML
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS
- https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading
