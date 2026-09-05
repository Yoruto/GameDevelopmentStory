---
name: track-report
description: 支持页面加载、点击、曝光等标准数据埋点上报，用于统计分析用户流量、模块点击和页面互动情况，方便了解页面表现与转化效果。
---

# Usage

- JS Path: `window.ColorboxAI.track(params)`

# Constraints

- 必须仅使用 window.ColorboxAI.track(params) 进行打点，严禁直接引入 @hupu/hp-tracer 或手动拼接 Hermes 接口 URL
- 页面加载事件 access 由底层框架自动触发上报，业务代码切勿重复调用
- 事件类型 act 必须且只能是：click (点击)、exposure (曝光)、videoact (视频) 之一；access、onload、onPageOpen、onPageClose 以及 submit、feed_xxx 等自定义 act 都不合法；不合法 act 会触发前端 SDK warning 与日志上报
- 点击埋点应写在事件处理器(handler)的最前端，保障先上报再请求/跳转；曝光埋点使用 IntersectionObserver 监测，同一个元素在单次会话中只上报一次
- 埋点上报必须控制数量：页面初始化阶段最多上报 50 个埋点，单页面 1 分钟内最多上报 200 个埋点，同一个 blk 在 1 分钟内最多上报 100 个埋点；超过限制的埋点会被前端 SDK 丢弃，不要通过循环、定时器或重复曝光规避限制
- blk 必须使用 BMC001-BMC999 的六位编号格式（如 BMC001、BMC128），禁止使用 VOTE_MODULE、HEADER_CLICK 等语义字符串；不符合规则会触发前端 SDK warning 与日志上报
- 位置标识写在 pos（同 blk 从 T1 递增）；可见文本写在 label；其它扩展业务属性写在 custom（小写驼峰）
- 切勿手动传入 pg、pi、ext、sc 等系统字段，底座会自动完成补充封装

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| params | object | 是 | 埋点上报参数，包含 act (事件类型), blk (模块名), pos (位置), label (标签文案), custom (自定义小写驼峰业务数据) |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| ok | boolean | 否 | 是否成功唤起底层上报方法 |

# Examples

```javascript
// 点击事件示例
window.ColorboxAI.track({ act: "click", blk: "BMC001", pos: "T1", label: "提交投票", custom: { voteId: 101 } });
```

```javascript
// 曝光监测示例
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      window.ColorboxAI.track({ act: "exposure", blk: "BMC002", pos: "T1", label: "投票模块" });
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
observer.observe(document.getElementById("vote-card"));
```