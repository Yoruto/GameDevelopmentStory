# 游戏开发物语

虎扑活动 H5：从 2015 点月经营到 2025。玩法数字只改本目录的 `config.json`，规则只在 `h5/js/sim/`。

## 怎么打开

用浏览器直接打开仓库里的 `h5/index.html`（`file://` 即可预览）。时间不会自己走，要点「下一月」。

- 预览：无 Colorbox 时起名过审视为通过，进度记在这一次打开的内存里。
- 虎扑 App：走登录、内容检查和云端存档（环境开通后才写得进云）。禁止 `localStorage`。

## 怎么改数值

1. 只改 `activity/config.json`（不要把平衡数字抄进 design / HTML / sim）。
2. `python scripts/sync_config.py`（同步 `h5/config.json` 与 `h5/js/config.generated.js`）。Windows 若失败再试 `python3`。
3. `node tests/run-sim-tests.js`，必须绿。

基准销量、盒装 Logistic 生命周期（`lifecycle` 的 T / x0 / k、`dropOffY`、`maxMonths`、`chartSize`）也只改这份 json。

## 文档索引

| 文件 | 给谁看 |
|------|--------|
| [design.md](design.md) | 现行玩法：点月、三端、外包、待发售、事件、生命周期、畅销榜、长线/工作室/评分/年度奖 |
| [architecture.md](architecture.md) | view / sim / config、公开接口、存档字段、测试与改数流程 |
| [requirements.md](requirements.md) | 已拍板业务：云档、不分享、公司名默认「喵扑studio」 |
| `config.json` | 数值唯一源；改完必须 sync + 测 |

仓库根 `README.md` 是 Colorbox 通用技能包说明，不是本游戏手册。
