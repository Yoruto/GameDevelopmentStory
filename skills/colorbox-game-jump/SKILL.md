---
name: game-jump
description: 识别活动页中指向 h5game.hupu.com 的链接跳转，在 App 内自动改写为 huputiyu://webview/openencodeurl?url=...，非 App 环境保留原始跳转逻辑。
---

# Goal

帮我把页面中的“游戏跳转”逻辑改造成 App 内外分流的写法。

# Context

- 需要识别 HTML 中 `a[href^="https://h5game.hupu.com"]`
- 需要识别 `location.href = "https://h5game.hupu.com..."` / `window.location.href = "https://h5game.hupu.com..."`
- App 内参考图片组件热区跳转逻辑：`http/https` 会被转成 `huputiyu://webview/openencodeurl?url=...`
- App 内执行跳转时，统一通过 `window.ColorboxAI.navigate.to(params)` 触发，`params.url` 填写转成后的 schema
- 非 App 内保持原来的 `href` 或 `location.href` 逻辑，不要强行改成 schema

# Constraints

- 只处理以 `https://h5game.hupu.com` 开头的游戏跳转
- 不要改动其它业务链接、外链或普通站内跳转
- 不要删除原有非 App 分支
- 不要把所有链接都改成 `huputiyu://webview/openencodeurl`
- App 内不要直接写 `location.href = huputiyu://...`，要先组装 `params` 再调用 `window.ColorboxAI.navigate.to(params)`
- 如果原代码有埋点，先保留埋点，再执行跳转
- 不要用 `window.open` 替代原跳转逻辑

# Examples

```javascript
const targetUrl = 'https://h5game.hupu.com?game=1&appid=cmzq&screenOrientation=2&sty=app&game_source=airyld';
if (sdk.isInApp) {
  window.ColorboxAI.navigate.to({
    url: `huputiyu://webview/openencodeurl?url=${encodeURIComponent(targetUrl)}`
  });
} else {
  location.href = targetUrl;
}
```

```javascript
const link = document.querySelector('a.result-action.game-entry');
if (link) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const targetUrl = link.getAttribute('href') || '';
    if (sdk.isInApp) {
      window.ColorboxAI.navigate.to({
        url: `huputiyu://webview/openencodeurl?url=${encodeURIComponent(targetUrl)}`
      });
      return;
    }
    location.href = targetUrl;
  });
}
```
