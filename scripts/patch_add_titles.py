# -*- coding: utf-8 -*-
"""P2-fix-a：给时间轴铺不满的公司补真实历史作品。

背景：75 家有 45 家的「大洞」（连续 ≥6 个月没有任何目录真作在研）合计 10824 月，
真作覆盖率只有 48.2%，其余靠游戏池的「过渡项目」顶。本脚本按公司补它们真实存在过
的代表作，把大洞填上，让玩家多数时间做的是目录真作。

生成规则（全部确定性，可重跑）：
  · stats 从「同公司年代最接近的既有作品」按比例缩放：合计对齐 qualityRef(300)，
    再按新作评分相对 8.0 的差做 ±6/分 的平移，最后夹到 [30,95]。保证落在既有分布内。
  · devMonths 取真实开发周期的近似值；devStart = 发售月 − devMonths。
  · inviteWindow = devStart+2 月 → 发售前一月；inviteMinFame 按 prestige 取（16/28/44/62）。
  · landmark 一律 false（叙事锚点留给 P5 六章编排），inviteEligible 一律 false
    （不新增 offer/邀约的落点，避免扰动已验收的准入链路；准入本身走 companyInDevCatalogTitle，
     与 inviteEligible 无关，所以这些作品照样能派给玩家）。
  · seriesId 不填，platforms/studioId/nameEn 沿用参考作品。

幂等：已存在的 id 跳过。写盘前备份 scripts/_cw_before_addtitles.json。
用法：python scripts/patch_add_titles.py [--dry-run]
"""
import json
import shutil
import sys
from collections import defaultdict

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_addtitles.json"
DIMS = ("play", "fun", "expression", "immersion")

# (companyId, id, name, alias, 发售年, 发售月, genreId, gameplayId, prestige, score, devMonths)
NEW = [
    # ── toysForBob（1989 us）────────────────────────────────────────────────
    ("toysForBob", "pandemonium96", "潘多拉魔盒", "潘多拉", 1996, 10, "cartoon", "platform", 2, 7.4, 16),
    ("toysForBob", "unholyWar98", "邪魔战争", "邪魔", 1998, 9, "scifi", "strategy", 2, 7.2, 16),
    ("toysForBob", "madagascar05", "马达加斯加", "马达加斯加", 2005, 5, "cartoon", "platform", 2, 6.9, 14),
    ("toysForBob", "crashTitans07", "古惑狼：泰坦之怒", "泰坦之怒", 2007, 10, "cartoon", "platform", 2, 7.3, 16),
    ("toysForBob", "skylanders11", "小龙斯派罗：冒险", "斯派罗冒险", 2011, 10, "cartoon", "platform", 3, 8.0, 24),
    # ── triAce（1995 jp）────────────────────────────────────────────────────
    ("triAce", "starOcean96", "星之海洋", "星海1", 1996, 7, "scifi", "rpg", 3, 8.2, 18),
    ("triAce", "starOcean2_98", "星之海洋2", "星海2", 1998, 7, "scifi", "rpg", 4, 8.7, 20),
    ("triAce", "valkyrie2_06", "女神侧身像2：希尔梅莉亚", "VP2", 2006, 6, "myth", "rpg", 3, 8.1, 24),
    ("triAce", "starOcean4_09", "星之海洋4：最后的希望", "星海4", 2009, 2, "scifi", "rpg", 3, 7.9, 24),
    ("triAce", "resonance10", "永恒终焉", "EOE", 2010, 1, "scifi", "rpg", 3, 7.7, 22),
    ("triAce", "starOcean5_16", "星之海洋5：忠诚与背叛", "星海5", 2016, 3, "scifi", "rpg", 2, 7.0, 20),
    ("triAce", "valkyrieElysium22", "女神侧身像：极乐世界", "VP极乐", 2022, 9, "myth", "arpg", 2, 6.8, 20),
    # ── treasure（1992 jp）──────────────────────────────────────────────────
    ("treasure", "yuYu95", "幽游白书 魔强统一战", "魔强统一战", 1995, 9, "superhero", "fighting", 3, 8.4, 12),
    ("treasure", "guardianHeroes97", "守护英雄", "守护英雄", 1997, 1, "fantasy", "action", 3, 8.3, 14),
    ("treasure", "sinPunishment00", "罪与罚：地球的继承者", "罪与罚", 2000, 11, "scifi", "shooter", 3, 8.0, 18),
    ("treasure", "warioWorld03", "瓦里奥世界", "瓦里奥世界", 2003, 5, "cartoon", "platform", 2, 7.2, 16),
    ("treasure", "childOfEden11", "伊甸之子", "伊甸之子", 2011, 6, "scifi", "shooter", 3, 7.9, 20),
    # ── sega（1960 jp）──────────────────────────────────────────────────────
    ("sega", "sonicAdventure98", "索尼克大冒险", "索尼克大冒险", 1998, 12, "cartoon", "platform", 4, 8.6, 20),
    ("sega", "yakuza05", "如龙", "如龙", 2005, 12, "urban", "action", 4, 8.5, 22),
    ("sega", "bayonetta09", "猎天使魔女", "魔女", 2009, 10, "fantasy", "action", 4, 8.8, 24),
    ("sega", "yakuza0_15", "如龙0：誓约的场所", "如龙0", 2015, 3, "urban", "action", 4, 9.0, 24),
    ("sega", "sonicFrontiers22", "索尼克：未知边境", "未知边境", 2022, 11, "cartoon", "openWorld", 3, 7.6, 28),
    # ── rare（1985 uk）──────────────────────────────────────────────────────
    ("rare", "banjo98", "班卓熊大冒险", "班卓熊", 1998, 6, "cartoon", "platform", 4, 8.9, 20),
    ("rare", "conker01", "康克的坏毛日", "康克", 2001, 3, "cartoon", "platform", 3, 8.4, 22),
    ("rare", "starFoxAdventures02", "星际火狐大冒险", "火狐冒险", 2002, 9, "scifi", "action", 3, 7.5, 24),
    ("rare", "kameo05", "卡美奥：元素之力", "卡美奥", 2005, 11, "fantasy", "action", 3, 7.3, 24),
    ("rare", "seaOfThieves18", "盗贼之海", "盗贼之海", 2018, 3, "adventure", "openWorld", 4, 8.2, 28),
    # ── ca（1987 uk）────────────────────────────────────────────────────────
    ("ca", "shogun00", "幕府将军：全面战争", "幕府1", 2000, 6, "historical", "strategy", 3, 8.3, 22),
    ("ca", "medieval02", "中世纪：全面战争", "中世纪1", 2002, 8, "historical", "strategy", 3, 8.4, 22),
    ("ca", "medieval2_06", "中世纪II：全面战争", "中世纪2", 2006, 11, "historical", "strategy", 4, 8.8, 24),
    ("ca", "empireTotalWar09", "帝国：全面战争", "帝国", 2009, 3, "historical", "strategy", 4, 8.5, 26),
    ("ca", "totalWarWarhammer16", "全面战争：战锤", "战锤全战", 2016, 5, "fantasy", "strategy", 4, 8.6, 26),
    # ── teamNinja（1995 jp）─────────────────────────────────────────────────
    ("teamNinja", "doa96", "死或生", "DOA1", 1996, 11, "urban", "fighting", 3, 8.0, 16),
    ("teamNinja", "doa2_99", "死或生2", "DOA2", 1999, 10, "urban", "fighting", 4, 8.6, 18),
    ("teamNinja", "ninjaGaiden04", "忍者龙剑传", "忍龙1", 2004, 3, "fantasy", "action", 4, 8.9, 24),
    ("teamNinja", "doa4_05", "死或生4", "DOA4", 2005, 12, "urban", "fighting", 4, 8.5, 22),
    ("teamNinja", "ninjaGaiden2_08", "忍者龙剑传2", "忍龙2", 2008, 6, "fantasy", "action", 4, 8.7, 26),
    ("teamNinja", "doa5_12", "死或生5", "DOA5", 2012, 9, "urban", "fighting", 3, 8.1, 24),
    ("teamNinja", "ninjaGaiden4_25", "忍者龙剑传4", "忍龙4", 2025, 10, "fantasy", "action", 4, 8.4, 30),
    # ── remedy（1995 fi）────────────────────────────────────────────────────
    ("remedy", "maxPayne2_03", "马克思·佩恩2：佩恩的陨落", "佩恩2", 2003, 10, "urban", "shooter", 3, 8.4, 22),
    ("remedy", "alanWake10", "心灵杀手", "阿兰醒醒", 2010, 5, "horror", "action", 4, 8.6, 28),
    ("remedy", "alanWakeAN12", "心灵杀手：美国噩梦", "美国噩梦", 2012, 2, "horror", "action", 2, 7.4, 16),
    ("remedy", "quantumBreak16", "量子破碎", "量子破碎", 2016, 4, "scifi", "shooter", 3, 7.8, 30),
    # ── polyphony（1998 jp）─────────────────────────────────────────────────
    ("polyphony", "gt5Prologue07", "GT赛车5 序章", "GT5序章", 2007, 12, "sports", "racing", 3, 8.0, 18),
    ("polyphony", "gt5_10", "GT赛车5", "GT5", 2010, 11, "sports", "racing", 4, 8.8, 30),
    ("polyphony", "gt6_13", "GT赛车6", "GT6", 2013, 12, "sports", "racing", 4, 8.4, 26),
    ("polyphony", "gtSport17", "GT Sport", "GTS", 2017, 10, "sports", "racing", 3, 8.1, 26),
    ("polyphony", "gt7_22", "GT赛车7", "GT7", 2022, 3, "sports", "racing", 4, 8.5, 30),
    # ── snk（1978 jp）───────────────────────────────────────────────────────
    ("snk", "lastBlade97", "月华剑士", "月华", 1997, 12, "historical", "fighting", 3, 8.2, 14),
    ("snk", "garouMotw99", "饿狼传说：狼之印记", "狼印", 1999, 11, "urban", "fighting", 4, 8.8, 18),
    ("snk", "kof2002", "拳皇2002", "KOF2002", 2002, 10, "urban", "fighting", 3, 8.3, 16),
    ("snk", "samsho5_03", "侍魂零", "侍魂零", 2003, 12, "historical", "fighting", 3, 8.0, 16),
    ("snk", "kofXI_05", "拳皇XI", "KOFXI", 2005, 11, "urban", "fighting", 3, 8.1, 18),
    ("snk", "kofXIII_10", "拳皇XIII", "KOF13", 2010, 7, "urban", "fighting", 4, 8.5, 22),
    ("snk", "kofXIV_16", "拳皇XIV", "KOF14", 2016, 8, "urban", "fighting", 3, 7.8, 22),
    # ── level5（1998 jp）────────────────────────────────────────────────────
    ("level5", "darkChronicle02", "暗黑编年史", "暗黑编年史", 2002, 11, "fantasy", "rpg", 3, 8.3, 24),
    ("level5", "dq8_04", "勇者斗恶龙VIII：天空、海洋、大地与被诅咒的公主", "DQ8", 2004, 11, "fantasy", "rpg", 4, 8.9, 26),
    ("level5", "layton2_07", "雷顿教授与恶魔之箱", "雷顿2", 2007, 11, "mystery", "puzzle", 3, 8.4, 18),
    ("level5", "inazumaGo11", "闪电十一人GO", "闪电GO", 2011, 12, "sports", "rpg", 3, 8.2, 20),
    ("level5", "yokai2_14", "妖怪手表2", "妖怪2", 2014, 7, "cartoon", "rpg", 4, 8.6, 22),
    ("level5", "yokai3_16", "妖怪手表3", "妖怪3", 2016, 7, "cartoon", "rpg", 3, 8.3, 24),
    ("level5", "ni2_18", "二之国II：亡灵之国", "二之国2", 2018, 3, "fantasy", "rpg", 3, 8.4, 28),
    # ── softstar（1988 cn）──────────────────────────────────────────────────
    ("softstar", "xdTianZhiHen00", "轩辕剑外传：天之痕", "天之痕", 2000, 12, "wuxia", "rpg", 4, 8.9, 22),
    ("softstar", "xd4_02", "轩辕剑肆：黑龙舞兮云飞扬", "轩辕剑肆", 2002, 8, "historical", "rpg", 3, 8.4, 22),
    ("softstar", "xdCangZhiTao04", "轩辕剑外传：苍之涛", "苍之涛", 2004, 2, "historical", "rpg", 4, 8.7, 24),
    ("softstar", "xd5_06", "轩辕剑伍：一剑凌云山海情", "轩辕剑伍", 2006, 10, "historical", "rpg", 3, 8.1, 24),
    ("softstar", "pal5Pre13", "仙剑奇侠传五前传", "仙五前", 2013, 1, "wuxia", "rpg", 4, 8.8, 24),
    ("softstar", "xd6_13", "轩辕剑陆：凤凌长空千载云", "轩辕剑陆", 2013, 8, "historical", "rpg", 2, 7.2, 22),
    ("softstar", "pal6_15", "仙剑奇侠传六", "仙剑六", 2015, 7, "wuxia", "rpg", 3, 7.6, 26),
    ("softstar", "pal7_21", "仙剑奇侠传七", "仙剑七", 2021, 10, "wuxia", "arpg", 3, 7.8, 30),
    # ── larian（1996 be）────────────────────────────────────────────────────
    ("larian", "divineDivinity02", "神界", "神界1", 2002, 9, "fantasy", "rpg", 3, 8.0, 24),
    ("larian", "beyondDivinity04", "超越神界", "超越神界", 2004, 4, "fantasy", "rpg", 2, 7.5, 20),
    ("larian", "divinity2_09", "神界II：复仇之炎", "神界2", 2009, 11, "fantasy", "rpg", 2, 7.6, 26),
    ("larian", "dragonCommander13", "神界：龙之指挥官", "龙之指挥官", 2013, 6, "fantasy", "strategy", 2, 7.3, 22),
    # ── falcom（1981 jp）────────────────────────────────────────────────────
    ("falcom", "ed3_95", "英雄传说III：白发魔女", "白发魔女", 1995, 3, "fantasy", "rpg", 3, 8.2, 16),
    ("falcom", "ed4_96", "英雄传说IV：朱红的泪", "朱红泪", 1996, 5, "fantasy", "rpg", 3, 8.3, 18),
    ("falcom", "ed5_99", "英雄传说V：海之槛歌", "海之槛歌", 1999, 12, "fantasy", "rpg", 3, 8.1, 20),
    ("falcom", "ys6_03", "伊苏VI：纳比斯汀的方舟", "伊苏6", 2003, 9, "fantasy", "arpg", 3, 8.3, 20),
    ("falcom", "ysOath05", "伊苏：菲尔盖纳之誓约", "伊苏F", 2005, 6, "fantasy", "arpg", 3, 8.4, 18),
    ("falcom", "soraSC_06", "英雄传说：空之轨迹SC", "空轨SC", 2006, 3, "fantasy", "rpg", 4, 8.8, 22),
    ("falcom", "sora3rd_07", "英雄传说：空之轨迹 the 3rd", "空轨3rd", 2007, 6, "fantasy", "rpg", 3, 8.5, 20),
    ("falcom", "ys7_09", "伊苏7", "伊苏7", 2009, 9, "fantasy", "arpg", 3, 8.2, 22),
    ("falcom", "sen1_13", "英雄传说：闪之轨迹", "闪轨1", 2013, 9, "fantasy", "rpg", 4, 8.6, 26),
    ("falcom", "sen2_14", "英雄传说：闪之轨迹II", "闪轨2", 2014, 9, "fantasy", "rpg", 3, 8.3, 24),
    ("falcom", "tokyoXanadu15", "东京迷城", "东京迷城", 2015, 9, "urban", "arpg", 3, 8.0, 24),
    ("falcom", "sen3_17", "英雄传说：闪之轨迹III", "闪轨3", 2017, 9, "fantasy", "rpg", 3, 8.4, 28),
    # ── ncsoft（1997 kr）────────────────────────────────────────────────────
    ("ncsoft", "guildWars05", "激战", "激战1", 2005, 4, "fantasy", "rpg", 3, 8.4, 26),
    ("ncsoft", "guildWars2_12", "激战2", "激战2", 2012, 8, "fantasy", "mmo", 4, 8.5, 30),
    ("ncsoft", "lineage2M19", "天堂2M", "天堂2M", 2019, 11, "fantasy", "mmo", 2, 7.0, 24),
    ("ncsoft", "throneLiberty23", "王权与自由", "王权与自由", 2023, 12, "fantasy", "mmo", 3, 7.4, 32),
    ("ncsoft", "aion2_25", "永恒之塔2", "AION2", 2025, 11, "fantasy", "mmo", 3, 7.6, 32),
    # ── firaxis（1996 us）───────────────────────────────────────────────────
    ("firaxis", "civ3_01", "文明III", "文明3", 2001, 10, "historical", "strategy", 4, 8.8, 24),
    ("firaxis", "civ4Warlords06", "文明IV：战神", "文明4战神", 2006, 7, "historical", "strategy", 3, 8.4, 16),
    ("firaxis", "civRev08", "文明：变革", "文明变革", 2008, 7, "historical", "strategy", 3, 8.0, 22),
    ("firaxis", "civ6_16", "文明VI", "文明6", 2016, 10, "historical", "strategy", 4, 8.8, 30),
    ("firaxis", "xcomWotC17", "幽浮2：天选者之战", "天选者之战", 2017, 8, "scifi", "strategy", 3, 8.6, 18),
    ("firaxis", "midnightSuns22", "漫威午夜之子", "午夜之子", 2022, 12, "superhero", "strategy", 3, 8.2, 30),
    # ── nexon（1994 kr）─────────────────────────────────────────────────────
    ("nexon", "kingdomWinds96", "风之国度", "风之国", 1996, 4, "fantasy", "mmo", 2, 7.5, 20),
    ("nexon", "mabinogi04", "洛奇", "洛奇", 2004, 12, "fantasy", "mmo", 3, 8.2, 26),
    ("nexon", "vindictus10", "洛奇英雄传", "洛英", 2010, 1, "fantasy", "action", 3, 8.0, 28),
    ("nexon", "firstDescendant24", "第一后裔", "第一后裔", 2024, 7, "scifi", "shooter", 3, 7.4, 32),
    # ── bandaiNamco（2005 jp）───────────────────────────────────────────────
    ("bandaiNamco", "tekken5_05", "铁拳5", "铁拳5", 2005, 3, "urban", "fighting", 4, 8.7, 22),
    ("bandaiNamco", "soulcalibur4_08", "灵魂能力IV", "SC4", 2008, 10, "fantasy", "fighting", 3, 8.3, 24),
    ("bandaiNamco", "tekken7_17", "铁拳7", "铁拳7", 2017, 6, "urban", "fighting", 4, 8.6, 30),
    ("bandaiNamco", "dbzFighterz18", "龙珠斗士Z", "斗士Z", 2018, 1, "superhero", "fighting", 4, 8.8, 26),
    ("bandaiNamco", "tekken8_24", "铁拳8", "铁拳8", 2024, 1, "urban", "fighting", 4, 8.5, 32),
    # ── bioware（1995 ca）───────────────────────────────────────────────────
    ("bioware", "neverwinter02", "无冬之夜", "无冬", 2002, 6, "fantasy", "rpg", 4, 8.9, 26),
    ("bioware", "dragonAge09", "龙腾世纪：起源", "DAO", 2009, 11, "fantasy", "rpg", 4, 8.9, 30),
    ("bioware", "dragonAge2_11", "龙腾世纪II", "DA2", 2011, 3, "fantasy", "rpg", 3, 7.8, 24),
    ("bioware", "massEffect3_12", "质量效应3", "ME3", 2012, 3, "scifi", "rpg", 4, 8.9, 30),
    ("bioware", "dragonAgeI14", "龙腾世纪：审判", "DAI", 2014, 11, "fantasy", "rpg", 4, 8.7, 32),
    ("bioware", "anthem19", "圣歌", "圣歌", 2019, 2, "scifi", "shooter", 3, 6.8, 32),
    # ── guerilla（2000 nl）──────────────────────────────────────────────────
    ("guerilla", "killzone04", "杀戮地带", "KZ1", 2004, 11, "scifi", "shooter", 3, 8.0, 26),
    ("guerilla", "killzone3_11", "杀戮地带3", "KZ3", 2011, 2, "scifi", "shooter", 3, 8.3, 26),
    ("guerilla", "shadowFall13", "杀戮地带：暗影坠落", "暗影坠落", 2013, 11, "scifi", "shooter", 3, 7.8, 28),
    ("guerilla", "horizonCotM23", "地平线：山之呼唤", "山之呼唤", 2023, 2, "scifi", "action", 2, 7.5, 24),
    # ── sony（1993 jp，第一方发行）──────────────────────────────────────────
    ("sony", "infamousSS14", "声名狼藉：次子", "次子", 2014, 3, "superhero", "action", 4, 8.5, 26),
    ("sony", "ghostOfTsushima20", "对马岛之魂", "对马岛", 2020, 7, "historical", "openWorld", 4, 8.9, 32),
    ("sony", "demonSouls20", "恶魔之魂 重制版", "恶魂重制", 2020, 11, "fantasy", "arpg", 4, 8.8, 28),
    ("sony", "returnal21", "死亡回归", "Returnal", 2021, 4, "scifi", "shooter", 3, 8.4, 30),
    ("sony", "helldivers2_24", "绝地潜兵2", "绝地潜兵2", 2024, 2, "scifi", "shooter", 4, 8.6, 32),
    # ── bethesda（1986 us）──────────────────────────────────────────────────
    ("bethesda", "daggerfall96", "上古卷轴II：匕首雨", "匕首雨", 1996, 9, "fantasy", "rpg", 3, 8.0, 26),
    ("bethesda", "morrowind02", "上古卷轴III：晨风", "晨风", 2002, 5, "fantasy", "rpg", 4, 8.9, 30),
    ("bethesda", "fallout76_18", "辐射76", "辐射76", 2018, 11, "apocalypse", "rpg", 2, 6.5, 30),
    ("bethesda", "starfield23", "星空", "星空", 2023, 9, "scifi", "rpg", 4, 7.8, 32),
    # ── insomniac（1994 us）─────────────────────────────────────────────────
    ("insomniac", "disruptor96", "破坏者", "Disruptor", 1996, 11, "scifi", "shooter", 2, 7.2, 18),
    ("insomniac", "ratchet02", "瑞奇与叮当", "瑞奇1", 2002, 11, "cartoon", "platform", 4, 8.8, 22),
    ("insomniac", "ratchet3_04", "瑞奇与叮当3", "瑞奇3", 2004, 11, "cartoon", "platform", 3, 8.5, 22),
    ("insomniac", "resistance2_08", "抵抗2", "抵抗2", 2008, 11, "scifi", "shooter", 3, 8.3, 26),
    ("insomniac", "resistance3_11", "抵抗3", "抵抗3", 2011, 9, "scifi", "shooter", 3, 8.1, 26),
    ("insomniac", "sunsetOverdrive14", "日落过载", "日落过载", 2014, 10, "urban", "shooter", 3, 8.4, 28),
    ("insomniac", "milesMorales20", "漫威蜘蛛侠：迈尔斯·莫拉莱斯", "迈尔斯", 2020, 11, "superhero", "action", 4, 8.7, 26),
    # ── hudson（1973 jp）────────────────────────────────────────────────────
    ("hudson", "bomberman64_97", "炸弹人64", "炸弹人64", 1997, 9, "cartoon", "action", 3, 8.0, 18),
    ("hudson", "marioParty98", "马里奥派对", "马派1", 1998, 12, "cartoon", "cards", 4, 8.5, 20),
    ("hudson", "bombermanLand03", "炸弹人乐园", "炸弹人乐园", 2003, 12, "cartoon", "action", 2, 7.4, 18),
    ("hudson", "tengai3_04", "天外魔境III：南弥陀", "天外3", 2004, 11, "fantasy", "rpg", 3, 7.7, 26),
    ("hudson", "marioParty8_07", "马里奥派对8", "马派8", 2007, 5, "cartoon", "cards", 3, 8.2, 20),
    ("hudson", "marioParty9_11", "马里奥派对9", "马派9", 2011, 10, "cartoon", "cards", 3, 8.1, 20),
]

CAREER_NOTE = "扎实的行业履历，声望提升有限。"
FAME_BY_PRESTIGE = {2: 16, 3: 28, 4: 44, 5: 62}


def main():
    dry = "--dry-run" in sys.argv
    d = json.load(open(PATH, encoding="utf-8"))
    tm = {t["id"]: t for t in d["titles"]}
    dm = {x["id"]: x for x in d["titleDetails"]}
    by_co = defaultdict(list)
    for t in d["titles"]:
        by_co[t["companyId"]].append(t)
    comap = {c["id"]: c for c in d["companies"]}
    valid_genre = {g["id"] for g in (json.load(open("activity/config.json", encoding="utf-8"))
                                    .get("content") or {}).get("genres", [])}
    valid_play = {g["id"] for g in (json.load(open("activity/config.json", encoding="utf-8"))
                                   .get("content") or {}).get("gameplay", [])}

    # 已在用 id 去重检查
    seen = set()
    for row in NEW:
        cid, tid = row[0], row[1]
        if tid in seen:
            raise SystemExit("新 id 重复: %s" % tid)
        seen.add(tid)
        if cid not in comap:
            raise SystemExit("公司不存在: %s" % cid)
        if tid in tm:
            continue
        if row[6] not in valid_genre:
            raise SystemExit("题材不存在: %s (%s)" % (row[6], tid))
        if row[7] not in valid_play:
            raise SystemExit("玩法不存在: %s (%s)" % (row[7], tid))

    added, skipped = [], []
    for (cid, tid, name, alias, y, m, genre, play, prestige, score, devmonths) in NEW:
        if tid in tm:
            skipped.append(tid)
            continue
        peers = sorted(by_co[cid], key=lambda t: abs((t["releaseYear"] or 2000) - y))
        if not peers:
            raise SystemExit("%s 没有可参考的既有作品" % cid)
        ref = peers[0]
        refd = dm[ref["id"]]
        rs = ref.get("stats") or {}
        ssum = sum(rs.get(k, 0) for k in DIMS) or 1
        target = 300.0 + (score - 8.0) * 6.0
        k = target / ssum
        stats = {}
        for dim in DIMS:
            v = int(round(rs.get(dim, 0) * k))
            stats[dim] = max(30, min(95, v))
        peak = [max(DIMS, key=lambda x: stats[x])]

        ds_i = (y * 12 + m) - devmonths
        dsy, dsm = (ds_i - 1) // 12, (ds_i - 1) % 12 + 1
        iw_s = ds_i + 2
        iw_e = (y * 12 + m) - 1
        t = {
            "id": tid,
            "companyId": cid,
            "publisherId": comap[cid].get("publisherId") or cid,
            "name": name,
            "alias": alias,
            "releaseYear": y,
            "releaseMonth": m,
            "score": score,
            "platforms": list(ref.get("platforms") or ["pc"]),
            "genreId": genre,
            "gameplayId": play,
            "releaseType": "boxed",
            "landmark": False,
            "prestige": prestige,
            "studioId": ref.get("studioId"),
            "stats": stats,
            "peakDims": peak,
        }
        det = {
            "id": tid,
            "blurb": "%d年由%s发行，媒体分%s。盒装发售。" % (y, comap[cid].get("name"), score),
            "careerNote": CAREER_NOTE,
            "devStartYear": dsy,
            "devStartMonth": dsm,
            "devMonths": devmonths,
            "inviteWindow": {
                "startYear": (iw_s - 1) // 12,
                "startMonth": (iw_s - 1) % 12 + 1,
                "endYear": (iw_e - 1) // 12,
                "endMonth": (iw_e - 1) % 12 + 1,
            },
            "inviteRoles": ["programmer", "art", "design", "music"],
            "inviteMinFame": FAME_BY_PRESTIGE.get(prestige, 28),
            "inviteEligible": False,
            "teamSize": 5,
            "crunch": "medium",
            "engine": None,
            "awards": [],
            "liveAfterRelease": False,
        }
        d["titles"].append(t)
        d["titleDetails"].append(det)
        by_co[cid].append(t)
        tm[tid] = t
        dm[tid] = det
        added.append((cid, tid, name, y, m, ref["name"]))

    print("补入 %d 部（跳过已存在 %d）" % (len(added), len(skipped)))
    per = defaultdict(int)
    for cid, *_ in added:
        per[cid] += 1
    print("  " + "  ".join("%s×%d" % (k, v) for k, v in sorted(per.items(), key=lambda x: -x[1])))
    if dry:
        print("\n[dry-run] 未写盘")
        for a in added[:8]:
            print("   e.g.", a)
        return

    shutil.copyfile(PATH, BACKUP)
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")

    chk = json.loads(open(PATH, encoding="utf-8").read())
    ids = [t["id"] for t in chk["titles"]]
    assert len(ids) == len(set(ids)), "新数据出现重复 id"
    assert len(chk["titles"]) == len(chk["titleDetails"])
    assert len(chk["titles"]) == 523 + len(added), len(chk["titles"])
    print("\n写盘完成：titles %d / titleDetails %d / 备份 %s"
          % (len(chk["titles"]), len(chk["titleDetails"]), BACKUP))


main()
