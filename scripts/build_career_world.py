# -*- coding: utf-8 -*-
"""生成 activity/career-world.json。改公司/作品/化名请改本脚本后重跑，或直接改 json。"""
from __future__ import print_function

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "activity", "career-world.json")

SAL = {1: 0.88, 2: 1.0, 3: 1.22}
HIRE = {1: 0.72, 2: 0.48, 3: 0.22}
DEV = {1: 8, 2: 12, 3: 16, 4: 24, 5: 32}
FAME = {1: 8, 2: 16, 3: 28, 4: 44, 5: 62}


def add_months(y, m, d):
    x = y * 12 + (m - 1) + d
    return x // 12, x % 12 + 1


def C(cid, name, alias, region, hq, founded, power, **kw):
    hire_from = kw.get("hireFrom", max(founded, 1995))
    joinable = kw.get("joinable")
    if joinable is None:
        joinable = not kw.get("worldOnly", False)
    row = {
        "id": cid,
        "name": name,
        "alias": alias,
        "region": region,
        "hq": hq,
        "foundedYear": founded,
        "hireFromYear": hire_from,
        "hireUntilYear": kw.get("until"),
        "power": power,
        "salaryMult": kw.get("sal", SAL[power]),
        "hireChance": kw.get("hire", HIRE.get(power, 0.48)),
        "openingOffer": kw.get("open", False),
        "joinable": bool(joinable),
        "successorId": kw.get("succ"),
        "mergedYear": kw.get("merge"),
        "starterTier": kw.get("tier"),
        "tags": kw.get("tags", []),
    }
    if kw.get("pw"):
        row["platformWeights"] = kw["pw"]
    return row


def T(tid, company, pub, name, alias, en, y, m, score, plats, genre, gp, **kw):
    row = {
        "id": tid,
        "companyId": company,
        "publisherId": pub,
        "name": name,
        "alias": alias,
        "nameEn": en,
        "releaseYear": y,
        "releaseMonth": m,
        "score": score,
        "platforms": plats if isinstance(plats, list) else plats.split("+"),
        "genreId": genre,
        "gameplayId": gp,
        "releaseType": kw.get("rtype", "boxed"),
        "landmark": kw.get("land", False),
        "prestige": kw.get("pres", 3),
        "seriesId": kw.get("series"),
    }
    if kw.get("stats"):
        row["stats"] = kw["stats"]
    if kw.get("peak"):
        row["peakDims"] = kw["peak"]
    if kw.get("quote"):
        row["shipQuote"] = kw["quote"]
    if kw.get("studio"):
        row["studioId"] = kw["studio"]
    return row


def S(sid, name, alias, genres, gameplay, hire=None):
    row = {
        "id": sid,
        "name": name,
        "alias": alias,
        "genreIds": list(genres),
        "gameplayIds": list(gameplay),
    }
    if hire is not None:
        row["hireChance"] = hire
    return row


COMPANIES = [
    C("nintendo", "任天堂", "N社", "jp", "京都", 1889, 3, open=True, tier="stable", hire=0.16,
      tags=["console", "firstParty"], pw={"console": 8, "pc": 1, "mobile": 1}),
    C("sony", "索尼电脑娱乐", "S社", "jp", "东京", 1993, 3, open=True, tier="stable", hire=0.18,
      tags=["console", "firstParty"], pw={"console": 7, "pc": 2, "mobile": 1}),
    C("sega", "世嘉", "世嘉", "jp", "东京", 1960, 2, open=True, tier="stable",
      tags=["console", "arcade"]),
    C("square", "史克威尔", "史克威尔", "jp", "东京", 1986, 3, open=True, tier="stable", hire=0.2,
      until=2003, succ="squareEnix", merge=2003, tags=["rpg"]),
    C("enix", "艾尼克斯", "艾尼克斯", "jp", "东京", 1975, 2, until=2003, succ="squareEnix", merge=2003, tags=["rpg"]),
    C("squareEnix", "史克威尔艾尼克斯", "SE社", "jp", "东京", 2003, 3, hireFrom=2003, hire=0.2, tags=["rpg"]),
    C("capcom", "卡普空", "卡普空", "jp", "大阪", 1979, 3, open=True, tier="stable", hire=0.22, tags=["action"]),
    C("konami", "科乐美", "K社", "jp", "东京", 1969, 2, open=True, tier="stable", tags=["action"]),
    C("namco", "南梦宫", "南梦宫", "jp", "东京", 1955, 2, until=2005, succ="bandaiNamco", merge=2005, tags=["arcade"]),
    C("bandaiNamco", "万代南梦宫", "BN社", "jp", "东京", 2005, 2, hireFrom=2005, tags=["arcade"]),
    C("fromsoftware", "FromSoftware", "魂社", "jp", "东京", 1986, 2, open=True, tier="small", tags=["arpg"]),
    C("atlus", "Atlus", "女神社", "jp", "东京", 1986, 1, tags=["rpg"]),
    C("falcom", "日本Falcom", "Falcom", "jp", "东京", 1981, 1, open=True, tier="small", tags=["rpg"]),
    C("snk", "SNK", "SNK", "jp", "大阪", 1978, 1, open=True, tier="small", tags=["fighting"]),
    C("koei", "光荣", "光荣", "jp", "横滨", 1978, 2, open=True, until=2009, succ="koeiTecmo", merge=2009, tags=["historical"]),
    C("koeiTecmo", "光荣特库摩", "KT社", "jp", "横滨", 2009, 2, hireFrom=2009, tags=["historical"]),
    C("gamefreak", "Game Freak", "宝可梦社", "jp", "东京", 1989, 2, open=True, tier="small", tags=["rpg"]),
    C("platinum", "PlatinumGames", "白金", "jp", "大阪", 2006, 2, hireFrom=2006, tags=["action"]),
    C("santaMonica", "圣莫尼卡工作室", "战神社", "us", "洛杉矶", 1999, 2, hireFrom=1999, tags=["action", "sonyStudio"]),
    C("naughtyDog", "顽皮狗", "狗社", "us", "圣莫尼卡", 1986, 2, open=True, tier="wild", tags=["action", "sonyStudio"]),
    C("insomniac", "Insomniac Games", "失眠社", "us", "伯班克", 1994, 2, open=True, tags=["action", "sonyStudio"]),
    C("guerilla", "Guerrilla Games", "地平线社", "eu", "阿姆斯特丹", 2000, 2, hireFrom=2000, tags=["openWorld", "sonyStudio"]),
    C("polyphony", "Polyphony Digital", "GT社", "jp", "东京", 1998, 2, hireFrom=1998, tags=["racing", "sonyStudio"]),
    C("teamIco", "Team Ico", "巨影社", "jp", "东京", 1997, 1, hireFrom=1997, until=2011, tags=["adventure", "sonyStudio"]),
    C("kojimaProductions", "Kojima Productions", "小岛组", "jp", "东京", 2015, 2, hireFrom=2015, tags=["action"]),
    C("ea", "艺电", "EA", "us", "红木城", 1982, 3, open=True, tier="stable", hire=0.28, tags=["publisher"]),
    C("activision", "动视", "动视", "us", "圣莫尼卡", 1979, 3, open=True, tier="stable", hire=0.26, tags=["publisher"]),
    C("blizzard", "暴雪娱乐", "暴雪", "us", "欧文", 1991, 3, open=True, tier="wild", hire=0.18, tags=["pc", "liveops"]),
    C("valve", "Valve", "帽子社", "us", "贝尔维尤", 1996, 3, hireFrom=1996, tags=["pc"]),
    C("idsoftware", "id Software", "id社", "us", "梅斯基特", 1991, 2, open=True, tier="wild", tags=["shooter"]),
    C("bungie", "Bungie", "邦吉", "us", "西雅图", 1991, 2, open=True, tier="wild", tags=["shooter"]),
    C("rockstar", "Rockstar Games", "R星", "us", "纽约", 1998, 3, hireFrom=1998, hire=0.14, tags=["openWorld"]),
    C("dma", "DMA Design", "DMA", "uk", "邓迪", 1988, 2, open=True, tier="small", until=2002, succ="rockstar", merge=2002, tags=["openWorld"]),
    C("bethesda", "贝塞斯达", "老贝", "us", "罗克维尔", 1986, 2, open=True, tags=["rpg", "openWorld"]),
    C("xbox", "微软Xbox", "微软", "us", "雷德蒙德", 2000, 3, hireFrom=2001, tags=["console", "firstParty"]),
    C("epic", "Epic Games", "虚幻社", "us", "卡里", 1991, 2, open=True, tier="wild", tags=["engine", "shooter"]),
    C("bioware", "BioWare", "比威尔", "us", "埃德蒙顿", 1995, 2, open=True, tags=["rpg"]),
    C("infinityWard", "Infinity Ward", "IW社", "us", "伍德兰希尔斯", 2002, 2, hireFrom=2002, tags=["shooter"]),
    C("firaxis", "Firaxis", "文明社", "us", "亨特谷", 1996, 2, hireFrom=1996, tags=["strategy"]),
    C("gearbox", "Gearbox", "齿轮箱", "us", "弗里斯科", 1999, 1, hireFrom=1999, tags=["shooter"]),
    C("westwood", "Westwood Studios", "西木", "us", "拉斯维加斯", 1985, 2, open=True, tier="wild", until=2003, tags=["rts"]),
    C("origin", "Origin Systems", "起源", "us", "奥斯汀", 1983, 2, open=True, until=2004, tags=["rpg"]),
    C("sierra", "Sierra On-Line", "雪乐山", "us", "奥克赫斯特", 1979, 2, open=True, until=2008, tags=["adventure"]),
    C("lucasarts", "LucasArts", "卢卡斯", "us", "圣拉斐尔", 1982, 2, open=True, until=2013, tags=["adventure"]),
    C("lookingGlass", "Looking Glass", "镜厅", "us", "剑桥", 1992, 1, open=True, tier="small", until=2000, tags=["sim", "immersive"]),
    C("riot", "拳头游戏", "拳头", "us", "洛杉矶", 2006, 3, hireFrom=2006, tags=["liveops", "pc"]),
    C("respawn", "Respawn", "重生社", "us", "谢尔曼奥克斯", 2010, 2, hireFrom=2010, tags=["shooter"]),
    C("maxis", "Maxis", "模拟人生社", "us", "埃默里维尔", 1987, 2, open=True, tags=["sim"]),
    C("popcap", "PopCap", "泡泡社", "us", "西雅图", 2000, 1, hireFrom=2000, tags=["casual"]),
    C("irrational", "Irrational Games", "非理性", "us", "昆西", 1997, 2, hireFrom=1997, until=2017, tags=["shooter"]),
    C("rocksteady", "Rocksteady", "稳岩", "uk", "伦敦", 2005, 2, hireFrom=2005, tags=["action"]),
    C("eidos", "Eidos Interactive", "Eidos", "uk", "伦敦", 1990, 2, open=True, until=2009, succ="squareEnix", merge=2009, tags=["publisher"]),
    C("coreDesign", "Core Design", "古墓社", "uk", "德比", 1988, 1, open=True, tier="small", until=2006, tags=["adventure"]),
    C("crystalDynamics", "Crystal Dynamics", "水晶社", "us", "雷德伍德", 1992, 2, open=True, tags=["action"]),
    C("rare", "Rare", "稀有社", "uk", "特温布鲁克", 1985, 2, open=True, tier="wild", tags=["console"]),
    C("ensemble", "Ensemble Studios", "帝国社", "us", "达拉斯", 1995, 2, open=True, until=2009, tags=["rts"]),
    C("playground", "Playground Games", "操场社", "uk", "利明顿", 2010, 2, hireFrom=2010, tags=["racing"]),
    C("ubisoft", "育碧", "育碧", "eu", "圣芒代", 1986, 3, open=True, hire=0.32, tags=["openWorld"]),
    C("cdpr", "CD Projekt RED", "红社", "eu", "华沙", 2002, 2, hireFrom=2002, tags=["rpg"]),
    C("remedy", "Remedy", "控制社", "eu", "埃斯波", 1995, 2, open=True, tags=["action"]),
    C("mojang", "Mojang", "我的世界社", "eu", "斯德哥尔摩", 2009, 2, hireFrom=2009, tags=["sandbox"]),
    C("supercell", "Supercell", "超细胞", "eu", "赫尔辛基", 2010, 2, hireFrom=2010, tags=["mobile", "liveops"]),
    C("paradox", "Paradox", "帕莱斯", "eu", "斯德哥尔摩", 1999, 1, hireFrom=1999, tags=["strategy"]),
    C("ca", "Creative Assembly", "全战社", "uk", "霍舍姆", 1987, 2, open=True, tags=["strategy"]),
    C("larian", "Larian Studios", "拉瑞安", "eu", "根特", 1996, 2, hireFrom=1996, tags=["rpg"]),
    C("hazelight", "Hazelight", "榛光", "eu", "斯德哥尔摩", 2014, 1, hireFrom=2014, tags=["coOp"]),
    C("warhorse", "Warhorse Studios", "战马", "eu", "布拉格", 2011, 1, hireFrom=2011, tags=["rpg"]),
    C("pioneer", "前导软件", "前导", "cn", "北京", 1992, 1, open=True, tier="small", until=2001, tags=["pc", "cnStudio"]),
    C("kingsoft", "金山软件", "金山", "cn", "北京", 1988, 2, open=True, tier="stable", tags=["pc", "cnStudio"]),
    C("softstar", "大宇资讯", "大宇", "cn", "台北", 1988, 2, open=True, tier="small", tags=["rpg", "cnStudio"]),
    C("objectSoftware", "目标软件", "目标", "cn", "北京", 1995, 1, open=True, tier="small", tags=["strategy", "cnStudio"]),
    C("shanda", "盛大网络", "盛大", "cn", "上海", 1999, 2, hireFrom=1999, tags=["mmo", "publisher"]),
    C("the9", "第九城市", "九城", "cn", "上海", 1999, 2, hireFrom=1999, tags=["publisher", "mmo"]),
    C("netease", "网易游戏", "网易", "cn", "广州", 1997, 3, hireFrom=2001, hire=0.3, tags=["liveops", "cnStudio"]),
    C("tencent", "腾讯游戏", "鹅厂", "cn", "深圳", 1998, 3, hireFrom=2003, hire=0.28, tags=["liveops", "publisher"]),
    C("perfectWorld", "完美世界", "完美", "cn", "北京", 2004, 2, hireFrom=2004, tags=["mmo"]),
    C("giant", "巨人网络", "巨人", "cn", "上海", 2004, 2, hireFrom=2004, tags=["mmo"]),
    C("mihoyo", "米哈游", "米社", "cn", "上海", 2011, 3, hireFrom=2012, hire=0.2, tags=["liveops", "anime"]),
    C("hypergryph", "鹰角网络", "鹰角", "cn", "上海", 2017, 2, hireFrom=2017, tags=["liveops", "anime"]),
    C("kuro", "库洛游戏", "库洛", "cn", "广州", 2014, 2, hireFrom=2014, tags=["liveops"]),
    C("lilith", "莉莉丝", "莉莉丝", "cn", "上海", 2013, 2, hireFrom=2013, tags=["mobile", "liveops"]),
    C("gamescience", "游戏科学", "游科", "cn", "深圳", 2014, 2, hireFrom=2014, tags=["action"]),
    C("nexon", "Nexon", "Nexon", "kr", "首尔", 1994, 2, open=True, tags=["mmo", "liveops"]),
    C("ncsoft", "NCSOFT", "NC", "kr", "城南", 1997, 2, hireFrom=1997, tags=["mmo"]),
    C("smilegate", "Smilegate", "微笑门", "kr", "城南", 2002, 2, hireFrom=2002, tags=["shooter", "liveops"]),
    C("krafton", "Krafton", "克拉夫顿", "kr", "城南", 2007, 2, hireFrom=2007, tags=["shooter", "liveops"]),
    C("shiftUp", "Shift Up", "Shift Up", "kr", "首尔", 2013, 1, hireFrom=2013, tags=["action"]),
    C("niantic", "Niantic", "Niantic", "us", "旧金山", 2010, 2, hireFrom=2010, tags=["mobile"]),
    C("supergiant", "Supergiant", "超巨型", "us", "旧金山", 2009, 1, hireFrom=2009, tags=["indie"]),
    C("tgc", "thatgamecompany", "花神", "us", "洛杉矶", 2006, 1, hireFrom=2006, tags=["indie"]),
    C("pocketpair", "Pocketpair", "口袋配对", "jp", "东京", 2015, 1, hireFrom=2015, tags=["sandbox"]),
    C("teamAsobi", "Team Asobi", "Asobi", "jp", "东京", 2012, 1, hireFrom=2012, tags=["platform", "sonyStudio"]),
    C("clover", "Clover Studio", "三叶草", "jp", "大阪", 2004, 1, hireFrom=2004, until=2007, tags=["action"]),
    C("level5", "LEVEL-5", "LEVEL-5", "jp", "福冈", 1998, 2, hireFrom=1998, tags=["rpg"]),
    C("acclaim", "Acclaim", "Acclaim", "us", "格伦科夫", 1987, 1, worldOnly=True, until=2004, tags=["publisher"]),
    C("thq", "THQ", "THQ", "us", "阿古拉山", 1989, 1, worldOnly=True, until=2013, tags=["publisher"]),
    C("midway", "Midway", "Midway", "us", "芝加哥", 1988, 1, worldOnly=True, until=2009, tags=["arcade"]),
    C("hudson", "Hudson Soft", "Hudson", "jp", "札幌", 1973, 1, worldOnly=True, until=2012, tags=["publisher"]),
    C("treasure", "Treasure", "Treasure", "jp", "东京", 1992, 1, worldOnly=True, tags=["action"]),
    C("triAce", "tri-Ace", "tri-Ace", "jp", "东京", 1995, 1, worldOnly=True, tags=["rpg"]),
    C("asciiEnt", "ASCII", "ASCII", "jp", "东京", 1977, 1, worldOnly=True, until=2002, tags=["publisher"]),
    C("infogrames", "Infogrames", "Infogrames", "eu", "里昂", 1983, 1, worldOnly=True, until=2009, tags=["publisher"]),
    C("gtInteractive", "GT Interactive", "GT", "us", "纽约", 1993, 1, worldOnly=True, until=1999, tags=["publisher"]),
    C("netdragon", "网龙", "网龙", "cn", "福州", 1999, 1, worldOnly=True, tags=["cnStudio", "publisher"]),
    C("ourpalm", "掌趣科技", "掌趣", "cn", "北京", 2004, 1, worldOnly=True, tags=["mobile"]),
    C("igame", "中青宝", "中青宝", "cn", "深圳", 2003, 1, worldOnly=True, tags=["cnStudio"]),
    C("yoozoo", "游族网络", "游族", "cn", "上海", 2009, 1, worldOnly=True, tags=["cnStudio"]),
    C("paperGames", "叠纸游戏", "叠纸", "cn", "上海", 2013, 1, worldOnly=True, tags=["mobile"]),
    C("arcSys", "Arc System Works", "弧社", "jp", "横滨", 1988, 1, worldOnly=True, tags=["fighting"]),
    C("compileHeart", "Compile Heart", "Compile", "jp", "东京", 2006, 1, worldOnly=True, hireFrom=2006, tags=["rpg"]),
]

TITLES = [
    T("chronoTrigger", "square", "square", "时空之轮", "时轮", "Chrono Trigger", 1995, 3, 9.5, "console", "fantasy", "rpg", land=True, pres=5, series="chrono"),
    T("yoshisIsland", "nintendo", "nintendo", "耀西岛", "耀西岛", "Yoshi's Island", 1995, 10, 9.1, "console", "cartoon", "platform", land=True, pres=4, series="yoshi"),
    T("warcraft2", "blizzard", "blizzard", "魔兽争霸II", "海2", "Warcraft II", 1995, 12, 9.0, "pc", "fantasy", "rts", land=True, pres=4, series="warcraft"),
    T("cnc", "westwood", "ea", "命令与征服", "泰伯利亚黎明", "Command & Conquer", 1995, 8, 8.8, "pc", "war", "rts", land=True, pres=4, series="cnc"),
    T("pal1", "softstar", "softstar", "仙剑奇侠传", "仙剑一", "The Legend of Sword and Fairy", 1995, 7, 8.7, "pc", "wuxia", "rpg", land=True, pres=4, series="pal"),
    T("wipeout", "sony", "sony", "Wipeout", "反重力赛车", "Wipeout", 1995, 9, 8.5, "console", "scifi", "racing", pres=3, series="wipeout"),
    T("mario64", "nintendo", "nintendo", "超级马力欧64", "马里奥64", "Super Mario 64", 1996, 6, 9.8, "console", "cartoon", "platform", land=True, pres=5, series="mario"),
    T("quake", "idsoftware", "idsoftware", "雷神之锤", "Quake", "Quake", 1996, 6, 9.4, "pc", "horror", "shooter", land=True, pres=5, series="quake"),
    T("pokemonRed", "gamefreak", "nintendo", "精灵宝可梦 红/绿", "初代宝可梦", "Pokémon Red/Green", 1996, 2, 8.8, "console", "fantasy", "rpg", land=True, pres=5, series="pokemon"),
    T("diablo", "blizzard", "blizzard", "暗黑破坏神", "暗黑1", "Diablo", 1996, 12, 9.4, "pc", "fantasy", "arpg", land=True, pres=5, series="diablo"),
    T("tombRaider", "coreDesign", "eidos", "古墓丽影", "劳拉1", "Tomb Raider", 1996, 10, 8.6, "console+pc", "adventure", "action", land=True, pres=4, series="tombRaider"),
    T("residentEvil", "capcom", "capcom", "生化危机", "生化1", "Resident Evil", 1996, 3, 8.7, "console", "horror", "survival", land=True, pres=4, series="re"),
    T("crash1", "naughtyDog", "sony", "古惑狼", "Crash", "Crash Bandicoot", 1996, 9, 8.6, "console", "cartoon", "platform", pres=3, series="crash"),
    T("ff7", "square", "square", "最终幻想VII", "FF7", "Final Fantasy VII", 1997, 1, 9.6, "console", "scifi", "rpg", land=True, pres=5, series="ff"),
    T("goldeneye", "rare", "nintendo", "黄金眼007", "金眼", "GoldenEye 007", 1997, 8, 9.6, "console", "war", "shooter", land=True, pres=5, series="goldeneye"),
    T("fallout1", "interplayFallback", "interplayFallback", "辐射", "辐射1", "Fallout", 1997, 9, 8.9, "pc", "apocalypse", "rpg", land=True, pres=4, series="fallout"),
    T("granTurismo", "polyphony", "sony", "GT赛车", "GT1", "Gran Turismo", 1997, 12, 9.5, "console", "sports", "racing", land=True, pres=4, series="gt"),
    T("sotn", "konami", "konami", "恶魔城 月下夜想曲", "月下", "Castlevania: Symphony of the Night", 1997, 3, 9.3, "console", "horror", "metroidvania", land=True, pres=4, series="castlevania"),
    T("jx1", "kingsoft", "kingsoft", "剑侠情缘", "剑侠一", "Swan", 1997, 1, 8.2, "pc", "wuxia", "rpg", pres=3, series="jx"),
    T("oot", "nintendo", "nintendo", "塞尔达传说 时之笛", "时之笛", "Ocarina of Time", 1998, 11, 9.9, "console", "adventure", "action", land=True, pres=5, series="zelda"),
    T("halfLife", "valve", "valve", "半衰期", "HL1", "Half-Life", 1998, 11, 9.6, "pc", "scifi", "shooter", land=True, pres=5, series="hl"),
    T("mgs1", "konami", "konami", "合金装备", "MGS1", "Metal Gear Solid", 1998, 9, 9.6, "console", "war", "stealth", land=True, pres=5, series="mgs"),
    T("starcraft", "blizzard", "blizzard", "星际争霸", "星际1", "StarCraft", 1998, 3, 9.3, "pc", "scifi", "rts", land=True, pres=5, series="starcraft"),
    T("re2", "capcom", "capcom", "生化危机2", "生化2", "Resident Evil 2", 1998, 1, 9.3, "console", "horror", "survival", land=True, pres=4, series="re"),
    T("chibi", "pioneer", "pioneer", "赤壁", "前导赤壁", "Red Cliff", 1998, 12, 7.8, "pc", "historical", "strategy", pres=2, series="chibi"),
    T("silentHill", "konami", "konami", "寂静岭", "寂静岭1", "Silent Hill", 1999, 3, 8.6, "console", "horror", "survival", land=True, pres=4, series="sh"),
    T("aoe2", "ensemble", "ensemble", "帝国时代II", "帝国2", "Age of Empires II", 1999, 9, 9.3, "pc", "historical", "rts", land=True, pres=4, series="aoe"),
    T("soulcalibur", "namco", "namco", "灵魂能力", "SC", "Soulcalibur", 1999, 7, 9.6, "console", "urban", "fighting", land=True, pres=4, series="soulcalibur"),
    T("systemShock2", "lookingGlass", "ea", "系统冲击2", "SS2", "System Shock 2", 1999, 8, 9.2, "pc", "scifi", "shooter", land=True, pres=4, series="systemShock"),
    T("shenmue", "sega", "sega", "莎木", "莎木1", "Shenmue", 1999, 12, 8.8, "console", "urban", "action", land=True, pres=4, series="shenmue"),
    T("pokemonGold", "gamefreak", "nintendo", "精灵宝可梦 金/银", "金银", "Pokémon Gold/Silver", 1999, 11, 8.9, "console", "fantasy", "rpg", land=True, pres=4, series="pokemon"),
    T("diablo2", "blizzard", "blizzard", "暗黑破坏神II", "暗黑2", "Diablo II", 2000, 6, 8.9, "pc", "fantasy", "arpg", land=True, pres=5, series="diablo"),
    T("theSims", "maxis", "ea", "模拟人生", "SIMS", "The Sims", 2000, 2, 9.2, "pc", "sliceOfLife", "sim", land=True, pres=5, series="sims"),
    T("perfectDark", "rare", "nintendo", "完美黑暗", "完美黑暗", "Perfect Dark", 2000, 5, 9.5, "console", "scifi", "shooter", land=True, pres=4, series="perfectDark"),
    T("majora", "nintendo", "nintendo", "塞尔达传说 穆修拉的假面", "面具", "Majora's Mask", 2000, 4, 9.5, "console", "adventure", "action", land=True, pres=4, series="zelda"),
    T("bg2", "bioware", "ea", "博德之门II", "BG2", "Baldur's Gate II", 2000, 9, 9.4, "pc", "fantasy", "rpg", land=True, pres=5, series="bg"),
    T("gta3", "dma", "rockstar", "侠盗猎车手III", "GTA3", "Grand Theft Auto III", 2001, 10, 9.5, "console+pc", "urban", "openWorld", land=True, pres=5, series="gta"),
    T("halo1", "bungie", "xbox", "光环：战斗进化", "光环1", "Halo: Combat Evolved", 2001, 11, 9.7, "console", "scifi", "shooter", land=True, pres=5, series="halo"),
    T("mgs2", "konami", "konami", "合金装备2", "MGS2", "Metal Gear Solid 2", 2001, 11, 9.6, "console", "war", "stealth", land=True, pres=4, series="mgs"),
    T("melee", "nintendo", "nintendo", "任天堂明星大乱斗DX", "Melee", "Super Smash Bros. Melee", 2001, 11, 9.2, "console", "cartoon", "fighting", land=True, pres=4, series="smash"),
    T("silentHill2", "konami", "konami", "寂静岭2", "寂静岭2", "Silent Hill 2", 2001, 9, 8.9, "console", "horror", "survival", land=True, pres=4, series="sh"),
    T("maxPayne", "remedy", "rockstar", "马克思·佩恩", "子弹时间", "Max Payne", 2001, 7, 8.8, "pc+console", "urban", "shooter", pres=3, series="maxPayne"),
    T("viceCity", "rockstar", "rockstar", "侠盗猎车手：罪恶都市", "VC", "Grand Theft Auto: Vice City", 2002, 10, 9.5, "console+pc", "urban", "openWorld", land=True, pres=4, series="gta"),
    T("metroidPrime", "nintendo", "nintendo", "密特罗德 究极", "MP1", "Metroid Prime", 2002, 11, 9.7, "console", "scifi", "metroidvania", land=True, pres=5, series="metroid"),
    T("warcraft3", "blizzard", "blizzard", "魔兽争霸III", "冰封王座", "Warcraft III", 2002, 7, 9.3, "pc", "fantasy", "rts", land=True, pres=5, series="warcraft"),
    T("kingdomHearts", "square", "square", "王国之心", "KH1", "Kingdom Hearts", 2002, 3, 8.7, "console", "cartoon", "arpg", land=True, pres=4, series="kh"),
    T("windWaker", "nintendo", "nintendo", "塞尔达传说 风之杖", "风之杖", "The Wind Waker", 2002, 12, 9.6, "console", "adventure", "action", land=True, pres=4, series="zelda"),
    T("qinSang", "objectSoftware", "objectSoftware", "秦殇", "秦殇", "Prince of Qin", 2002, 12, 7.9, "pc", "historical", "rpg", pres=3, series="qin"),
    T("kotor", "bioware", "lucasarts", "星球大战：旧共和国武士", "KOTOR", "Knights of the Old Republic", 2003, 7, 9.3, "console+pc", "scifi", "rpg", land=True, pres=5, series="kotor"),
    T("sandsOfTime", "ubisoft", "ubisoft", "波斯王子：时之砂", "时之砂", "Prince of Persia: The Sands of Time", 2003, 11, 8.9, "console+pc", "adventure", "action", land=True, pres=4, series="pop"),
    T("cod1", "infinityWard", "activision", "使命召唤", "COD1", "Call of Duty", 2003, 10, 9.1, "pc", "war", "shooter", land=True, pres=4, series="cod"),
    T("mhxy", "netease", "netease", "梦幻西游", "梦幻", "Fantasy Westward Journey", 2003, 12, 8.4, "pc", "xianxia", "mmo", land=True, pres=4, rtype="liveops", series="mhxy"),
    T("pal3", "softstar", "softstar", "仙剑奇侠传三", "仙剑三", "Chinese Paladin 3", 2003, 7, 8.5, "pc", "wuxia", "rpg", land=True, pres=3, series="pal"),
    T("hl2", "valve", "valve", "半衰期2", "HL2", "Half-Life 2", 2004, 11, 9.6, "pc", "scifi", "shooter", land=True, pres=5, series="hl"),
    T("sanAndreas", "rockstar", "rockstar", "侠盗猎车手：圣安地列斯", "SA", "Grand Theft Auto: San Andreas", 2004, 10, 9.5, "console+pc", "urban", "openWorld", land=True, pres=5, series="gta"),
    T("wow", "blizzard", "blizzard", "魔兽世界", "WOW", "World of Warcraft", 2004, 11, 9.3, "pc", "fantasy", "mmo", land=True, pres=5, rtype="liveops", series="wow"),
    T("halo2", "bungie", "xbox", "光环2", "光环2", "Halo 2", 2004, 11, 9.5, "console", "scifi", "shooter", land=True, pres=4, series="halo"),
    T("mgs3", "konami", "konami", "合金装备3", "MGS3", "Metal Gear Solid 3", 2004, 11, 9.4, "console", "war", "stealth", land=True, pres=4, series="mgs"),
    T("re4", "capcom", "capcom", "生化危机4", "生化4", "Resident Evil 4", 2005, 1, 9.6, "console", "horror", "survival", land=True, pres=5, series="re"),
    T("gow1", "santaMonica", "sony", "战神", "战神1", "God of War", 2005, 3, 9.4, "console", "myth", "action", land=True, pres=4, series="gow"),
    T("sotc", "teamIco", "sony", "旺达与巨像", "巨影", "Shadow of the Colossus", 2005, 10, 9.1, "console", "adventure", "action", land=True, pres=4, series="ico"),
    T("civ4", "firaxis", "2kFallback", "文明IV", "文明4", "Civilization IV", 2005, 10, 9.3, "pc", "historical", "strategy", land=True, pres=4, series="civ"),
    T("dnf", "nexon", "nexon", "地下城与勇士", "DNF", "Dungeon & Fighter", 2005, 8, 8.3, "pc", "fantasy", "arpg", land=True, pres=4, rtype="liveops", series="dnf"),
    T("oblivion", "bethesda", "bethesda", "上古卷轴IV：湮灭", "湮灭", "The Elder Scrolls IV: Oblivion", 2006, 3, 9.4, "console+pc", "fantasy", "openWorld", land=True, pres=4, series="tes"),
    T("gears1", "epic", "xbox", "战争机器", "Gears1", "Gears of War", 2006, 11, 9.4, "console", "scifi", "shooter", land=True, pres=4, series="gears"),
    T("wiiSports", "nintendo", "nintendo", "Wii Sports", "Wii运动", "Wii Sports", 2006, 11, 7.7, "console", "sports", "sportsGame", land=True, pres=5, series="wiiSports"),
    T("okami", "clover", "capcom", "大神", "大神", "Ōkami", 2006, 4, 8.8, "console", "myth", "action", land=True, pres=3, series="okami"),
    T("zt", "giant", "giant", "征途", "征途", "Zhengtu", 2006, 4, 7.6, "pc", "xianxia", "mmo", pres=3, rtype="liveops", series="zt"),
    T("bioshock", "irrational", "2kFallback", "生化奇兵", "Bioshock", "BioShock", 2007, 8, 9.6, "console+pc", "scifi", "shooter", land=True, pres=5, series="bioshock"),
    T("marioGalaxy", "nintendo", "nintendo", "超级马力欧银河", "银河1", "Super Mario Galaxy", 2007, 11, 9.7, "console", "cartoon", "platform", land=True, pres=5, series="mario"),
    T("portal", "valve", "valve", "传送门", "Portal", "Portal", 2007, 10, 9.5, "pc+console", "scifi", "puzzle", land=True, pres=4, series="portal"),
    T("mw1", "infinityWard", "activision", "使命召唤4：现代战争", "COD4", "Call of Duty 4: Modern Warfare", 2007, 11, 9.4, "console+pc", "war", "shooter", land=True, pres=5, series="cod"),
    T("halo3", "bungie", "xbox", "光环3", "光环3", "Halo 3", 2007, 9, 9.4, "console", "scifi", "shooter", land=True, pres=4, series="halo"),
    T("cf", "smilegate", "tencent", "穿越火线", "CF", "CrossFire", 2007, 8, 7.8, "pc", "war", "shooter", land=True, pres=4, rtype="liveops", series="cf"),
    T("massEffect", "bioware", "ea", "质量效应", "ME1", "Mass Effect", 2007, 11, 8.9, "console+pc", "scifi", "rpg", land=True, pres=4, series="me"),
    T("gta4", "rockstar", "rockstar", "侠盗猎车手IV", "GTA4", "Grand Theft Auto IV", 2008, 4, 9.8, "console+pc", "urban", "openWorld", land=True, pres=5, series="gta"),
    T("fallout3", "bethesda", "bethesda", "辐射3", "辐射3", "Fallout 3", 2008, 10, 9.1, "console+pc", "apocalypse", "openWorld", land=True, pres=4, series="fallout"),
    T("l4d", "valve", "valve", "求生之路", "L4D", "Left 4 Dead", 2008, 11, 8.9, "pc+console", "horror", "shooter", pres=3, series="l4d"),
    T("mgs4", "konami", "konami", "合金装备4", "MGS4", "Metal Gear Solid 4", 2008, 6, 9.4, "console", "war", "stealth", land=True, pres=4, series="mgs"),
    T("smashBrawl", "nintendo", "nintendo", "任天堂明星大乱斗X", "Brawl", "Super Smash Bros. Brawl", 2008, 3, 9.3, "console", "cartoon", "fighting", pres=4, series="smash"),
    T("uncharted2", "naughtyDog", "sony", "神秘海域2", "U2", "Uncharted 2", 2009, 10, 9.6, "console", "adventure", "action", land=True, pres=5, series="uncharted"),
    T("mw2", "infinityWard", "activision", "使命召唤：现代战争2", "MW2", "Modern Warfare 2", 2009, 11, 9.4, "console+pc", "war", "shooter", land=True, pres=4, series="cod"),
    T("demonsSouls", "fromsoftware", "fromsoftware", "恶魔之魂", "恶魔魂", "Demon's Souls", 2009, 2, 8.5, "console", "fantasy", "arpg", land=True, pres=4, series="souls"),
    T("lol", "riot", "riot", "英雄联盟", "LOL", "League of Legends", 2009, 10, 8.2, "pc", "fantasy", "moba", land=True, pres=5, rtype="liveops", series="lol"),
    T("ac2", "ubisoft", "ubisoft", "刺客信条II", "AC2", "Assassin's Creed II", 2009, 11, 9.1, "console+pc", "historical", "action", land=True, pres=4, series="ac"),
    T("jx3", "kingsoft", "kingsoft", "剑侠情缘网络版叁", "剑网3", "JX3", 2009, 8, 8.3, "pc", "wuxia", "mmo", land=True, pres=3, rtype="liveops", series="jx"),
    T("pvz", "popcap", "popcap", "植物大战僵尸", "PVZ", "Plants vs. Zombies", 2009, 5, 8.7, "pc+mobile", "comedy", "towerDefense", land=True, pres=3, series="pvz"),
    T("rdr1", "rockstar", "rockstar", "荒野大镖客", "救赎1", "Red Dead Redemption", 2010, 5, 9.5, "console", "western", "openWorld", land=True, pres=5, series="rdr"),
    T("me2", "bioware", "ea", "质量效应2", "ME2", "Mass Effect 2", 2010, 1, 9.6, "console+pc", "scifi", "rpg", land=True, pres=5, series="me"),
    T("sc2", "blizzard", "blizzard", "星际争霸II", "星际2", "StarCraft II", 2010, 7, 9.1, "pc", "scifi", "rts", land=True, pres=4, series="starcraft"),
    T("haloReach", "bungie", "xbox", "光环：致远星", "致远星", "Halo: Reach", 2010, 9, 9.1, "console", "scifi", "shooter", pres=3, series="halo"),
    T("marioGalaxy2", "nintendo", "nintendo", "超级马力欧银河2", "银河2", "Super Mario Galaxy 2", 2010, 5, 9.7, "console", "cartoon", "platform", land=True, pres=4, series="mario"),
    T("portal2", "valve", "valve", "传送门2", "Portal2", "Portal 2", 2011, 4, 9.5, "pc+console", "scifi", "puzzle", land=True, pres=5, series="portal"),
    T("skyrim", "bethesda", "bethesda", "上古卷轴V：天际", "天际", "The Elder Scrolls V: Skyrim", 2011, 11, 9.4, "console+pc", "fantasy", "openWorld", land=True, pres=5, series="tes"),
    T("darkSouls", "fromsoftware", "fromsoftware", "黑暗之魂", "黑魂1", "Dark Souls", 2011, 9, 8.9, "console+pc", "fantasy", "arpg", land=True, pres=5, series="souls"),
    T("minecraft", "mojang", "mojang", "我的世界", "MC", "Minecraft", 2011, 11, 9.0, "pc+console+mobile", "sliceOfLife", "sandbox", land=True, pres=5, rtype="liveops", series="minecraft"),
    T("arkhamCity", "rocksteady", "rocksteady", "蝙蝠侠：阿卡姆城市", "阿卡姆城", "Batman: Arkham City", 2011, 10, 9.6, "console+pc", "superhero", "action", land=True, pres=4, series="arkham"),
    T("uncharted3", "naughtyDog", "sony", "神秘海域3", "U3", "Uncharted 3", 2011, 11, 9.2, "console", "adventure", "action", pres=3, series="uncharted"),
    T("journey", "tgc", "sony", "风之旅人", "Journey", "Journey", 2012, 3, 9.2, "console", "adventure", "action", land=True, pres=3, series="journey"),
    T("xcomEu", "firaxis", "2kFallback", "幽浮：未知敌人", "XCOM", "XCOM: Enemy Unknown", 2012, 10, 8.9, "pc+console", "scifi", "tactics", land=True, pres=4, series="xcom"),
    T("bl2", "gearbox", "2kFallback", "无主之地2", "BL2", "Borderlands 2", 2012, 9, 8.9, "console+pc", "scifi", "shooter", pres=3, series="bl"),
    T("dota2", "valve", "valve", "DOTA2", "刀塔2", "Dota 2", 2012, 7, 9.1, "pc", "fantasy", "moba", land=True, pres=4, rtype="liveops", series="dota"),
    T("diablo3", "blizzard", "blizzard", "暗黑破坏神III", "暗黑3", "Diablo III", 2012, 5, 8.0, "pc+console", "fantasy", "arpg", land=True, pres=4, rtype="liveops", series="diablo"),
    T("gtav", "rockstar", "rockstar", "侠盗猎车手V", "GTA5", "Grand Theft Auto V", 2013, 9, 9.7, "console+pc", "urban", "openWorld", land=True, pres=5, series="gta"),
    T("tlou", "naughtyDog", "sony", "最后生还者", "美国末日", "The Last of Us", 2013, 6, 9.5, "console", "apocalypse", "action", land=True, pres=5, series="tlou"),
    T("bioshockInfinite", "irrational", "2kFallback", "生化奇兵：无限", "无限", "BioShock Infinite", 2013, 3, 9.4, "console+pc", "scifi", "shooter", land=True, pres=4, series="bioshock"),
    T("tombRaider2013", "crystalDynamics", "squareEnix", "古墓丽影（2013）", "劳拉重启", "Tomb Raider (2013)", 2013, 3, 8.6, "console+pc", "adventure", "action", pres=3, series="tombRaider"),
    T("pokemonXY", "gamefreak", "nintendo", "精灵宝可梦 X/Y", "XY", "Pokémon X/Y", 2013, 10, 8.7, "console", "fantasy", "rpg", pres=3, series="pokemon"),
    T("hearthstone", "blizzard", "blizzard", "炉石传说", "炉石", "Hearthstone", 2014, 3, 8.8, "pc+mobile", "fantasy", "cards", land=True, pres=4, rtype="liveops", series="hs"),
    T("destiny", "bungie", "activision", "命运", "命运1", "Destiny", 2014, 9, 7.6, "console", "scifi", "shooter", pres=3, rtype="liveops", series="destiny"),
    T("marioKart8", "nintendo", "nintendo", "马力欧卡丁车8", "MK8", "Mario Kart 8", 2014, 5, 9.1, "console", "cartoon", "racing", land=True, pres=4, series="mk"),
    T("honkai2", "mihoyo", "mihoyo", "崩坏学园2", "崩2", "Guns GirlZ", 2014, 3, 7.8, "mobile", "school", "arpg", pres=2, rtype="liveops", series="honkai"),
    T("bladeSoul", "ncsoft", "ncsoft", "剑灵", "剑灵", "Blade & Soul", 2012, 6, 8.0, "pc", "wuxia", "mmo", pres=3, rtype="liveops", series="bns"),
    T("bloodborne", "fromsoftware", "sony", "血源诅咒", "血源", "Bloodborne", 2015, 3, 9.2, "console", "horror", "arpg", land=True, pres=5, series="souls"),
    T("witcher3", "cdpr", "cdpr", "巫师3：狂猎", "巫师3", "The Witcher 3", 2015, 5, 9.3, "console+pc", "fantasy", "openWorld", land=True, pres=5, series="witcher"),
    T("mgsv", "konami", "konami", "合金装备V", "MGSV", "Metal Gear Solid V", 2015, 9, 8.6, "console+pc", "war", "stealth", land=True, pres=4, series="mgs"),
    T("fallout4", "bethesda", "bethesda", "辐射4", "辐射4", "Fallout 4", 2015, 11, 8.4, "console+pc", "apocalypse", "openWorld", pres=3, series="fallout"),
    T("hok", "tencent", "tencent", "王者荣耀", "王者", "Honor of Kings", 2015, 11, 8.0, "mobile", "myth", "moba", land=True, pres=5, rtype="liveops", series="hok"),
    T("overwatch", "blizzard", "blizzard", "守望先锋", "OW", "Overwatch", 2016, 5, 9.1, "console+pc", "scifi", "shooter", land=True, pres=5, rtype="liveops", series="ow"),
    T("uncharted4", "naughtyDog", "sony", "神秘海域4", "U4", "Uncharted 4", 2016, 5, 9.3, "console", "adventure", "action", land=True, pres=4, series="uncharted"),
    T("ds3", "fromsoftware", "fromsoftware", "黑暗之魂III", "黑魂3", "Dark Souls III", 2016, 3, 8.9, "console+pc", "fantasy", "arpg", land=True, pres=4, series="souls"),
    T("pokemonGo", "niantic", "niantic", "Pokémon GO", "POGO", "Pokémon GO", 2016, 7, 7.0, "mobile", "fantasy", "action", land=True, pres=5, rtype="liveops", series="pokemon"),
    T("onmyoji", "netease", "netease", "阴阳师", "阴阳师", "Onmyoji", 2016, 9, 8.1, "mobile", "myth", "rpg", land=True, pres=3, rtype="liveops", series="onmyoji"),
    T("honkai3", "mihoyo", "mihoyo", "崩坏3", "崩3", "Honkai Impact 3rd", 2016, 10, 8.3, "mobile", "mecha", "arpg", land=True, pres=3, rtype="liveops", series="honkai"),
    T("doom2016", "idsoftware", "bethesda", "毁灭战士（2016）", "新毁灭战士", "DOOM (2016)", 2016, 5, 8.5, "console+pc", "horror", "shooter", land=True, pres=4, series="doom"),
    T("botw", "nintendo", "nintendo", "塞尔达传说 旷野之息", "野炊", "Breath of the Wild", 2017, 3, 9.7, "console", "adventure", "openWorld", land=True, pres=5, series="zelda"),
    T("horizon", "guerilla", "sony", "地平线 零之曙光", "地平线1", "Horizon Zero Dawn", 2017, 2, 8.9, "console", "scifi", "openWorld", land=True, pres=4, series="horizon"),
    T("pubg", "krafton", "krafton", "绝地求生", "吃鸡", "PUBG", 2017, 12, 8.1, "pc+console", "war", "battleRoyale", land=True, pres=5, rtype="liveops", series="pubg"),
    T("odyssey", "nintendo", "nintendo", "超级马力欧 奥德赛", "奥德赛", "Super Mario Odyssey", 2017, 10, 9.7, "console", "cartoon", "platform", land=True, pres=5, series="mario"),
    T("nierAutomata", "platinum", "squareEnix", "尼尔：机械纪元", "尼尔2", "NieR: Automata", 2017, 3, 8.8, "console+pc", "apocalypse", "arpg", land=True, pres=4, series="nier"),
    T("fortnite", "epic", "epic", "堡垒之夜", "Fortnite", "Fortnite", 2017, 9, 8.0, "console+pc+mobile", "cartoon", "battleRoyale", land=True, pres=5, rtype="liveops", series="fortnite"),
    T("gow2018", "santaMonica", "sony", "战神（2018）", "战神4", "God of War (2018)", 2018, 4, 9.4, "console", "myth", "action", land=True, pres=5, series="gow"),
    T("rdr2", "rockstar", "rockstar", "荒野大镖客2", "救赎2", "Red Dead Redemption 2", 2018, 10, 9.7, "console+pc", "western", "openWorld", land=True, pres=5, series="rdr"),
    T("spiderman", "insomniac", "sony", "漫威蜘蛛侠", "蜘蛛侠", "Marvel's Spider-Man", 2018, 9, 8.7, "console", "superhero", "action", land=True, pres=4, series="spiderman"),
    T("mhw", "capcom", "capcom", "怪物猎人 世界", "世界", "Monster Hunter: World", 2018, 1, 9.0, "console+pc", "fantasy", "action", land=True, pres=4, series="mh"),
    T("identityV", "netease", "netease", "第五人格", "第五", "Identity V", 2018, 4, 7.8, "mobile", "horror", "action", pres=3, rtype="liveops", series="idv"),
    T("smashUltimate", "nintendo", "nintendo", "任天堂明星大乱斗 特别版", "究极乱斗", "Super Smash Bros. Ultimate", 2018, 12, 9.3, "console", "cartoon", "fighting", land=True, pres=4, series="smash"),
    T("sekiro", "fromsoftware", "fromsoftware", "只狼：影逝二度", "只狼", "Sekiro", 2019, 3, 9.0, "console+pc", "historical", "action", land=True, pres=5, series="sekiro"),
    T("apex", "respawn", "ea", "Apex英雄", "Apex", "Apex Legends", 2019, 2, 8.4, "console+pc", "scifi", "battleRoyale", land=True, pres=4, rtype="liveops", series="apex"),
    T("arknights", "hypergryph", "hypergryph", "明日方舟", "方舟", "Arknights", 2019, 5, 8.5, "mobile", "scifi", "towerDefense", land=True, pres=4, rtype="liveops", series="arknights"),
    T("control", "remedy", "remedy", "控制", "Control", "Control", 2019, 8, 8.3, "console+pc", "scifi", "action", pres=3, series="control"),
    T("peaceElite", "tencent", "tencent", "和平精英", "和平", "Game for Peace", 2019, 5, 7.6, "mobile", "war", "battleRoyale", pres=3, rtype="liveops", series="pubg"),
    T("deathStranding", "kojimaProductions", "sony", "死亡搁浅", "踩踩踩", "Death Stranding", 2019, 11, 8.2, "console+pc", "scifi", "action", land=True, pres=4, series="ds"),
    T("genshin", "mihoyo", "mihoyo", "原神", "原神", "Genshin Impact", 2020, 9, 8.4, "pc+console+mobile", "fantasy", "openWorld", land=True, pres=5, rtype="liveops", series="genshin"),
    T("acnh", "nintendo", "nintendo", "集合啦！动物森友会", "动森", "Animal Crossing: New Horizons", 2020, 3, 8.7, "console", "sliceOfLife", "sim", land=True, pres=5, series="ac"),
    T("tlou2", "naughtyDog", "sony", "最后生还者 第二部", "美国末日2", "The Last of Us Part II", 2020, 6, 9.3, "console", "apocalypse", "action", land=True, pres=5, series="tlou"),
    T("doomEternal", "idsoftware", "bethesda", "毁灭战士：永恒", "永恒", "DOOM Eternal", 2020, 3, 8.8, "console+pc", "horror", "shooter", land=True, pres=4, series="doom"),
    T("hades", "supergiant", "supergiant", "哈迪斯", "Hades", "Hades", 2020, 9, 9.3, "pc+console", "myth", "roguelike", land=True, pres=4, series="hades"),
    T("cyberpunk", "cdpr", "cdpr", "赛博朋克2077", "赛博朋克", "Cyberpunk 2077", 2020, 12, 7.0, "console+pc", "cyber", "openWorld", land=True, pres=5, series="cyberpunk"),
    T("ff7r", "squareEnix", "squareEnix", "最终幻想VII 重制版", "FF7R", "Final Fantasy VII Remake", 2020, 4, 8.9, "console", "scifi", "arpg", land=True, pres=4, series="ff"),
    T("valorant", "riot", "riot", "无畏契约", "Valorant", "Valorant", 2020, 6, 8.2, "pc", "scifi", "shooter", land=True, pres=4, rtype="liveops", series="valorant"),
    T("itTakesTwo", "hazelight", "ea", "双人成行", "双人成行", "It Takes Two", 2021, 3, 8.8, "console+pc", "comedy", "platform", land=True, pres=4, series="itt"),
    T("reVillage", "capcom", "capcom", "生化危机 村庄", "生化8", "Resident Evil Village", 2021, 5, 8.4, "console+pc", "horror", "survival", pres=3, series="re"),
    T("metroidDread", "nintendo", "nintendo", "密特罗德 生存恐惧", "恐惧", "Metroid Dread", 2021, 10, 8.8, "console", "scifi", "metroidvania", land=True, pres=3, series="metroid"),
    T("fh5", "playground", "xbox", "极限竞速：地平线5", "地平线5", "Forza Horizon 5", 2021, 11, 9.2, "console+pc", "sports", "racing", land=True, pres=4, series="forza"),
    T("naraka", "netease", "netease", "永劫无间", "永劫", "Naraka: Bladepoint", 2021, 8, 8.0, "pc+console", "wuxia", "battleRoyale", pres=3, rtype="liveops", series="naraka"),
    T("eldenRing", "fromsoftware", "fromsoftware", "艾尔登法环", "法环", "Elden Ring", 2022, 2, 9.6, "console+pc", "fantasy", "openWorld", land=True, pres=5, series="souls"),
    T("gowRagnarok", "santaMonica", "sony", "战神 诸神黄昏", "诸神黄昏", "God of War Ragnarök", 2022, 11, 9.4, "console", "myth", "action", land=True, pres=5, series="gow"),
    T("splatoon3", "nintendo", "nintendo", "斯普拉遁3", "喷喷3", "Splatoon 3", 2022, 9, 8.4, "console", "cartoon", "shooter", pres=3, rtype="liveops", series="splatoon"),
    T("diabloImmortal", "blizzard", "netease", "暗黑破坏神 不朽", "不朽", "Diablo Immortal", 2022, 6, 5.8, "mobile+pc", "fantasy", "arpg", pres=2, rtype="liveops", series="diablo"),
    T("pokemonSV", "gamefreak", "nintendo", "精灵宝可梦 朱/紫", "朱紫", "Pokémon Scarlet/Violet", 2022, 11, 7.2, "console", "fantasy", "rpg", pres=3, series="pokemon"),
    T("bg3", "larian", "larian", "博德之门3", "BG3", "Baldur's Gate 3", 2023, 8, 9.6, "console+pc", "fantasy", "rpg", land=True, pres=5, series="bg"),
    T("starRail", "mihoyo", "mihoyo", "崩坏：星穹铁道", "星铁", "Honkai: Star Rail", 2023, 4, 8.6, "pc+console+mobile", "scifi", "rpg", land=True, pres=4, rtype="liveops", series="hsr"),
    T("totk", "nintendo", "nintendo", "塞尔达传说 王国之泪", "王泪", "Tears of the Kingdom", 2023, 5, 9.6, "console", "adventure", "openWorld", land=True, pres=5, series="zelda"),
    T("spiderman2", "insomniac", "sony", "漫威蜘蛛侠2", "蜘蛛侠2", "Marvel's Spider-Man 2", 2023, 10, 8.7, "console", "superhero", "action", land=True, pres=4, series="spiderman"),
    T("alanWake2", "remedy", "remedy", "心灵杀手2", "AW2", "Alan Wake 2", 2023, 10, 8.9, "console+pc", "horror", "survival", land=True, pres=4, series="aw"),
    T("diablo4", "blizzard", "blizzard", "暗黑破坏神IV", "暗黑4", "Diablo IV", 2023, 6, 8.6, "console+pc", "fantasy", "arpg", pres=3, rtype="liveops", series="diablo"),
    T("wukong", "gamescience", "gamescience", "黑神话：悟空", "悟空", "Black Myth: Wukong", 2024, 8, 8.4, "console+pc", "myth", "action", land=True, pres=5, series="wukong"),
    T("wuwa", "kuro", "kuro", "鸣潮", "鸣潮", "Wuthering Waves", 2024, 5, 7.8, "pc+console+mobile", "scifi", "openWorld", land=True, pres=3, rtype="liveops", series="wuwa"),
    T("zzz", "mihoyo", "mihoyo", "绝区零", "绝区零", "Zenless Zone Zero", 2024, 7, 8.2, "pc+console+mobile", "urban", "arpg", land=True, pres=4, rtype="liveops", series="zzz"),
    T("astroBot", "teamAsobi", "sony", "宇宙机器人", "Astro", "Astro Bot", 2024, 9, 9.3, "console", "cartoon", "platform", land=True, pres=4, series="astro"),
    T("palworld", "pocketpair", "pocketpair", "幻兽帕鲁", "帕鲁", "Palworld", 2024, 1, 8.0, "pc+console", "cartoon", "survival", land=True, pres=4, rtype="liveops", series="palworld"),
    T("ff7rebirth", "squareEnix", "squareEnix", "最终幻想VII 重生", "Rebirth", "Final Fantasy VII Rebirth", 2024, 2, 9.2, "console", "scifi", "arpg", land=True, pres=4, series="ff"),
    T("mhWilds", "capcom", "capcom", "怪物猎人 荒野", "荒野", "Monster Hunter Wilds", 2025, 2, 8.6, "console+pc", "fantasy", "action", land=True, pres=4, series="mh"),
    T("kcd2", "warhorse", "warhorse", "天国：拯救2", "KCD2", "Kingdom Come: Deliverance II", 2025, 2, 8.9, "console+pc", "historical", "rpg", land=True, pres=4, series="kcd"),
    T("nightreign", "fromsoftware", "fromsoftware", "艾尔登法环 黑夜君临", "黑夜君临", "Elden Ring Nightreign", 2025, 5, 7.8, "console+pc", "fantasy", "arpg", pres=3, series="souls"),
    T("splitFiction", "hazelight", "ea", "双人成行：分分合合", "分分合合", "Split Fiction", 2025, 3, 8.7, "console+pc", "scifi", "platform", land=True, pres=3, series="itt"),
    T("ds2", "kojimaProductions", "sony", "死亡搁浅2", "DS2", "Death Stranding 2", 2025, 6, 8.5, "console", "scifi", "action", land=True, pres=4, series="ds"),
    T("stellarBlade", "shiftUp", "sony", "剑星", "剑星", "Stellar Blade", 2025, 4, 8.3, "console", "scifi", "action", land=True, pres=3, series="stellar"),
]

# 可入职公司加中小作，缩短空窗；不可入职厂用后面 pad 撑每年发售密度。
TITLES.extend([
    T("dkc2", "nintendo", "nintendo", "大金刚国度2", "DKC2", "Donkey Kong Country 2", 1995, 11, 8.9, "console", "cartoon", "platform", pres=3, series="dkc"),
    T("tekken2", "namco", "namco", "铁拳2", "铁拳2", "Tekken 2", 1995, 8, 8.6, "console", "urban", "fighting", pres=3, series="tekken"),
    T("panzerDragoon", "sega", "sega", "飞龙神枪", "飞龙", "Panzer Dragoon", 1995, 3, 8.2, "console", "scifi", "shooter", pres=2, series="panzer"),
    T("sfAlpha", "capcom", "capcom", "街头霸王 零", "ZERO", "Street Fighter Alpha", 1995, 6, 8.4, "console", "urban", "fighting", pres=3, series="sf"),
    T("twistedMetal", "sony", "sony", "扭曲金属", "TM", "Twisted Metal", 1995, 11, 8.0, "console", "urban", "action", pres=2, series="tm"),
    T("earthwormJim2", "interplayFallback", "interplayFallback", "蚯蚓吉姆2", "吉姆2", "Earthworm Jim 2", 1995, 11, 8.1, "console", "cartoon", "platform", pres=2),
    T("virtuaFighter2", "sega", "sega", "VR战士2", "VF2", "Virtua Fighter 2", 1995, 12, 8.5, "console", "urban", "fighting", pres=3, series="vf"),
    T("marioKart64", "nintendo", "nintendo", "马力欧卡丁车64", "MK64", "Mario Kart 64", 1996, 12, 8.7, "console", "cartoon", "racing", pres=3, series="mk"),
    T("waveRace", "nintendo", "nintendo", "波面赛车", "WaveRace", "Wave Race 64", 1996, 9, 8.4, "console", "sports", "racing", pres=2),
    T("nights", "sega", "sega", "NiGHTS", "NiGHTS", "NiGHTS into Dreams", 1996, 7, 8.5, "console", "fantasy", "action", pres=3),
    T("soulBlade", "namco", "namco", "剑魂", "SoulBlade", "Soul Edge", 1996, 12, 8.3, "console", "historical", "fighting", pres=2, series="soulcalibur"),
    T("ff6", "square", "square", "最终幻想VI", "FF6", "Final Fantasy VI", 1995, 4, 9.2, "console", "fantasy", "rpg", land=True, pres=4, series="ff"),
    T("chronoCross", "square", "square", "穿越时空", "时十", "Chrono Cross", 1999, 11, 8.8, "console", "fantasy", "rpg", pres=3, series="chrono"),
    T("ff8", "square", "square", "最终幻想VIII", "FF8", "Final Fantasy VIII", 1999, 2, 8.9, "console", "scifi", "rpg", pres=4, series="ff"),
    T("ff9", "square", "square", "最终幻想IX", "FF9", "Final Fantasy IX", 2000, 7, 9.0, "console", "fantasy", "rpg", pres=4, series="ff"),
    T("ff10", "square", "square", "最终幻想X", "FF10", "Final Fantasy X", 2001, 7, 9.0, "console", "fantasy", "rpg", land=True, pres=4, series="ff"),
    T("dmc1", "capcom", "capcom", "鬼泣", "DMC1", "Devil May Cry", 2001, 8, 8.7, "console", "horror", "action", land=True, pres=4, series="dmc"),
    T("mh1", "capcom", "capcom", "怪物猎人", "MH1", "Monster Hunter", 2004, 3, 8.0, "console", "fantasy", "action", pres=3, series="mh"),
    T("sf3", "capcom", "capcom", "街头霸王III", "SF3", "Street Fighter III", 1997, 6, 8.6, "console", "urban", "fighting", pres=3, series="sf"),
    T("crash2", "naughtyDog", "sony", "古惑狼2", "Crash2", "Crash Bandicoot 2", 1997, 10, 8.5, "console", "cartoon", "platform", pres=3, series="crash"),
    T("crash3", "naughtyDog", "sony", "古惑狼3", "Crash3", "Crash Bandicoot 3", 1998, 10, 8.6, "console", "cartoon", "platform", pres=3, series="crash"),
    T("spyro", "insomniac", "sony", "史派罗", "史派罗", "Spyro the Dragon", 1998, 9, 8.3, "console", "fantasy", "platform", pres=3, series="spyro"),
    T("thps2", "neversoft", "activision", "托尼霍克职业滑板2", "THPS2", "Tony Hawk's Pro Skater 2", 2000, 9, 8.8, "console", "sports", "sportsGame", pres=3, series="thps"),
    T("jak1", "naughtyDog", "sony", "杰克与达斯特", "Jak1", "Jak and Daxter", 2001, 12, 8.6, "console", "cartoon", "platform", pres=3, series="jak"),
    T("socom", "sony", "sony", "SOCOM", "SOCOM", "SOCOM: U.S. Navy SEALs", 2002, 8, 8.2, "console", "war", "shooter", pres=2),
    T("kh2", "squareEnix", "squareEnix", "王国之心II", "KH2", "Kingdom Hearts II", 2005, 12, 8.8, "console", "cartoon", "arpg", pres=4, series="kh"),
    T("ff12", "squareEnix", "squareEnix", "最终幻想XII", "FF12", "Final Fantasy XII", 2006, 3, 8.7, "console", "fantasy", "rpg", pres=3, series="ff"),
    T("ff13", "squareEnix", "squareEnix", "最终幻想XIII", "FF13", "Final Fantasy XIII", 2009, 12, 8.0, "console", "scifi", "rpg", pres=3, series="ff"),
    T("marioSunshine", "nintendo", "nintendo", "超级马力欧阳光", "阳光", "Super Mario Sunshine", 2002, 7, 8.5, "console", "cartoon", "platform", pres=3, series="mario"),
    T("pikmin", "nintendo", "nintendo", "皮克敏", "皮克敏1", "Pikmin", 2001, 10, 8.6, "console", "cartoon", "strategy", pres=3, series="pikmin"),
    T("animalCrossing", "nintendo", "nintendo", "动物森友会", "动森初代", "Animal Crossing", 2001, 4, 8.4, "console", "sliceOfLife", "sim", pres=3, series="acnh"),
    T("paperMario", "nintendo", "nintendo", "纸片马力欧", "纸片", "Paper Mario", 2000, 8, 8.8, "console", "cartoon", "rpg", pres=3, series="paperMario"),
    T("twilightPrincess", "nintendo", "nintendo", "塞尔达传说 黄昏公主", "黄昏", "Twilight Princess", 2006, 11, 9.2, "console", "adventure", "action", land=True, pres=4, series="zelda"),
    T("skywardSword", "nintendo", "nintendo", "塞尔达传说 天空之剑", "天空", "Skyward Sword", 2011, 11, 8.4, "console", "adventure", "action", pres=3, series="zelda"),
    T("smashWiiU", "nintendo", "nintendo", "任天堂明星大乱斗 WiiU", "Smash4", "Super Smash Bros. for Wii U", 2014, 11, 8.8, "console", "cartoon", "fighting", pres=3, series="smash"),
    T("splatoon", "nintendo", "nintendo", "斯普拉遁", "喷喷", "Splatoon", 2015, 5, 8.6, "console", "cartoon", "shooter", land=True, pres=4, series="splatoon"),
    T("marioKart8", "nintendo", "nintendo", "马力欧卡丁车8", "MK8", "Mario Kart 8", 2014, 5, 8.9, "console", "cartoon", "racing", pres=3, series="mk"),
    T("bayonetta", "platinum", "sega", "猎天使魔女", "Bayo", "Bayonetta", 2009, 10, 8.7, "console", "urban", "action", land=True, pres=4, series="bayonetta"),
    T("vanquish", "platinum", "sega", "迸发", "Vanquish", "Vanquish", 2010, 10, 8.4, "console", "scifi", "shooter", pres=3),
    T("nier", "squareEnix", "squareEnix", "尼尔", "尼尔1", "NieR", 2010, 4, 8.0, "console", "scifi", "arpg", pres=3, series="nier"),
    T("dq8", "squareEnix", "squareEnix", "勇者斗恶龙VIII", "DQ8", "Dragon Quest VIII", 2004, 11, 8.8, "console", "fantasy", "rpg", pres=4, series="dq"),
    T("dq11", "squareEnix", "squareEnix", "勇者斗恶龙XI", "DQ11", "Dragon Quest XI", 2017, 7, 8.7, "console+pc", "fantasy", "rpg", pres=3, series="dq"),
    T("persona3", "atlus", "atlus", "女神异闻录3", "P3", "Persona 3", 2006, 7, 8.6, "console", "school", "rpg", land=True, pres=4, series="persona"),
    T("persona4", "atlus", "atlus", "女神异闻录4", "P4", "Persona 4", 2008, 7, 8.8, "console", "school", "rpg", land=True, pres=4, series="persona"),
    T("smt3", "atlus", "atlus", "真女神转生III", "Nocturne", "Shin Megami Tensei III", 2003, 2, 8.5, "console", "myth", "rpg", pres=3, series="smt"),
    T("ysOrigin", "falcom", "falcom", "伊苏：始源", "始源", "Ys Origin", 2006, 12, 8.1, "pc", "fantasy", "arpg", pres=2, series="ys"),
    T("ys8", "falcom", "falcom", "伊苏VIII", "伊苏8", "Ys VIII", 2016, 7, 8.3, "console+pc", "fantasy", "arpg", pres=3, series="ys"),
    T("trailsSky", "falcom", "falcom", "空之轨迹", "空轨", "Trails in the Sky", 2004, 6, 8.4, "pc", "fantasy", "rpg", pres=3, series="trails"),
    T("kof97", "snk", "snk", "拳皇97", "KOF97", "The King of Fighters '97", 1997, 7, 8.5, "console", "urban", "fighting", land=True, pres=3, series="kof"),
    T("kof98", "snk", "snk", "拳皇98", "KOF98", "The King of Fighters '98", 1998, 7, 8.7, "console", "urban", "fighting", pres=3, series="kof"),
    T("samsho2", "snk", "snk", "侍魂2", "侍2", "Samurai Shodown II", 1995, 2, 8.2, "console", "historical", "fighting", pres=2, series="samsho"),
    T("romance3", "koei", "koei", "三国志VII", "三7", "Romance of the Three Kingdoms VII", 2000, 1, 8.0, "pc", "historical", "strategy", pres=2, series="rotk"),
    T("nwb", "koei", "koei", "信长之野望 烈风传", "信长", "Nobunaga's Ambition", 1999, 3, 7.9, "pc", "historical", "strategy", pres=2),
    T("pokemonRuby", "gamefreak", "nintendo", "精灵宝可梦 红宝石/蓝宝石", "红蓝宝石", "Pokémon Ruby/Sapphire", 2002, 11, 8.4, "console", "fantasy", "rpg", pres=4, series="pokemon"),
    T("pokemonDp", "gamefreak", "nintendo", "精灵宝可梦 钻石/珍珠", "珍珠钻石", "Pokémon Diamond/Pearl", 2006, 9, 8.3, "console", "fantasy", "rpg", pres=3, series="pokemon"),
    T("pokemonBw", "gamefreak", "nintendo", "精灵宝可梦 黑/白", "黑白", "Pokémon Black/White", 2010, 9, 8.4, "console", "fantasy", "rpg", pres=3, series="pokemon"),
    T("pokemonXY", "gamefreak", "nintendo", "精灵宝可梦 X/Y", "XY", "Pokémon X/Y", 2013, 10, 8.2, "console", "fantasy", "rpg", pres=3, series="pokemon"),
    T("quake2", "idsoftware", "idsoftware", "雷神之锤2", "Q2", "Quake II", 1997, 12, 8.8, "pc", "scifi", "shooter", pres=4, series="quake"),
    T("doom3", "idsoftware", "idsoftware", "毁灭战士3", "Doom3", "Doom 3", 2004, 8, 8.5, "pc", "horror", "shooter", pres=3, series="doom"),
    T("rage", "idsoftware", "idsoftware", "狂怒", "Rage", "Rage", 2011, 10, 7.8, "pc+console", "apocalypse", "shooter", pres=2),
    T("haloOdst", "bungie", "xbox", "光环3：ODST", "ODST", "Halo 3: ODST", 2009, 9, 8.4, "console", "scifi", "shooter", pres=3, series="halo"),
    T("myth", "bungie", "bungie", "神话", "Myth", "Myth: The Fallen Lords", 1997, 11, 8.3, "pc", "fantasy", "tactics", pres=2),
    T("dungeonKeeper", "bullfrog", "ea", "地下城守护者", "DK", "Dungeon Keeper", 1997, 6, 8.6, "pc", "fantasy", "sim", pres=3),
    T("populous3", "bullfrog", "ea", "上帝也疯狂3", "Pop3", "Populous: The Beginning", 1998, 11, 8.2, "pc", "fantasy", "strategy", pres=2),
    T("nfs2", "ea", "ea", "极品飞车2", "NFS2", "Need for Speed II", 1997, 3, 8.0, "pc+console", "sports", "racing", pres=2, series="nfs"),
    T("ssx", "ea", "ea", "SSX", "SSX", "SSX", 2000, 10, 8.4, "console", "sports", "sportsGame", pres=2),
    T("fifa98", "ea", "ea", "FIFA 98", "FIFA98", "FIFA 98", 1997, 11, 8.1, "pc+console", "sports", "sportsGame", pres=2, series="fifa"),
    T("cod2", "infinityWard", "activision", "使命召唤2", "COD2", "Call of Duty 2", 2005, 10, 8.8, "pc+console", "war", "shooter", pres=3, series="cod"),
    T("codWaW", "infinityWard", "activision", "使命召唤：世界战争", "WaW", "Call of Duty: World at War", 2008, 11, 8.4, "console+pc", "war", "shooter", pres=3, series="cod"),
    T("prototype", "radical", "activision", "虐杀原形", "Prototype", "Prototype", 2009, 6, 8.0, "console+pc", "urban", "action", pres=2),
    T("starcraftBrood", "blizzard", "blizzard", "星际争霸：母巢之战", "母巢", "StarCraft: Brood War", 1998, 11, 9.2, "pc", "scifi", "rts", pres=4, series="starcraft"),
    T("wowTbc", "blizzard", "blizzard", "魔兽世界：燃烧的远征", "TBC", "World of Warcraft: The Burning Crusade", 2007, 1, 8.8, "pc", "fantasy", "mmo", pres=3, rtype="liveops", series="wow"),
    T("sc2Hots", "blizzard", "blizzard", "星际争霸II：虫群之心", "HotS", "StarCraft II: Heart of the Swarm", 2013, 3, 8.5, "pc", "scifi", "rts", pres=3, series="starcraft"),
    T("heroes3", "nwc", "threeDo", "英雄无敌III", "H3", "Heroes of Might and Magic III", 1999, 3, 9.0, "pc", "fantasy", "strategy", land=True, pres=4, series="homm"),
    T("mm7", "nwc", "threeDo", "魔法门VII", "MM7", "Might and Magic VII", 1999, 6, 8.1, "pc", "fantasy", "rpg", pres=2),
    T("age3", "ensemble", "ensemble", "帝国时代III", "帝国3", "Age of Empires III", 2005, 10, 8.3, "pc", "historical", "rts", pres=3, series="aoe"),
    T("haloWars", "ensemble", "xbox", "光环战争", "HaloWars", "Halo Wars", 2009, 2, 8.2, "console", "scifi", "rts", pres=2, series="halo"),
    T("re3", "capcom", "capcom", "生化危机3", "生化3", "Resident Evil 3", 1999, 9, 8.6, "console", "horror", "survival", pres=3, series="re"),
    T("re5", "capcom", "capcom", "生化危机5", "生化5", "Resident Evil 5", 2009, 3, 8.3, "console", "horror", "shooter", pres=3, series="re"),
    T("dmc3", "capcom", "capcom", "鬼泣3", "DMC3", "Devil May Cry 3", 2005, 2, 8.7, "console", "horror", "action", pres=4, series="dmc"),
    T("dmc4", "capcom", "capcom", "鬼泣4", "DMC4", "Devil May Cry 4", 2008, 1, 8.3, "console", "horror", "action", pres=3, series="dmc"),
    T("vsav", "capcom", "capcom", "恶魔战士", "VSav", "Vampire Savior", 1997, 5, 8.4, "console", "horror", "fighting", pres=2),
    T("mgsPw", "konami", "konami", "合金装备 和平行队", "PW", "Metal Gear Solid: Peace Walker", 2010, 4, 8.6, "console", "war", "stealth", pres=3, series="mgs"),
    T("sh3", "konami", "konami", "寂静岭3", "SH3", "Silent Hill 3", 2003, 5, 8.4, "console", "horror", "survival", pres=3, series="sh"),
    T("bemaniIidx", "konami", "konami", "beatmania IIDX", "IIDX", "beatmania IIDX", 1999, 2, 8.0, "console", "urban", "rhythm", pres=2),
    T("sotnDx", "konami", "konami", "恶魔城 晓月圆舞曲", "晓月", "Castlevania: Harmony of Dissonance", 2002, 6, 8.1, "console", "horror", "metroidvania", pres=2, series="castlevania"),
    T("ico", "teamIco", "sony", "ICO", "ICO", "ICO", 2001, 9, 8.8, "console", "adventure", "action", land=True, pres=4, series="ico"),
    T("gt2", "polyphony", "sony", "GT赛车2", "GT2", "Gran Turismo 2", 1999, 12, 9.0, "console", "sports", "racing", pres=3, series="gt"),
    T("gt3", "polyphony", "sony", "GT赛车3", "GT3", "Gran Turismo 3", 2001, 4, 9.1, "console", "sports", "racing", pres=3, series="gt"),
    T("gt4", "polyphony", "sony", "GT赛车4", "GT4", "Gran Turismo 4", 2004, 12, 8.9, "console", "sports", "racing", pres=3, series="gt"),
    T("wipeout2097", "sony", "sony", "Wipeout 2097", "W2097", "WipEout 2097", 1996, 9, 8.6, "console", "scifi", "racing", pres=3, series="wipeout"),
    T("apeEscape", "sony", "sony", "捉猴啦", "捉猴", "Ape Escape", 1999, 6, 8.2, "console", "cartoon", "platform", pres=2),
    T("pal2", "softstar", "softstar", "仙剑奇侠传二", "仙剑二", "Chinese Paladin 2", 2003, 1, 7.6, "pc", "wuxia", "rpg", pres=2, series="pal"),
    T("pal4", "softstar", "softstar", "仙剑奇侠传四", "仙剑四", "Chinese Paladin 4", 2007, 8, 8.1, "pc", "wuxia", "rpg", pres=3, series="pal"),
    T("pal5", "softstar", "softstar", "仙剑奇侠传五", "仙剑五", "Chinese Paladin 5", 2011, 1, 7.8, "pc", "wuxia", "rpg", pres=2, series="pal"),
    T("xuanyuan", "softstar", "softstar", "轩辕剑叁", "轩3", "Xuanyuan Sword 3", 1999, 12, 8.2, "pc", "wuxia", "rpg", pres=3, series="xuanyuan"),
    T("jx2", "kingsoft", "kingsoft", "剑侠情缘二", "剑侠二", "JX2", 2002, 1, 7.9, "pc", "wuxia", "rpg", pres=2, series="jx"),
    T("csbox", "kingsoft", "kingsoft", "封神榜", "封神", "Fengshenbang", 2004, 7, 7.5, "pc", "myth", "mmo", pres=2, rtype="liveops"),
    T("chibi2", "pioneer", "pioneer", "官渡", "前导官渡", "Guandu", 1996, 12, 7.4, "pc", "historical", "strategy", pres=2),
    T("richman4", "softstar", "softstar", "大富翁4", "富4", "Richman 4", 1998, 1, 7.8, "pc", "sliceOfLife", "sim", pres=2, series="richman"),
    T("richman7", "softstar", "softstar", "大富翁7", "富7", "Richman 7", 2003, 12, 7.6, "pc", "sliceOfLife", "sim", pres=2, series="richman"),
    T("wowClassicLike", "netease", "netease", "大话西游", "大话", "Fantasy Westward Journey Classic", 2002, 8, 8.0, "pc", "xianxia", "mmo", pres=3, rtype="liveops"),
    T("ty2", "netease", "netease", "大唐无双", "大唐", "Datang Wushuang", 2010, 6, 7.5, "pc", "historical", "mmo", pres=2, rtype="liveops"),
    T("qnzj", "netease", "netease", "倩女幽魂", "倩女", "Justice", 2011, 4, 7.8, "pc", "wuxia", "mmo", pres=2, rtype="liveops"),
    T("dnfDuel", "nexon", "nexon", "地下城与勇士 格斗", "DNFDuel", "DNF Duel", 2022, 6, 7.6, "console+pc", "fantasy", "fighting", pres=2, series="dnf"),
    T("maplestory", "nexon", "nexon", "冒险岛", "冒险岛", "MapleStory", 2003, 4, 8.0, "pc", "cartoon", "mmo", land=True, pres=3, rtype="liveops", series="maple"),
    T("kartrider", "nexon", "nexon", "跑跑卡丁车", "跑跑", "KartRider", 2004, 6, 7.7, "pc", "cartoon", "racing", pres=2, rtype="liveops"),
    T("aion", "ncsoft", "ncsoft", "永恒之塔", "Aion", "Aion", 2008, 11, 8.0, "pc", "fantasy", "mmo", pres=3, rtype="liveops"),
    T("bns", "ncsoft", "ncsoft", "剑灵", "剑灵", "Blade & Soul", 2012, 6, 8.1, "pc", "wuxia", "mmo", pres=3, rtype="liveops"),
    T("lineage2", "ncsoft", "ncsoft", "天堂II", "天堂2", "Lineage II", 2003, 10, 8.2, "pc", "fantasy", "mmo", pres=3, rtype="liveops"),
    T("lostark", "smilegate", "smilegate", "失落的方舟", "LOA", "Lost Ark", 2019, 11, 8.3, "pc", "fantasy", "arpg", pres=3, rtype="liveops"),
    T("inFamous", "sony", "sony", "恶名昭彰", "inFamous", "inFamous", 2009, 5, 8.3, "console", "urban", "action", pres=3),
    T("killzone2", "guerilla", "sony", "杀戮地带2", "KZ2", "Killzone 2", 2009, 2, 8.4, "console", "scifi", "shooter", pres=3, series="kz"),
    T("horizonFw", "guerilla", "sony", "地平线 西之绝境", "西绝", "Horizon Forbidden West", 2022, 2, 8.6, "console", "scifi", "openWorld", pres=3, series="horizon"),
    T("ratchet2", "insomniac", "sony", "瑞奇与叮当2", "Ratchet2", "Ratchet & Clank 2", 2003, 11, 8.4, "console", "cartoon", "platform", pres=3, series="ratchet"),
    T("resistance", "insomniac", "sony", "抵抗黎明", "Resistance", "Resistance: Fall of Man", 2006, 11, 8.3, "console", "scifi", "shooter", pres=3),
    T("gow2", "santaMonica", "sony", "战神2", "战神2", "God of War II", 2007, 3, 9.1, "console", "myth", "action", pres=4, series="gow"),
    T("gow3", "santaMonica", "sony", "战神3", "战神3", "God of War III", 2010, 3, 9.0, "console", "myth", "action", pres=4, series="gow"),
    T("gowAscension", "santaMonica", "sony", "战神：升天", "升天", "God of War: Ascension", 2013, 3, 8.0, "console", "myth", "action", pres=2, series="gow"),
    T("tlouLeft", "naughtyDog", "sony", "最后生还者：遗落", "遗落", "The Last of Us: Left Behind", 2014, 2, 8.5, "console", "apocalypse", "action", pres=2, series="tlou"),
    T("uncharted3", "naughtyDog", "sony", "神秘海域3", "U3", "Uncharted 3", 2011, 11, 8.9, "console", "adventure", "action", pres=4, series="uncharted"),
    T("unchartedLost", "naughtyDog", "sony", "神秘海域：失落遗产", "遗产", "Uncharted: The Lost Legacy", 2017, 8, 8.4, "console", "adventure", "action", pres=2, series="uncharted"),
    T("lastGuardian", "teamIco", "sony", "最后的守护者", "守护者", "The Last Guardian", 2016, 12, 8.1, "console", "adventure", "action", pres=3, series="ico"),
    T("bloodborne", "fromsoftware", "sony", "血源诅咒", "血源", "Bloodborne", 2015, 3, 9.2, "console", "horror", "arpg", land=True, pres=5, series="souls"),
    T("ds2souls", "fromsoftware", "fromsoftware", "黑暗之魂II", "魂2", "Dark Souls II", 2014, 3, 8.4, "console+pc", "fantasy", "arpg", pres=3, series="souls"),
    T("ac3", "ubisoft", "ubisoft", "刺客信条III", "AC3", "Assassin's Creed III", 2012, 10, 8.0, "console+pc", "historical", "action", pres=3, series="ac"),
    T("acBlackFlag", "ubisoft", "ubisoft", "刺客信条IV：黑旗", "黑旗", "Assassin's Creed IV", 2013, 10, 8.5, "console+pc", "historical", "action", pres=3, series="ac"),
    T("fc3", "ubisoft", "ubisoft", "孤岛惊魂3", "FC3", "Far Cry 3", 2012, 11, 8.6, "console+pc", "adventure", "shooter", pres=3, series="fc"),
    T("fc4", "ubisoft", "ubisoft", "孤岛惊魂4", "FC4", "Far Cry 4", 2014, 11, 8.2, "console+pc", "adventure", "shooter", pres=2, series="fc"),
    T("r6siege", "ubisoft", "ubisoft", "彩虹六号：围攻", "R6", "Rainbow Six Siege", 2015, 12, 8.3, "console+pc", "war", "shooter", pres=3, rtype="liveops"),
    T("divinity2", "larian", "larian", "神界原罪", "OS1", "Divinity: Original Sin", 2014, 6, 8.6, "pc", "fantasy", "rpg", pres=3, series="divinity"),
    T("dos2", "larian", "larian", "神界原罪2", "OS2", "Divinity: Original Sin 2", 2017, 9, 9.2, "pc+console", "fantasy", "rpg", land=True, pres=4, series="divinity"),
    T("tw2", "cdpr", "cdpr", "巫师2", "巫师2", "The Witcher 2", 2011, 5, 8.5, "pc", "fantasy", "arpg", pres=3, series="witcher"),
    T("cp2077Phantom", "cdpr", "cdpr", "赛博朋克2077：往日之影", "往日", "Phantom Liberty", 2023, 9, 8.6, "pc+console", "cyber", "rpg", pres=3, series="cyberpunk"),
    T("tes4dlc", "bethesda", "bethesda", "上古卷轴IV：战栗孤岛", "孤岛", "The Shivering Isles", 2007, 3, 8.2, "pc+console", "fantasy", "openWorld", pres=2, series="tes"),
    T("foNV", "obsidian", "bethesda", "辐射：新维加斯", "NV", "Fallout: New Vegas", 2010, 10, 8.6, "pc+console", "apocalypse", "rpg", land=True, pres=4, series="fallout"),
    T("dishonored", "arkane", "bethesda", "羞辱", "Dishonored", "Dishonored", 2012, 10, 8.9, "pc+console", "urban", "stealth", land=True, pres=4),
    T("prey2017", "arkane", "bethesda", "Prey", "Prey", "Prey", 2017, 5, 8.4, "pc+console", "scifi", "shooter", pres=3),
    T("civ5", "firaxis", "2kFallback", "文明V", "文明5", "Civilization V", 2010, 9, 8.8, "pc", "historical", "strategy", pres=4, series="civ"),
    T("xcom", "firaxis", "2kFallback", "XCOM：未知敌人", "XCOM", "XCOM: Enemy Unknown", 2012, 10, 8.8, "pc+console", "scifi", "tactics", land=True, pres=4, series="xcom"),
    T("xcom2", "firaxis", "2kFallback", "XCOM 2", "XCOM2", "XCOM 2", 2016, 2, 8.7, "pc", "scifi", "tactics", pres=3, series="xcom"),
    T("borderlands", "gearbox", "2kFallback", "无主之地", "BL1", "Borderlands", 2009, 10, 8.3, "console+pc", "scifi", "shooter", pres=3, series="bl"),
    T("bl2", "gearbox", "2kFallback", "无主之地2", "BL2", "Borderlands 2", 2012, 9, 8.6, "console+pc", "scifi", "shooter", pres=3, series="bl"),
    T("alice", "ea", "ea", "美国麦吉的爱丽丝", "爱丽丝", "American McGee's Alice", 2000, 12, 8.2, "pc", "horror", "action", pres=2),
    T("deadSpace", "ea", "ea", "死亡空间", "DS", "Dead Space", 2008, 10, 8.6, "console+pc", "horror", "survival", land=True, pres=4),
    T("deadSpace2", "ea", "ea", "死亡空间2", "DS2", "Dead Space 2", 2011, 1, 8.6, "console+pc", "horror", "survival", pres=3),
    T("crysis", "crytek", "ea", "孤岛危机", "Crysis", "Crysis", 2007, 11, 8.5, "pc", "scifi", "shooter", land=True, pres=4),
    T("bf2", "dice", "ea", "战地2", "BF2", "Battlefield 2", 2005, 6, 8.7, "pc", "war", "shooter", pres=3, series="bf"),
    T("bf3", "dice", "ea", "战地3", "BF3", "Battlefield 3", 2011, 10, 8.6, "console+pc", "war", "shooter", pres=3, series="bf"),
    T("bf1", "dice", "ea", "战地1", "BF1", "Battlefield 1", 2016, 10, 8.5, "console+pc", "war", "shooter", pres=3, series="bf"),
    T("theSims2", "maxis", "ea", "模拟人生2", "SIMS2", "The Sims 2", 2004, 9, 8.8, "pc", "sliceOfLife", "sim", pres=4, series="sims"),
    T("theSims3", "maxis", "ea", "模拟人生3", "SIMS3", "The Sims 3", 2009, 6, 8.4, "pc", "sliceOfLife", "sim", pres=3, series="sims"),
    T("theSims4", "maxis", "ea", "模拟人生4", "SIMS4", "The Sims 4", 2014, 9, 7.6, "pc", "sliceOfLife", "sim", pres=2, series="sims", rtype="liveops"),
    T("spore", "maxis", "ea", "孢子", "Spore", "Spore", 2008, 9, 7.8, "pc", "scifi", "sim", pres=3),
    T("simcity4", "maxis", "ea", "模拟城市4", "SC4", "SimCity 4", 2003, 1, 8.5, "pc", "urban", "sim", pres=3, series="simcity"),
    T("wowWotlk", "blizzard", "blizzard", "巫妖王之怒", "WLK", "Wrath of the Lich King", 2008, 11, 9.0, "pc", "fantasy", "mmo", pres=4, rtype="liveops", series="wow"),
    T("hots", "blizzard", "blizzard", "风暴英雄", "HotS", "Heroes of the Storm", 2015, 6, 7.8, "pc", "fantasy", "moba", pres=2, rtype="liveops"),
    T("scLegacy", "blizzard", "blizzard", "星际争霸：重制版", "Remastered", "StarCraft Remastered", 2017, 8, 8.0, "pc", "scifi", "rts", pres=2, series="starcraft"),
    T("diablo3Ros", "blizzard", "blizzard", "暗黑破坏神III：夺魂之镰", "ROS", "Reaper of Souls", 2014, 3, 8.4, "pc+console", "fantasy", "arpg", pres=3, series="diablo"),
    T("codMw2019", "infinityWard", "activision", "使命召唤：现代战争", "MW19", "Modern Warfare 2019", 2019, 10, 8.2, "console+pc", "war", "shooter", pres=3, series="cod"),
    T("codMw2r", "infinityWard", "activision", "使命召唤：现代战争II", "MWII", "Modern Warfare II", 2022, 10, 7.8, "console+pc", "war", "shooter", pres=2, series="cod"),
    T("crash4", "toysForBob", "activision", "古惑狼4", "Crash4", "Crash Bandicoot 4", 2020, 10, 8.4, "console+pc", "cartoon", "platform", pres=3, series="crash"),
    T("spyroReignited", "toysForBob", "activision", "史派罗重制", "Reignited", "Spyro Reignited Trilogy", 2018, 11, 8.2, "console+pc", "fantasy", "platform", pres=2, series="spyro"),
    T("wowShadow", "blizzard", "blizzard", "暗影国度", "SL", "Shadowlands", 2020, 11, 7.4, "pc", "fantasy", "mmo", pres=2, rtype="liveops", series="wow"),
    T("wowDf", "blizzard", "blizzard", "巨龙时代", "DF", "Dragonflight", 2022, 11, 8.0, "pc", "fantasy", "mmo", pres=2, rtype="liveops", series="wow"),
    T("genshinFontaine", "mihoyo", "mihoyo", "原神：枫丹", "枫丹", "Genshin Fontaine", 2023, 8, 8.4, "pc+mobile", "fantasy", "openWorld", pres=3, rtype="liveops", series="genshin"),
    T("hi3part2", "mihoyo", "mihoyo", "崩坏3：后崩坏书", "后崩", "Honkai Impact Part 2", 2024, 2, 8.0, "pc+mobile", "scifi", "action", pres=2, rtype="liveops", series="hi3"),
    T("zzz1", "mihoyo", "mihoyo", "绝区零", "ZZZ", "Zenless Zone Zero", 2024, 7, 8.2, "pc+mobile", "urban", "action", pres=3, rtype="liveops"),
    T("pgr", "kuro", "kuro", "战双帕弥什", "战双", "Punishing: Gray Raven", 2019, 12, 8.0, "mobile", "scifi", "action", pres=3, rtype="liveops"),
    T("wuthering", "kuro", "kuro", "鸣潮", "鸣潮", "Wuthering Waves", 2024, 5, 8.1, "pc+mobile", "scifi", "action", pres=3, rtype="liveops"),
    T("nsh", "netease", "netease", "逆水寒", "逆水寒", "Justice Online", 2018, 6, 8.0, "pc", "wuxia", "mmo", pres=3, rtype="liveops"),
    T("eggy", "netease", "netease", "蛋仔派对", "蛋仔", "Eggy Party", 2022, 7, 7.6, "mobile", "cartoon", "platform", pres=2, rtype="liveops"),
    T("identityV2", "netease", "netease", "第五人格：庄园", "五人", "Identity V", 2018, 4, 7.8, "mobile", "horror", "action", pres=2, rtype="liveops"),
    T("hokChess", "tencent", "tencent", "王者荣耀：星之破晓", "星之破晓", "Honor of Kings World", 2024, 3, 7.5, "mobile", "fantasy", "moba", pres=2),
    T("dnfM", "nexon", "tencent", "地下城与勇士：起源", "DNFM", "DNF Mobile", 2023, 12, 7.7, "mobile", "fantasy", "arpg", pres=2, rtype="liveops", series="dnf"),
    T("valheim", "ironGate", "ironGate", "英灵神殿", "Valheim", "Valheim", 2021, 2, 8.5, "pc", "myth", "survival", pres=3),
    T("phasmo", "kinetic", "kinetic", "恐鬼症", "Phasmo", "Phasmophobia", 2020, 9, 8.2, "pc", "horror", "sim", pres=2),
    T("amongUs", "innersloth", "innersloth", "Among Us", "太空狼杀", "Among Us", 2018, 6, 8.0, "pc+mobile", "scifi", "sim", pres=3),
    T("fallGuys", "mediatonic", "epic", "糖豆人", "糖豆", "Fall Guys", 2020, 8, 8.0, "pc+console", "cartoon", "platform", pres=3, rtype="liveops"),
    T("rocketLeague", "psyonix", "psyonix", "火箭联盟", "RL", "Rocket League", 2015, 7, 8.5, "pc+console", "sports", "sportsGame", land=True, pres=3, rtype="liveops"),
    T("hades2", "supergiant", "supergiant", "哈迪斯2", "Hades2", "Hades II", 2024, 5, 8.8, "pc", "myth", "roguelike", pres=4, series="hades"),
    T("bastion", "supergiant", "supergiant", "堡垒", "Bastion", "Bastion", 2011, 7, 8.6, "pc", "fantasy", "action", pres=3),
    T("transistor", "supergiant", "supergiant", "晶体管", "Transistor", "Transistor", 2014, 5, 8.5, "pc", "scifi", "action", pres=3),
    T("pyre", "supergiant", "supergiant", "Pyre", "Pyre", "Pyre", 2017, 7, 8.2, "pc", "fantasy", "sportsGame", pres=2),
    T("journey", "tgc", "sony", "风之旅人", "Journey", "Journey", 2012, 3, 9.0, "console", "adventure", "action", land=True, pres=4),
    T("sky", "tgc", "tgc", "光·遇", "光遇", "Sky", 2019, 7, 8.2, "mobile", "adventure", "action", pres=3, rtype="liveops"),
    T("flower", "tgc", "sony", "花", "Flower", "Flower", 2009, 2, 8.3, "console", "sliceOfLife", "action", pres=2),
    T("astrosPlayroom", "teamAsobi", "sony", "Astro's Playroom", "Playroom", "Astro's Playroom", 2020, 11, 8.4, "console", "cartoon", "platform", pres=2, series="astro"),
    T("palworldPlus", "pocketpair", "pocketpair", "幻兽帕鲁：家园", "帕鲁家园", "Palworld", 2024, 1, 8.0, "pc+console", "scifi", "survival", pres=3, series="palworld"),
    T("craftopia", "pocketpair", "pocketpair", "创世理想乡", "Craftopia", "Craftopia", 2020, 9, 7.4, "pc", "fantasy", "sandbox", pres=2),
    T("bb3", "mihoyo", "mihoyo", "未定事件簿", "未定", "Tears of Themis", 2020, 7, 7.8, "mobile", "mystery", "visualNovel", pres=2, rtype="liveops"),
    T("honkaiImpact2", "mihoyo", "mihoyo", "崩坏学园2", "崩2", "Houkai Gakuen 2", 2014, 3, 7.6, "mobile", "scifi", "action", pres=2, rtype="liveops"),
    T("ys9", "falcom", "falcom", "伊苏IX", "伊苏9", "Ys IX", 2019, 9, 8.1, "console+pc", "fantasy", "arpg", pres=2, series="ys"),
    T("trailsFromZero", "falcom", "falcom", "零之轨迹", "零轨", "Trails from Zero", 2010, 9, 8.3, "console+pc", "urban", "rpg", pres=3, series="trails"),
    T("trailsToAzure", "falcom", "falcom", "碧之轨迹", "碧轨", "Trails to Azure", 2011, 9, 8.3, "console+pc", "urban", "rpg", pres=3, series="trails"),
    T("kofxv", "snk", "snk", "拳皇15", "KOF15", "The King of Fighters XV", 2022, 2, 8.0, "console+pc", "urban", "fighting", pres=2, series="kof"),
    T("samsho2019", "snk", "snk", "侍魂 晓", "侍晓", "Samurai Shodown 2019", 2019, 6, 7.9, "console", "historical", "fighting", pres=2, series="samsho"),
    T("fatalFuryCotw", "snk", "snk", "饿狼传说 狼之镇魂曲", "饿狼", "Fatal Fury: City of the Wolves", 2025, 4, 8.1, "console+pc", "urban", "fighting", pres=2),
    T("nioh", "teamNinja", "koeiTecmo", "仁王", "仁王1", "Nioh", 2017, 2, 8.4, "console+pc", "historical", "arpg", pres=3, series="nioh"),
    T("nioh2", "teamNinja", "koeiTecmo", "仁王2", "仁王2", "Nioh 2", 2020, 3, 8.5, "console+pc", "historical", "arpg", pres=3, series="nioh"),
    T("woLong", "teamNinja", "koeiTecmo", "卧龙：苍天陨落", "卧龙", "Wo Long", 2023, 3, 7.8, "console+pc", "historical", "action", pres=2),
    T("dynastyW9", "koeiTecmo", "koeiTecmo", "真三国无双8", "无双8", "Dynasty Warriors 9", 2018, 2, 6.8, "console+pc", "historical", "hackSlash", pres=2, series="dw"),
    T("dynastyW8", "koeiTecmo", "koeiTecmo", "真三国无双7", "无双7", "Dynasty Warriors 8", 2013, 2, 7.8, "console", "historical", "hackSlash", pres=2, series="dw"),
    T("persona2", "atlus", "atlus", "女神异闻录2", "P2", "Persona 2", 1999, 6, 8.2, "console", "urban", "rpg", pres=3, series="persona"),
    T("smt5", "atlus", "atlus", "真女神转生V", "SMT5", "Shin Megami Tensei V", 2021, 11, 8.3, "console", "myth", "rpg", pres=3, series="smt"),
    T("metaphor", "atlus", "atlus", "暗喻幻想", "Metaphor", "Metaphor: ReFantazio", 2024, 10, 8.8, "console+pc", "fantasy", "rpg", land=True, pres=4),
    T("catherine", "atlus", "atlus", "凯瑟琳", "Catherine", "Catherine", 2011, 2, 8.2, "console", "urban", "puzzle", pres=2),
    T("niNoKuni", "level5", "level5", "二之国", "二之国", "Ni no Kuni", 2011, 11, 8.4, "console", "fantasy", "rpg", pres=3),
    T("yoKaiWatch", "level5", "level5", "妖怪手表", "妖怪", "Yo-kai Watch", 2013, 7, 7.9, "console", "cartoon", "rpg", pres=2),
    T("professorLayton", "level5", "level5", "雷顿教授", "雷顿", "Professor Layton", 2007, 2, 8.4, "console", "mystery", "puzzle", pres=3),
    T("inazuma", "level5", "level5", "闪电十一人", "闪电", "Inazuma Eleven", 2008, 8, 7.8, "console", "sports", "rpg", pres=2),
    T("fantasyLife", "level5", "level5", "Fantasy Life", "幻想生活", "Fantasy Life", 2012, 12, 7.9, "console", "fantasy", "rpg", pres=2),
    T("octopath", "squareEnix", "squareEnix", "八方旅人", "八方", "Octopath Traveler", 2018, 7, 8.3, "console", "fantasy", "rpg", pres=3),
    T("octopath2", "squareEnix", "squareEnix", "歧路旅人2", "八方2", "Octopath Traveler II", 2023, 2, 8.6, "console+pc", "fantasy", "rpg", pres=3),
    T("ff15", "squareEnix", "squareEnix", "最终幻想XV", "FF15", "Final Fantasy XV", 2016, 11, 8.1, "console+pc", "fantasy", "arpg", pres=3, series="ff"),
    T("ff16", "squareEnix", "squareEnix", "最终幻想XVI", "FF16", "Final Fantasy XVI", 2023, 6, 8.4, "console", "fantasy", "action", pres=3, series="ff"),
    T("kingdomHearts3", "squareEnix", "squareEnix", "王国之心III", "KH3", "Kingdom Hearts III", 2019, 1, 8.2, "console", "cartoon", "arpg", pres=3, series="kh"),
    T("dqBuilders", "squareEnix", "squareEnix", "勇者斗恶龙：创世小玩家", "创世", "Dragon Quest Builders", 2016, 1, 8.0, "console", "fantasy", "sandbox", pres=2, series="dq"),
    T("re7", "capcom", "capcom", "生化危机7", "生化7", "Resident Evil 7", 2017, 1, 8.5, "console+pc", "horror", "survival", land=True, pres=4, series="re"),
    T("re2make", "capcom", "capcom", "生化危机2 重制", "RE2R", "Resident Evil 2 Remake", 2019, 1, 9.0, "console+pc", "horror", "survival", land=True, pres=4, series="re"),
    T("re4make", "capcom", "capcom", "生化危机4 重制", "RE4R", "Resident Evil 4 Remake", 2023, 3, 9.0, "console+pc", "horror", "survival", pres=4, series="re"),
    T("mhrise", "capcom", "capcom", "怪物猎人 崛起", "崛起", "Monster Hunter Rise", 2021, 3, 8.4, "console", "fantasy", "action", pres=3, series="mh"),
    T("dmc5", "capcom", "capcom", "鬼泣5", "DMC5", "Devil May Cry 5", 2019, 3, 8.8, "console+pc", "horror", "action", land=True, pres=4, series="dmc"),
    T("sf6", "capcom", "capcom", "街头霸王6", "SF6", "Street Fighter 6", 2023, 6, 8.7, "console+pc", "urban", "fighting", land=True, pres=4, series="sf"),
    T("sf4", "capcom", "capcom", "街头霸王IV", "SF4", "Street Fighter IV", 2008, 7, 8.8, "console+pc", "urban", "fighting", land=True, pres=4, series="sf"),
    T("sf5", "capcom", "capcom", "街头霸王V", "SF5", "Street Fighter V", 2016, 2, 7.8, "console+pc", "urban", "fighting", pres=2, series="sf"),
])

# 生涯四维：配置基准 0–100。局内 live 分允许超过 100，这里不要写成运行时硬夹满。
# 键 program/design/art/music；策划 design 对应经营局员工 script。
# 元组 (program, design, art, music) 或再加 shipQuote。峰值维应明显高于其余维。
STATS = {
    "chronoTrigger": (82, 94, 88, 92, "梦之队把回合制RPG的完成度推到90年代高位。"),
    "yoshisIsland": (86, 88, 94, 84, "手绘关卡把平台跳跃画成可以走进去的绘本。"),
    "warcraft2": (88, 90, 72, 80),
    "cnc": (86, 88, 74, 78),
    "pal1": (70, 82, 76, 90, "音乐和人设先被记住，系统随后才跟上。"),
    "wipeout": (84, 76, 88, 86),
    "mario64": (96, 94, 86, 80, "三维摄像机和关卡胶囊从此变成平台跳跃的工业语法。"),
    "quake": (97, 78, 70, 74, "3D引擎把第一人称射击的地面重新铺平。"),
    "pokemonRed": (72, 90, 78, 82, "收集与养成把便携RPG写成国民习惯。"),
    "diablo": (86, 88, 80, 84),
    "tombRaider": (80, 82, 88, 74),
    "residentEvil": (78, 84, 86, 80),
    "crash1": (84, 82, 86, 78),
    "ff7": (76, 82, 96, 97, "用碾压的预渲染画面和配乐，把主机RPG推进主流视野。"),
    "goldeneye": (94, 88, 72, 70, "分屏射击把客厅主机变成对战场。"),
    "fallout1": (78, 92, 70, 76),
    "granTurismo": (92, 80, 90, 74, "拟真驾驶把赛车模拟送进客厅。"),
    "sotn": (84, 90, 88, 92),
    "jx1": (68, 76, 70, 74),
    "oot": (94, 96, 90, 88, "把三维冒险钉成后来二十年的默认模板。"),
    "halfLife": (94, 90, 78, 76, "无过场的叙事FPS，证明PC也能把故事演完。"),
    "mgs1": (86, 94, 82, 88, "潜行和过场第一次被主机玩家当成电影来看。"),
    "starcraft": (90, 94, 74, 80, "平衡和对战生态把RTS写成电竞语言。"),
    "re2": (82, 86, 90, 84),
    "chibi": (64, 70, 62, 58),
    "silentHill": (74, 86, 90, 92),
    "aoe2": (86, 92, 78, 76),
    "soulcalibur": (90, 82, 94, 80, "刀光和建模把3D格斗的观赏性拉满。"),
    "systemShock2": (88, 92, 76, 80),
    "shenmue": (80, 86, 88, 84),
    "pokemonGold": (74, 88, 80, 82),
    "diablo2": (86, 90, 82, 86),
    "theSims": (80, 94, 78, 64, "没有终点的玩偶屋，把模拟品类做成大众玩具。"),
    "perfectDark": (92, 86, 80, 74),
    "majora": (88, 94, 86, 90),
    "bg2": (82, 96, 78, 84, "选择密度把CRPG写成可以反复开档的舞台。"),
    "gta3": (88, 90, 84, 80, "3D都市开放世界从此成为类型，而不只是卖点。"),
    "halo1": (95, 88, 82, 78, "主机FPS的操作与关卡课。"),
    "mgs2": (86, 92, 84, 86),
    "melee": (94, 90, 80, 82),
    "silentHill2": (76, 90, 88, 94, "雾、房间和配乐把心理恐怖写进主机。"),
    "maxPayne": (86, 80, 82, 78),
    "viceCity": (86, 88, 86, 90),
    "metroidPrime": (94, 90, 92, 80),
    "warcraft3": (88, 92, 84, 82),
    "kingdomHearts": (78, 82, 88, 90),
    "windWaker": (88, 90, 94, 86, "赛璐珞大海把塞尔达画成另一副面孔。"),
    "qinSang": (66, 72, 68, 64),
    "kotor": (80, 94, 78, 82),
    "sandsOfTime": (86, 90, 88, 80),
    "cod1": (90, 84, 78, 76),
    "mhxy": (70, 82, 72, 76),
    "pal3": (72, 84, 78, 86),
    "hl2": (96, 88, 90, 80, "物理、面部和城市追逐把PC单机再抬一档。"),
    "sanAndreas": (88, 90, 86, 88),
    "wow": (84, 90, 86, 88, "资料片和社交把游戏变成长期服务。"),
    "halo2": (92, 86, 84, 80),
    "mgs3": (86, 90, 86, 88),
    "re4": (92, 94, 88, 82, "越肩视角让恐怖片也能打。"),
    "gow1": (90, 84, 88, 86),
    "sotc": (88, 90, 92, 90),
    "civ4": (84, 94, 72, 78),
    "dnf": (74, 80, 76, 72),
    "oblivion": (78, 86, 84, 80),
    "gears1": (90, 82, 88, 80),
    "wiiSports": (64, 78, 58, 52, "体感聚会比四维堆料更能改写客厅。"),
    "okami": (80, 84, 96, 90, "水墨笔触把神话绘成可玩的画卷。"),
    "zt": (62, 70, 64, 60),
    "bioshock": (84, 92, 94, 86, "艺术指导和沉浸感把射击做成一场展览。"),
    "marioGalaxy": (94, 96, 90, 88),
    "portal": (88, 97, 70, 78, "一扇门、一把枪，把谜题设计写成可以传阅的短课。"),
    "mw1": (92, 86, 84, 80),
    "halo3": (90, 86, 84, 82),
    "cf": (68, 72, 64, 60),
    "massEffect": (80, 92, 84, 82),
    "gta4": (90, 88, 90, 86),
    "fallout3": (80, 86, 82, 78),
    "l4d": (86, 84, 76, 74),
    "mgs4": (88, 86, 90, 84),
    "smashBrawl": (88, 90, 82, 84),
    "uncharted2": (88, 90, 94, 82, "表演关卡把线性冒险做成夏季档大片。"),
    "mw2": (90, 84, 86, 80),
    "demonsSouls": (84, 90, 86, 82),
    "lol": (78, 86, 72, 68, "免费地图和职业联赛把MOBA做成全球日常。"),
    "ac2": (84, 88, 86, 80),
    "jx3": (74, 80, 78, 76),
    "pvz": (76, 90, 86, 74),
    "rdr1": (86, 90, 90, 88),
    "me2": (84, 96, 86, 82, "招募与忠诚任务把太空歌剧写成人事档案。"),
    "sc2": (90, 92, 84, 80),
    "haloReach": (88, 84, 86, 80),
    "marioGalaxy2": (94, 95, 88, 86),
    "portal2": (90, 96, 78, 84),
    "skyrim": (82, 88, 86, 84, "再开一档和模组定义了开放世界RPG的十年。"),
    "darkSouls": (88, 94, 86, 84, "关卡咬合和难度从此可以当形容词。"),
    "minecraft": (80, 92, 70, 62, "方块沙盒长成文化现象。"),
    "arkhamCity": (88, 90, 90, 80),
    "uncharted3": (86, 86, 90, 80),
    "journey": (78, 88, 92, 96, "少字、大风景、一首能走完的配乐。"),
    "xcomEu": (82, 94, 76, 74),
    "bl2": (84, 82, 80, 78),
    "dota2": (86, 88, 76, 70),
    "diablo3": (78, 70, 84, 80),
    "gtav": (90, 88, 94, 86, "把一座可玩的娱乐都市做成十年后仍在卖的工业品。"),
    "tlou": (86, 94, 90, 88, "表演捕捉把动作冒险做成剧集。"),
    "bioshockInfinite": (84, 90, 92, 88),
    "tombRaider2013": (82, 84, 86, 78),
    "pokemonXY": (74, 84, 82, 80),
    "hearthstone": (76, 88, 84, 78),
    "destiny": (80, 68, 86, 80),
    "marioKart8": (86, 90, 88, 82),
    "honkai2": (68, 72, 80, 76),
    "bladeSoul": (74, 76, 86, 80),
    "bloodborne": (88, 90, 94, 90, "哥特街道和猎杀节奏重写魂式动作。"),
    "witcher3": (84, 94, 90, 88, "任务密度和选择后果交出欧洲开放世界答卷。"),
    "mgsv": (92, 78, 88, 86),
    "fallout4": (80, 76, 84, 78),
    "hok": (76, 82, 78, 70, "移动MOBA把电竞和社交做成国民应用。"),
    "overwatch": (86, 88, 92, 84, "英雄射击把角色和表情包绑在电竞上。"),
    "uncharted4": (88, 90, 92, 84),
    "ds3": (88, 90, 88, 86),
    "pokemonGo": (58, 80, 64, 52, "把现实街道变成可走的图鉴，技术先磕磕绊绊。"),
    "onmyoji": (72, 80, 86, 84),
    "honkai3": (76, 80, 88, 86),
    "doom2016": (92, 84, 86, 90, "前冲射击把配乐和手感焊在一起。"),
    "botw": (94, 96, 90, 86, "攀爬、物理和高原实验重写了开放世界塞尔达。"),
    "horizon": (86, 84, 94, 82, "机械兽和远景把开放世界的第一眼打满。"),
    "pubg": (78, 84, 70, 64, "大逃杀从模组变成品类。"),
    "odyssey": (94, 96, 90, 84, "帽子、国度与跳跃手感把3D马里奥再写一版。"),
    "nierAutomata": (84, 90, 88, 96, "主题曲和人机叙事把动作RPG唱进记忆。"),
    "fortnite": (80, 82, 84, 76, "免费大逃杀加一座活得更久的舞台。"),
    "gow2018": (88, 92, 90, 88, "镜头和父亲叙事把战神重做成电影动作。"),
    "rdr2": (90, 92, 96, 90, "把开放世界的电影感推到工时与口碑的极限。"),
    "spiderman": (86, 84, 92, 80),
    "mhw": (86, 88, 90, 82),
    "identityV": (70, 76, 82, 74),
    "smashUltimate": (90, 92, 84, 86),
    "sekiro": (94, 90, 86, 84, "弹反取代翻滚，从魂公式里长出另一套动作。"),
    "apex": (84, 82, 86, 78),
    "arknights": (76, 88, 92, 86),
    "control": (86, 80, 94, 82),
    "peaceElite": (72, 74, 70, 64),
    "deathStranding": (84, 88, 90, 92),
    "genshin": (80, 84, 92, 90, "跨端开放世界把国产长线推到全球视野。"),
    "acnh": (78, 90, 88, 82, "把无人岛摸鱼做成社会事件。"),
    "tlou2": (88, 90, 92, 86),
    "doomEternal": (94, 86, 88, 90),
    "hades": (86, 94, 90, 92, "Roguelike的叙事和角色可以同时做满。"),
    "cyberpunk": (42, 70, 86, 78, "预购期待撞上发售bug墙，画面先到、程序后补。"),
    "ff7r": (84, 86, 94, 92),
    "valorant": (90, 84, 82, 76, "枪感和角色技能要在同一回合里同时成立。"),
    "itTakesTwo": (84, 94, 88, 80, "必须两人的关卡马戏团。"),
    "reVillage": (84, 82, 90, 86),
    "metroidDread": (88, 90, 86, 82),
    "fh5": (86, 84, 94, 82),
    "naraka": (78, 80, 86, 76),
    "eldenRing": (90, 94, 92, 86, "把魂式咬合铺进开放大地。"),
    "gowRagnarok": (88, 90, 92, 88),
    "splatoon3": (84, 86, 90, 82),
    "diabloImmortal": (52, 40, 66, 58, "暗黑皮囊底下是另一套长线抽卡账本。"),
    "pokemonSV": (44, 76, 72, 74, "开放帕底亚很热闹，主机帧率和拼接还没收住。"),
    "bg3": (86, 97, 88, 84, "选项密度和同伴戏把CRPG做成可以反复开档的舞台。"),
    "starRail": (80, 86, 90, 88),
    "totk": (94, 96, 88, 84, "把物理玩具箱再翻一倍。"),
    "spiderman2": (86, 84, 94, 82),
    "alanWake2": (82, 90, 96, 92, "现场感画面把恐怖做成可走的摄影棚。"),
    "diablo4": (80, 78, 88, 82),
    "wukong": (86, 80, 94, 88, "单机、影视感和主机品质被拿到同一句话里。"),
    "wuwa": (76, 78, 86, 82),
    "zzz": (80, 82, 90, 86),
    "astroBot": (92, 94, 90, 84, "平台跳跃的当代完成度课。"),
    "palworld": (74, 82, 76, 68),
    "ff7rebirth": (86, 88, 94, 93, "重制的世界把预渲染记忆扩成可漫游的舞台。"),
    "mhWilds": (84, 86, 90, 80),
    "kcd2": (82, 90, 86, 78),
    "nightreign": (80, 82, 84, 78),
    "splitFiction": (84, 92, 88, 80),
    "ds2": (84, 86, 90, 90),
    "stellarBlade": (84, 78, 92, 80),
}

QUALITY = {
    "comment": "配置基准 0-100；局内 live 四维允许>100，禁止硬夹满。对外 score 仍是 1-10。design 对应员工 script。",
    "statMin": 0,
    "statMax": 100,
    "liveCanExceedMax": True,
    "dims": ["program", "design", "art", "music"],
}

DIMS = ("program", "design", "art", "music")

GP_BIAS = {
    "rpg": {"design": 7, "music": 5, "art": 2, "program": -3},
    "arpg": {"program": 4, "design": 5, "art": 3, "music": 1},
    "platform": {"program": 6, "design": 6, "art": 3, "music": 0},
    "shooter": {"program": 8, "design": 2, "art": 2, "music": 1},
    "puzzle": {"design": 12, "program": 4, "art": -2, "music": 2},
    "rts": {"design": 8, "program": 6, "art": 0, "music": 1},
    "strategy": {"design": 8, "program": 4, "art": 1, "music": 0},
    "tactics": {"design": 9, "program": 3, "art": 1, "music": 0},
    "racing": {"program": 7, "art": 6, "design": 2, "music": 2},
    "fighting": {"program": 8, "art": 5, "design": 3, "music": 2},
    "stealth": {"design": 7, "program": 5, "art": 2, "music": 3},
    "survival": {"design": 5, "program": 3, "art": 4, "music": 4},
    "openWorld": {"art": 6, "design": 5, "program": 3, "music": 2},
    "action": {"program": 5, "art": 4, "design": 3, "music": 2},
    "mmo": {"design": 7, "program": 3, "art": 3, "music": 2},
    "moba": {"design": 6, "program": 5, "art": 2, "music": 1},
    "sim": {"design": 9, "program": 4, "art": 2, "music": 0},
    "sandbox": {"design": 8, "program": 5, "art": 2, "music": 1},
    "cards": {"design": 8, "program": 3, "art": 3, "music": 2},
    "towerDefense": {"design": 8, "program": 3, "art": 4, "music": 3},
    "battleRoyale": {"program": 6, "design": 5, "art": 2, "music": 1},
    "roguelike": {"design": 9, "program": 4, "art": 3, "music": 4},
    "metroidvania": {"design": 8, "program": 5, "art": 4, "music": 3},
    "sportsGame": {"design": 6, "program": 4, "art": 2, "music": -2},
}


def clamp_stat(n):
    n = int(round(n))
    if n < QUALITY["statMin"]:
        return QUALITY["statMin"]
    if n > QUALITY["statMax"]:
        return QUALITY["statMax"]
    return n


def infer_peak_dims(stats):
    avg = sum(stats[d] for d in DIMS) / 4.0
    ranked = sorted(DIMS, key=lambda d: (-stats[d], d))
    peaks = [d for d in ranked if stats[d] >= avg + 5]
    if not peaks:
        peaks = [ranked[0]]
        if stats[ranked[1]] >= stats[ranked[0]] - 2:
            peaks.append(ranked[1])
    elif len(peaks) > 2:
        peaks = peaks[:2]
    if len(peaks) == 1 and stats[ranked[1]] >= stats[ranked[0]] - 3 and stats[ranked[1]] >= avg + 3:
        peaks.append(ranked[1])
    return peaks


def derive_stats(title):
    center = title["score"] * 8.6 + title.get("prestige", 3) * 0.6
    if title.get("landmark"):
        center += 2
    h = 0
    for ch in title["id"]:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    raw = {d: center + (((h >> (i * 5)) % 7) - 3) for i, d in enumerate(DIMS)}
    bias = GP_BIAS.get(title.get("gameplayId"), {})
    for d in DIMS:
        raw[d] += bias.get(d, 0)
    mean = sum(raw.values()) / 4.0
    shift = center - mean
    stats = {d: clamp_stat(raw[d] + shift) for d in DIMS}
    vals = [stats[d] for d in DIMS]
    if vals.count(vals[0]) == 4:
        bump = "design" if title.get("gameplayId") in ("rpg", "puzzle", "sim") else "program"
        stats[bump] = clamp_stat(stats[bump] + 6)
        other = "music" if bump != "music" else "art"
        stats[other] = clamp_stat(stats[other] - 4)
    return stats


def apply_title_quality(titles):
    derived = []
    for t in titles:
        row = STATS.get(t["id"])
        if row:
            stats = {
                "program": clamp_stat(row[0]),
                "design": clamp_stat(row[1]),
                "art": clamp_stat(row[2]),
                "music": clamp_stat(row[3]),
            }
            quote = row[4] if len(row) > 4 else None
        else:
            derived.append(t["id"])
            stats = derive_stats(t)
            quote = None
        vals = [stats[d] for d in DIMS]
        if vals.count(vals[0]) == 4:
            stats["program"] = clamp_stat(stats["program"] + 5)
            stats["music"] = clamp_stat(stats["music"] - 4)
        t["stats"] = stats
        t["peakDims"] = infer_peak_dims(stats)
        if quote:
            t["shipQuote"] = quote
    if derived:
        print("stats derived (no override):", ", ".join(derived))


def QE(eid, name, dim, delta, **kw):
    row = {
        "id": eid,
        "displayName": name,
        "text": kw.get("text", ""),
        "presentation": kw.get("pres", "notice"),
    }
    if dim is not None:
        row["qualityDim"] = dim
    if delta is not None:
        row["qualityDelta"] = delta
    if kw.get("role"):
        row["role"] = kw["role"]
    if kw.get("phase"):
        row["phase"] = kw["phase"]
    if kw.get("titleId"):
        row["titleId"] = kw["titleId"]
    if kw.get("choices"):
        row["presentation"] = "choice"
        row["choices"] = kw["choices"]
    return row


DEV_EVENTS = {
    "comment": "个人线开发事件。有 role 的只进该岗池，有 phase 的只进该阶段池；无 role 的全员可抽。每条必须指定 qualityDim，禁止随机抽一维讲故事。结果只改 live 质量，不写奖杯。titleId 仅提高该作出现权重且每作只触发一次。design 对应员工 script。",
    "list": [
        QE("engineBreakthrough", "底层跑通了", "program", 8, role="programmer", phase="production",
           text="加载快了一截，制作人在群里夸了程序一句。"),
        QE("fatalBug", "致命缺陷", "program", -6, role="programmer", phase="alpha",
           text="填充期存档坏了、还会闪退，程序这边被当面打回。"),
        QE("netcodeCrunch", "联调通宵", "program", 5, role="programmer", phase="polish",
           text="联机终于稳住了，但只修了程序这边，别的没跟着涨。"),
        QE("screeningWow", "试映震撼", "art", 8, role="art", phase="production",
           text="内部试映时过场和场景把制作人看愣了，画面被当场加码。"),
        QE("styleCut", "风格被砍", "art", -6, role="art", phase="prepro",
           text="老板说这套太贵或太怪，视觉方向收了，画面先掉一档。"),
        QE("shaderPass", "终章打光", "art", 6, role="art", phase="polish",
           text="打磨期补上材质和灯光，画面好看了一截。"),
        QE("levelInspiration", "关卡灵感", "design", 8, role="design", phase="production",
           text="一条能教会再考的关卡链跑通了，好玩被写明白了。"),
        QE("featureCut", "功能被砍", "design", -5, role="design", phase="alpha",
           text="核心系统被制作人砍掉一块，设计稿对不上现成关卡，策划这边下滑。"),
        QE("sysDocLock", "系统定稿", "design", 6, role="design", phase="prepro",
           text="前期把循环和数字框架钉死，后面返工变少，策划这边先立住。"),
        QE("themeLock", "主题曲定稿", "music", 8, role="music", phase="production",
           text="主题旋律定稿后，整部作品的情绪被配乐拽着走。"),
        QE("scoreShrink", "配乐缩水", "music", -6, role="music", phase="alpha",
           text="外包预算被抽走，歌用循环垫乐顶上，音乐这边明显空了。"),
        QE("mixPass", "声音过关", "music", 5, role="music", phase="polish",
           text="打磨期把说话、效果和主旋律的层次拉开，音乐这边回了一截。"),
        QE("crunchTradeoff", "这周只能做一件", None, None, phase="polish",
           text="马上要上了，这周只能做好一件事。",
           choices=[
               {"id": "codeFirst", "label": "少闪退", "qualityDim": ["program", "art"], "qualityDelta": [7, -5]},
               {"id": "looksFirst", "label": "更好看", "qualityDim": ["art", "program"], "qualityDelta": [7, -5]},
               {"id": "evenPush", "label": "都挤一点", "qualityDim": ["program", "design", "art", "music"], "qualityDelta": [3, 3, 3, 3]},
           ]),
        QE("scopeCutChoice", "东西太多做不完", None, None, phase="alpha",
           text="东西太多做不完。少做花活，还是少做系统？",
           choices=[
               {"id": "cutSetpiece", "label": "少做花活", "qualityDim": ["design", "art"], "qualityDelta": [6, -4]},
               {"id": "cutSystem", "label": "少做系统", "qualityDim": ["art", "design"], "qualityDelta": [6, -4]},
               {"id": "cutAudio", "label": "压缩音乐", "qualityDim": ["program", "music"], "qualityDelta": [5, -5]},
           ]),
        QE("goldDelayChoice", "最后一周", None, None, phase="gold",
           text="最后一周只能改一样。",
           choices=[
               {"id": "lastBugs", "label": "少闪退", "qualityDim": ["program", "music"], "qualityDelta": [6, -3]},
               {"id": "lastFeel", "label": "更好玩", "qualityDim": ["design", "art"], "qualityDelta": [6, -3]},
               {"id": "lastTheme", "label": "补一首歌", "qualityDim": ["music", "program"], "qualityDelta": [6, -3]},
           ]),
        QE("ff7PreRenderLock", "过场样片过关", "art", 7, role="art", phase="production", titleId="ff7",
           text="预渲染过场的光影和运镜被制作人拍板，画面完成度明显上了一个台阶。"),
        QE("ff7ThemeLock", "主题曲进片", "music", 8, role="music", phase="production", titleId="ff7",
           text="主题旋律写进过场后，整部都市故事的情绪被配乐托住。"),
        QE("portalPuzzleClick", "传送枪关卡闭环", "design", 8, role="design", phase="alpha", titleId="portal",
           text="教-练-考的谜题链跑通，关卡策划把一句话玩法写成可以自学的课。"),
        QE("botwPhysicsClick", "物理沙盒跑通", "program", 7, role="programmer", phase="production", titleId="botw",
           text="攀爬、攀附物和化学引擎开始互相咬合，程序维把开放高原撑起来。"),
    ],
}

def _merge_choice_catalog():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "career_choice_events.py")
    ns = {}
    with open(path, "r", encoding="utf-8") as f:
        exec(compile(f.read(), path, "exec"), ns)
    DEV_EVENTS["list"][:] = ns["merge_dev_events"](DEV_EVENTS["list"])

_merge_choice_catalog()

# 补被引用但未建档的发行商 / 不可入职世界厂
COMPANIES.extend([
    C("interplayFallback", "Interplay", "Interplay", "us", "比佛利山", 1983, 1, open=True, until=2004, tags=["publisher", "rpg"]),
    C("2kFallback", "2K Games", "2K", "us", "诺瓦托", 2005, 2, hireFrom=2005, tags=["publisher"]),
    C("neversoft", "Neversoft", "Neversoft", "us", "伍德兰希尔斯", 1994, 1, worldOnly=True, until=2014, tags=["sports"]),
    C("bullfrog", "Bullfrog", "牛蛙", "uk", "吉尔福德", 1987, 1, worldOnly=True, until=2001, tags=["sim"]),
    C("nwc", "New World Computing", "NWC", "us", "阿古拉山", 1984, 1, worldOnly=True, until=2003, tags=["strategy"]),
    C("threeDo", "The 3DO Company", "3DO", "us", "雷德伍德", 1991, 1, worldOnly=True, until=2003, tags=["publisher"]),
    C("radical", "Radical Entertainment", "Radical", "us", "温哥华", 1991, 1, worldOnly=True, tags=["action"]),
    C("obsidian", "Obsidian Entertainment", "黑曜石", "us", "欧文", 2003, 2, hireFrom=2003, tags=["rpg"]),
    C("arkane", "Arkane Studios", "方舟", "eu", "里昂", 1999, 2, hireFrom=1999, tags=["stealth"]),
    C("crytek", "Crytek", "Crytek", "eu", "法兰克福", 1999, 2, worldOnly=True, tags=["shooter"]),
    C("dice", "DICE", "DICE", "eu", "斯德哥尔摩", 1992, 2, worldOnly=True, tags=["shooter"]),
    C("toysForBob", "Toys for Bob", "Toys for Bob", "us", "诺瓦托", 1989, 1, worldOnly=True, tags=["platform"]),
    C("ironGate", "Iron Gate", "Iron Gate", "eu", "斯德哥尔摩", 2018, 1, worldOnly=True, hireFrom=2018, tags=["survival"]),
    C("kinetic", "Kinetic Games", "Kinetic", "uk", "利物浦", 2019, 1, worldOnly=True, hireFrom=2019, tags=["horror"]),
    C("innersloth", "Innersloth", "Innersloth", "us", "雷德蒙德", 2015, 1, worldOnly=True, hireFrom=2015, tags=["indie"]),
    C("mediatonic", "Mediatonic", "Mediatonic", "uk", "伦敦", 2005, 1, worldOnly=True, hireFrom=2005, tags=["indie"]),
    C("psyonix", "Psyonix", "Psyonix", "us", "圣地亚哥", 2000, 1, worldOnly=True, hireFrom=2000, tags=["sports"]),
    C("teamNinja", "Team Ninja", "忍者组", "jp", "京都", 1995, 2, hireFrom=1995, tags=["action"]),
])

BLURBS = {
    "chronoTrigger": ("史克威尔集结鸟山明、堀井雄二与坂口博信的梦幻班底，回合制RPG的高水分水岭。", "90年代能进此组，履历可以直接写进行业传说。", "heavy", None),
    "mario64": ("三维平台跳跃的教科书。摄像机、三心体系和关卡胶囊都从这里变成工业标准。", "进组等于参与重写平台游戏语法。", "heavy", "N64"),
    "ff7": ("PlayStation世代的RPG旗舰。都市、魔晄与明星角色把主机RPG带进主流文化。", "制作人线的经典敲门砖，也是转职高光。", "heavy", None),
    "oot": ("时之笛把三维冒险钉死成后来二十年的默认模板。媒体分长期停在近满分。", "任天堂第一方核心班底，邀请门槛极高。", "heavy", "N64"),
    "halfLife": ("无过场的叙事FPS。Valve用它证明PC还能讲故事。", "程序岗含金量极高，引擎与AI都是教材。", "medium", "GoldSrc"),
    "mgs1": ("潜行、过场与编导感第一次被主机玩家当成电影来看。", "小岛组文化浓，事件多，适合剧情向职业线。", "heavy", None),
    "starcraft": ("电子竞技在韩国爆开的原点之一。平衡性与对战生态改写了RTS。", "数值策划与对战运营的早期高光履历。", "heavy", None),
    "gta3": ("3D都市开放世界从此成为类型，而不只是卖点。", "能进DMA/R星，后面十年跳槽会容易很多。", "heavy", None),
    "halo1": ("主机FPS的操作与关卡课。Xbox需要一部这样的开山作。", "Bungie班底，射击程序与关卡策划都抢手。", "heavy", "Blam!"),
    "wow": ("长线MMO的商业与内容机器。资料片、辐射与社交把游戏变成服务。", "运营、数值和内容填充会变成你的日常。", "heavy", None),
    "hl2": ("物理、面部与城市追逐把PC单机再抬一档。", "Source引擎履历，程序岗含金量拉满。", "heavy", "Source"),
    "re4": ("越肩视角动作射击的现代源头，恐怖片也开始能打。", "卡普空动作组的硬履历。", "heavy", None),
    "mhxy": ("国产回合MMO长线的标杆之一，点卡与社区比画面更重要。", "国内大厂内容与数值岗的稳妥跳板。", "medium", None),
    "bioshock": ("艺术指导、哲学台词与 immersion 的展示课。", "叙事策划与美术指导的高光项目。", "heavy", "Unreal"),
    "lol": ("MOBA从地图变成全球职业。免费游玩与电竞赛事绑在一起。", "长线运营岗，不是做完就走的盒装项目。", "medium", None),
    "minecraft": ("沙盒变成文化现象。正式版只是漫长早中期之后的盖章。", "独立气质工作室，系统策划比管线更重要。", "light", "Java/C++"),
    "skyrim": ("模组、冒险与“再开一档”定义了2010年代开放世界RPG。", "内容体量极大，中期填充阶段很长。", "heavy", "Creation"),
    "darkSouls": ("难度、关卡咬合与“魂味”从此可以当形容词用。", "魂社程序与关卡策划是后来法环邀请的预科。", "heavy", None),
    "gtav": ("娱乐工业级的开放都市。后来十年仍在卖。", "R星制作周期长、保密严、加班出名。", "heavy", "RAGE"),
    "tlou": ("过场、表演捕捉与关卡叙事把动作冒险做成剧集。", "狗社班底，剧情向制作人的重要台阶。", "heavy", None),
    "hok": ("移动MOBA把电竞和社交做成国民应用。", "腾讯内容与运营岗，声望涨得快但螺丝钉感强。", "medium", None),
    "botw": ("物理、攀爬与“高原上的实验”重写塞尔达。", "任天堂第一方最难进的组之一。", "heavy", None),
    "pubg": ("大逃杀从模组变成品类，随后被全世界复制。", "能赶上早期吃鸡组，等于踩中品类窗口。", "heavy", "Unreal 4"),
    "rdr2": ("电影级开放世界的极限。口碑与工时都是行业案例。", "制作人体力活，也是履历天花板之一。", "heavy", "RAGE"),
    "arknights": ("二次元塔防把剧情、立绘和长线养成做成社区。", "鹰角早期核心组，美术与策划邀请很香。", "medium", "Unity"),
    "genshin": ("开放世界、跨端与长线直播把国产研发推到全球视野。", "典型高光邀请：指定公司、指定作品、指定岗位。", "heavy", "Unity"),
    "cyberpunk": ("预购期待与发售翻车写进教科书，后续几年才把口碑捞回来。", "高声望项目不一定是舒适项目。", "heavy", "REDengine"),
    "eldenRing": ("开放世界和魂系列交汇，媒体与玩家一起把分打到顶。", "魂社制作人线的终局邀请之一。", "heavy", None),
    "bg3": ("CRPG的制作规模与选项密度刷新认知，也证明长周期值得。", "拉瑞安班底，系统设计岗含金量极高。", "heavy", None),
    "wukong": ("国产动作的全球出圈。单机、影视感和主机品质第一次被拿到同一句话里。", "游科体量不大，进组就是核心。", "heavy", "Unreal 5"),
    "pal1": ("国产单机RPG的情感记忆。音乐与人设比系统更先被记住。", "1995年华语开局的重要履历。", "medium", None),
    "theSims": ("没有终点的玩偶屋。模拟品类的大众化。", "系统策划与内容工具岗很吃香。", "medium", None),
    "portal": ("一扇门、一把枪、一句蛋糕。谜题设计的示范课。", "关卡策划的短而美高光。", "medium", "Source"),
    "witcher3": ("任务密度、选择后果与开放世界叙事的欧洲答卷。", "红社在狂猎之后才真正变成全球雇主品牌。", "heavy", "REDengine"),
    "overwatch": ("英雄射击把角色、电竞和表情包绑在一起。", "暴雪后期的全球运营项目。", "medium", None),
    "fortnite": ("免费大逃杀加舞台。活得比多数预测都长。", "Epic的运营与创意工坊岗，跨端经验值钱。", "medium", "Unreal 4"),
    "acnh": ("2020年把“无人岛摸鱼”做成社会事件。", "任天堂第一方，节奏相对不靠长线数值。", "medium", None),
    "hades": ("Roguelike叙事与角色可以同时做满。", "小团队高完成度，适合独立气质职业线。", "medium", None),
    "starRail": ("回合制在长线二次元里被重新证明能赚钱也能好看。", "米社第二部长线，岗位比原神期稍好进一点。", "medium", "Unity"),
    "totk": ("王泪把物理玩具箱再翻一倍。", "野炊原班，邀请几乎只发给内部与极高声望。", "heavy", None),
    "astroBot": ("平台跳跃的当代满分课，也是主机第一方的面子。", "体量不大但制作人学分很高。", "medium", None),
    "valorant": ("战术射击的英雄化。枪感与角色技能要同时成立。", "拳头第二曲线，射击程序抢手。", "medium", "Unreal 4"),
    "gow2018": ("镜头、父亲叙事与北欧神话把战神重做成电影动作。", "圣莫尼卡核心组，动作程序与过场很吃香。", "heavy", None),
    "mhw": ("怪物猎人把狩猎做成全球服务。", "卡普空动作组，长线内容填充很长。", "heavy", None),
    "sekiro": ("弹反取代Roll。从魂公式里长出另一套动作。", "魂社动作程序的展示作。", "heavy", None),
    "itTakesTwo": ("双人合作的关卡马戏团，也把“必须两人”做成设计。", "关卡策划履历非常好看。", "medium", "Unreal 4"),
}


def build_details(title, companies_by_id):
    pres = title["prestige"]
    y, m = title["releaseYear"], title["releaseMonth"]
    dev_m = DEV[pres]
    if title["releaseType"] == "liveops":
        dev_m = max(dev_m, 18)
    sy, sm = add_months(y, m, -dev_m)
    if sy < 1993:
        sy, sm = 1993, 1
        dev_m = (y * 12 + m) - (sy * 12 + sm)
    iy, im = add_months(sy, sm, 2)
    ey, em = add_months(y, m, -1)
    if (iy, im) > (ey, em):
        iy, im = sy, sm
        ey, em = add_months(y, m, -1)
    extra = BLURBS.get(title["id"])
    company = companies_by_id[title["companyId"]]
    if extra:
        blurb, career_note, crunch, engine = extra
    else:
        blurb = "%s年由%s发行，媒体分%s。%s。" % (
            y,
            company["name"],
            title["score"],
            "长线运营" if title["releaseType"] == "liveops" else "盒装发售",
        )
        career_note = "进入本作制作组会成为履历高光。" if title["landmark"] else "扎实的行业履历，声望提升有限。"
        crunch = "heavy" if pres >= 5 else ("medium" if pres >= 3 else "light")
        engine = None
    return {
        "id": title["id"],
        "blurb": blurb,
        "careerNote": career_note,
        "devStartYear": sy,
        "devStartMonth": sm,
        "devMonths": dev_m,
        "inviteWindow": {
            "startYear": iy,
            "startMonth": im,
            "endYear": ey,
            "endMonth": em,
        },
        "inviteRoles": ["programmer", "art", "design", "music"],
        "inviteMinFame": FAME[pres],
        "inviteEligible": title["landmark"],
        "teamSize": 5,
        "crunch": crunch,
        "engine": engine,
        "awards": [],
        "liveAfterRelease": title["releaseType"] == "liveops",
    }


def load_content_ids():
    cfg_path = os.path.join(ROOT, "activity", "config.json")
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    genres = {g["id"] for g in cfg["content"]["genres"]}
    gameplay = {g["id"] for g in cfg["content"]["gameplay"]}
    platforms = {p["id"] for p in cfg["content"]["platforms"]}
    return genres, gameplay, platforms


def dedupe_titles(titles):
    seen = set()
    out = []
    for t in titles:
        if t["id"] in seen:
            continue
        seen.add(t["id"])
        out.append(t)
    return out


FILL_STEMS = [
    ("街机精选", "Arcade Hits", "cartoon", "action"),
    ("年度合集", "Year Pack", "urban", "sim"),
    ("掌机小品", "Handheld", "cartoon", "platform"),
    ("体育赛季", "Sports Season", "sports", "sportsGame"),
    ("射击试作", "Shooter Trial", "war", "shooter"),
    ("策略资料片", "Strategy Pack", "historical", "strategy"),
    ("赛车巡回", "Racing Tour", "sports", "racing"),
    ("格斗大赛", "Fighter Cup", "urban", "fighting"),
    ("解谜盒", "Puzzle Box", "mystery", "puzzle"),
    ("长线运营包", "Live Season", "fantasy", "mmo"),
]


def pad_year_releases(titles, companies, min_per_year):
    counts = {}
    for t in titles:
        y = t["releaseYear"]
        counts[y] = counts.get(y, 0) + 1
    houses = [c for c in companies if c.get("joinable") is False]
    if not houses:
        houses = companies
    extra = []
    n = 0
    for y in range(1995, 2026):
        need = min_per_year - counts.get(y, 0)
        i = 0
        while i < need:
            co = houses[(y + i + n) % len(houses)]
            stem = FILL_STEMS[(y + i) % len(FILL_STEMS)]
            month = 1 + ((i * 3) + (y % 5)) % 12
            tid = "worldFill_%s_%s" % (y, i)
            rtype = "liveops" if stem[3] in ("mmo", "moba") else "boxed"
            plat = "pc" if co.get("region") in ("us", "eu", "cn") and i % 2 == 0 else "console"
            extra.append(T(
                tid, co["id"], co["id"],
                "%s%s" % (co["alias"], stem[0]),
                stem[0],
                "%s %s" % (stem[1], y),
                y, month, round(6.8 + (i % 4) * 0.3, 1), plat, stem[2], stem[3],
                pres=2, rtype=rtype,
            ))
            i += 1
            n += 1
    titles.extend(extra)
    return titles


PLAYER = {
    "comment": "开局四维与每月主职贡献。specialtyBonus 加在锁定主职对应维上。live 超 cap 看 quality.liveCanExceedMax。",
    "startingFame": 0,
    "startingHonor": 0,
    "startingStats": {"program": 34, "design": 34, "art": 34, "music": 34},
    "specialtyBonus": 12,
    "monthlyContribution": 2,
}

COLLEAGUES = {
    "comment": "5 人组：制作人+四职。玩家占锁定岗，其余复用本公司同事池。",
    "teamSize": 5,
    "statVariance": 6,
}

SCORE_FROM_LIVE = {
    "comment": "对外口碑仍 1–10。混合世界 score 与 live 均值/divisor，禁止 JS 写死 10。",
    "divisor": 10,
    "min": 1,
    "max": 10,
    "decimals": 1,
    "playerWeight": 0.12,
}

COMPANY_XP = {
    "comment": "公司级题材/玩法经验作种子与展示合计；立项加成读工作室 studioXp。",
    "xpPerHistoricalRelease": 8,
    "xpPerVirtualRelease": 5,
    "xpPerPlayerCredit": 4,
    "seedPerCatalogTitle": 2,
    "seedPerPastRelease": 4,
    "statBonusPerXp": 0.12,
    "statBonusCap": 18,
    "tiers": [
        {"until": 8, "id": "novice", "name": "生疏", "alias": "生疏"},
        {"until": 24, "id": "able", "name": "熟练", "alias": "熟练"},
        {"until": 48, "id": "strong", "name": "拿手", "alias": "拿手"},
        {"until": 9999, "id": "signature", "name": "看家本领", "alias": "看家"},
    ],
}

VIRTUAL_POOL = {
    "comment": "空窗时从词库抽虚拟作。不要抢同公司同月 landmark 档期。待命超过 idleMaxMonths 强制立项。",
    "idleMaxMonths": 1,
    "devMonthsMin": 6,
    "devMonthsMax": 14,
    "baseStats": {"program": 48, "design": 48, "art": 48, "music": 48},
    "statJitter": 8,
    "prestige": 2,
    "score": 7.2,
    "landmarkBlockSameMonth": True,
    "minWorldReleasesPerYear": 10,
    "namePrefixes": ["夜航", "银钉", "雾港", "赤轨", "北窗", "折纸", "回声", "青石", "灯塔", "深巷"],
    "nameSuffixes": ["计划", "传说", "纪事", "行动", "编年", "协议", "花园", "边境", "夜曲", "手记"],
    "aliasPrefixes": ["夜航", "银钉", "雾港", "赤轨", "北窗"],
    "aliasSuffixes": ["计划", "传说", "纪事", "行动"],
    "genreWeights": [
        {"id": "fantasy", "weight": 3},
        {"id": "urban", "weight": 3},
        {"id": "scifi", "weight": 2},
        {"id": "adventure", "weight": 2},
        {"id": "war", "weight": 1},
        {"id": "cartoon", "weight": 2},
        {"id": "historical", "weight": 1},
        {"id": "horror", "weight": 1},
        {"id": "wuxia", "weight": 1},
    ],
    "gameplayWeights": [
        {"id": "action", "weight": 3},
        {"id": "rpg", "weight": 3},
        {"id": "shooter", "weight": 2},
        {"id": "platform", "weight": 2},
        {"id": "strategy", "weight": 1},
        {"id": "sim", "weight": 1},
        {"id": "racing", "weight": 1},
        {"id": "puzzle", "weight": 1},
        {"id": "arpg", "weight": 2},
    ],
}

MOBILITY = {
    "comment": "年底 5 格 offer：内部工作室最多 2、排在前面。主动申请掷骰，失败记 hopFailedYear，本年不能再投。挖人必成。允许开发中途跳槽。",
    "hopMonth": 12,
    "allowMidProject": True,
    "offerCount": 5,
    "internalOfferMax": 2,
    "fameOnAccept": 2,
    "inviteMaxPerYear": 1,
    "inviteChance": 0.4,
    "counterSteps": 1,
    "stayPromiseFame": 1,
    "hireChanceByPower": {"1": 0.72, "2": 0.48, "3": 0.22},
    "fameHirePer": 0.004,
    "statHirePer": 0.003,
    "hireChanceMin": 0.05,
    "hireChanceMax": 0.92,
}

PERSONAL_ECONOMY = {
    "comment": "个人积蓄。个人线不扣生活费，月薪只入账。薪资先算技术/声望/职级/通胀，公司 power 与 salaryMult 只抬档，再夹到 steps。禁止零头。",
    "startingSavings": 2500,
    "deductLivingCost": False,
    "livingCostPerMonth": 900,
    "livingCostYearGrowth": 0.025,
    "salary": {
        "comment": "raw = base × skill × inflation，floor 到档；再按 powerShift 与 salaryMult 挪档。counterSteps 是还价跳档数。",
        "steps": [
            2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000, 12000, 15000,
            20000, 25000, 30000, 40000, 50000, 60000, 80000, 100000,
        ],
        "snap": "floor",
        "base": 3000,
        "statRef": 46,
        "avgRef": 37,
        "mainStatPer": 0.012,
        "avgStatPer": 0.004,
        "famePer": 0.005,
        "honorPer": 0.03,
        "yearsPer": 0.03,
        "yearInflation": 0.035,
        "skillMin": 0.7,
        "stageBonus": {"employee": 0, "producer": 0.15, "founder": 0.25},
        "powerShift": {"1": -1, "2": 0, "3": 1},
        "salaryMultRef": 1,
        "salaryMultPerStep": 0.18,
        "counterSteps": 1,
    },
}

BIG_STUDIOS = {
    "nintendo": [
        S("nintendo-studio1", "第一制作组", "N一组", ["urban", "cartoon"], ["cards", "puzzle", "platform"]),
        S("nintendo-studio2", "第二制作组", "塞尔达组", ["adventure"], ["action", "openWorld"]),
    ],
    "sony": [
        S("sony-japan", "日本工作室", "S日组", ["scifi", "urban"], ["racing", "platform"]),
        S("sony-ww", "全球第一方组", "S一组", ["adventure", "war"], ["action", "stealth"]),
    ],
    "sega": [
        S("sega-am2", "第二研发部", "AM2", ["urban", "sports"], ["action", "racing"]),
        S("sega-sonic", "索尼克组", "刺猬组", ["cartoon"], ["platform", "action"]),
    ],
    "square": [
        S("square-rd1", "第一开发事业部", "FF组", ["fantasy", "scifi"], ["rpg"]),
        S("square-rd3", "第三开发事业部", "时轮组", ["fantasy", "urban"], ["rpg", "action"]),
    ],
    "squareEnix": [
        S("squareEnix-1", "第一开发事业部", "SE一组", ["fantasy", "scifi"], ["rpg", "action"]),
        S("squareEnix-2", "第二开发事业部", "SE二组", ["urban", "adventure"], ["action", "openWorld"]),
    ],
    "capcom": [
        S("capcom-re", "生化组", "RE组", ["horror"], ["survival", "action"]),
        S("capcom-mh", "狩猎组", "MH组", ["adventure", "fantasy"], ["action", "arpg"]),
    ],
    "ea": [
        S("ea-sports", "EA Sports", "EA体育", ["sports"], ["sportsGame", "racing"]),
        S("ea-west", "EA 西海岸", "EA西", ["war", "scifi"], ["rts", "shooter"]),
    ],
    "blizzard": [
        S("blizzard-rts", "RTS组", "星际组", ["fantasy", "scifi"], ["rts"]),
        S("blizzard-rpg", "RPG组", "暗雪组", ["fantasy"], ["arpg", "mmo"]),
    ],
    "activision": [
        S("activision-cod", "使命组", "COD组", ["war"], ["shooter"]),
        S("activision-pub", "发行制作组", "动视一组", ["cartoon", "urban"], ["platform", "action"]),
    ],
    "tencent": [
        S("tencent-t1", "天美工作室群", "天美", ["urban"], ["moba", "shooter"]),
        S("tencent-t2", "魔方工作室群", "魔方", ["fantasy", "wuxia"], ["mmo", "rpg"]),
    ],
    "netease": [
        S("netease-leihuo", "雷火", "雷火", ["fantasy"], ["mmo", "rpg"]),
        S("netease-fuxi", "伏羲", "伏羲", ["urban", "scifi"], ["moba", "shooter"]),
    ],
    "mihoyo": [
        S("mihoyo-ys", "原神项目组", "提瓦特组", ["adventure", "fantasy"], ["openWorld", "arpg"]),
        S("mihoyo-sr", "星穹铁道组", "列车组", ["scifi", "fantasy"], ["rpg"]),
    ],
    "ubisoft": [
        S("ubisoft-ac", "刺客组", "AC组", ["historical", "urban"], ["action", "openWorld"]),
        S("ubisoft-open", "开放世界组", "育碧二组", ["war", "adventure"], ["shooter", "openWorld"]),
    ],
    "rockstar": [
        S("rockstar-north", "Rockstar North", "北区", ["urban"], ["action", "openWorld"]),
        S("rockstar-sd", "Rockstar San Diego", "圣地亚哥", ["historical", "urban"], ["action", "openWorld"]),
    ],
    "valve": [
        S("valve-hl", "半衰期组", "HL组", ["scifi"], ["shooter"]),
        S("valve-valve2", "平台与小品组", "V组", ["urban", "cartoon"], ["puzzle", "action"]),
    ],
    "xbox": [
        S("xbox-first", "第一方工作室", "Xbox一组", ["scifi", "war"], ["shooter", "action"]),
        S("xbox-pub", "发行合作组", "Xbox二组", ["urban", "sports"], ["sportsGame", "racing"]),
    ],
    "riot": [
        S("riot-lol", "英雄联盟组", "LOL组", ["fantasy", "urban"], ["moba"]),
        S("riot-val", "无畏契约组", "VAL组", ["urban", "scifi"], ["shooter"]),
    ],
}


def apply_company_studios(companies):
    for c in companies:
        if c["id"] in BIG_STUDIOS:
            c["studios"] = BIG_STUDIOS[c["id"]]
        elif not c.get("studios"):
            c["studios"] = [S(
                c["id"] + "-main",
                c["name"] + "工作室",
                (c.get("alias") or c["name"]) + "组",
                [],
                [],
            )]


def studio_match_score(studio, title):
    score = 0
    if title.get("genreId") in (studio.get("genreIds") or []):
        score += 2
    if title.get("gameplayId") in (studio.get("gameplayIds") or []):
        score += 2
    return score


def attach_title_studios(titles, companies):
    by_id = {c["id"]: c for c in companies}
    for t in titles:
        if t.get("studioId"):
            continue
        co = by_id.get(t["companyId"])
        studios = (co or {}).get("studios") or []
        if not studios:
            continue
        best = studios[0]
        best_s = -1
        for s in studios:
            sc = studio_match_score(s, t)
            if sc > best_s:
                best_s = sc
                best = s
        t["studioId"] = best["id"]


SAVE = {
    "comment": "个人线新局 saveVersion。经营局仍写 4。",
    "version": 7,
}


def main():
    genres, gameplay, platforms = load_content_ids()
    apply_company_studios(COMPANIES)
    ids = [c["id"] for c in COMPANIES]
    assert len(ids) == len(set(ids)), "duplicate company id"
    by_id = {c["id"]: c for c in COMPANIES}
    studio_bad = []
    for cid, studios in BIG_STUDIOS.items():
        assert cid in by_id, "studio company missing %s" % cid
        assert len(studios) >= 2, "big company %s needs 2+ studios" % cid
        seen_sid = set()
        for s in studios:
            if s["id"] in seen_sid:
                studio_bad.append("dup studio %s" % s["id"])
            seen_sid.add(s["id"])
            for gid in s.get("genreIds") or []:
                if gid not in genres:
                    studio_bad.append("studio genre %s %s" % (s["id"], gid))
            for gid in s.get("gameplayIds") or []:
                if gid not in gameplay:
                    studio_bad.append("studio gameplay %s %s" % (s["id"], gid))
    assert not studio_bad, "\n".join(studio_bad)
    titles = dedupe_titles(TITLES)
    pad_year_releases(titles, COMPANIES, VIRTUAL_POOL["minWorldReleasesPerYear"])
    attach_title_studios(titles, COMPANIES)
    title_ids = [t["id"] for t in titles]
    assert len(title_ids) == len(set(title_ids)), "duplicate title id"
    apply_title_quality(titles)
    event_ids = [ev["id"] for ev in DEV_EVENTS["list"]]
    assert len(event_ids) == len(set(event_ids)), "duplicate dev event id"
    for ev in DEV_EVENTS["list"]:
        if ev.get("presentation") == "choice":
            assert ev.get("choices"), "choice event %s needs choices" % ev["id"]
            for ch in ev["choices"]:
                assert ch.get("qualityDim"), "choice %s/%s missing qualityDim" % (ev["id"], ch.get("id"))
        else:
            assert ev.get("qualityDim"), "event %s missing qualityDim" % ev["id"]
    bad = []
    for t in titles:
        if t["companyId"] not in by_id:
            bad.append("company %s (%s)" % (t["companyId"], t["id"]))
        if t["publisherId"] not in by_id:
            bad.append("publisher %s (%s)" % (t["publisherId"], t["id"]))
        if not (1995 <= t["releaseYear"] <= 2025):
            bad.append("year %s" % t["id"])
        if not (1 <= t["releaseMonth"] <= 12):
            bad.append("month %s" % t["id"])
        if not (1.0 <= t["score"] <= 10.0):
            bad.append("score %s" % t["id"])
        if t["genreId"] not in genres:
            bad.append("genre %s (%s)" % (t["genreId"], t["id"]))
        if t["gameplayId"] not in gameplay:
            bad.append("gameplay %s (%s)" % (t["gameplayId"], t["id"]))
        sid = t.get("studioId")
        if sid:
            co = by_id.get(t["companyId"]) or {}
            studio_ids = [s["id"] for s in (co.get("studios") or [])]
            if sid not in studio_ids:
                bad.append("studio %s (%s)" % (sid, t["id"]))
        for p in t["platforms"]:
            if p not in platforms:
                bad.append("platform %s (%s)" % (p, t["id"]))
        stt = t.get("stats") or {}
        for d in DIMS:
            v = stt.get(d)
            if not isinstance(v, int) or not (QUALITY["statMin"] <= v <= QUALITY["statMax"]):
                bad.append("stats %s %s" % (t["id"], d))
        peaks = t.get("peakDims") or []
        for d in peaks:
            if d not in stt:
                bad.append("peakDims %s %s" % (t["id"], d))
    assert not bad, "\n".join(bad)
    years = {t["releaseYear"] for t in titles}
    missing = [y for y in range(1995, 2026) if y not in years]
    assert not missing, "years without titles: %s" % missing
    details = [build_details(t, by_id) for t in titles]
    opening = [c["id"] for c in COMPANIES if c.get("openingOffer")]
    data = {
        "comment": "生涯世界表：公司 / 作品 / 四维 / 开发事件。展示名 = useAlias? alias : name。改完跑 python scripts/sync_config.py。score 是 1–10 对外口碑；stats 是配置基准 0–100（design 对应员工 script），局内 live 四维允许超过 statMax。评奖读 titles[].stats 与 score，不读空的 titleDetails.awards。现行经营局仍读 activity/config.json 的 calendar（2015 起）。",
        "useAlias": False,
        "quality": QUALITY,
        "timeline": {
            "startYear": 1995,
            "startMonth": 1,
            "endYear": 2025,
            "endMonth": 12,
        },
        "save": SAVE,
        "player": PLAYER,
        "colleagues": COLLEAGUES,
        "scoreFromLive": SCORE_FROM_LIVE,
        "companyXp": COMPANY_XP,
        "virtualPool": VIRTUAL_POOL,
        "mobility": MOBILITY,
        "roles": [
            {"id": "programmer", "name": "程序", "alias": "程序", "stat": "program"},
            {"id": "art", "name": "美术", "alias": "美术", "stat": "art"},
            {"id": "design", "name": "策划", "alias": "策划", "stat": "design", "staffStat": "script"},
            {"id": "music", "name": "音乐", "alias": "音乐", "stat": "music"},
            {"id": "producer", "name": "制作人", "alias": "制作人", "stat": None},
        ],
        "growthStages": [
            {"id": "employee", "name": "打工仔", "alias": "职员"},
            {"id": "producer", "name": "制作人", "alias": "制作人", "unlock": "inviteOrPromotion"},
            {
                "id": "founder",
                "name": "公司负责人",
                "alias": "社长",
                "lockedThisVersion": True,
                "savingsGate": 200000,
            },
        ],
        "projectPhases": [
            {"id": "prepro", "name": "前期", "alias": "立项期", "until": 0.15},
            {"id": "production", "name": "中期制作", "alias": "制作期", "until": 0.55},
            {"id": "alpha", "name": "内容填充", "alias": "填充期", "until": 0.8},
            {"id": "polish", "name": "打磨", "alias": "打磨期", "until": 0.95},
            {"id": "gold", "name": "待发售", "alias": "金盘期", "until": 1.0},
        ],
        "personalEconomy": PERSONAL_ECONOMY,
        "openingOffer": {
            "comment": "1995 开局从 openingOffer=true 的公司抽 3 份：小作坊 / 稳定大厂 / 野牌各一，岗位锁定玩家擅长。",
            "count": 3,
            "tiers": ["small", "stable", "wild"],
            "riskByTier": {
                "small": "编制紧、项目说停就停，但你能摸到整条管线。",
                "stable": "薪水稳、流程长，新人容易被埋在大组里。",
                "wild": "方向野、加班猛，做成了就是履历，做砸了也没人兜底。",
            },
            "companyIds": opening,
        },
        "awards": {
            "comment": "生涯评奖读 titles[].stats 与 score，现场按窗口比；不读 titleDetails.awards。先提名再决出。",
            "statsFrom": "titles[].stats",
            "scoreFrom": "titles[].score",
            "ignoreAwardsArray": True,
            "famePerWin": 6,
            "honorPerWin": 2,
            "famePerNomination": 2,
            "honorPerNomination": 1,
        },
        "devEvents": DEV_EVENTS,
        "companies": COMPANIES,
        "titles": titles,
        "titleDetails": details,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote", OUT)
    print("companies", len(COMPANIES), "titles", len(titles), "opening", len(opening),
          "devEvents", len(DEV_EVENTS["list"]))
    year_counts = {}
    for t in titles:
        year_counts[t["releaseYear"]] = year_counts.get(t["releaseYear"], 0) + 1
    thin = [y for y in range(1995, 2026) if year_counts.get(y, 0) < VIRTUAL_POOL["minWorldReleasesPerYear"]]
    print("thin years", thin or "none")


if __name__ == "__main__":
    main()
