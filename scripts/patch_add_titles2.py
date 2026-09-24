# -*- coding: utf-8 -*-
"""P2-fix-a 第二批：继续把时间轴铺不满的公司补上真实历史作品。

与第一批（patch_add_titles.py）同规则，但参考作品的选择放宽了：
  · 公司已有 ≥4 部时，仍取「同公司年代最近」的作品（保住这家公司的数值手感）；
  · 公司已有 <4 部时（sierra 只有 2 部、dice 只有 3 部…），
    改成在「同题材 + 同公司」里取年代最近 —— 否则 20 部新作会全部继承同一部旧作的
    四维形状（sierra 全是 1995 年冒险游戏的形状），peakDims 也会全部撞在一起。
生成规则（确定性，可重跑）：
  · stats：参考作按比例缩放到合计 = 300 + (score − 8.0) × 6，再夹 [30,95]。
  · devMonths 取真实开发周期近似值；devStart = 发售月 − devMonths。
  · inviteWindow = devStart + 2 月 → 发售前一月；inviteMinFame 按 prestige（16/28/44/62）。
  · landmark / inviteEligible 一律 false（见第一批的说明）。

幂等：已存在的 id 跳过。写盘前备份 scripts/_cw_before_addtitles2.json。
用法：python scripts/patch_add_titles2.py [--dry-run]
"""
import json
import shutil
import sys
from collections import defaultdict

PATH = "activity/career-world.json"
BACKUP = "scripts/_cw_before_addtitles2.json"
DIMS = ("play", "fun", "expression", "immersion")

# (companyId, id, name, alias, 发售年, 发售月, genreId, gameplayId, prestige, score, devMonths)
NEW = [
    # ══ dice（1995–2025 eu power2）—— 原来只有 bf2/bf3/bf1 三部，真作率 23.4% ══
    ("dice", "pinballIllusions95", "弹珠台幻境", "弹珠台", 1995, 8, "urban", "sim", 2, 7.6, 10),
    ("dice", "motorhead98", "摩托头", "摩托头", 1998, 4, "sports", "racing", 2, 7.3, 14),
    ("dice", "rallyMasters00", "拉力大师", "拉力大师", 2000, 3, "sports", "racing", 2, 7.1, 14),
    ("dice", "codenameEagle00", "代号鹰", "代号鹰", 2000, 9, "war", "shooter", 2, 7.2, 16),
    ("dice", "bf1942", "战地1942", "BF1942", 2002, 9, "war", "shooter", 4, 8.7, 20),
    ("dice", "bfVietnam04", "战地：越南", "BF越南", 2004, 3, "war", "shooter", 3, 8.1, 18),
    ("dice", "bf2142", "战地2142", "BF2142", 2006, 10, "scifi", "shooter", 3, 8.0, 18),
    ("dice", "mirrorEdge08", "镜之边缘", "镜之边缘", 2008, 11, "scifi", "action", 3, 8.2, 22),
    ("dice", "bfBadCompany2_10", "战地：叛逆连队2", "叛逆连队2", 2010, 3, "war", "shooter", 3, 8.5, 20),
    ("dice", "bf4_13", "战地4", "BF4", 2013, 10, "war", "shooter", 4, 8.2, 22),
    ("dice", "bfHardline15", "战地：硬仗", "硬仗", 2015, 3, "war", "shooter", 2, 7.3, 20),
    ("dice", "battlefront15", "星球大战：前线", "星战前线", 2015, 11, "scifi", "shooter", 4, 8.0, 24),
    ("dice", "battlefront2_17", "星球大战：前线II", "星战前线2", 2017, 11, "scifi", "shooter", 3, 7.6, 24),
    ("dice", "bfV18", "战地V", "BFV", 2018, 11, "war", "shooter", 3, 7.9, 24),
    ("dice", "bf2042_21", "战地2042", "BF2042", 2021, 11, "war", "shooter", 3, 6.9, 26),
    ("dice", "bf6_25", "战地6", "BF6", 2025, 10, "war", "shooter", 4, 8.4, 30),

    # ══ sierra（1995–2008 us power2）—— 只有 2 部，167 个月全靠池作，真作率 0.6% ══
    ("sierra", "caesar2_95", "凯撒大帝II", "凯撒2", 1995, 9, "historical", "sim", 3, 8.4, 16),
    ("sierra", "gabrielKnight2_95", "狩魔猎人2：血之诅咒", "狩魔2", 1995, 9, "horror", "visualNovel", 3, 8.5, 14),
    ("sierra", "spaceQuest6_95", "太空任务6：洞窟中的星云", "太空6", 1995, 9, "scifi", "visualNovel", 3, 8.2, 14),
    ("sierra", "leisureSuitLarry7_96", "花花公子拉瑞7：爱情暑假", "拉瑞7", 1996, 10, "comedy", "visualNovel", 2, 7.4, 12),
    ("sierra", "phantasmagoria2_96", "幽魂2：肉欲陷阱", "幽魂2", 1996, 9, "horror", "visualNovel", 2, 7.0, 12),
    ("sierra", "lordsOfRealm2_96", "王国霸主II", "王国霸主2", 1996, 10, "historical", "strategy", 3, 8.2, 14),
    ("sierra", "kingsQuestMoE", "国王密使：永恒面具", "永恒面具", 1998, 11, "fantasy", "action", 3, 7.8, 20),
    ("sierra", "caesar3_98", "凯撒大帝III", "凯撒3", 1998, 10, "historical", "sim", 3, 8.5, 18),
    ("sierra", "halfLife98", "半条命", "半条命", 1998, 11, "scifi", "shooter", 4, 9.3, 26),
    ("sierra", "homeworld99", "家园", "家园", 1999, 9, "scifi", "strategy", 4, 8.8, 22),
    ("sierra", "pharaoh99", "法老", "法老", 1999, 11, "historical", "sim", 3, 8.4, 20),
    ("sierra", "gabrielKnight3_99", "狩魔猎人3：血之契约", "狩魔3", 1999, 11, "horror", "puzzle", 3, 8.4, 18),
    ("sierra", "swat3_99", "特警3：近距交战", "特警3", 1999, 11, "war", "shooter", 3, 8.0, 18),
    ("sierra", "zeus00", "宙斯：奥林匹斯之主", "宙斯", 2000, 10, "historical", "sim", 3, 8.4, 20),
    ("sierra", "arcanum01", "奥秘：蒸汽与魔法", "奥秘", 2001, 8, "fantasy", "rpg", 3, 8.3, 26),
    ("sierra", "empireEarth01", "地球帝国", "地球帝国", 2001, 11, "historical", "strategy", 3, 8.3, 22),
    ("sierra", "homeworld2_03", "家园2", "家园2", 2003, 9, "scifi", "strategy", 3, 8.5, 20),
    ("sierra", "lslMagnaCumLaude04", "花花公子拉瑞：优等生", "优等生", 2004, 12, "comedy", "visualNovel", 1, 6.0, 14),
    ("sierra", "swat4_05", "特警4", "特警4", 2005, 4, "war", "shooter", 3, 8.2, 20),
    ("sierra", "fear05", "极度恐慌", "极度恐慌", 2005, 10, "horror", "shooter", 3, 8.4, 22),
    ("sierra", "worldInConflict07", "冲突世界", "冲突世界", 2007, 9, "war", "strategy", 3, 8.4, 22),
    ("sierra", "timeShift07", "时空飞梭", "时空飞梭", 2007, 10, "scifi", "shooter", 2, 7.2, 22),
    ("sierra", "crashMoM08", "古惑狼：变异之心", "变异之心", 2008, 10, "cartoon", "platform", 2, 7.0, 18),

    # ══ lucasarts（1995–2013 us power2）—— 只有 2 部，1998.11 之后 182 个月全空 ══
    ("lucasarts", "fullThrottle95", "极速天龙", "极速天龙", 1995, 4, "adventure", "action", 3, 8.4, 14),
    ("lucasarts", "theDig95", "异星搜奇", "异星搜奇", 1995, 11, "scifi", "puzzle", 3, 8.0, 16),
    ("lucasarts", "afterlife96", "来世", "来世", 1996, 6, "comedy", "sim", 2, 7.6, 16),
    ("lucasarts", "jediKnight97", "星球大战：绝地武士", "绝地武士", 1997, 10, "scifi", "action", 3, 8.6, 18),
    ("lucasarts", "rogueSquadron98", "星球大战：侠盗中队", "侠盗中队", 1998, 11, "scifi", "action", 3, 8.6, 20),
    ("lucasarts", "xWingAlliance99", "星球大战：X翼联盟", "X翼联盟", 1999, 2, "scifi", "sim", 3, 8.3, 18),
    ("lucasarts", "ep1Racer99", "星球大战前传：极速飞梭", "极速飞梭", 1999, 5, "scifi", "racing", 3, 8.2, 16),
    ("lucasarts", "escapeMI00", "猴岛小英雄：逃离猴岛", "逃离猴岛", 2000, 11, "adventure", "puzzle", 3, 8.5, 20),
    ("lucasarts", "starfighter01", "星球大战：星际战士", "星际战士", 2001, 4, "scifi", "action", 2, 7.4, 16),
    ("lucasarts", "jediOutcast02", "星球大战：绝地武士II", "绝地武士2", 2002, 3, "scifi", "action", 3, 8.7, 20),
    ("lucasarts", "kotor03", "星球大战：旧共和国武士", "KOTOR", 2003, 7, "scifi", "rpg", 4, 9.0, 24),
    ("lucasarts", "jediAcademy03", "星球大战：绝地学院", "绝地学院", 2003, 9, "scifi", "action", 3, 8.4, 18),
    ("lucasarts", "battlefront04", "星球大战：前线", "星战前线", 2004, 9, "scifi", "shooter", 3, 8.4, 20),
    ("lucasarts", "republicCommando05", "星球大战：共和国突击队", "突击队", 2005, 3, "scifi", "shooter", 3, 8.4, 20),
    ("lucasarts", "battlefront2_05", "星球大战：前线II", "星战前线2", 2005, 11, "scifi", "shooter", 3, 8.6, 20),
    ("lucasarts", "empireAtWar06", "星球大战：帝国战争", "帝国战争", 2006, 2, "scifi", "strategy", 3, 8.2, 22),
    ("lucasarts", "legoSW2_06", "乐高星球大战II：原创三部曲", "乐高星战2", 2006, 9, "cartoon", "action", 3, 8.0, 18),
    ("lucasarts", "forceUnleashed08", "星球大战：原力释放", "原力释放", 2008, 9, "scifi", "action", 3, 7.8, 26),
    ("lucasarts", "monkeyIslandSE09", "猴岛小英雄 特别版", "猴岛特别版", 2009, 7, "adventure", "puzzle", 2, 7.6, 12),
    ("lucasarts", "forceUnleashed2_10", "星球大战：原力释放II", "原力释放2", 2010, 10, "scifi", "action", 2, 6.6, 20),
    ("lucasarts", "legoSW3_11", "乐高星球大战III：克隆人战争", "乐高星战3", 2011, 3, "cartoon", "action", 2, 7.2, 18),
    ("lucasarts", "swtor11", "星球大战：旧共和国", "旧共和国", 2011, 12, "scifi", "mmo", 3, 8.0, 30),
    ("lucasarts", "kinectStarWars12", "星球大战：Kinect", "星战Kinect", 2012, 4, "scifi", "action", 1, 6.0, 18),
    ("lucasarts", "angryBirdsSW13", "愤怒的小鸟：星球大战", "怒鸟星战", 2013, 11, "cartoon", "puzzle", 2, 7.4, 14),

    # ══ treasure（1995– jp power1）—— 230 个月池作 ══════════════════════════════
    ("treasure", "alienSoldier95", "异形战士", "异形战士", 1995, 2, "scifi", "action", 3, 8.3, 12),
    ("treasure", "lightCrusader96", "光之十字军", "光之十字军", 1996, 1, "fantasy", "action", 2, 7.6, 12),
    ("treasure", "mischiefMakers97", "捣蛋鬼", "捣蛋鬼", 1997, 2, "cartoon", "action", 2, 7.4, 12),
    ("treasure", "bangaiO99", "班凯奥", "班凯奥", 1999, 1, "scifi", "shooter", 3, 8.0, 14),
    ("treasure", "astroBoy03", "铁臂阿童木", "阿童木", 2003, 4, "scifi", "action", 2, 7.2, 14),
    ("treasure", "gunstarSuperHeroes05", "超级异形战士", "超级异形", 2005, 10, "scifi", "action", 3, 8.0, 16),
    ("treasure", "sinPunishment2_09", "罪与罚2：星空的继承者", "罪与罚2", 2009, 10, "scifi", "shooter", 3, 8.0, 22),
    ("treasure", "gaistCrusher13", "钢铁粉碎者", "粉碎者", 2013, 12, "cartoon", "action", 1, 6.5, 16),

    # ══ rare（1995– uk power2）—— 186 个月池作 ═════════════════════════════════
    ("rare", "dkc2_95", "大金刚国度2：迪迪金刚的冒险", "大金刚2", 1995, 11, "cartoon", "platform", 4, 9.0, 16),
    ("rare", "dkc3_96", "大金刚国度3：迪克西金刚的双重麻烦", "大金刚3", 1996, 11, "cartoon", "platform", 3, 8.6, 16),
    ("rare", "diddyKongRacing97", "迪迪金刚赛车", "迪迪赛车", 1997, 11, "cartoon", "racing", 3, 8.6, 18),
    ("rare", "jetForceGemini99", "喷气力量双子星", "双子星", 1999, 10, "scifi", "action", 3, 8.2, 20),
    ("rare", "banjoTooie00", "班卓熊大冒险2", "班卓熊2", 2000, 11, "cartoon", "platform", 4, 8.7, 22),
    ("rare", "ghoulies03", "恶魔缠身", "恶魔缠身", 2003, 10, "comedy", "action", 2, 6.8, 20),
    ("rare", "vivaPinata06", "皮纳塔万岁", "皮纳塔", 2006, 11, "cartoon", "sim", 3, 8.3, 22),
    ("rare", "nutsAndBolts08", "班卓熊：螺母与螺栓", "螺母与螺栓", 2008, 11, "cartoon", "platform", 2, 7.4, 24),
    ("rare", "kinectSports10", "Kinect 运动", "Kinect运动", 2010, 11, "sports", "sportsGame", 3, 8.0, 20),
    ("rare", "rareReplay15", "Rare 经典合集", "经典合集", 2015, 8, "cartoon", "action", 3, 8.4, 18),

    # ══ idsoftware（1995– us power2）—— 181 个月池作 ═══════════════════════════
    ("idsoftware", "ultimateDoom95", "终极毁灭战士", "终极毁灭", 1995, 5, "scifi", "shooter", 3, 8.6, 12),
    ("idsoftware", "finalDoom96", "最终毁灭战士", "最终毁灭", 1996, 6, "scifi", "shooter", 3, 8.3, 12),
    ("idsoftware", "quake3_99", "雷神之锤III 竞技场", "雷神3", 1999, 12, "scifi", "shooter", 4, 8.6, 18),
    ("idsoftware", "quake4_05", "雷神之锤4", "雷神4", 2005, 10, "scifi", "shooter", 3, 7.9, 20),
    ("idsoftware", "quakeLive10", "雷神之锤 竞技场 在线", "雷神在线", 2010, 8, "scifi", "shooter", 2, 7.4, 22),
    ("idsoftware", "rage2_19", "狂怒2", "狂怒2", 2019, 5, "apocalypse", "shooter", 3, 7.2, 26),
    ("idsoftware", "doomDarkAges25", "毁灭战士：黑暗时代", "黑暗时代", 2025, 5, "fantasy", "shooter", 3, 8.4, 28),

    # ══ maxis（1995– us power2）—— 175 个月池作 ════════════════════════════════
    ("maxis", "simtown95", "模拟小镇", "模拟小镇", 1995, 3, "urban", "sim", 2, 7.0, 14),
    ("maxis", "simcopter96", "模拟直升机", "模拟直升机", 1996, 8, "urban", "sim", 2, 7.2, 16),
    ("maxis", "streetsOfSimCity97", "模拟城市街车", "街车", 1997, 10, "urban", "racing", 2, 6.8, 18),
    ("maxis", "simcity3000_99", "模拟城市3000", "模拟城市3", 1999, 1, "urban", "sim", 3, 8.6, 20),
    ("maxis", "theSimsOnline02", "模拟人生 在线", "模拟人生在线", 2002, 12, "urban", "mmo", 2, 6.6, 24),
    ("maxis", "simcity2013", "模拟城市（2013）", "模拟城市5", 2013, 3, "urban", "sim", 3, 6.6, 26),
    ("maxis", "sims4Seasons18", "模拟人生4：四季", "四季", 2018, 6, "urban", "sim", 2, 7.6, 18),
    ("maxis", "sims4GrowingTogether23", "模拟人生4：相伴成长", "相伴成长", 2023, 3, "urban", "sim", 2, 7.4, 20),

    # ══ epic（1995– us power2）—— 1995–2006 有 132 个月空白 ════════════════════
    ("epic", "unreal98", "虚幻", "虚幻", 1998, 5, "scifi", "shooter", 4, 8.9, 22),
    ("epic", "jazzJackrabbit2_98", "爵士兔2", "爵士兔2", 1998, 9, "cartoon", "platform", 3, 8.2, 16),
    ("epic", "unrealTournament99", "虚幻竞技场", "UT99", 1999, 11, "scifi", "shooter", 4, 8.8, 20),
    ("epic", "unreal2_03", "虚幻II：觉醒", "虚幻2", 2003, 2, "scifi", "shooter", 2, 7.0, 24),
    ("epic", "ut2004", "虚幻竞技场2004", "UT2004", 2004, 3, "scifi", "shooter", 4, 8.6, 20),
    ("epic", "ut3_07", "虚幻竞技场3", "UT3", 2007, 11, "scifi", "shooter", 3, 7.8, 24),
    ("epic", "shadowComplex09", "暗影帝国", "暗影帝国", 2009, 8, "scifi", "action", 3, 8.4, 20),
    ("epic", "bulletstorm11", "子弹风暴", "子弹风暴", 2011, 2, "scifi", "shooter", 3, 8.0, 22),
    ("epic", "paragon16", "帕拉贡", "帕拉贡", 2016, 3, "scifi", "moba", 2, 7.0, 26),

    # ══ kingsoft（1995– cn power2）—— 166 个月池作 ═════════════════════════════
    ("kingsoft", "jxXin01", "新剑侠情缘", "新剑侠", 2001, 1, "wuxia", "rpg", 3, 8.3, 18),
    ("kingsoft", "jxYueYing01", "剑侠情缘外传：月影传说", "月影传说", 2001, 7, "wuxia", "rpg", 3, 8.4, 18),
    ("kingsoft", "bloodShanghai03", "抗日：血战上海滩", "血战上海滩", 2003, 7, "war", "shooter", 2, 7.2, 20),
    ("kingsoft", "jxWorld10", "剑侠世界", "剑侠世界", 2010, 10, "wuxia", "mmo", 2, 7.4, 26),
    ("kingsoft", "jx3Anshi13", "剑网3：安史之乱", "安史之乱", 2013, 7, "wuxia", "mmo", 3, 8.2, 20),
    ("kingsoft", "jx3CangXue15", "剑网3：苍雪龙城", "苍雪龙城", 2015, 11, "wuxia", "mmo", 2, 7.8, 20),
    ("kingsoft", "jx3ShuangXin19", "剑网3：双心法", "双心法", 2019, 8, "wuxia", "mmo", 2, 7.6, 20),

    # ══ toysForBob（1995– us power1）—— 163 个月池作 ═══════════════════════════
    ("toysForBob", "pandemonium2_97", "潘多拉魔盒2", "潘多拉2", 1997, 9, "cartoon", "platform", 2, 7.2, 14),
    ("toysForBob", "tonyHawkDownhill06", "托尼霍克：速降滑板", "速降滑板", 2006, 11, "sports", "sportsGame", 2, 6.8, 18),
    ("toysForBob", "skylandersGiants12", "小龙斯派罗：巨人", "斯派罗巨人", 2012, 10, "cartoon", "action", 3, 7.8, 20),
    ("toysForBob", "skylandersSwapForce13", "小龙斯派罗：交换力量", "交换力量", 2013, 10, "cartoon", "action", 3, 7.9, 20),
    ("toysForBob", "skylandersTrapTeam14", "小龙斯派罗：陷阱小队", "陷阱小队", 2014, 10, "cartoon", "action", 3, 7.7, 20),
    ("toysForBob", "crashTeamRumble23", "古惑狼：队伍大乱斗", "队伍大乱斗", 2023, 6, "cartoon", "action", 2, 6.9, 22),

    # ══ ubisoft（1995– eu power3）—— 151 个月池作 ══════════════════════════════
    ("ubisoft", "rayman95", "雷曼", "雷曼", 1995, 9, "cartoon", "platform", 4, 8.8, 18),
    ("ubisoft", "rainbowSix98", "彩虹六号", "彩虹六号", 1998, 8, "war", "shooter", 3, 8.4, 20),
    ("ubisoft", "rayman2_99", "雷曼2：胜利大逃亡", "雷曼2", 1999, 11, "cartoon", "platform", 4, 8.8, 20),
    ("ubisoft", "ghostRecon01", "幽灵行动", "幽灵行动", 2001, 11, "war", "shooter", 3, 8.3, 20),
    ("ubisoft", "splinterCell02", "细胞分裂", "细胞分裂", 2002, 11, "urban", "action", 4, 8.8, 22),
    ("ubisoft", "beyondGoodAndEvil03", "超越善恶", "超越善恶", 2003, 11, "scifi", "action", 3, 8.4, 24),
    ("ubisoft", "farCry04", "孤岛惊魂", "孤岛惊魂1", 2004, 3, "scifi", "shooter", 4, 8.6, 24),
    ("ubisoft", "ac1_07", "刺客信条", "刺客信条1", 2007, 11, "historical", "action", 4, 8.2, 26),
    ("ubisoft", "acBrotherhood10", "刺客信条：兄弟会", "兄弟会", 2010, 11, "historical", "action", 4, 8.8, 24),
    ("ubisoft", "watchDogs14", "看门狗", "看门狗", 2014, 5, "urban", "action", 3, 8.0, 28),
    ("ubisoft", "theDivision16", "全境封锁", "全境封锁", 2016, 3, "apocalypse", "shooter", 3, 7.8, 30),
    ("ubisoft", "acOrigins17", "刺客信条：起源", "起源", 2017, 10, "historical", "openWorld", 4, 8.6, 28),
    ("ubisoft", "acValhalla20", "刺客信条：英灵殿", "英灵殿", 2020, 11, "historical", "openWorld", 4, 8.4, 30),
    ("ubisoft", "acMirage23", "刺客信条：幻景", "幻景", 2023, 10, "historical", "action", 3, 7.6, 24),

    # ══ koei（1995–2009 jp power2）—— 143 个月池作 ═════════════════════════════
    ("koei", "romance5_95", "三国志V", "三国志5", 1995, 12, "historical", "strategy", 3, 8.3, 14),
    ("koei", "nobunagaTenshou95", "信长之野望：天翔记", "天翔记", 1995, 12, "historical", "strategy", 3, 8.5, 16),
    ("koei", "taikou2_95", "太阁立志传II", "太阁2", 1995, 12, "historical", "rpg", 3, 8.2, 14),
    ("koei", "romance6_98", "三国志VI", "三国志6", 1998, 3, "historical", "strategy", 3, 8.2, 16),
    ("koei", "nobunagaShouki97", "信长之野望：将星录", "将星录", 1997, 3, "historical", "strategy", 3, 8.1, 16),
    ("koei", "kessen00", "决战", "决战", 2000, 3, "historical", "strategy", 3, 8.3, 20),
    ("koei", "dynastyWarriors1", "真三国无双", "无双1", 2000, 8, "historical", "action", 4, 8.5, 18),
    ("koei", "dynastyWarriors2", "真三国无双2", "无双2", 2001, 9, "historical", "action", 4, 8.8, 20),
    ("koei", "dynastyWarriors3", "真三国无双3", "无双3", 2003, 2, "historical", "action", 4, 8.7, 20),
    ("koei", "romance9_03", "三国志IX", "三国志9", 2003, 7, "historical", "strategy", 3, 8.4, 20),
    ("koei", "taikou5_04", "太阁立志传V", "太阁5", 2004, 8, "historical", "rpg", 3, 8.4, 22),
    ("koei", "dynastyWarriors5_07", "真三国无双5", "无双5", 2007, 11, "historical", "action", 4, 8.3, 22),
    ("koei", "nwbTendo09", "信长之野望：天道", "天道", 2009, 9, "historical", "strategy", 3, 8.4, 22),

    # ══ koeiTecmo（2009– jp power2）—— 150 个月池作 ════════════════════════════
    ("koeiTecmo", "dynastyW6_11", "真三国无双6", "无双6", 2011, 3, "historical", "action", 4, 8.3, 22),
    ("koeiTecmo", "musouOrochi2_11", "无双大蛇2", "大蛇2", 2011, 12, "historical", "action", 3, 8.0, 22),
    ("koeiTecmo", "toukiden13", "讨鬼传", "讨鬼传", 2013, 6, "myth", "action", 3, 7.8, 24),
    ("koeiTecmo", "samuraiW4_14", "战国无双4", "战国4", 2014, 3, "historical", "action", 3, 8.2, 22),
    ("koeiTecmo", "attackOnTitan16", "进击的巨人", "进击的巨人", 2016, 2, "apocalypse", "action", 3, 7.6, 22),
    ("koeiTecmo", "nioh17", "仁王", "仁王", 2017, 2, "myth", "arpg", 4, 8.6, 30),
    ("koeiTecmo", "atelierRyza19", "莱莎的炼金工房", "莱莎", 2019, 9, "fantasy", "rpg", 3, 8.0, 24),
    ("koeiTecmo", "romance14_20", "三国志14", "三国志14", 2020, 1, "historical", "strategy", 3, 8.0, 24),
    ("koeiTecmo", "nioh2_20", "仁王2", "仁王2", 2020, 3, "myth", "arpg", 4, 8.5, 28),
    ("koeiTecmo", "woLong23", "卧龙：苍天陨落", "卧龙", 2023, 3, "myth", "arpg", 3, 8.0, 28),
    ("koeiTecmo", "dynastyOrigins25", "真三国无双：起源", "无双起源", 2025, 1, "historical", "action", 3, 8.2, 26),

    # ══ ca（1995– uk power2）—— 147 个月池作 ══════════════════════════════════
    ("ca", "rome2_13", "罗马II：全面战争", "罗马2", 2013, 9, "historical", "strategy", 3, 7.8, 26),
    ("ca", "alienIsolation14", "异形：隔离", "异形隔离", 2014, 10, "scifi", "survival", 4, 8.6, 28),
    ("ca", "attila15", "阿提拉：全面战争", "阿提拉", 2015, 2, "historical", "strategy", 3, 8.0, 24),
    ("ca", "haloWars2_17", "光环战争2", "光环战争2", 2017, 2, "scifi", "strategy", 3, 8.0, 26),
    ("ca", "warhammer2_17", "全面战争：战锤II", "战锤2", 2017, 9, "fantasy", "strategy", 4, 8.6, 26),
    ("ca", "threeKingdoms19", "全面战争：三国", "全战三国", 2019, 5, "historical", "strategy", 4, 8.6, 28),
    ("ca", "warhammer3_22", "全面战争：战锤III", "战锤3", 2022, 2, "fantasy", "strategy", 3, 8.2, 28),
    ("ca", "pharaohTw23", "全面战争：法老", "法老", 2023, 10, "historical", "strategy", 2, 6.4, 24),

    # ══ atlus（1995– jp power1）—— 143 个月池作 ════════════════════════════════
    ("atlus", "devilSummoner95", "真女神转生：恶魔召唤师", "恶魔召唤师", 1995, 12, "myth", "rpg", 3, 8.2, 16),
    ("atlus", "persona1_96", "女神异闻录", "P1", 1996, 9, "school", "rpg", 3, 8.3, 18),
    ("atlus", "etrianOdyssey07", "世界树迷宫", "世界树", 2007, 1, "fantasy", "rpg", 3, 8.2, 20),
    ("atlus", "smt4_13", "真女神转生IV", "真4", 2013, 5, "myth", "rpg", 3, 8.4, 24),
    ("atlus", "dragonCrown13", "龙之王冠", "龙之王冠", 2013, 7, "fantasy", "arpg", 3, 8.5, 22),
    ("atlus", "persona5_16", "女神异闻录5", "P5", 2016, 9, "school", "rpg", 4, 9.2, 30),
    ("atlus", "p5Royal19", "女神异闻录5 皇家版", "P5R", 2019, 10, "school", "rpg", 3, 9.0, 22),

    # ══ konami（1995– jp power2）—— 140 个月池作 ═══════════════════════════════
    ("konami", "suikoden1_95", "幻想水浒传", "水浒传1", 1995, 12, "fantasy", "rpg", 3, 8.5, 18),
    ("konami", "pes96", "实况世界足球：胜利十一人", "实况足球", 1996, 3, "sports", "sportsGame", 3, 8.2, 16),
    ("konami", "ddr98", "热舞革命", "DDR", 1998, 11, "music", "rhythm", 3, 8.2, 16),
    ("konami", "suikoden2_98", "幻想水浒传II", "水浒传2", 1998, 12, "fantasy", "rpg", 4, 9.0, 20),
    ("konami", "castlevaniaLoI03", "恶魔城：无罪的叹息", "无罪叹息", 2003, 10, "horror", "action", 3, 8.0, 22),
    ("konami", "castlevaniaLoS10", "恶魔城：暗影之王", "暗影之王", 2010, 10, "horror", "action", 3, 7.8, 26),
    ("konami", "mgrRevengeance13", "合金装备崛起：复仇", "崛起复仇", 2013, 2, "scifi", "action", 3, 8.4, 24),
    ("konami", "yugiohDuelLinks16", "游戏王：决斗链接", "决斗链接", 2016, 11, "fantasy", "cards", 3, 8.0, 22),
    ("konami", "pes2019", "实况足球2019", "PES2019", 2018, 8, "sports", "sportsGame", 2, 7.4, 22),
    ("konami", "efootball21", "eFootball", "eFootball", 2021, 9, "sports", "sportsGame", 2, 5.6, 24),
    ("konami", "mgsDelta25", "合金装备Δ：食蛇者", "食蛇者", 2025, 8, "scifi", "action", 3, 8.4, 28),

    # ══ fromsoftware（1995– jp power2）—— 1995–2009 有 140+ 个月空白 ═══════════
    ("fromsoftware", "kingsField2_95", "国王密令II", "国王密令2", 1995, 11, "fantasy", "rpg", 2, 7.6, 14),
    ("fromsoftware", "armoredCore97", "装甲核心", "装甲核心", 1997, 7, "mecha", "action", 3, 8.0, 16),
    ("fromsoftware", "armoredCore2_97", "装甲核心2", "装甲核心2", 1997, 12, "mecha", "action", 3, 8.0, 16),
    ("fromsoftware", "armoredCore3_99", "装甲核心3", "装甲核心3", 1999, 9, "mecha", "action", 3, 8.1, 18),
    ("fromsoftware", "armoredCoreNexus04", "装甲核心：联结", "联结", 2004, 3, "mecha", "action", 3, 8.0, 20),
    ("fromsoftware", "chromehounds06", "钢狼传说", "钢狼", 2006, 6, "mecha", "action", 2, 7.0, 22),
    ("fromsoftware", "armoredCore4_06", "装甲核心4", "装甲核心4", 2006, 12, "mecha", "action", 3, 7.8, 22),
    ("fromsoftware", "armoredCoreFa08", "装甲核心：答案", "答案", 2008, 3, "mecha", "action", 3, 8.0, 22),

    # ══ platinum（2006– jp power2）—— 134 个月池作 ═════════════════════════════
    ("platinum", "madWorld09", "疯狂世界", "疯狂世界", 2009, 3, "urban", "action", 3, 7.8, 22),
    ("platinum", "wonderful101_13", "神奇101", "神奇101", 2013, 8, "superhero", "action", 3, 8.0, 24),
    ("platinum", "transformersDevastation15", "变形金刚：毁灭", "毁灭", 2015, 10, "scifi", "action", 3, 7.6, 22),
    ("platinum", "starFoxZero16", "星际火狐 零", "火狐零", 2016, 4, "scifi", "shooter", 2, 6.8, 24),
    ("platinum", "astralChain19", "异界锁链", "异界锁链", 2019, 8, "scifi", "action", 4, 8.6, 26),
    ("platinum", "bayonetta3_22", "猎天使魔女3", "魔女3", 2022, 10, "fantasy", "action", 4, 8.7, 30),
    ("platinum", "solCresta23", "索尔克蕾斯塔", "索尔", 2023, 9, "scifi", "shooter", 2, 7.0, 22),

    # ══ infinityWard（2002– us power2）—— 132 个月池作 ═════════════════════════
    ("infinityWard", "mw3_11", "使命召唤：现代战争3", "现代战争3", 2011, 11, "war", "shooter", 4, 8.2, 24),
    ("infinityWard", "codGhosts13", "使命召唤：幽灵", "幽灵", 2013, 11, "war", "shooter", 3, 7.6, 24),
    ("infinityWard", "codInfiniteWarfare16", "使命召唤：无限战争", "无限战争", 2016, 11, "scifi", "shooter", 3, 7.4, 26),
    ("infinityWard", "codMw3_23", "使命召唤：现代战争III", "现代战争Ⅲ", 2023, 11, "war", "shooter", 3, 6.6, 26),

    # ══ eidos（1995–2009 uk power2）—— 114 个月池作 ════════════════════════════
    ("eidos", "tombRaider2_97", "古墓丽影II", "古墓2", 1997, 11, "adventure", "action", 4, 8.6, 18),
    ("eidos", "tombRaider3_98", "古墓丽影III", "古墓3", 1998, 11, "adventure", "action", 3, 8.4, 18),
    ("eidos", "tombRaider4_99", "古墓丽影：最后的启示", "最后的启示", 1999, 11, "adventure", "action", 3, 8.4, 18),
    ("eidos", "thief2_00", "神偷II：金属时代", "神偷2", 2000, 3, "urban", "action", 4, 8.5, 20),
    ("eidos", "hitman00", "杀手：代号47", "杀手1", 2000, 11, "urban", "action", 3, 8.2, 20),
    ("eidos", "hitman2_02", "杀手2：沉默刺客", "杀手2", 2002, 10, "urban", "action", 4, 8.6, 22),
    ("eidos", "deusEx2_03", "杀出重围：隐形战争", "隐形战争", 2003, 12, "scifi", "rpg", 3, 7.7, 24),
    ("eidos", "hitmanContracts04", "杀手：契约", "契约", 2004, 4, "urban", "action", 3, 8.0, 22),
    ("eidos", "tombRaiderLegend06", "古墓丽影：传奇", "传奇", 2006, 4, "adventure", "action", 3, 8.0, 24),
    ("eidos", "hitmanBloodMoney06", "杀手：血钱", "血钱", 2006, 5, "urban", "action", 4, 8.6, 24),
    ("eidos", "tombRaiderUnderworld08", "古墓丽影：地下世界", "地下世界", 2008, 11, "adventure", "action", 3, 7.4, 26),

    # ══ origin（1995–2004 us power2）—— 只有 2 部 ══════════════════════════════
    ("origin", "crusaderNoRemorse95", "十字军：无怨无悔", "无怨无悔", 1995, 9, "scifi", "action", 3, 8.2, 16),
    ("origin", "wingCommander4_95", "银河飞将IV：自由的代价", "银河飞将4", 1995, 12, "scifi", "sim", 3, 8.4, 18),
    ("origin", "privateer2_96", "私掠者2：黑暗", "私掠者2", 1996, 5, "scifi", "sim", 3, 7.8, 20),
    ("origin", "crusaderNoRegret96", "十字军：无怨无悔2", "无怨无悔2", 1996, 11, "scifi", "action", 3, 8.0, 16),
    ("origin", "ultimaOnline97", "网络创世纪", "UO", 1997, 9, "fantasy", "mmo", 4, 8.6, 26),

    # ══ nwc（1995–2003 us power1）—— 只有 2 部 ═════════════════════════════════
    ("nwc", "heroes1_95", "魔法门之英雄无敌", "英雄无敌1", 1995, 8, "fantasy", "strategy", 3, 8.4, 14),
    ("nwc", "heroes2_96", "魔法门之英雄无敌II", "英雄无敌2", 1996, 10, "fantasy", "strategy", 3, 8.6, 16),
    ("nwc", "mightAndMagic6_98", "魔法门VI：天堂之令", "魔法门6", 1998, 4, "fantasy", "rpg", 3, 8.4, 20),
    ("nwc", "mm8_00", "魔法门VIII：毁灭者之日", "魔法门8", 2000, 3, "fantasy", "rpg", 2, 7.4, 20),
    ("nwc", "heroes4_02", "英雄无敌IV", "英雄无敌4", 2002, 3, "fantasy", "strategy", 2, 7.4, 22),

    # ══ ensemble（1995–2009 us power2）—— 只有 3 部 ════════════════════════════
    ("ensemble", "aoe1_97", "帝国时代", "帝国1", 1997, 10, "historical", "strategy", 4, 8.8, 20),
    ("ensemble", "aoeRiseOfRome98", "帝国时代：罗马复兴", "罗马复兴", 1998, 10, "historical", "strategy", 3, 8.6, 18),
    ("ensemble", "aoe2Conquerors00", "帝国时代II：征服者", "征服者", 2000, 8, "historical", "strategy", 4, 8.8, 22),
    ("ensemble", "aom01", "神话时代", "神话时代", 2002, 10, "myth", "strategy", 4, 8.7, 22),
    ("ensemble", "aomTitans03", "神话时代：泰坦", "泰坦", 2003, 10, "myth", "strategy", 3, 8.4, 20),

    # ══ namco（1995–2005 jp power2）—— 只有 3 部 ═══════════════════════════════
    ("namco", "ridgeRacer95", "山脊赛车", "山脊", 1995, 12, "sports", "racing", 3, 8.0, 14),
    ("namco", "tekken3_97", "铁拳3", "铁拳3", 1997, 3, "urban", "fighting", 4, 9.0, 18),
    ("namco", "aceCombat2_97", "皇牌空战2", "皇牌2", 1997, 1, "war", "sim", 3, 8.2, 16),
    ("namco", "talesOfDestiny97", "宿命传说", "宿命传说", 1997, 12, "fantasy", "rpg", 3, 8.4, 20),
    ("namco", "ridgeRacerType4_99", "山脊赛车：R4", "R4", 1999, 1, "sports", "racing", 3, 8.4, 18),
    ("namco", "tekkenTag99", "铁拳 TAG 锦标赛", "铁拳TAG", 1999, 7, "urban", "fighting", 4, 8.8, 18),
    ("namco", "tekken4_01", "铁拳4", "铁拳4", 2001, 8, "urban", "fighting", 3, 8.2, 20),
    ("namco", "aceCombat04_01", "皇牌空战04：破碎的天空", "皇牌4", 2001, 10, "war", "sim", 3, 8.4, 20),
    ("namco", "soulcalibur2_03", "灵魂能力II", "SC2", 2003, 3, "fantasy", "fighting", 4, 8.8, 20),
    ("namco", "katamari04", "块魂", "块魂", 2004, 3, "comedy", "action", 3, 8.4, 18),

    # ══ interplayFallback（1995–2004 us power1）—— 只有 2 部 ═══════════════════
    ("interplayFallback", "fallout2_98", "辐射2", "辐射2", 1998, 10, "apocalypse", "rpg", 4, 8.9, 20),
    ("interplayFallback", "baldursGate98", "博德之门", "博德1", 1998, 12, "fantasy", "rpg", 4, 8.9, 24),
    ("interplayFallback", "freespace2_99", "自由空间2", "自由空间2", 1999, 9, "scifi", "sim", 3, 8.5, 20),
    ("interplayFallback", "descent3_99", "天旋地转3", "天旋地转3", 1999, 6, "scifi", "shooter", 3, 7.8, 20),
    ("interplayFallback", "planescapeTorment99", "异域镇魂曲", "异域镇魂曲", 1999, 12, "fantasy", "rpg", 4, 9.1, 22),
    ("interplayFallback", "icewindDale00", "冰风谷", "冰风谷", 2000, 5, "fantasy", "rpg", 3, 8.5, 20),
    ("interplayFallback", "baldursGate2_00", "博德之门II：安姆的阴影", "博德2", 2000, 9, "fantasy", "rpg", 4, 9.0, 24),

    # ══ nexon（1995– kr power2）—— 141 个月池作 ════════════════════════════════
    ("nexon", "crazyArcade01", "泡泡堂", "泡泡堂", 2001, 10, "cartoon", "action", 2, 7.6, 18),
    ("nexon", "combatArms08", "战地之王", "战地之王", 2008, 7, "war", "shooter", 2, 7.4, 22),
    ("nexon", "dragonNest10", "龙之谷", "龙之谷", 2010, 3, "fantasy", "arpg", 3, 8.0, 24),
    ("nexon", "blueArchive21", "蔚蓝档案", "蔚蓝档案", 2021, 2, "school", "rpg", 3, 8.2, 24),
    ("nexon", "daveTheDiver23", "潜水员戴夫", "戴夫", 2023, 6, "sliceOfLife", "sim", 3, 8.6, 22),
    ("nexon", "theFinals23", "终极决战", "终极决战", 2023, 12, "urban", "shooter", 3, 7.8, 26),

    # ══ gamefreak（1995– jp power2）—— 108 个月池作 ════════════════════════════
    ("gamefreak", "pokemonYellow98", "精灵宝可梦 皮卡丘", "皮卡丘", 1998, 9, "cartoon", "rpg", 3, 8.5, 16),
    ("gamefreak", "pokemonCrystal00", "精灵宝可梦 水晶", "水晶", 2000, 12, "cartoon", "rpg", 3, 8.6, 18),
    ("gamefreak", "pokemonEmerald04", "精灵宝可梦 绿宝石", "绿宝石", 2004, 9, "cartoon", "rpg", 4, 8.8, 20),
    ("gamefreak", "pokemonPlatinum08", "精灵宝可梦 白金", "白金", 2008, 9, "cartoon", "rpg", 4, 8.8, 22),
    ("gamefreak", "pokemonB2W2_12", "精灵宝可梦 黑2/白2", "黑2白2", 2012, 6, "cartoon", "rpg", 3, 8.6, 22),
    ("gamefreak", "pokemonORAS14", "精灵宝可梦 欧米伽红宝石/阿尔法蓝宝石", "宝石复刻", 2014, 11, "cartoon", "rpg", 3, 8.4, 22),
    ("gamefreak", "pokemonSwSh19", "精灵宝可梦 剑/盾", "剑盾", 2019, 11, "cartoon", "rpg", 3, 8.0, 26),
    ("gamefreak", "pokemonLegendsArceus22", "宝可梦传说 阿尔宙斯", "阿尔宙斯", 2022, 1, "cartoon", "rpg", 3, 8.4, 26),

    # ══ sega（1995– jp power2）—— 119 个月池作 ═════════════════════════════════
    ("sega", "sonicAdventure2_01", "索尼克大冒险2", "索尼克2", 2001, 6, "cartoon", "platform", 4, 8.6, 22),
    ("sega", "shenmue2_01", "莎木2", "莎木2", 2001, 9, "urban", "action", 4, 8.5, 26),
    ("sega", "yakuza2_06", "如龙2", "如龙2", 2006, 12, "urban", "action", 4, 8.6, 24),
    ("sega", "yakuza3_09", "如龙3", "如龙3", 2009, 2, "urban", "action", 3, 8.2, 24),
    ("sega", "yakuza4_10", "如龙4：传说的继承者", "如龙4", 2010, 3, "urban", "action", 3, 8.4, 24),
    ("sega", "yakuza5_12", "如龙5：圆梦者", "如龙5", 2012, 12, "urban", "action", 3, 8.6, 26),
    ("sega", "sonicMania17", "索尼克狂欢", "狂欢", 2017, 8, "cartoon", "platform", 4, 8.7, 20),
    ("sega", "judgments19", "审判之眼：死神的遗言", "审判之眼", 2018, 12, "mystery", "action", 3, 8.4, 26),
    ("sega", "likeADragon20", "如龙7：光与暗的去向", "如龙7", 2020, 1, "urban", "rpg", 4, 8.6, 28),
    ("sega", "likeADragon8_24", "如龙8", "如龙8", 2024, 1, "urban", "rpg", 3, 8.6, 30),

    # ══ tgc（2006– us power1）—— 141 个月池作 ══════════════════════════════════
    ("tgc", "flOw07", "流", "流", 2007, 2, "fantasy", "sim", 3, 8.0, 14),
    ("tgc", "skyLittlePrince21", "光·遇：小王子季", "小王子季", 2021, 7, "fantasy", "action", 2, 7.8, 16),

    # ══ 第三小批：第一批补过之后仍靠池作顶的公司 ═══════════════════════════════
    # ── irrational（1997–2017 us power2）—— 只有 bioshock/bioshockInfinite，39.7% ──
    ("irrational", "systemShock2_99", "网络奇兵2", "系统震撼2", 1999, 8, "horror", "rpg", 3, 8.6, 20),
    ("irrational", "freedomForce02", "自由力量", "自由力量", 2002, 3, "superhero", "strategy", 3, 8.3, 22),
    ("irrational", "tribesVengeance04", "部落：复仇", "部落复仇", 2004, 10, "scifi", "shooter", 2, 7.4, 24),
    ("irrational", "freedomForceVs3R05", "自由力量VS第三帝国", "自由力量2", 2005, 3, "superhero", "strategy", 2, 7.6, 18),
    ("irrational", "bioshockBurialAtSea13", "生化奇兵：海葬", "海葬", 2013, 11, "scifi", "action", 3, 8.0, 16),
    ("irrational", "bioshockCollection16", "生化奇兵 合集", "生化奇兵合集", 2016, 9, "scifi", "shooter", 2, 8.4, 18),
    # ── bullfrog（1995–2001 uk power1）—— 只有 dungeonKeeper/populous3 ──────────
    ("bullfrog", "hiOctane95", "高辛烷", "高辛烷", 1995, 9, "scifi", "racing", 2, 7.0, 12),
    ("bullfrog", "magicCarpet2_95", "魔毯2：决斗学院", "魔毯2", 1995, 11, "fantasy", "sim", 3, 8.0, 14),
    ("bullfrog", "syndicateWars96", "辛迪加战争", "辛迪加战争", 1996, 11, "scifi", "strategy", 3, 8.2, 16),
    ("bullfrog", "themeHospital97", "主题医院", "主题医院", 1997, 2, "comedy", "sim", 4, 8.8, 16),
    ("bullfrog", "dungeonKeeper2_99", "地下城守护者2", "地下城2", 1999, 6, "fantasy", "sim", 3, 8.4, 18),
    ("bullfrog", "themeParkWorld99", "主题公园世界", "主题公园", 1999, 11, "comedy", "sim", 3, 7.8, 16),
    # ── bungie（1995– us power2）—— 153 个月池作 ════════════════════════════════
    ("bungie", "marathon2_95", "马拉松2：杜兰达尔", "马拉松2", 1995, 11, "scifi", "shooter", 3, 8.2, 14),
    ("bungie", "marathonInfinity96", "马拉松：无限", "马拉松无限", 1996, 10, "scifi", "shooter", 3, 8.0, 14),
    ("bungie", "myth2_98", "神话II：灵魂吞噬者", "神话2", 1998, 11, "fantasy", "strategy", 3, 8.2, 16),
    ("bungie", "oni01", "奥妮", "Oni", 2001, 1, "scifi", "action", 2, 7.4, 22),
    ("bungie", "destiny2_17", "命运2", "命运2", 2017, 9, "scifi", "shooter", 4, 8.6, 28),
    ("bungie", "d2Forsaken18", "命运2：遗落之族", "遗落之族", 2018, 9, "scifi", "shooter", 3, 8.4, 16),
    ("bungie", "d2BeyondLight20", "命运2：凌光之刻", "凌光之刻", 2020, 11, "scifi", "shooter", 3, 8.0, 16),
    ("bungie", "d2WitchQueen22", "命运2：邪姬魅影", "邪姬魅影", 2022, 2, "scifi", "shooter", 3, 8.4, 16),
    ("bungie", "d2FinalShape24", "命运2：终焉之形", "终焉之形", 2024, 6, "scifi", "shooter", 3, 8.6, 18),
    # ── bandaiNamco（2005– jp power2）—— 79 个月池作 ════════════════════════════
    ("bandaiNamco", "soulcalibur3_05", "灵魂能力III", "SC3", 2005, 10, "fantasy", "fighting", 3, 8.6, 20),
    ("bandaiNamco", "aceCombatZero06", "皇牌空战零：贝尔卡战争", "皇牌零", 2006, 3, "war", "sim", 3, 8.4, 18),
    ("bandaiNamco", "godEater10", "噬神者", "噬神者", 2010, 2, "apocalypse", "action", 3, 8.0, 24),
    ("bandaiNamco", "soulcalibur5_12", "灵魂能力V", "SC5", 2012, 2, "fantasy", "fighting", 3, 7.6, 22),
    ("bandaiNamco", "godEater2_13", "噬神者2", "噬神者2", 2013, 11, "apocalypse", "action", 3, 8.2, 24),
    ("bandaiNamco", "aceCombat7_19", "皇牌空战7：未知的天空", "皇牌7", 2019, 1, "war", "sim", 4, 8.4, 26),
    ("bandaiNamco", "talesOfArise21", "破晓传说", "破晓传说", 2021, 9, "fantasy", "rpg", 4, 8.6, 28),
    # ── pocketpair（2015– jp power1）—— 65 个月池作 ════════════════════════════
    ("pocketpair", "overdungeon19", "无尽地牢", "无尽地牢", 2019, 5, "fantasy", "cards", 2, 7.2, 16),
    ("pocketpair", "palworldSakurajima24", "幻兽帕鲁：樱岛", "樱岛", 2024, 12, "cartoon", "survival", 2, 7.8, 16),
    # ── cdpr（2002– eu power2）—— 111 个月池作 ═════════════════════════════════
    ("cdpr", "witcher1_07", "巫师", "巫师1", 2007, 10, "fantasy", "rpg", 4, 8.6, 30),
    ("cdpr", "witcher1Enhanced08", "巫师：加强版", "巫师加强版", 2008, 9, "fantasy", "rpg", 2, 8.4, 14),
    ("cdpr", "gwent18", "巫师之昆特牌", "昆特牌", 2018, 10, "fantasy", "cards", 3, 8.0, 22),
    ("cdpr", "witcher3NextGen22", "巫师3：狂猎 次世代版", "次世代版", 2022, 12, "fantasy", "rpg", 2, 8.6, 16),
    # ── kuro（2014– cn power2）—— 56 个月池作 ══════════════════════════════════
    ("kuro", "pgr-y2020", "战双帕弥什：九龙夜航", "九龙夜航", 2020, 8, "scifi", "action", 2, 7.6, 16),
    ("kuro", "pgr-y2021", "战双帕弥什：湮灭残晨", "湮灭残晨", 2021, 8, "scifi", "action", 2, 7.6, 16),
    ("kuro", "pgr-y2023", "战双帕弥什：刻命螺旋", "刻命螺旋", 2023, 8, "scifi", "action", 2, 7.8, 16),
    # ── origin（1995–2004 us power2）—— 61 个月池作 ════════════════════════════
    ("origin", "bioForge95", "生化锻造", "生化锻造", 1995, 3, "scifi", "action", 3, 7.8, 16),
    ("origin", "wingCmdSecretOps98", "银河飞将：秘密行动", "秘密行动", 1998, 9, "scifi", "sim", 2, 7.6, 16),
    ("origin", "ultimaOnline2ndAge98", "网络创世纪：第二纪元", "第二纪元", 1998, 10, "fantasy", "mmo", 3, 8.2, 18),
    ("origin", "uoRenaissance00", "网络创世纪：文艺复兴", "文艺复兴", 2000, 4, "fantasy", "mmo", 3, 8.0, 18),
    ("origin", "uoThirdDawn01", "网络创世纪：第三黎明", "第三黎明", 2001, 3, "fantasy", "mmo", 2, 7.6, 18),
    ("origin", "uoAgeOfShadows03", "网络创世纪：暗影纪元", "暗影纪元", 2003, 2, "fantasy", "mmo", 3, 8.0, 20),
    ("origin", "uoSamurai04", "网络创世纪：武士帝国", "武士帝国", 2004, 11, "fantasy", "mmo", 2, 7.6, 20),
    # ── interplayFallback（1995–2004 us power1）—— 51 个月池作 ═════════════════
    ("interplayFallback", "mdk2_00", "MDK2", "MDK2", 2000, 11, "scifi", "action", 2, 7.6, 20),
    ("interplayFallback", "sacrifice00", "牺牲", "牺牲", 2000, 11, "fantasy", "strategy", 3, 8.2, 22),
    ("interplayFallback", "giantsCitizenKabuto00", "巨人：卡布托公民", "巨人", 2000, 11, "scifi", "action", 3, 8.0, 20),
    ("interplayFallback", "falloutTactics01", "辐射战略版：钢铁兄弟会", "辐射战略版", 2001, 3, "apocalypse", "strategy", 3, 7.8, 20),
    ("interplayFallback", "lionheart03", "狮心王：遗产", "狮心王", 2003, 8, "fantasy", "rpg", 2, 7.0, 22),
    ("interplayFallback", "falloutBos04", "辐射：钢铁兄弟会", "钢铁兄弟会", 2004, 1, "apocalypse", "action", 1, 5.8, 18),
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
    cfg = json.load(open("activity/config.json", encoding="utf-8")).get("content") or {}
    valid_genre = {g["id"] for g in cfg.get("genres", [])}
    valid_play = {g["id"] for g in cfg.get("gameplay", [])}
    valid_plat = {g["id"] for g in cfg.get("platforms", [])}

    seen = set()
    for row in NEW:
        cid, tid = row[0], row[1]
        if tid in seen:
            raise SystemExit("新 id 重复: %s" % tid)
        seen.add(tid)
        if cid not in comap:
            raise SystemExit("公司不存在: %s" % cid)
        if row[6] not in valid_genre:
            raise SystemExit("题材不存在: %s (%s)" % (row[6], tid))
        if row[7] not in valid_play:
            raise SystemExit("玩法不存在: %s (%s)" % (row[7], tid))
        c = comap[cid]
        lo = c.get("hireFromYear") or c.get("foundedYear") or 1995
        hi = c.get("hireUntilYear")
        if row[4] < lo:
            raise SystemExit("%s 发售年 %d 早于公司可玩起点 %d" % (tid, row[4], lo))
        if hi is not None and row[4] > hi:
            raise SystemExit("%s 发售年 %d 晚于公司 hireUntilYear %d" % (tid, row[4], hi))

    added, skipped = [], []
    for (cid, tid, name, alias, y, m, genre, play, prestige, score, devmonths) in NEW:
        if tid in tm:
            skipped.append(tid)
            continue
        own = by_co[cid]
        # 公司作品 < 4 部时，把「同题材」的别家作品也拉进参考池，避免四维形状全部同源
        pool = list(own)
        if len(own) < 4:
            pool += [t for t in d["titles"] if t.get("genreId") == genre and t["companyId"] != cid]
        if not pool:
            raise SystemExit("%s 没有可参考的既有作品" % cid)
        ref = sorted(pool, key=lambda t: abs((t["releaseYear"] or 2000) - y))[0]
        rs = ref.get("stats") or {}
        ssum = sum(rs.get(k, 0) for k in DIMS) or 1
        target = 300.0 + (score - 8.0) * 6.0
        k = target / ssum
        stats = {}
        for dim in DIMS:
            stats[dim] = max(30, min(95, int(round(rs.get(dim, 0) * k))))
        peak = [max(DIMS, key=lambda x: stats[x])]

        ds_i = (y * 12 + m) - devmonths
        dsy, dsm = (ds_i - 1) // 12, (ds_i - 1) % 12 + 1
        iw_s = ds_i + 2
        iw_e = (y * 12 + m) - 1
        plats = [p for p in (ref.get("platforms") or ["pc"]) if p in valid_plat] or ["pc"]
        t = {
            "id": tid,
            "companyId": cid,
            "publisherId": comap[cid].get("publisherId") or cid,
            "name": name,
            "alias": alias,
            "releaseYear": y,
            "releaseMonth": m,
            "score": score,
            "platforms": plats,
            "genreId": genre,
            "gameplayId": play,
            "releaseType": "boxed",
            "landmark": False,
            "prestige": prestige,
            "studioId": (own[0].get("studioId") if own else ref.get("studioId")),
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

    # 同公司 + 同名 的重复检查（P2-fix-a 已踩过一次：mw1/cod4）
    dup = defaultdict(list)
    for t in d["titles"]:
        dup[(t["companyId"], t["name"], t["releaseYear"], t["releaseMonth"])].append(t["id"])
    bad = {k: v for k, v in dup.items() if len(v) > 1}
    if bad:
        raise SystemExit("同公司+同名+同发售月重复：%s" % list(bad.items())[:5])

    print("补入 %d 部（跳过已存在 %d）" % (len(added), len(skipped)))
    per = defaultdict(int)
    for cid, *_ in added:
        per[cid] += 1
    print("  " + "  ".join("%s×%d" % (k, v) for k, v in sorted(per.items(), key=lambda x: -x[1])))
    if dry:
        print("\n[dry-run] 未写盘")
        return

    shutil.copyfile(PATH, BACKUP)
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")

    chk = json.loads(open(PATH, encoding="utf-8").read())
    ids = [t["id"] for t in chk["titles"]]
    assert len(ids) == len(set(ids)), "新数据出现重复 id"
    assert len(chk["titles"]) == len(chk["titleDetails"])
    print("\n写盘完成：titles %d / titleDetails %d / 备份 %s"
          % (len(chk["titles"]), len(chk["titleDetails"]), BACKUP))


main()
