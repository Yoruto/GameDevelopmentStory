# -*- coding: utf-8 -*-
"""P2-fix：把 career-world.json 的 virtualPool 升级为「游戏池」titlePool。

改动（精确字符串替换，幂等可重跑）：
1. 顶层键 virtualPool → titlePool；
2. 重写 comment：池作 = 覆盖补全 + 运行时兜底；
3. enabled false → true，并插入 coverage / fallback 两个策略子块；
4. idleGap 的 comment 补一句「池作优先，抉择只在池不可用时兜底」。

comment 的旧字面量由 json.dumps 现场生成，避免手抄出错。
写盘前备份 scripts/_cw_before_titlepool.json，改完 json.loads 复核。
"""
import json
import shutil

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_titlepool.json"

NEW_POOL_COMMENT = (
    "【游戏池｜P2-fix 起重新启用】不属于任何公司的备用作品库，两个用途："
    "① 覆盖补全——某公司某月排不出目录真作时从池里抽一部顶上，保证它从成立（或 1995 开局）到 2025 年底"
    "始终有活可干（只剩 minFillMonths−1 个月以内的短空窗，由推进吸收）；"
    "② 入职兜底——新入职当月在研为空时立即抽一部，不让人站在空档里。"
    "抽出来的池作带 virtual:true 标记（含义：非目录真作），走独立生命周期，不改目录档期、不占目录榜单候选。"
    "命名按题材从 titlesByGenre 抽，本局用过的不再抽；题材/玩法优先取该工作室偏好（genreIds/gameplayIds），"
    "没有偏好才按 genreWeights/gameplayWeights 抽。工期取 devMonthsMin~devMonthsMax，且不得跨过下一档目录真作的开工月。"
    "口碑走 craft（组队均值），baseStats 只在组队为空时垫底。"
    "coverage/fallback 是策略开关：都关 + enabled=false 即完全回到 P2b 的「短空窗静默 / 长空窗弹抉择」。"
)

COVERAGE_BLOCK = """\"coverage\": {
      \"comment\": \"覆盖补全的判定口径。minFillMonths 是「值得为它开一部池作的最小空窗」——比它短的洞不补，交给推进吸收（于是允许的空窗 = minFillMonths − 1 个月，与 idleGap.minDevMonths 同量级）。maxFillMonths 是单部池作最长工期（与 devMonthsMax 取小）。enabled=false 只关覆盖补全（回到纯兜底）。\",
      \"enabled\": true,
      \"minFillMonths\": 6,
      \"maxFillMonths\": 24
    },
    \"fallback\": {
      \"comment\": \"运行时兜底：入职当月、或在岗某月公司排不出目录真作时，立即从池里抽一部顶上（不等 idleMaxMonths、不弹空窗抉择）。关掉它即回到 P2b 的空窗规则。\",
      \"enabled\": true
    },"""

NEW_GAP_PREFIX = (
    "【池作优先，抉择兜底】titlePool 可用时，空窗一律由池作顶上（见 titlePool.coverage / fallback），"
    "本段只在池不可用（titlePool.enabled=false 或两个策略开关都关）时生效："
)


def literal(text):
    return '"comment": ' + json.dumps(text, ensure_ascii=False)


def main():
    s = open(PATH, encoding="utf-8").read()
    orig = s
    if '"titlePool"' in s and '"virtualPool"' not in s:
        print("已经改过（titlePool 存在、virtualPool 不存在），跳过。")
        return

    d = json.loads(s)
    old_pool_comment = literal(d["virtualPool"]["comment"])
    old_gap_comment = literal(d["idleGap"]["comment"])

    assert s.count('"virtualPool"') == 1, "virtualPool 键应只出现一次"
    s = s.replace('"virtualPool"', '"titlePool"')

    assert s.count(old_pool_comment) == 1, "titlePool comment 未命中"
    s = s.replace(old_pool_comment, literal(NEW_POOL_COMMENT))

    old_enabled = '"enabled": false,\n    "idleMaxMonths": 1,'
    assert s.count(old_enabled) == 1, "enabled/idleMaxMonths 未命中"
    s = s.replace(old_enabled, '"enabled": true,\n    ' + COVERAGE_BLOCK + '\n    "idleMaxMonths": 1,')

    assert s.count(old_gap_comment) == 1, "idleGap comment 未命中"
    s = s.replace(old_gap_comment, literal(NEW_GAP_PREFIX + d["idleGap"]["comment"].split("：", 1)[-1]))

    d2 = json.loads(s)  # 复核
    assert d2["titlePool"]["enabled"] is True
    assert d2["titlePool"]["coverage"]["minFillMonths"] == 6
    assert d2["titlePool"]["fallback"]["enabled"] is True
    assert d2["titlePool"]["idleMaxMonths"] == 1
    assert len(d2["titles"]) == 530 and len(d2["companies"]) == 75
    assert len(d2["titleDetails"]) == 530
    assert d2["idleGap"]["minDevMonths"] == 6

    shutil.copyfile(PATH, BACKUP)
    open(PATH, "w", encoding="utf-8", newline="\n").write(s)
    print("ok: %d → %d 字节；备份 %s" % (len(orig), len(s), BACKUP))
    print("idleGap comment:", d2["idleGap"]["comment"][:80] + "…")


main()
