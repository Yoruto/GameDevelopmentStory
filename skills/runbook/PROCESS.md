# 活动交付流程（通用核心 runbook）

本文件是**流程结构的唯一事实源**：机器解析 `[phase:名称]` 块（阶段顺序 = 文件顺序），
`state.py current` 每轮从这里读取当前阶段的指引。**阶段顺序、目标、产出、读范围、禁止、参考在此；硬门禁由 `domain/gates/` 机器检查。**

本层与云无关：阶段定义与沟通纪律在此；**具体实现（数据库/云函数/网关/部署步骤）
在活动技能里**（如 `act-cloudbase`，其 SKILL.md 与 references 承接）。文中「活动技能」=
当前工作区里实现本流程的交付技能（如 `skills/act-cloudbase/`）。

阶段顺序：`requirements → plan → implement → security-review → deploy → test → deliver → done`

每个阶段包含：

- **目标**：本阶段要达成的结果
- **产出**：必须落盘到 `activity/` 的产物（给人看）
- **产出文件**：本阶段产物清单（给人看；机器硬检查由对应手写 Gate 决定，见 domain/gates/）
- **禁止**：本阶段绝对不能做的事
- **参考**：需要读取的 `references/` 文档
- **输入**：本阶段允许读什么、禁止读什么（探索边界，避免读源码/无关文件）
- **为什么**（可选）：本阶段防什么失败，供 Agent 理解规则背后的意图
- **可选: 是** → 不在 advance 链上，仅 `state.py goto` 进入

---

[phase:requirements]
确认: 开发者确认
目标: 澄清开发者真实需求（先锚定目的地；先写草案再问，一轮问完整前沿 + 带推荐；新建场景必须先问雏形、禁止跳过直接生成预览（机器强制 kind=prototype 节点，已有 HTML 改造场景不问）；部署决策按技能包能力触发且时序靠后——技能包含云服务能力 → 需求轮只问雏形，存储方式确认（引导式：云端保存/本地保存，讲清区别 + 按业务推荐）留到静态预览获得开发者确认后的技术方案设计阶段；不含 → 预填本地存储、不提问但必须主动告知（需求单写「本地存储告知」，门禁强制）），产出 activity/requirements.md 并获得开发者确认
执行步骤: 静默探索（activity.json/credentials.json + query-cloudbase.js 只读查环境 + 检查技能包是否含云服务技能 skills/act-cloudbase + 检查工作区根目录是否已有 h5/index.html 判断新建/改造）→ 写草案 activity/requirements.md + decisions.json（模板见 requirements.md §需求单模板；新建 → 加 kind=prototype 节点待问；已有 HTML 改造 → 不加；无云服务技能 → 部署节点预填 choice=B + note 依据，并在需求单「部署决策」节写「本地存储告知」主动告知；含云服务技能 → 部署节点标 deferred、不进入前沿、本轮不问） | 第 1 轮只问业务拍板点（≤3 题；先 present --frontier，再按开发者回答 decide 逐项记录；prototype 节点自动排在其后） | 第 2 轮雏形引导（新建必做，机器强制）：发功能清单 + 只问「要不要先看个雏形模板」，present 后等开发者回复再 decide（A=要看/B=不用），开发者要看 → 直接收敛进 plan 出静态预览，不重复示意/追问，禁止夹带部署/存储问题 | 收敛：tree 前沿为空 → 写 confirmations/requirements.md（开发者原话）→ confirm requirements → advance | 存储方式确认在 plan 静态预览确认后执行（见 plan 阶段步骤）
产出: activity/requirements.md（业务目标/用户能做什么/规则/数据需求/素材/部署决策/不做范围/静默假设清单）+ activity/decisions.json（决策树，state.py decide 维护）
产出文件: activity/requirements.md
禁止: 未确认不得 advance；未确认前不得执行物理建表/部署云函数；不得跳过需求直接开发；禁止甩空白表单向开发者填空；新建场景（工作区根目录无 h5/index.html）禁止跳过雏形引导直接收敛生成预览（kind=prototype 节点必须 present + decide 落定）；需求轮一次只问一类问题：技能包含云服务能力时，第 2 轮雏形引导禁止同时问数据存储/后台（部署节点必须标 deferred，确认留到 plan 预览确认后）；技能包不含云服务能力时禁止提问云服务，**但必须主动告知本地存储并写入需求单（门禁强制）**；禁止无依据代答（技能包不含云服务能力时的本地存储预填除外，必须写 note 依据）；禁止未确认（或无技能包事实依据）就按云服务实现；不得向开发者问技术方案或「用哪个能力」；部署目标属于静默发现（读 activity.json/credentials.json + 跑 query-cloudbase.js 只读查询），禁止作为提问项让开发者提供环境链接/ID，仅静默发现完全失败时才回退索取；部署=云端保存时禁止拖到 deploy 阶段才第一次确认部署目标；最终确认单/提问必须以业务话术直接开头，禁止自报内部进度（文件路径/决策树状态/机制命令/阶段名）
参考: references/requirements.md（操作速查/轮次制提问/预填分级/部署决策/决策树维护）、references/thinking.md（整体思考）；部署目标与环境的细节见活动技能（act-cloudbase）的 references/deploy.md §A；命令：state.py tree / state.py decide
输入: 只读: references/requirements.md（含操作速查）、references/thinking.md、activity.json 与 credentials.json（身份/部署凭据现状）、活动技能能力总览（如 skills/colorbox-skill/SKILL.md）；禁止读: 活动技能源码、examples/、state/*.json；禁止批量浏览 skills/ 下子技能文档（选型在 plan/implement 做，最多按需读 1-2 个）；机制不会用先看 requirements.md 操作速查，不要读实现
为什么: 真实意图不在第一句话里；未问即默认的假设必须显式呈现，否则交付的是「我们以为的」。存储方式决定要不要建后台、涉及资源与成本，必须由开发者知情确认；但确认要给到用户能判断的时候——先看雏形、确认页面没问题，再引导式问「云端保存还是本地保存」（讲清区别 + 按业务给推荐，禁止甩「要不要存」这种抽象问题）；没有云服务能力时必须主动告知只能本地存储，禁止静默
[/phase:requirements]

[phase:plan]
确认: 开发者确认
目标: 生成静态 H5 预览 + 业务确认（新建走完整预览；已有 HTML 走基线改造 + 改动对照），锁定 UI 与业务事实并获得开发者确认；（技能包含云服务能力时）预览确认后、进入技术方案设计前，引导式确认存储方式（云端保存/本地保存）
执行步骤: 读 plan-confirm.md 判定新建 vs 已有改造 | 新建→生成 h5/index.html（单一原生 HTML、数据写死、无网络依赖）；已有改造→改现有 index.html + 写 activity/plan/changes.md（位置/原样/新样） | 确认单放可点击 file 链接（开发者自行打开预览；禁止调起浏览器/界面调试工具自测） | 发业务确认单（非技术化；新建=功能清单+预览，已有=三问对照） | 收到开发者确认→写 confirmations/plan.md（原话）→ confirm plan | 技能包含云服务能力 → 单独引导式确认存储方式（讲清云端保存/本地保存的区别 + 按业务给推荐，先 present 部署节点，等开发者明确回复再 decide，A=云端保存/B=本地保存）→ advance 进 implement
产出: 新建→h5/index.html（单一原生 HTML，数据写死，无网络依赖）；已有改造→改动版 index.html + activity/plan/changes.md（改动点清单：位置/原样/新样）；+ 开发者确认单（非技术化表达）
产出文件: h5/index.html（含内嵌技能使用数据块）
禁止: 未确认不得 advance；确认单禁止出现技术细节（表名/路由/puid/PostgreSQL 等）；禁止问技术方案或「用哪个能力」；已有改造不得从零重写（「重做」类须开发者确认后才行）；技能包含云服务能力时，禁止在业务确认单里夹带数据存储问题（先让开发者看预览，确认页面没问题后再单独问存储）；确认单规则段禁止把依赖存储/登录的规则写成既定事实（须标「待定：取决于存储方式」）；确认单/提问禁止预告后续流程（如「我会再单独确认一次」「不会在…一并问」）；禁止调起界面调试工具自测页面正确性（Chrome MCP / DevTools / Playwright / 浏览器模拟器 / 截图），预览仅供开发者查看
参考: references/business-rules.md（场景默认业务规则：输入接风控、分享提醒）、references/plan-confirm.md（确认单模板、已有改造三问对照、改动幅度与确认强度、用词指导）
输入: 只读: references/business-rules.md、references/plan-confirm.md、activity/requirements.md（可内部读活动技能的实现参考推导方案，不写进确认单）；禁止读: examples/、活动技能源码、state/*.json
为什么: 静态预览让开发者「看到」之后再做业务确认，避免确认了看不见的方案；已有改造要靠「改动对照」确认，只看新版会漏掉「动了我什么」；存储方式问题要等用户看完预览、确认页面没问题后再问（引导式，讲清云端/本地区别 + 给推荐，禁止问「要不要存」这种抽象问题），需求轮只问雏形
[/phase:plan]

[phase:implement]
目标: 按部署决策改造：需要→打通真实后端并接真实数据（具体步骤与产物见活动技能的 references）；不需要→纯静态 H5 完成，严禁假后端
执行步骤: 若部署模式未决（deferred）→ 先完成部署确认（present 部署节点 → 等开发者明确回复 → decide）再判定模式 | 判定部署模式（decisions.json 部署决策：需要=云 / 不需要=纯静态） | 需要→按活动技能 references（database.md/backend.md/frontend.md）在 demo 基线上原地改造：建表迁移/改云函数/改路由/前端接真实接口；不需要→完成纯静态 H5 | 按 references/business-rules.md 落地命中的业务默认规则 | 把技能使用数据块写入 h5/index.html（先跑 `node skills/runbook/scripts/scan-skill-usage.mjs` 自动扫描并原地更新 `<script type="application/json" id="colorbox-skill-usage">` 数据块；技能 ID = skills/ 下目录名，规则见 references/skill-usage.md） | 自检：需要→无 Mock/假数据、前后端字段对齐；不需要→无假接口/localStorage 冒充、无空壳函数 | confirm implement（自检语义）→ advance
产出: 需要→活动技能要求的后端产物（迁移/函数/接入，见其 references 产物清单）+ h5 接入真实接口；不需要→h5/index.html 完成 + 自检说明（无假后端产物）；+ h5/index.html 内嵌技能使用数据块（真实使用的 ColorboxAI 技能清单，单一来源）
产出文件: h5/index.html（含内嵌技能使用数据块）
禁止: 不向开发者问技术方案或「用哪个能力」；禁止另建第二套后端资源（demo 基线原地改造或显式清理）；禁止未确认先部署；需要模式严禁前端 localStorage/Mock 替代真实后端；不需要模式严禁写假接口/部署空壳；禁止伪造/漏报技能使用（h5/index.html 内嵌技能使用数据块必须与实际调用的 window.ColorboxAI API 一致，门禁按 JS Path 双向核对）；禁止重复写入技能使用数据块（多次扫描只原地更新同一 id 数据块）；禁止调起界面调试工具自测页面正确性（Chrome MCP / DevTools / Playwright / 浏览器模拟器 / 截图），写页面正确性靠静态结构自检与门禁；页面含用户文本输入必须接 R-01 内容安全检测（门禁强制拦截，见 references/business-rules.md）
参考: 活动技能（act-cloudbase）的 references/（database.md 表与迁移、backend.md 函数与路由、frontend.md H5 调用、deploy.md §B）、skills/colorbox-skill/SKILL.md（能力底座，挑选实现能力）、references/skill-usage.md（技能使用统计规则与 JSON 规范）、references/business-rules.md（场景默认业务规则：输入接风控、分享提醒）
输入: 只读: activity/requirements.md（已确认业务事实：规则/静默假设/部署决策）、活动技能（act-cloudbase）的 references/ 与 examples/（示例可参考）、references/skill-usage.md、references/business-rules.md；禁止读: state/*.json（只经 state.py）
为什么: 云服务用不用是开发者的决策；一旦确认，真实打通或纯静态都要做到「没有假的东西」；用户输入的内容安全是安全红线（R-01），防止违规内容经 H5 上线/入库
[/phase:implement]

[phase:security-review]
确认: 开发者确认
目标: 对 implement 产出的前端代码做只读发布安全审查（code-package-security-review 协议），decision 必须为 passed 才允许部署
执行步骤: 先跑 staging 构建 build-review-package.py --source h5 --output activity/review-package（勿手写 manifest） | 再跑确定性预扫描 preflight_scan.py activity/review-package | 按 security-review/SKILL.md 协议只读审查 .html/.htm/.js/.css（禁运行/联网），对照 platform-gates.md SR-000~SR-006 判 decision | 写 activity/security-review.json（security_review_json_v1 原样落盘）；decision=blocked → reject 回 implement 整改 | passed → 写 confirmations/security-review.md → confirm security-review → advance
产出: activity/review-package/（staging：h5/ 的 .html/.htm/.js/.css + .code-review/manifest.json，由 build-review-package.py 生成）+ activity/security-review.json（security_review_json_v1，原样落盘）
产出文件: activity/security-review.json
禁止: 禁止运行/构建/联网执行被审查代码；禁止读取超范围文件内容（图片/字体/音视频/WASM/JSON/SVG/source map/依赖清单等）；禁止手写 manifest（用 build-review-package.py 生成）；禁止修改被审查代码（发现违规只报告，整改回 implement 阶段做）；decision=blocked 时禁止 advance
参考: references/security-review/SKILL.md（审查协议与输出字段）、references/security-review/references/platform-gates.md（SR-000~SR-006 判定基线）、references/security-review/scripts/preflight_scan.py（确定性预扫描，先跑；用法=`preflight_scan.py activity/review-package`，参数是审查包目录）、references/security-review/scripts/build-review-package.py（staging 构建，先跑；用法=`build-review-package.py --source h5 --output activity/review-package`，参数有默认值可省略，不要用位置参数试错）
输入: 只读: references/security-review/（协议与基线）、h5/ 与 activity/review-package/（仅 .html/.htm/.js/.css）；禁止读: examples/、活动技能源码、state/*.json；后端代码不在本阶段审查范围（由 test 阶段冒烟覆盖）
为什么: 发布安全门禁必须在部署前拦截；确定性预扫描 + 小窗口人工确认，防止外域资源/内联脚本/动态代码执行等违规代码上线
[/phase:security-review]

[phase:deploy]
确认: 开发者确认
目标: 需要→按活动技能 references 部署后端与配置（迁移/函数/网关/域名，回写前端配置）；不需要→声明「无需部署」进入测试
执行步骤: 静默确认部署目标（credentials.json / query-cloudbase.js 零参数只读：已有 envId 直接复用，无环境才 create-cloudbase.js 开通；脚本未绑定活动身份时直接报错，绝不使用默认身份开通） | 按活动技能 references/deploy.md §B 执行部署清单（迁移/函数/网关/域名）并回写前端配置 | 真实环境验收：health 200、无 token 写 401 | 写 confirmations/deploy.md（开发者确认原话）→ confirm deploy → advance（部署是真实变更，必须先获开发者确认）
产出: 需要→部署自检通过且前端已接入真实后端；不需要→activity/deploy-note.md（一行说明为何无需部署）
产出文件: 
禁止: 部署目标未明确时禁止执行任何部署动作；先静默确认（credentials.json / query-cloudbase.js 只读 + create-cloudbase.js 开通），仅静默发现失败时才用业务语言索取「环境链接/环境 ID」，禁止猜测/批量选环境；禁止用默认身份（workspace）或未替换占位符开通云环境（脚本会直接报错，门禁同步拦截）；后台不可达（fetch failed）先自愈重试，禁止把后台未启动当作需要开发者提供环境的问题抛给开发者；部署 API 的具体约束见活动技能（act-cloudbase）的 references/deploy.md；不需要模式禁止部署空壳
参考: 活动技能（act-cloudbase）的 references/deploy.md §B（部署清单与验收）
输入: 只读: 活动技能（act-cloudbase）的 references/deploy.md 等部署文档与既有配置；禁止读: 与本阶段无关的文档
为什么: 部署是真实变更，目标环境是开发者资产、必须由开发者明确，Agent 禁止自选环境；必须先验收兜底再交付；无需部署时也别留空壳
[/phase:deploy]

[phase:test]
目标: 需要→接口冒烟 + 规则对齐自检；不需要→页面/静态自检 + 规则对齐，产出测试报告全绿
执行步骤: 按部署模式选测试路径：需要→接口冒烟（curl 校验 health/读写/限次，示例见 deploy.md §C）；不需要→静态页面自检清单 | 规则对齐：需求单每条规则逐项核对（功能/权限/性能），并纳入 references/business-rules.md 默认规则自检 | 写 activity/test-report.md 逐项全绿；有失败 → reject 回 implement 整改 | confirm test → advance
产出: activity/test-report.md（功能/规则/权限/性能逐项核对，按部署决策选冒烟或页面自检）
产出文件: activity/test-report.md
禁止: 禁用 UI 自动化（Chrome MCP / DevTools / 浏览器模拟器）；需要模式只用 curl 或脚本做接口校验；不需要模式用静态页面检查清单
参考: 活动技能（act-cloudbase）的 references/deploy.md §C（需要模式冒烟示例与性能补充）
输入: 只读: 活动技能（act-cloudbase）的 references/deploy.md §C（冒烟与性能补充）；禁止读: 与本阶段无关的文档
为什么: 全绿才交付，失败回 implement，防止把未验证的东西交给开发者
[/phase:test]

[phase:deliver]
确认: 开发者确认
目标: 写 manifest、发审计通知（走 ai-game 服务推送钉钉）、发交付确认单（部署完成 + 真实线上地址 + 本地文件位置 + 询问预览二维码/打开本地文件夹）并获开发者确认
执行步骤: 写 activity/activity.manifest.json（metaActivityId/alias/envId/resources/publicBaseUrl/verification.ok） | 发审计通知（钉钉，脚本走 ai-game 服务推送，见 runbook/scripts/notify-dingtalk.mjs） | 发开发者交付确认单（模板见 references/deliver-confirm.md，含「可选下一步」先询问是否需要生成预览二维码）→ 收到开发者回复（确认 + 是否要二维码）→ 确认要二维码才按 preview-qr.md 跑 update-activity-html.js 生成 preview-qr.png + previewUrl → 写 confirmations/deliver.md（开发者原话）→ confirm deliver → advance
产出: activity/activity.manifest.json（status=verified）、钉钉通知已发、交付确认单已发；开发者确认要二维码后才有 preview-qr.png + previewUrl
产出文件: activity/activity.manifest.json
禁止: 交付单禁止把 localhost/本地端口/未发布地址当「在线预览（真实数据）」；未确认不得执行上线/二维码脚本（见活动技能 references/preview-qr.md）；通知失败不回滚已部署资源
参考: references/deliver-confirm.md（交付确认单模板）、活动技能（act-cloudbase）的 references/deploy.md §C（manifest 规范）、references/preview-qr.md（二维码）
输入: 只读: references/deliver-confirm.md、活动技能（act-cloudbase）的 references/deploy.md §C、references/preview-qr.md
[/phase:deliver]

[phase:done]
目标: 交付完成，通知开发者并结束
执行步骤: 向开发者发结果告知（一句话业务结果）；可选留档 activity/ 记录 | 流程结束，不再 advance
产出: 无（可选留档记录）
产出文件: 
禁止: 无
参考: 无
输入: 无
[/phase:done]
