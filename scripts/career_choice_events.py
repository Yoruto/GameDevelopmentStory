# -*- coding: utf-8 -*-
"""个人线岗位抉择目录。写入 activity/career-world.json 的 devEvents / postLaunch。"""
from __future__ import print_function

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD = os.path.join(ROOT, "activity", "career-world.json")

FORBIDDEN = [
    "金盘", "管线", "切片", "混音", "包体", "四维",
    "shader", "Shader", "Bloom", "HUD", "mocap", "Mocap",
    "帧时间", "fillrate", "自适应", "认证",
]

DIMS = ["program", "design", "art", "music"]
ROLES = ("programmer", "art", "design", "music")
PHASES = ("prepro", "production", "alpha", "polish", "gold")


def O(oid, label, dims, deltas):
    if not isinstance(dims, list):
        dims = [dims]
        deltas = [deltas]
    return {"id": oid, "label": label, "qualityDim": dims, "qualityDelta": deltas}


def EVEN(oid="even", label="都挤一点", n=2):
    return O(oid, label, DIMS, [n, n, n, n])


def C(eid, title, text, role, phase, choices):
    row = {
        "id": eid,
        "displayName": title,
        "text": text,
        "presentation": "choice",
        "choices": choices,
    }
    if role:
        row["role"] = role
        row["phase"] = phase
    elif phase:
        row["phase"] = phase
    return row


def P(eid, title, text, role, choices):
    return {
        "id": eid,
        "displayName": title,
        "text": text,
        "presentation": "choice",
        "role": role,
        "choices": choices,
    }


NOTICE_PATCHES = {
    "engineBreakthrough": {
        "displayName": "底层跑通了",
        "text": "加载快了一截，制作人在群里夸了程序一句。",
    },
    "fatalBug": {
        "text": "填充期存档坏了、还会闪退，程序这边被当面打回。",
    },
    "netcodeCrunch": {
        "text": "联机终于稳住了，但只修了程序这边，别的没跟着涨。",
    },
    "screeningWow": {
        "text": "内部试映时过场和场景把制作人看愣了，画面被当场加码。",
    },
    "styleCut": {
        "text": "老板说这套太贵或太怪，视觉方向收了，画面先掉一档。",
    },
    "shaderPass": {
        "displayName": "终章打光",
        "text": "打磨期补上材质和灯光，画面好看了一截。",
    },
    "levelInspiration": {
        "text": "一条能教会再考的关卡链跑通了，好玩被写明白了。",
    },
    "featureCut": {
        "text": "核心系统被制作人砍掉一块，设计稿对不上现成关卡，策划这边下滑。",
    },
    "sysDocLock": {
        "text": "前期把循环和数字框架钉死，后面返工变少，策划这边先立住。",
    },
    "themeLock": {
        "text": "主题旋律定稿后，整部作品的情绪被配乐拽着走。",
    },
    "scoreShrink": {
        "text": "外包预算被抽走，歌用循环垫乐顶上，音乐这边明显空了。",
    },
    "mixPass": {
        "displayName": "声音过关",
        "text": "打磨期把说话、效果和主旋律的层次拉开，音乐这边回了一截。",
    },
}

GENERIC_PATCHES = {
    "crunchTradeoff": C(
        "crunchTradeoff", "这周只能做一件",
        "马上要上了，这周只能做好一件事。",
        None, "polish",
        [
            O("codeFirst", "少闪退", ["program", "art"], [7, -5]),
            O("looksFirst", "更好看", ["art", "program"], [7, -5]),
            EVEN("evenPush", "都挤一点", 3),
        ],
    ),
    "scopeCutChoice": C(
        "scopeCutChoice", "东西太多做不完",
        "东西太多做不完。少做花活，还是少做系统？",
        None, "alpha",
        [
            O("cutSetpiece", "少做花活", ["design", "art"], [6, -4]),
            O("cutSystem", "少做系统", ["art", "design"], [6, -4]),
            O("cutAudio", "压缩音乐", ["program", "music"], [5, -5]),
        ],
    ),
    "goldDelayChoice": C(
        "goldDelayChoice", "最后一周",
        "最后一周只能改一样。",
        None, "gold",
        [
            O("lastBugs", "少闪退", ["program", "music"], [6, -3]),
            O("lastFeel", "更好玩", ["design", "art"], [6, -3]),
            O("lastTheme", "补一首歌", ["music", "program"], [6, -3]),
        ],
    ),
}

POST_LAUNCH_NOTICE_PATCHES = {
    "hotfixCrash": {
        "text": "已经上架了，集中修了几处必现闪退，程序这边补了一点。",
    },
    "patchNotes": {
        "text": "发了热修说明，口碑没立刻变，组里还在守这部。",
    },
    "reviewHotfix": {
        "text": "差评点名的系统被补了一刀，好玩轻轻回了一点。",
    },
    "artTouchup": {
        "displayName": "破图热修",
        "text": "修了几处破图和过亮的光，画面稳了一点。",
    },
    "audioGlitch": {
        "displayName": "占位音漏了",
        "text": "有人把占位音效漏进游戏里，热修时清掉了。",
    },
    "communityNote": {
        "text": "玩家在问存档和操作，组里回了帖，游戏本身没改。",
    },
}

CHOICE_EVENTS = [
    # --- 前期 programmer ---
    C("blankStart", "电脑还是空白",
      "电脑里还是空白。制作人问你：从零写，还是拿以前的改。",
      "programmer", "prepro",
      [
          O("fromScratch", "从零写", ["program", "art"], [8, -4]),
          EVEN("reuseOld", "拿旧的改", 2),
          O("levelTool", "先做摆关", ["design", "program", "art"], [6, 2, -3]),
      ]),
    C("demoDontCrash", "演示别崩",
      "下周给老板看，存档还不灵。群里有人问：演示那天别崩就行吧？",
      "programmer", "prepro",
      [
          O("saveFirst", "先做存档", ["program", "art"], [7, -4]),
          O("prettyIntro", "先做好看", ["art", "program"], [6, -5]),
          EVEN("clickable", "能点就行", 1),
      ]),
    C("goOnline", "要不要联网",
      "群里说不联网不时髦。制作人让你拍板。",
      "programmer", "prepro",
      [
          O("offline", "先做单机", ["program", "design"], [6, -3]),
          O("onlineHard", "硬上联网", ["design", "program"], [6, -5]),
          O("leaderboard", "先做排行", ["design", "program"], [3, -2]),
      ]),
    # --- 前期 art ---
    C("stylePushedBack", "画风被拍回来",
      "老板说太素，商店没人点。制作人把图打回来了。",
      "art", "prepro",
      [
          O("goFlashy", "改花改亮", ["art", "program"], [8, -4]),
          O("keepNow", "坚持现在", ["design", "art"], [4, -3]),
          O("twoSets", "出两套挑", ["art", "design"], [4, -3]),
      ]),
    C("charOrWorld", "先画人还是地",
      "这周人手只够画一边。先画主角，还是先铺场景？",
      "art", "prepro",
      [
          O("heroFirst", "先画主角", ["art", "design"], [8, -4]),
          O("sceneFirst", "先铺场景", ["design", "art"], [6, 2]),
          O("bothABit", "都画一点", ["art", "design"], [3, 3]),
      ]),
    C("refFight", "参考图吵起来了",
      "策划丢来截图，要做成那样。群里吵开了。",
      "art", "prepro",
      [
          O("followDesign", "听策划", ["design", "art"], [6, -4]),
          O("ownStyle", "按自己画", ["art", "design"], [7, -4]),
          O("splitDiff", "各让一半", ["art", "design"], [3, 3]),
      ]),
    # --- 前期 design ---
    C("whatIsTheGame", "到底在玩什么",
      "制作人问：这游戏到底在玩什么？动作还是解谜。",
      "design", "prepro",
      [
          O("oneCore", "就做一个", ["design", "art"], [7, -4]),
          O("twoBits", "两个都做", ["art", "program"], [4, -5]),
          EVEN("copyThenTwist", "先抄再改", 2),
      ]),
    C("oneLevelPlaytest", "先做一关试试",
      "要不要先做一关给人试？群里有人说开会用嘴讲也行。",
      "design", "prepro",
      [
          O("makeOne", "做一关", ["design", "program"], [7, -5]),
          O("writeRules", "先写清规则", ["design", "art"], [5, -3]),
          O("talkOnly", "开会用嘴讲", ["design"], [1]),
      ]),
    C("storyDepth", "故事写多深",
      "故事压短让玩法先爽，还是写满，还是做成能跳过的过场？",
      "design", "prepro",
      [
          O("playFirst", "玩法先爽", ["design", "music"], [7, -3]),
          O("storyFull", "故事写满", ["music", "design"], [6, -3]),
          O("skippable", "能跳过场", ["design", "music"], [3, 3]),
      ]),
    # --- 前期 music ---
    C("themeNow", "现在就要主题曲",
      "制作人问：现在就要主题曲吗？群里有人说等能看见再写。",
      "music", "prepro",
      [
          O("writeHook", "先写熟旋律", ["music", "art"], [8, -4]),
          O("waitSee", "等能看见", ["art", "music"], [4, -2]),
          O("foleyFirst", "先做小声音", ["design", "music"], [5, 2]),
      ]),
    C("songOrAmbience", "用歌还是气氛",
      "要能哼的歌，还是气氛垫底？两首都浅浅做也行。",
      "music", "prepro",
      [
          O("hummable", "能哼的歌", ["music", "design"], [8, -4]),
          O("pad", "气氛垫底", ["design", "music"], [5, -2]),
          EVEN("bothShallow", "两首都浅做", 2),
      ]),
    C("outsourceTheme", "请人还是自己写",
      "请人做主题，还是自己写、钱留给画面？免费的也能顶上。",
      "music", "prepro",
      [
          O("hireOut", "请人做主题", ["music", "art"], [8, -3]),
          O("writeSelf", "自己写省钱", ["art", "music"], [5, -2]),
          O("freePack", "免费的顶上", ["music", "program"], [-4, 3]),
      ]),
    # --- 制作期 programmer ---
    C("animStutter", "一跑动画就卡",
      "一跑动画就卡。制作人让你这周定：画面降一档，还是继续做细。",
      "programmer", "production",
      [
          O("dropGfx", "画面降一档", ["program", "art"], [7, -5]),
          O("keepDetail", "继续做细", ["art", "program"], [6, -4]),
          O("nightFix", "晚上加班抠", ["program", "art"], [3, 3]),
      ]),
    C("saveBrokeAgain", "存档又坏了",
      "存档又坏了。这周只修存档，还是先做新功能？",
      "programmer", "production",
      [
          O("fixSave", "这周只修", ["program", "design"], [7, -4]),
          O("newFeature", "先做新功能", ["design", "program"], [5, -5]),
          O("errorToast", "加个出错提示", ["program"], [2]),
      ]),
    C("demoBlackScreen", "演示当场黑屏",
      "演示当场黑屏。制作人盯着你：通宵修，还是改用录像播？",
      "programmer", "production",
      [
          O("allNighter", "当周通宵修", ["program", "art", "music"], [8, -4, -3]),
          O("playTape", "改用录像播", ["art", "program"], [6, -4]),
          O("delayReview", "承认改期", ["design", "program"], [4, -2]),
      ]),
    C("netMismatch", "联网对不上",
      "联网对不上，有人能穿墙。先修这个，还是先让单机好玩？",
      "programmer", "production",
      [
          O("fixWalls", "先修穿墙", ["program", "design"], [7, -4]),
          O("funOffline", "先保单机", ["design", "program"], [6, -4]),
          O("hideOnline", "关掉联网", ["program", "design"], [4, -3]),
      ]),
    # --- 制作期 art ---
    C("reskinLook", "角色像换皮",
      "角色看起来像换皮。重做脸，换套衣服，还是把钱花在大海报上？",
      "art", "production",
      [
          O("redoFace", "重做脸", ["art", "design"], [8, -4]),
          O("newClothes", "换套衣服", ["art"], [3]),
          O("posterMoney", "钱花大海报", ["art", "design"], [6, -3]),
      ]),
    C("emptyScene", "场景太空",
      "场景太空。堆细节，用灯光天气撑气氛，还是加敌人数量？",
      "art", "production",
      [
          O("pileDetail", "堆细节", ["art", "program"], [7, -4]),
          O("lightWeather", "灯光天气撑", ["art", "music"], [5, 3]),
          O("moreEnemies", "加敌人数量", ["design", "art"], [6, -3]),
      ]),
    C("prettyCutscene", "过场要不要漂亮",
      "过场要不要做漂亮？做会动的贵，漫画翻页和纯文字便宜。",
      "art", "production",
      [
          O("animate", "做会动的", ["art", "program"], [8, -5]),
          O("comic", "漫画翻页", ["design", "art"], [5, -2]),
          O("textOnly", "纯文字", ["music", "art"], [5, -3]),
      ]),
    C("colorFight", "颜色吵起来了",
      "颜色吵起来了。加饱和，保持灰再加亮道具，还是听策划改亮？",
      "art", "production",
      [
          O("moreSat", "加饱和", ["art", "design"], [6, -2]),
          O("greyPlusProps", "灰底加亮道具", ["art", "design"], [3, 3]),
          O("followLead", "改亮听策划", ["design", "art"], [5, -3]),
      ]),
    # --- 制作期 design ---
    C("tooHardPlaytest", "试玩卡住了",
      "太难了，试玩卡住。填坑加提示，加跳过这关，还是不改？",
      "design", "production",
      [
          O("hints", "填坑加提示", ["design", "music"], [7, -3]),
          O("skipLevel", "加跳过这关", ["design"], [4]),
          O("noChange", "不改", ["design"], [-3]),
      ]),
    C("moreFeaturesWeek", "又要加功能",
      "这周又要加功能。顶回去，接进来，还是做成可关的隐藏？",
      "design", "production",
      [
          O("pushBack", "顶回去", ["design", "art"], [7, -3]),
          O("takeIn", "接进来", ["design", "program"], [3, -5]),
          O("toggleHide", "做成可关", ["design", "program"], [5, -2]),
      ]),
    C("copyPasteLevels", "关卡在复制",
      "关卡在复制粘贴。砍重复留少而精，继续铺量，还是每关一个小花招？",
      "design", "production",
      [
          O("cutDupes", "砍重复留精", ["design", "music"], [7, -3]),
          O("keepVolume", "继续铺量", ["art", "design"], [4, -4]),
          O("oneTrick", "每关小花招", ["design", "program"], [5, -4]),
      ]),
    C("tutorialOrNot", "要不要做教程",
      "要不要做教程？做一关慢慢教，弹窗说明，还是不教自己摸？",
      "design", "production",
      [
          O("teachLevel", "做一关教", ["design", "music"], [6, -3]),
          O("popup", "弹窗说明", ["design"], [1]),
          O("noTeach", "不教自己摸", ["design", "art"], [-3, 3]),
      ]),
    # --- 制作期 music ---
    C("tempSfxStill", "临时音效还在",
      "临时音效还在。这周全换，只换主角几下，还是先不管？",
      "music", "production",
      [
          O("replaceAll", "这周全换", ["music", "design"], [7, -3]),
          O("heroOnly", "只换主角", ["music"], [3]),
          O("ignore", "先不管", ["music"], [-4]),
      ]),
    C("themeSoundsLike", "主题曲像别的歌",
      "主题曲被说像别的歌。推倒重写，改几个音，还是当致敬？",
      "music", "production",
      [
          O("rewrite", "推倒重写", ["music", "art"], [8, -4]),
          O("tweakNotes", "改几个音", ["music"], [2]),
          O("homage", "当致敬", ["design", "music"], [5, -2]),
      ]),
    C("cutsceneChopsSong", "过场把歌切碎",
      "过场把歌切碎了。求镜头拉长，改成短小段，还是歌只放菜单片尾？",
      "music", "production",
      [
          O("longerShots", "求镜头拉长", ["music", "art"], [7, -4]),
          O("shortStems", "改成短小段", ["music", "art"], [3, 2]),
          O("menuOnly", "只放菜单片尾", ["music", "design"], [5, -3]),
      ]),
    C("hireSinger", "要不要请人唱",
      "要不要请人唱歌？请人唱主题，自己哼，还是钱给画面做预告？",
      "music", "production",
      [
          O("hire", "请人唱主题", ["music", "art"], [8, -3]),
          O("humSelf", "自己哼", ["music"], [2]),
          O("trailerArt", "钱给画面", ["art", "music"], [6, -2]),
      ]),
    # --- 填充期 programmer ---
    C("allRedList", "列表上全是红的",
      "列表上全是红的。先修会让人重来的，还是先让新关能进？",
      "programmer", "alpha",
      [
          O("fixRetry", "先修会重来的", ["program", "design"], [7, -4]),
          O("newLevelsIn", "先让新关能进", ["design", "art", "program"], [5, 3, -5]),
          O("hideUgly", "把明显的藏起", ["art", "program"], [4, -5]),
      ]),
    C("downloadTooLong", "下载要很久",
      "游戏太大，下载要很久。贴图压小，语音拿掉留歌，还是不管、先求装得下？",
      "programmer", "alpha",
      [
          O("shrinkArt", "贴图压小", ["program", "art"], [6, -5]),
          O("dropVoice", "语音拿掉", ["program", "music"], [5, -5]),
          O("ignoreSize", "不管", ["program", "art"], [-3, 3]),
      ]),
    C("buildLeaked", "测试版发出去了",
      "同事把测试版发出去了。赶紧修到能看，装死，还是顺着预热？",
      "programmer", "alpha",
      [
          O("rushFix", "赶紧修能看", ["program", "art"], [6, -4]),
          O("playDead", "装死", ["program"], [0]),
          O("leanHype", "顺着预热", ["design", "program"], [5, -3]),
      ]),
    C("featuresFight", "功能互相打架",
      "功能互相打架。砍新技能，关卡全改，还是先关入口？",
      "programmer", "alpha",
      [
          O("cutSkill", "砍新技能", ["program", "design"], [6, -4]),
          O("reworkLevels", "关卡全改", ["design", "art"], [6, -4]),
          O("closeDoor", "先关入口", ["program", "design"], [3, -2]),
      ]),
    # --- 填充期 art ---
    C("texturesBloomed", "贴图花了",
      "贴图花了。一张张修，把灯调暗遮住，还是只修预告出镜的？",
      "art", "alpha",
      [
          O("fixOneByOne", "一张张修", ["art", "design"], [7, -3]),
          O("dimLights", "灯调暗遮住", ["art", "design"], [3, -4]),
          O("trailerOnly", "只修出镜的", ["art"], [4]),
      ]),
    C("clothesMismatch", "衣服关卡对不上",
      "衣服和关卡对不上。补一套衣服，改关卡天气迁就，还是加一件披风？",
      "art", "alpha",
      [
          O("extraOutfit", "补一套衣服", ["art", "design"], [6, -3]),
          O("changeWeather", "改天气迁就", ["design", "art"], [5, -2]),
          O("addCape", "加一件披风", ["art"], [3]),
      ]),
    C("feetFloat", "走路脚不沾地",
      "走路脚不沾地。重做走路，加快镜头，还是加尘土和声音遮丑？",
      "art", "alpha",
      [
          O("redoWalk", "重做走路", ["art", "design"], [7, -3]),
          O("fasterCam", "加快镜头", ["art", "design"], [-3, 3]),
          O("dustSfx", "尘土声音遮丑", ["music", "art"], [4, 3]),
      ]),
    C("posterVsGame", "海报和游戏不像",
      "海报和游戏里不像。游戏往海报靠，海报画真实点，还是各管各的？",
      "art", "alpha",
      [
          O("gameToPoster", "游戏往海报靠", ["art", "program"], [7, -5]),
          O("posterHonest", "海报画真实点", ["design", "art"], [5, -2]),
          O("ignoreGap", "各管各的", ["art", "design"], [-3, -3]),
      ]),
    # --- 填充期 design ---
    C("twiceWrittenHalfDone", "写了两倍做一半",
      "内容写了两倍，做完一半。砍支线保主线，支线全留用过场粘，还是支线改成再打一次？",
      "design", "alpha",
      [
          O("cutSide", "砍支线保主线", ["design", "music"], [7, -3]),
          O("keepSideCutscene", "支线用过场粘", ["art", "design"], [5, -4]),
          O("sideReplay", "支线再打一次", ["program", "design"], [-4, 4]),
      ]),
    C("numbersExploded", "数字炸了",
      "数值炸了。整周只调数字，加简单模式，还是不调、说这就是高难度？",
      "design", "alpha",
      [
          O("tuneWeek", "整周调数字", ["design", "program"], [7, -2]),
          O("easyMode", "加简单模式", ["design", "art"], [4, -3]),
          O("callHard", "不调说很难", ["design"], [-3]),
      ]),
    C("hatedLevel", "有一关人人嫌",
      "有一关所有人都讨厌。删掉，改成可选，还是用剧情解释？",
      "design", "alpha",
      [
          O("deleteIt", "删掉", ["design", "music"], [6, -3]),
          O("makeOptional", "改成可选", ["design"], [4]),
          O("storyExcuse", "用剧情解释", ["music", "design"], [5, -2]),
      ]),
    C("feelsLikeOtherGame", "被人说像某款",
      "玩法被人说像某款。改核心，改皮不改骨，还是当致敬？",
      "design", "alpha",
      [
          O("changeCore", "改核心", ["design", "art"], [7, -4]),
          O("reskinKeep", "改皮不改骨", ["art", "design"], [4, -3]),
          O("callHomage", "当致敬", ["design"], [2]),
      ]),
    # --- 填充期 music ---
    C("oneSongFortyMin", "一首歌转四十分钟",
      "同一首曲子循环四十分钟。每区换新歌，同一首变奏，还是人力去补小声音？",
      "music", "alpha",
      [
          O("newPerArea", "每区换新歌", ["music", "art"], [8, -4]),
          O("variations", "同一首变奏", ["music"], [3]),
          O("moreSfx", "去补小声音", ["design", "music"], [5, -3]),
      ]),
    C("vendorFlaked", "外包鸽了",
      "外包鸽了。自己通宵顶，用以前的改，还是这区先静音？",
      "music", "alpha",
      [
          O("allNighter", "自己通宵顶", ["music", "art"], [6, -3]),
          O("reuseOld", "用以前的改", ["music"], [2]),
          O("muteArea", "这区先静音", ["music"], [-5]),
      ]),
    C("voiceVsMusic", "说话和歌曲抢",
      "对白和音乐抢音量。说话时把歌拧小，歌保持大声，还是少说话多靠画面？",
      "music", "alpha",
      [
          O("duckSong", "说话时拧小", ["music", "art"], [7, -3]),
          O("songLoud", "歌保持大声", ["music", "design"], [3, -4]),
          O("lessTalk", "少说话靠画面", ["art", "music"], [5, -2]),
      ]),
    C("shortVideoHook", "要不要抓耳副歌",
      "要不要做能发短视频的歌？做抓耳副歌，服务游戏气氛，还是另做三十秒预告？",
      "music", "alpha",
      [
          O("catchyChorus", "做抓耳副歌", ["music", "design"], [7, -3]),
          O("serveGame", "服务游戏气氛", ["design", "music"], [5, -2]),
          O("thirtySec", "另做三十秒", ["music", "art"], [3, 3]),
      ]),
    # --- 打磨 programmer ---
    C("crashStillThere", "闪退还在",
      "闪退还在。这周只修闪退，先调手感，还是画面差一点但更稳？",
      "programmer", "polish",
      [
          O("crashWeek", "这周只修闪退", ["program", "design"], [7, -4]),
          O("feelFirst", "先调手感", ["design", "program"], [6, -4]),
          O("uglierStable", "差一点更稳", ["program", "art"], [4, -5]),
      ]),
    C("loadTooLong", "加载太久",
      "加载太久。拆小勤进，一次加载完，还是加载时放笑话？",
      "programmer", "polish",
      [
          O("splitLoads", "拆小勤进", ["program", "art"], [5, -4]),
          O("oneLoad", "一次加载完", ["art", "program"], [4, -3]),
          O("jokeLoad", "加载放笑话", ["design", "program"], [4, -2]),
      ]),
    C("controlsFloat", "操作发飘",
      "操作发飘。整周调手感，加大判定更好过，还是加辅助？",
      "programmer", "polish",
      [
          O("tuneFeel", "整周调手感", ["design", "program"], [6, -2]),
          O("biggerHit", "加大判定", ["design"], [4]),
          O("assist", "加辅助", ["design", "art"], [3, -3]),
      ]),
    C("weekendCrunch", "周末还来吗",
      "制作人在群里问：周末还来吗？",
      "programmer", "polish",
      [
          O("comeIn", "来", ["program", "art"], [6, -3]),
          O("nextWeek", "下周补", ["design"], [-2]),
          O("crashOnly", "只来修闪退", ["program"], [4]),
      ]),
    # --- 打磨 art ---
    C("menuIsBoxes", "菜单还是方块",
      "菜单还是方块。菜单做漂亮，字看清按钮好按，还是套个皮肤？",
      "art", "polish",
      [
          O("prettyMenu", "菜单做漂亮", ["art", "design"], [7, -4]),
          O("readable", "字清按钮好按", ["design", "art"], [6, -3]),
          O("skin", "套个皮肤", ["art"], [3]),
      ]),
    C("nightTooDark", "晚上啥都看不清",
      "晚上什么都看不清。加灯，保持暗加小地图，还是不改就是吓人？",
      "art", "polish",
      [
          O("addLights", "加灯", ["art", "design"], [3, 6]),
          O("darkPlusMap", "暗加小地图", ["design", "art"], [5, -3]),
          O("keepScary", "不改就吓人", ["art", "design"], [6, -4]),
      ]),
    C("trailerTooPretty", "预告比游戏美",
      "预告片太美，游戏跟不上。游戏往片子靠，预告用游戏里能见到的，还是预告继续美？",
      "art", "polish",
      [
          O("gameCatchUp", "游戏往片子靠", ["art", "program"], [7, -4]),
          O("honestTrailer", "预告用实机", ["design", "art"], [5, -2]),
          O("keepPretty", "预告继续美", ["design", "art"], [-4, 3]),
      ]),
    C("deadFaces", "表情是死的",
      "表情是死的。补表情，多用镜头切，还是加配音遮丑？",
      "art", "polish",
      [
          O("addFaces", "补表情", ["art", "design"], [7, -3]),
          O("moreCuts", "多用镜头切", ["art"], [3]),
          O("voiceCover", "加配音遮丑", ["music", "art"], [5, -2]),
      ]),
    # --- 打磨 design ---
    C("endingRushed", "结尾太赶",
      "结尾太赶。砍前面把时间给结尾，加一章，还是用过场讲完？",
      "design", "polish",
      [
          O("cutFront", "砍前保结尾", ["design", "art"], [7, -3]),
          O("addChapter", "加一章", ["design", "program"], [4, -5]),
          O("cutsceneEnd", "用过场讲完", ["music", "design"], [5, -4]),
      ]),
    C("tooManyHints", "提示太多了",
      "提示太多了。清掉一半，做成可关，还是再加？",
      "design", "polish",
      [
          O("cutHalf", "清掉一半", ["art", "design"], [5, -3]),
          O("toggle", "做成可关", ["design"], [4]),
          O("addMore", "再加", ["design", "art"], [2, -4]),
      ]),
    C("achievementsNoise", "成就在刷存在",
      "成就和收集在刷存在感。砍收集保手感，按表堆满，还是宝箱只放路上？",
      "design", "polish",
      [
          O("cutCollect", "砍收集保手感", ["design", "music"], [7, -3]),
          O("fillTable", "按表堆满", ["art", "design"], [3, -4]),
          O("chestsOnPath", "宝箱放路上", ["design"], [4]),
      ]),
    C("lastNewMode", "最后加新模式",
      "最后要不要加新模式？加，不加把现在打磨完，还是简单计时挑战？",
      "design", "polish",
      [
          O("addMode", "加", ["design", "program"], [5, -5]),
          O("polishNow", "不加先打磨", ["program", "design"], [4, 2]),
          O("timed", "计时挑战", ["design"], [3]),
      ]),
    # --- 打磨 music ---
    C("headphonesPain", "耳机里全是吵",
      "耳机里全是吵。说话时歌要让，保持热闹，还是战斗里把歌拿掉只留打击？",
      "music", "polish",
      [
          O("duckTalk", "说话时歌让", ["music", "art"], [7, -3]),
          O("keepLoud", "保持热闹", ["music", "design"], [3, -4]),
          O("combatHits", "战斗只留打击", ["design", "music"], [5, -2]),
      ]),
    C("noCreditsSong", "片尾曲还没有",
      "片尾曲还没有。这周只写片尾，主题曲放慢当片尾，还是片尾静音？",
      "music", "polish",
      [
          O("writeCredits", "这周只写片尾", ["music", "program"], [7, -3]),
          O("slowTheme", "主题曲放慢", ["music"], [4]),
          O("muteEnd", "片尾静音", ["music"], [-4]),
      ]),
    C("uglyStretch", "有一段被说难听",
      "有一段被说难听。换掉，做成可关音乐，还是改更安静？",
      "music", "polish",
      [
          O("replace", "换掉", ["music", "art"], [7, -3]),
          O("toggleMusic", "做成可关", ["music"], [2]),
          O("quieter", "改更安静", ["music", "design"], [3, 2]),
      ]),
    C("cheapSfx", "音效听着廉价",
      "音效听起来廉价。全换，只换常见十个，还是加大歌盖住？",
      "music", "polish",
      [
          O("replaceAll", "全换", ["music", "design"], [7, -3]),
          O("topTen", "只换常见十个", ["music"], [3]),
          O("loudSong", "加大歌盖住", ["music", "design"], [4, -3]),
      ]),
    # --- 马上要上架 programmer ---
    C("storeTooBig", "文件太大过不了",
      "商店说文件太大过不了。画面压糊一点，语音拿掉，还是勉强塞进去？",
      "programmer", "gold",
      [
          O("mushArt", "画面压糊一点", ["program", "art"], [6, -5]),
          O("dropVoice", "语音拿掉", ["program", "music"], [5, -5]),
          O("squeezeIn", "勉强塞进去", ["program", "art"], [-3, 2]),
      ]),
    C("lastChange", "最后还能改什么",
      "马上要上架了。最后还能改什么？修还会闪退的，按键再调一下，还是别动了？",
      "programmer", "gold",
      [
          O("lastCrash", "修还会闪退的", ["program", "music"], [6, -3]),
          O("lastButtons", "按键再调一下", ["design", "art"], [6, -3]),
          EVEN("freeze", "别动了", 1),
      ]),
    C("reviewEarly", "评测要提前进",
      "评测要提前进游戏。给他们能跑的版本，求晚一周，还是派人盯着别走到坏掉的地方？",
      "programmer", "gold",
      [
          O("giveRunnable", "给能跑的", ["program", "design"], [5, -3]),
          O("delayWeek", "求晚一周", ["design", "program"], [4, -2]),
          O("babysit", "派人盯着", ["art", "program"], [4, -3]),
      ]),
    # --- 马上要上架 art ---
    C("eightShots", "官方要八张图",
      "官方要八张图。通宵做八张好看的，截实机有啥算啥，还是用过场顶上？",
      "art", "gold",
      [
          O("overnight", "通宵做八张", ["art", "program"], [6, -3]),
          O("screenshots", "截实机顶上", ["art", "design"], [-3, 3]),
          O("cutsceneStills", "用过场顶上", ["art", "music"], [4, -2]),
      ]),
    C("noIcon", "图标还没有",
      "图标还没有。画抢眼的，用主角脸，还是纯色标志？",
      "art", "gold",
      [
          O("catchy", "画抢眼的", ["art", "design"], [6, -2]),
          O("heroFace", "用主角脸", ["art", "design"], [3, 2]),
          O("colorLogo", "纯色标志", ["art"], [-4]),
      ]),
    C("lastStyleChange", "最后改不改画风",
      "最后要不要改画风？整体改，不改，还是只改菜单和海报？",
      "art", "gold",
      [
          O("fullRedo", "整体改", ["art", "program"], [5, -5]),
          EVEN("leave", "不改", 1),
          O("menuPoster", "只改菜单海报", ["art", "design"], [4, -3]),
      ]),
    # --- 马上要上架 design ---
    C("reviewThreeHours", "评测只要三小时",
      "评测只要三小时能看懂。标准路线，让他们自己逛，还是做个快速看完模式？",
      "design", "gold",
      [
          O("criticalPath", "标准路线", ["design", "program"], [5, -2]),
          O("wander", "让他们自己逛", ["art", "design"], [3, -2]),
          O("speedMode", "快速看完", ["design", "art"], [3, -3]),
      ]),
    C("hideEaster", "要不要藏彩蛋",
      "要不要藏彩蛋？藏，不藏，还是只在标题画面藏一句？",
      "design", "gold",
      [
          O("hide", "藏", ["design", "program"], [5, -4]),
          O("no", "不藏", ["design"], [0]),
          O("titleGag", "标题藏一句", ["design", "music"], [2, 2]),
      ]),
    C("whoWritesManual", "说明书谁写",
      "说明书谁写？你写清楚，游戏里弹窗，还是不写做视频？",
      "design", "gold",
      [
          O("youWrite", "你写清楚", ["design", "art"], [5, -3]),
          O("ingamePopup", "游戏里弹窗", ["design", "art"], [2, -2]),
          O("video", "不写做视频", ["art", "design"], [4, -2]),
      ]),
    # --- 马上要上架 music ---
    C("onlyOneSong", "只能完成一首",
      "只能完成一首。片尾，标题画面每次打开听到，还是战斗那首？",
      "music", "gold",
      [
          O("credits", "片尾", ["music", "design"], [7, -3]),
          O("titleLoop", "标题每次听到", ["music", "art"], [5, 2]),
          O("battle", "战斗那首", ["design", "music", "program"], [4, 4, -2]),
      ]),
    C("trailerNeedsSong", "预告片要歌",
      "预告片要歌。最好的那首给他们，另做三十秒，还是旧素材顶？",
      "music", "gold",
      [
          O("bestOne", "最好的给他们", ["music", "design"], [5, -3]),
          O("thirtySec", "另做三十秒", ["music", "art"], [4, 3]),
          O("oldPack", "旧素材顶", ["music", "art"], [-2, 2]),
      ]),
    C("placeholderAudio", "上架前还有占位音",
      "上架前还有占位音。连夜换最丢人的几个，全听一遍换掉，还是赌没人注意？",
      "music", "gold",
      [
          O("shameFirst", "连夜换丢人的", ["music"], [4]),
          O("listenAll", "全听一遍换掉", ["music", "art"], [6, -3]),
          O("gamble", "赌没人注意", ["music"], [-4]),
      ]),
]

POST_LAUNCH_CHOICES = [
    P("mustCrash", "必现闪退",
      "已经上架了，必现闪退。连夜修，先发公告，还是等周末？",
      "programmer",
      [
          O("overnight", "连夜修", ["program"], [6]),
          O("announce", "先发公告", ["program"], [2]),
          O("weekend", "等周末", ["program"], [-2]),
      ]),
    P("saveLost", "存档丢了",
      "已经上架了，有人存档丢了。给补偿，只修以后的，还是装死？",
      "programmer",
      [
          O("compensate", "给补偿", ["design", "program"], [4, 3]),
          O("futureOnly", "只修以后的", ["program"], [4]),
          O("playDead", "装死", ["program"], [-3]),
      ]),
    P("cheatTool", "有人开挂",
      "群里说有人开挂。赶紧堵，先发公告，还是装死？",
      "programmer",
      [
          O("patch", "赶紧堵", ["program", "design"], [6, -3]),
          O("announceBan", "先发公告", ["program"], [2]),
          O("ignore", "装死", ["program"], [-3]),
      ]),
    P("brokenArtHot", "破图上热门",
      "破图上热门了。立刻补，先撤那张图，还是等大更新？",
      "art",
      [
          O("fixNow", "立刻补", ["art"], [5]),
          O("takeDown", "先撤那张图", ["art"], [2]),
          O("waitPatch", "等大更新", ["art"], [-2]),
      ]),
    P("notLikeTrailer", "和预告不像",
      "已经上架了，有人说和预告不像。补画面，承认滤镜，还是先发说明？",
      "art",
      [
          O("addArt", "补画面", ["art", "program"], [5, -3]),
          O("admitFilter", "承认滤镜", ["art", "design"], [-2, 2]),
          O("noteFirst", "先发说明", ["design", "art"], [2, -1]),
      ]),
    P("hatedLevelReviews", "差评骂某一关",
      "差评在骂某一关。砍掉，调简单，还是发攻略不改？",
      "design",
      [
          O("cut", "砍掉", ["design", "music"], [5, -2]),
          O("easier", "调简单", ["design"], [4]),
          O("guide", "发攻略不改", ["design"], [-2]),
      ]),
    P("tooGrindy", "太肝",
      "已经上架了，玩家说太肝。减次数，加跳过，还是不改？",
      "design",
      [
          O("lessTimes", "减次数", ["design"], [4]),
          O("skip", "加跳过", ["design"], [3]),
          O("noChange", "不改", ["design"], [-3]),
      ]),
    P("placeholderShipped", "占位音还在",
      "占位音还在游戏里。连夜换，下个补丁，还是当梗认了？",
      "music",
      [
          O("overnight", "连夜换", ["music"], [5]),
          O("nextPatch", "下个补丁", ["music"], [2]),
          O("memeIt", "当梗认了", ["music", "design"], [-2, 3]),
      ]),
    P("memeSong", "被做成鬼畜",
      "某首被做成鬼畜。顺着热度，不管，还是要求别乱剪？",
      "music",
      [
          O("rideHeat", "顺着热度", ["design", "music"], [3, 3]),
          O("ignore", "不管", ["music"], [0]),
          O("takeDown", "要求别乱剪", ["music"], [-2]),
      ]),
]

DEV_EVENTS_COMMENT = (
    "个人线开发事件。有 role 的只进该岗池，有 phase 的只进该阶段池；无 role 的全员可抽。"
    "每条必须指定 qualityDim，禁止随机抽一维讲故事。结果只改 live 质量，不写奖杯。"
    "titleId 仅提高该作出现权重且每作只触发一次。design 对应员工 script。"
)


def visible_text(ev):
    bits = [ev.get("displayName") or "", ev.get("text") or ""]
    for ch in ev.get("choices") or []:
        bits.append(ch.get("label") or "")
    return "\n".join(bits)


def assert_event_ok(ev, require_role_phase=False):
    vid = ev.get("id")
    text = visible_text(ev)
    for word in FORBIDDEN:
        if word in text:
            raise AssertionError("forbidden %r in %s" % (word, vid))
    if ev.get("presentation") == "choice":
        choices = ev.get("choices") or []
        if len(choices) != 3:
            raise AssertionError("%s needs 3 choices, got %s" % (vid, len(choices)))
        for ch in choices:
            if not ch.get("qualityDim"):
                raise AssertionError("%s/%s missing qualityDim" % (vid, ch.get("id")))
            if ch.get("qualityDelta") is None:
                raise AssertionError("%s/%s missing qualityDelta" % (vid, ch.get("id")))
            dims = ch["qualityDim"]
            deltas = ch["qualityDelta"]
            if len(dims) != len(deltas):
                raise AssertionError("%s/%s dim/delta length" % (vid, ch.get("id")))
    if require_role_phase:
        if ev.get("role") not in ROLES:
            raise AssertionError("%s missing role" % vid)
        if ev.get("phase") not in PHASES:
            raise AssertionError("%s missing phase" % vid)


def merge_dev_events(existing):
    by_id = {}
    out = []
    for ev in existing:
        row = dict(ev)
        eid = row.get("id")
        if eid in NOTICE_PATCHES:
            row.update(NOTICE_PATCHES[eid])
        if eid in GENERIC_PATCHES:
            row = GENERIC_PATCHES[eid]
        by_id[eid] = len(out)
        out.append(row)
    insert_at = None
    for i, ev in enumerate(out):
        if ev.get("titleId"):
            insert_at = i
            break
    if insert_at is None:
        insert_at = len(out)
    extra = []
    for ev in CHOICE_EVENTS:
        assert_event_ok(ev, require_role_phase=True)
        if ev["id"] in by_id:
            out[by_id[ev["id"]]] = ev
        else:
            extra.append(ev)
    if extra:
        out[insert_at:insert_at] = extra
    for ev in GENERIC_PATCHES.values():
        assert_event_ok(ev, require_role_phase=False)
    return out


def merge_post_launch_events(existing):
    by_id = {}
    out = []
    for ev in existing:
        row = dict(ev)
        eid = row.get("id")
        if eid in POST_LAUNCH_NOTICE_PATCHES:
            row.update(POST_LAUNCH_NOTICE_PATCHES[eid])
        by_id[eid] = len(out)
        out.append(row)
    for ev in POST_LAUNCH_CHOICES:
        assert_event_ok(ev, require_role_phase=False)
        if not ev.get("role"):
            raise AssertionError("%s postLaunch choice needs role" % ev["id"])
        if ev.get("phase"):
            raise AssertionError("%s postLaunch should not have phase" % ev["id"])
        if ev["id"] in by_id:
            out[by_id[ev["id"]]] = ev
        else:
            out.append(ev)
    return out


def count_table(events):
    table = {role: {phase: 0 for phase in PHASES} for role in ROLES}
    for ev in events:
        if ev.get("presentation") != "choice":
            continue
        role = ev.get("role")
        phase = ev.get("phase")
        if role in table and phase in table[role]:
            table[role][phase] += 1
    return table


def apply_to_world(world):
    spec = world.setdefault("devEvents", {})
    spec["comment"] = DEV_EVENTS_COMMENT
    spec["list"] = merge_dev_events(spec.get("list") or [])
    pl = world.setdefault("postLaunch", {})
    pl["events"] = merge_post_launch_events(pl.get("events") or [])
    ids = [ev["id"] for ev in spec["list"]] + [ev["id"] for ev in pl["events"]]
    if len(ids) != len(set(ids)):
        dup = [i for i in ids if ids.count(i) > 1]
        raise AssertionError("duplicate event ids: %s" % sorted(set(dup)))
    for ev in spec["list"] + pl["events"]:
        text = visible_text(ev)
        for word in FORBIDDEN:
            if word in text:
                raise AssertionError("forbidden %r in %s" % (word, ev.get("id")))
    return world


def main():
    with open(WORLD, "r", encoding="utf-8") as f:
        world = json.load(f)
    apply_to_world(world)
    with open(WORLD, "w", encoding="utf-8", newline="\n") as f:
        json.dump(world, f, ensure_ascii=False, indent=2)
        f.write("\n")
    table = count_table(world["devEvents"]["list"])
    pl_roles = {}
    for ev in world["postLaunch"]["events"]:
        if ev.get("presentation") == "choice" and ev.get("role"):
            pl_roles[ev["role"]] = pl_roles.get(ev["role"], 0) + 1
    print("wrote", WORLD)
    print("devEvents", len(world["devEvents"]["list"]))
    print("postLaunch", len(world["postLaunch"]["events"]))
    print("role x phase choice:")
    print("            " + " ".join("%12s" % p for p in PHASES))
    for role in ROLES:
        cells = " ".join("%12s" % table[role][p] for p in PHASES)
        print("%12s %s" % (role, cells))
    print("postLaunch choice by role", pl_roles)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("career_choice_events failed:", e, file=sys.stderr)
        sys.exit(1)
