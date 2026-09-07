# 游戏开发物语

虎扑活动 H5。现行页面是 **1995 生涯档**（刚毕业入职，点月打工到 2025）。2015 经营局仍在 `h5/js/sim/`，本版入口不走开公司。

经营数字只改本目录的 `config.json`；生涯公司/作品/薪资/跳槽只改 `career-world.json`。规则只在 `h5/js/sim/`。

## 怎么打开

用浏览器直接打开仓库里的 `h5/index.html`（`file://` 即可预览）。时间不会自己走，要点「下一月」。

- 预览：无 Colorbox 时起名过审视为通过，进度记在这一次打开的内存里。
- 虎扑 App：走登录、内容检查和云端存档（环境开通后才写得进云）。禁止 `localStorage`。

## 怎么改数值

1. 经营平衡只改 `activity/config.json`；生涯公司/作品/薪资/跳槽/虚拟作只改 `career-world.json`。不要把平衡数字抄进 design / HTML / sim。
2. `python scripts/sync_config.py`（同步 `h5/config.json` 与 `h5/js/config.generated.js`，并并入生涯表）。Windows 若失败再试 `python3`。
3. `node tests/run-sim-tests.js`，必须绿。

基准销量、盒装 Logistic 生命周期（`lifecycle` 的 T / x0 / k、`dropOffY`、`maxMonths`、`chartSize`）也只改 `config.json`。

## 文档索引

| 文件 | 给谁看 |
|------|--------|
| [design.md](design.md) | 现行玩法：生涯档（入口）+ 经营局、长线/版本、TGA、点月顺序 |
| [architecture.md](architecture.md) | view / sim / config、公开接口、存档字段、测试与改数流程 |
| [requirements.md](requirements.md) | 已拍板业务：云档、不分享、经营局公司名默认「喵扑studio」、生涯角色名默认「阿喵」 |
| `config.json` | 经营数值唯一源；改完必须 sync + 测 |
| `career-world.json` | 生涯公司/作品表；sync 时并入 `careerWorld`。长线版本不预填目录，由 sim 按发售日推算 |

仓库根 `README.md` 是 Colorbox 通用技能包说明，不是本游戏手册。
