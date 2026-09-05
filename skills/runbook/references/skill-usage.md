# 技能使用统计（内嵌于 h5/index.html）

## 目的

统计 `h5/index.html` **真实用到**的 ColorboxAI 技能，并作为 implement 阶段硬门禁：

- 防止 AI 编造技能名（动态范围校验：值必须是本工作区已交付、可调用的运行时技能 ID，范围随技能包运行期得出，无需硬编码表）；
- 防止漏报/虚报（门禁按 JS Path 双向核对：声明了必须真实调用，调用了必须已声明）；
- 单一来源：技能使用 JSON **内嵌在 HTML 数据块**，审核/门禁都从 HTML 提取，
  不另写独立 JSON 文件，避免与 HTML 重复写入、更新后失步。

## 产物（内嵌数据块）

技能使用 JSON 以 `<script type="application/json">` 数据块内嵌在 `h5/index.html`：

```html
<script type="application/json" id="colorbox-skill-usage">
{
  "skills": ["colorbox-cloud-auth", "colorbox-cloud-request"]
}
</script>
```

- 数据块位于 `<head>` 内（扫描脚本自动插入/原地更新，同 id 只保留一份，重复运行不产生重复块）；
- `skills`：字符串数组，元素为**技能 ID**（= 工作区 `skills/` 下目录名，如 `colorbox-cloud-auth`）；
- 未用到任何 ColorboxAI 技能时写空数组 `[]`（数据块仍必须存在）；
- 每个技能 ID 只出现一次；
- 该数据块不执行业务逻辑，发布安全门禁 SR-003 明确放行 `type="application/json"` 数据脚本，
  会随 h5/ 上传包一起发布，线上 HTML 自带技能使用清单，便于事后审核直接读取。

## 生成方式（推荐）

implement 完成 `h5/index.html` 后，在工作区根目录执行：

```bash
node skills/runbook/scripts/scan-skill-usage.mjs
```

脚本自动扫描 index.html 中出现的 `window.ColorboxAI.*` 调用并**原地更新**数据块
（技能 ID 取自工作区已交付技能的 SKILL.md JS Path，子能力前缀不混淆；不存在时自动插入）。
也可手写数据块，但必须真实。

## 门禁检查项（implement，机器强制）

1. `h5/index.html` 存在且包含可解析的技能使用数据块（`id="colorbox-skill-usage"`）；
2. 结构为 `{"skills": ["colorbox-...", ...]}`（`skills` 为非空字符串数组）；
3. **动态范围**：每个值必须是本工作区 `skills/` 下**已交付且可调用**的 ColorboxAI
   运行时技能——技能目录由技能包打包写入，运行期按「目录存在且 SKILL.md 带 JS Path」
   动态收集，不维护硬编码检查表，SDK 增删技能无需再生成。交付技能
   `act-cloudbase`、审查技能 `audit-hupu-web-security`、总览 `colorbox-skill`
   没有 JS Path，天然不在范围内，不得出现在数据块中；
4. 无重复；
5. 双向真实核对：声明的技能必须在 `h5/index.html` 中调用了对应 `window.ColorboxAI.*`
   API；index.html 实际调用到的技能必须全部声明。

> 说明：合法范围 = 打包时交付的技能（`skills/` 由技能包写入，Agent 不应增改）。
> 声明了未交付/非运行时技能、或声明与实际调用不一致，都会被门禁拦截。
