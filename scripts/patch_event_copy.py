# -*- coding: utf-8 -*-
"""事件文案改写补丁：按定位路径改写 activity/career-world.json 的文案字段。

用法：python scripts/patch_event_copy.py          # dry-run，只打印
      python scripts/patch_event_copy.py --apply  # 写盘（精确文本替换，保格式）

定位路径用点号分隔；某一段是 "id=xxx" 时表示该层是数组、按 id 取元素。
最后一段是字段名；新值为 None 表示删除该键（用于清掉错误的 speakerBond）。
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW = os.path.join(ROOT, 'activity', 'career-world.json')
APPLY = '--apply' in sys.argv

# 定位路径: 新值。None = 删除该键。
EDITS = []

# ============ A. devEvents（106 条）============
EDITS += [
 ("devEvents.list.id=engineBreakthrough.text", "底层跑通后，加载快了一截，制作人在群里夸了程序这边一句。"),
 ("devEvents.list.id=fatalBug.text", "填充期存档坏了，还时不时闪退，程序这边的方案被当面打回。"),
 ("devEvents.list.id=netcodeCrunch.text", "联机终于稳住了，但这一项只补了程序这边，别的没跟上。"),
 ("devEvents.list.id=screeningWow.text", "内部试映时，过场和场景把制作人看得愣住，表现力当场被加码。"),
 ("devEvents.list.id=styleCut.text", "老板嫌这套又贵又怪，视觉方向收紧，表现力先掉一档。"),
 ("devEvents.list.id=shaderPass.text", "打磨期把终章的材质和灯光补上，整部作品的观感上了一档。"),
 ("devEvents.list.id=levelInspiration.text", "一条教会再考的关卡链跑通了，趣味性这块终于立住。"),
 ("devEvents.list.id=featureCut.text", "核心系统被制作人砍掉一块，设计稿对不上现成关卡，趣味性跟着塌了一块。"),
 ("devEvents.list.id=sysDocLock.text", "前期把循环和数值框架钉死，后面返工变少，趣味性这块先站稳了。"),
 ("devEvents.list.id=themeLock.text", "主题旋律定稿后，整部作品的情绪都跟着配乐走。"),
 ("devEvents.list.id=scoreShrink.text", "外包预算被抽走，曲子只能用循环垫乐顶上，沉浸感明显空了一截。"),
 ("devEvents.list.id=mixPass.text", "打磨期把对白、音效和主旋律的层次拉开，声音这关算是过了。"),
 ("devEvents.list.id=blankStart.text", "电脑里还是一片空白。制作人问你：从零写，还是拿以前的改？"),
 ("devEvents.list.id=blankStart.choices.id=levelTool.label", "先做关卡工具"),
 ("devEvents.list.id=demoDontCrash.text", "下周就要给老板看，存档还不灵。群里有人问：演示那天别崩就行吧？"),
 ("devEvents.list.id=goOnline.text", "群里说不联网就落伍了。制作人让你拍板。"),
 ("devEvents.list.id=stylePushedBack.text", "老板说太素，摆在商店没人点。制作人把图打回来了。"),
 ("devEvents.list.id=charOrWorld.displayName", "画人还是画景"),
 ("devEvents.list.id=refFight.text", "策划丢来一堆截图，说要做成那样。群里吵开了。"),
 ("devEvents.list.id=whatIsTheGame.text", "制作人问：这游戏到底在玩什么？走动作，还是走解谜。"),
 ("devEvents.list.id=oneLevelPlaytest.text", "要不要先做一关给人试？群里有人说，开会用嘴讲也一样。"),
 ("devEvents.list.id=storyDepth.text", "故事压短给玩法让路，还是写满，或者干脆做成能跳过的过场？"),
 ("devEvents.list.id=themeNow.text", "制作人问：现在就要主题曲吗？群里有人说，等能看见画面再写。"),
 ("devEvents.list.id=songOrAmbience.text", "要能让人哼出来的歌，还是铺底的气氛乐？两首都浅浅做也行。"),
 ("devEvents.list.id=songOrAmbience.choices.id=pad.label", "铺底的气氛"),
 ("devEvents.list.id=outsourceTheme.text", "主题请人做，还是自己写、把钱留给画面？用免费素材顶上也不是不行。"),
 ("devEvents.list.id=outsourceTheme.choices.id=freePack.label", "用免费素材"),
 ("devEvents.list.id=animStutter.text", "一跑动画就卡。制作人让你这周定：表现力降一档，还是继续做细。"),
 ("devEvents.list.id=netMismatch.text", "联网对不上，有人能穿墙。先修这个，还是先把单机做扎实？"),
 ("devEvents.list.id=prettyCutscene.text", "过场要不要做漂亮？做成动画贵，漫画翻页和纯文字便宜。"),
 ("devEvents.list.id=colorFight.text", "颜色吵起来了。加饱和度，保持灰底再加亮道具，还是听策划的改亮？"),
 ("devEvents.list.id=colorFight.choices.id=followLead.label", "听策划改亮"),
 ("devEvents.list.id=tooHardPlaytest.text", "太难了，试玩全卡住。补难度曲线加提示，加个跳过，还是不改？"),
 ("devEvents.list.id=tooHardPlaytest.choices.id=hints.label", "补曲线加提示"),
 ("devEvents.list.id=moreFeaturesWeek.text", "这周又要加功能。顶回去，接进来，还是做成能关掉的隐藏项？"),
 ("devEvents.list.id=copyPasteLevels.text", "关卡全在复制粘贴。砍重复留少而精，继续铺量，还是每关塞一个小花招？"),
 ("devEvents.list.id=tutorialOrNot.text", "要不要做教程？做一关慢慢教，弹窗说明，还是干脆不教、让人自己摸？"),
 ("devEvents.list.id=tutorialOrNot.choices.id=noTeach.label", "不教，自己摸"),
 ("devEvents.list.id=tempSfxStill.text", "临时音效还在。这周全部换掉，只换主角的几个，还是先不管？"),
 ("devEvents.list.id=cutsceneChopsSong.text", "过场把歌切碎了。去求他们把镜头拉长，改成短小的分段，还是干脆只放菜单和片尾？"),
 ("devEvents.list.id=hireSinger.text", "要不要请人唱歌？请人唱主题，自己哼，还是把钱给画面做预告？"),
 ("devEvents.list.id=allRedList.text", "缺陷列表上全是红的。先修会让人重来的，还是先让新关能进？"),
 ("devEvents.list.id=allRedList.choices.id=fixRetry.label", "先修会让人重来的"),
 ("devEvents.list.id=downloadTooLong.text", "游戏包太大，下载要很久。贴图压小，语音拿掉留歌，还是先不管、只求装得下？"),
 ("devEvents.list.id=clothesMismatch.text", "衣服和关卡对不上。补一套衣服，改关卡天气迁就，还是干脆加一件披风？"),
 ("devEvents.list.id=feetFloat.text", "走路脚不沾地。重做走路，加快镜头切走，还是加尘土和音效遮丑？"),
 ("devEvents.list.id=feetFloat.choices.id=dustSfx.label", "尘土音效遮丑"),
 ("devEvents.list.id=posterVsGame.text", "海报和游戏里差太多。让游戏往海报靠，海报画真实点，还是各管各的？"),
 ("devEvents.list.id=twiceWrittenHalfDone.text", "内容写了两倍，只做完一半。砍支线保主线，支线全留、用过场串起来，还是把支线改成再打一次？"),
 ("devEvents.list.id=twiceWrittenHalfDone.choices.id=keepSideCutscene.label", "支线用过场串"),
 ("devEvents.list.id=oneSongFortyMin.displayName", "一首歌撑四十分钟"),
 ("devEvents.list.id=oneSongFortyMin.text", "同一首曲子循环了四十分钟。每区换新歌，同一首做变奏，还是把人力投到小音效上？"),
 ("devEvents.list.id=oneSongFortyMin.choices.id=moreSfx.label", "补小音效"),
 ("devEvents.list.id=voiceVsMusic.displayName", "对白和配乐抢"),
 ("devEvents.list.id=voiceVsMusic.text", "对白和配乐在抢音量。说话时把歌压下去，歌保持大声，还是少说话、多靠画面？"),
 ("devEvents.list.id=voiceVsMusic.choices.id=duckSong.label", "说话时把歌拧小"),
 ("devEvents.list.id=shortVideoHook.text", "要不要做一段能当预告的歌？做抓耳的副歌，服务游戏气氛，还是另做三十秒的片子？"),
 ("devEvents.list.id=crashStillThere.text", "闪退还在。这周只修闪退，先调手感，还是画面差一点、但更稳？"),
 ("devEvents.list.id=crashStillThere.choices.id=uglierStable.label", "画面差一点更稳"),
 ("devEvents.list.id=loadTooLong.text", "加载太久。拆成小块勤加载，一次读完，还是加载时放点笑话？"),
 ("devEvents.list.id=loadTooLong.choices.id=splitLoads.label", "拆成小块勤加载"),
 ("devEvents.list.id=loadTooLong.choices.id=jokeLoad.label", "加载时放笑话"),
 ("devEvents.list.id=controlsFloat.text", "操作发飘。整周调手感，加大判定让人好过点，还是加辅助？"),
 ("devEvents.list.id=menuIsBoxes.text", "菜单还是方块。把菜单做漂亮，还是先保证字看得清、按钮好按，或者直接套个皮肤？"),
 ("devEvents.list.id=menuIsBoxes.choices.id=readable.label", "字清、按钮好按"),
 ("devEvents.list.id=nightTooDark.text", "晚上什么都看不清。加灯，保持暗、加个小地图，还是不改、就是这么吓人？"),
 ("devEvents.list.id=nightTooDark.choices.id=darkPlusMap.label", "保持暗加小地图"),
 ("devEvents.list.id=nightTooDark.choices.id=keepScary.label", "不改，就吓人"),
 ("devEvents.list.id=trailerTooPretty.text", "预告片太美，游戏跟不上。让游戏往片子靠，预告改用实机画面，还是预告继续美？"),
 ("devEvents.list.id=deadFaces.text", "表情是死的。补表情，多用镜头切换，还是加配音遮丑？"),
 ("devEvents.list.id=deadFaces.choices.id=moreCuts.label", "多用镜头切换"),
 ("devEvents.list.id=endingRushed.text", "结尾太赶。砍前面、把时间挪给结尾，加一章，还是用过场讲完？"),
 ("devEvents.list.id=tooManyHints.text", "提示太多了。清掉一半，做成能关的，还是再加？"),
 ("devEvents.list.id=achievementsNoise.displayName", "成就在刷存在感"),
 ("devEvents.list.id=achievementsNoise.text", "成就和收集在刷存在感。砍收集保手感，照表堆满，还是让宝箱只出现在路上？"),
 ("devEvents.list.id=achievementsNoise.choices.id=fillTable.label", "照表堆满"),
 ("devEvents.list.id=lastNewMode.text", "最后要不要加新模式？加，还是不加、先把现有的打磨完，或者只做个计时挑战？"),
 ("devEvents.list.id=lastNewMode.choices.id=polishNow.label", "不加，先打磨"),
 ("devEvents.list.id=headphonesPain.text", "耳机里全是吵。说话时让歌退一步，保持热闹，还是战斗里把歌拿掉、只留打击音？"),
 ("devEvents.list.id=noCreditsSong.text", "片尾曲还没有。这周只写片尾，把主题曲放慢当片尾，还是片尾干脆静音？"),
 ("devEvents.list.id=uglyStretch.text", "有一段被说难听。换掉，做成能关的音乐，还是把这段改安静？"),
 ("devEvents.list.id=uglyStretch.choices.id=quieter.label", "改得更安静"),
 ("devEvents.list.id=cheapSfx.text", "音效听着廉价。全换，只换最常见的十个，还是把歌加大盖住？"),
 ("devEvents.list.id=cheapSfx.choices.id=loudSong.label", "把歌加大盖住"),
 ("devEvents.list.id=storeTooBig.text", "商店说文件太大过不了。画面压糊一点，语音拿掉，还是硬塞进去？"),
 ("devEvents.list.id=storeTooBig.choices.id=squeezeIn.label", "硬塞进去"),
 ("devEvents.list.id=reskinLook.choices.id=posterMoney.label", "钱花在大海报"),
 ("devEvents.list.id=lastChange.text", "马上要上架了，最后还能改什么？修还会闪退的，按键再调一下，还是干脆别动了？"),
 ("devEvents.list.id=reviewEarly.text", "评测要提前进游戏。给他们能跑的版本，求晚一周，还是派人盯着、别让他们走到会崩的地方？"),
 ("devEvents.list.id=eightShots.text", "官方要八张图。通宵做八张好看的，截实机、有什么算什么，还是用过场截图顶上？"),
 ("devEvents.list.id=reviewThreeHours.text", "评测只给三小时，得让人看懂。给条标准路线，让他们自己逛，还是做个快速看完模式？"),
 ("devEvents.list.id=hideEaster.text", "要不要藏彩蛋？藏，不藏，还是只在标题画面塞一句？"),
 ("devEvents.list.id=whoWritesManual.text", "说明书谁来写？你写清楚，游戏里弹窗，还是不写、改做视频？"),
 ("devEvents.list.id=whoWritesManual.choices.id=video.label", "不写，做视频"),
 ("devEvents.list.id=onlyOneSong.text", "只能完成一首。放片尾，放标题画面，还是放战斗？"),
 ("devEvents.list.id=trailerNeedsSong.text", "预告片要歌。把最好的那首给他们，另做三十秒，还是拿旧素材顶上？"),
 ("devEvents.list.id=trailerNeedsSong.choices.id=oldPack.label", "旧素材顶上"),
 ("devEvents.list.id=placeholderAudio.text", "上架前还有占位音。连夜换掉最丢人的几个，全听一遍再换，还是赌没人注意？"),
 ("devEvents.list.id=ff7PreRenderLock.text", "预渲染过场的光影和运镜被制作人拍板，表现力明显上了一个台阶。"),
 ("devEvents.list.id=portalPuzzleClick.text", "教会、练习、考核的谜题链跑通，一句话的玩法被写成了能自学的课。"),
 ("devEvents.list.id=botwPhysicsClick.text", "攀爬、抓取和化学引擎开始互相咬合，程序这边把开放世界的骨架撑了起来。"),
 ("devEvents.list.id=playRefClear.text", "晚上把同玩法的旧作通关了一遍，核心循环抄在本子上。"),
 ("devEvents.list.id=goldGenrePass.text", "商店页文案要定稿，你把这部的题材口径又对了一遍。"),
 ("devEvents.list.id=artMoodBoard.text", "你给这部做了题材情绪板，色彩和道具的调子一下子齐了。"),
 ("devEvents.list.id=musicGenreListen.displayName", "同题材听曲"),
 ("devEvents.list.id=musicGenreListen.text", "你把同题材的配乐循环听了一夜，进场的第一个音符就对上了。"),
 ("devEvents.list.id=polishGenreLock.text", "宣发把题材关键词钉死了，你把这部的味道又对了一遍。"),
 ("devEvents.list.id=musicThemeLock.text", "打磨期主题曲要定调，你把这部题材的听感又听扎实了。"),
]

# ============ B. postLaunch（15 条）============
EDITS += [
 ("postLaunch.events.id=hotfixCrash.text", "已经上架了，集中修了几处必现闪退，玩起来稳了一点。"),
 ("postLaunch.events.id=patchNotes.text", "发了热修说明，口碑没立刻变，组里继续守着这部。"),
 ("postLaunch.events.id=reviewHotfix.text", "差评点名的系统补了一刀，好玩轻轻回了一点。"),
 ("postLaunch.events.id=audioGlitch.text", "占位音效混进了正式版，热修时清掉了。"),
 ("postLaunch.events.id=cheatTool.text", "玩家说有人开挂。赶紧堵，先发公告，还是装死？"),
 ("postLaunch.events.id=notLikeTrailer.text", "已经上架了，有人说和预告不像。补画面，承认用了滤镜，还是先发个说明？"),
 ("postLaunch.events.id=memeSong.displayName", "被剪成搞笑视频"),
 ("postLaunch.events.id=memeSong.text", "有段配乐被玩家剪成了搞笑视频。顺着热度，不管，还是要求别乱剪？"),
]

# ============ C. producerEvents（5 条）============
EDITS += [
 ("producerEvents.list.id=prodScopeCut.text", "节点压到头了，你只能二选一：砍掉一块外围系统把工期挤回来，还是硬扛原案。"),
 ("producerEvents.list.id=prodMarketLean.text", "发行希望发售口径更讨喜。你可以往讨喜那边靠一点，也可以守住完成度。"),
 ("producerEvents.list.id=prodAllHands.text", "你把四个岗位的目标对齐了一轮，各维都抬了一点。"),
]

# ============ D. idleGap ============
EDITS += [
 ("idleGap.text", "离下一部正式作品还有不到半年，组里不会为此新开临时项目。选一次，整段空窗都按这个来。"),
 ("idleGap.choices.id=crossTrain.label", "多学点领域外的东西"),
]

# ============ E. eventLines.pathFork ============
EDITS += [
 ("eventLines.pathFork.body", "你已经够格走专家晋升，也可以争取转制作人。两条路暂时只能选一条。"),
]

# ============ F. eventLines（9 条线 + pathFork 已在上方）============
EDITS += [
 ("eventLines.lines.id=company-merger.beats.id=merge.body",
  "{companyName} 已经并进 {companySuccessor}。你跟着转过去，还是趁机离开？"),
 ("eventLines.lines.id=promo-to-director.beats.id=offer.body",
  "上面想把你推上总监。要走正式评审吗？走完流程才会正式任命。"),
 ("eventLines.lines.id=become-producer.beats.id=invite.body",
  "公司缺人扛项目。转制作人后你仍是这家的员工，只是不再挂具体岗位职称。"),
 # --- 前辈线：带 speakerBond 的拍已渲染为「名字：「正文」」，正文必须是台词 ---
 ("eventLines.lines.id=bond-mentor.beats.id=take-in.body",
  "这行不能只靠自己摸。要不要跟我一段时间？"),
 ("eventLines.lines.id=bond-mentor.beats.id=drill.body",
  "接下来几周，我一条条给你拆评审意见。手感先稳住了。"),
 ("eventLines.lines.id=bond-mentor.beats.id=drill.bodyRemote",
  "隔着时差，我一条条给你拆评审意见。手感先稳住了。"),
 ("eventLines.lines.id=bond-mentor.beats.id=rebuke.body",
  "例会上我当着全组改了你的方案。难堪归难堪，改法你记下了吧。"),
 ("eventLines.lines.id=bond-mentor.beats.id=own-voice.body",
  "这是我的一版成稿。你按我的骨架铺，还是改成你自己的说法？"),
 ("eventLines.lines.id=bond-mentor.beats.id=own-voice.bodyRemote",
  "一版成稿发给你了。按我的骨架铺，还是改成你自己的说法？"),
 ("eventLines.lines.id=bond-mentor.beats.id=voice-echo-mirror.body",
  "评审时有人说了一句：这股味道眼熟。你照着我的骨架铺得太久，快分不清哪一笔是自己的了。"),
 ("eventLines.lines.id=bond-mentor.beats.id=voice-echo-mirror.bodyRemote",
  "评审记录传到我手上，我回了一句：像我的手笔。"),
 ("eventLines.lines.id=bond-mentor.beats.id=voice-echo-own.body",
  "有人把你的稿子和我的旧作摆在一起，说这不像同一个人的路子。我没反驳，只批了两个字——再想。"),
 ("eventLines.lines.id=bond-mentor.beats.id=voice-echo-own.bodyRemote",
  "有人在会上提到你的名字，说这不是我那一派的做法。这是夸你。"),
 ("eventLines.lines.id=bond-mentor.beats.id=stand.body",
  "这版你自己扛。后面我不再逐句改了。"),
 ("eventLines.lines.id=bond-mentor.beats.id=stand.bodyRemote",
  "这版你自己扛。邮件里我就不逐句改了。"),
 ("eventLines.lines.id=bond-mentor.beats.id=nominate.body",
  "我把你的名字递进了公司。"),
 ("eventLines.lines.id=bond-mentor.beats.id=nominate.bodyRemote",
  "我给新东家写了一封推荐信。"),
 ("eventLines.lines.id=bond-mentor.beats.id=leave.body",
  "我要去 {successorCompany} 了。位子给你留了一格，跟不跟？不跟也没事。"),
 # --- 同事线 ---
 ("eventLines.lines.id=bond-peer.beats.id=rival.body",
  "{peerName} 和你抢同一块交付。要硬刚一轮，还是把节奏对齐？"),
 ("eventLines.lines.id=bond-peer.beats.id=credit.body",
  "这块交付要署名。和 {peerName} 一起摊开写，还是这份算你的？"),
 ("eventLines.lines.id=bond-peer.beats.id=forced-coop.body",
  "有个卡了很久的模块，把我和你分到同一组了。各做各的，还是把方案摊开？"),
 ("eventLines.lines.id=bond-peer.beats.id=forced-coop.bodyRemote",
  "这个跨公司的坑，又把我俩扯到一起了。各做各的，还是把方案摊开？"),
 ("eventLines.lines.id=bond-peer.beats.id=respect.body",
  "这是我写的一份方案。你上次那个思路我抄了一半，剩下的你看看还能不能用。"),
 ("eventLines.lines.id=bond-peer.beats.id=respect.bodyRemote",
  "发了份文档给你，里面抄了你一半的思路。当年抢交付的事，谁也没再提。"),
 ("eventLines.lines.id=bond-peer.beats.id=finale-relation.body",
  "你和 {peerName} 的这段较劲，总得有个说法。"),
 # --- 后辈线 ---
 ("eventLines.lines.id=bond-junior.beats.id=meet.body",
  "组里来了个新人，说自己叫{juniorName}，总往你工位这边瞟。要不要教两手？"),
 ("eventLines.lines.id=bond-junior.beats.id=copy.body",
  "我把你写的那份清单整套抄了去，连坏习惯也一起抄。"),
 ("eventLines.lines.id=bond-junior.beats.id=copy.bodyRemote",
  "我还在按你发过来的清单做，连坏习惯也一起抄。"),
 ("eventLines.lines.id=bond-junior.beats.id=first-ship.body",
  "我跟着这作走完了发售。清单上那几个名字，我都记住了。"),
 ("eventLines.lines.id=bond-junior.beats.id=teach-echo-well.body",
  "我把你给的那版清单改了一遍，批注比你的还密。这是跟你学的。"),
 ("eventLines.lines.id=bond-junior.beats.id=teach-echo-well.bodyRemote",
  "我自己整理了一版清单，底子是你给的。"),
 ("eventLines.lines.id=bond-junior.beats.id=finale.body",
  "该给他一个去处了。留在组里、推荐去别的工作室，还是让他被人挖走？"),
 ("eventLines.lines.id=bond-junior.beats.id=call.body",
  "他后来还是走了。某天深夜，一个陌生号码打来——接起来，对面沉默了两秒：「……是我。」声音一下就熟了。"),
 ("eventLines.lines.id=bond-junior.beats.id=call.bodyRemote",
  "某天深夜，一个陌生号码打来——接起来，对面沉默了两秒：「……是我。」声音一下就熟了。"),
 ("eventLines.lines.id=bond-junior.beats.id=reveal.body",
  "他说了个名字——{juniorName}。这名字你最近老在榜单上看见。他笑了一声，说当年工位旁边那个总来问问题的，就是他。"),
 # --- 史诗作线 / 回国线 ---
 ("eventLines.lines.id=epic-title.beats.id=weight.body",
  "组里把《{titleName}》当成里程碑在盯。你顶得住，还是觉得要翻车？翻车只会让你离开这家，世界不会改写。"),
 ("eventLines.lines.id=epic-title.beats.id=land.body",
  "《{titleName}》照着它本该有的样子落地了。你没改写它的历史，只是把自己往前推了一截。"),
 ("eventLines.lines.id=era-return-china.beats.id=letter.body",
  "2010 年之后，国内厂商真的起来了。那几部作品已经在排，你要不要回来做？"),
 ("eventLines.lines.id=era-return-china.beats.id=reveal.body",
  "信封上的署名是当年的小满——原来是 {juniorName}。人还在国内的厂里。"),
 ("eventLines.lines.id=era-return-china.beats.id=invite.body",
  "米哈游、鹰角、叠纸都在招人，项目也已经排好。去的话你还是员工：不招人，也不开公司，接制作人岗也一样。"),
]

# === END EDITS ===


def walk_get(root, parts):
    cur = root
    for p in parts:
        if isinstance(cur, list):
            m = re.match(r'^id=(.+)$', p)
            assert m, 'list layer needs id=xxx, got: ' + p
            hit = [x for x in cur if isinstance(x, dict) and x.get('id') == m.group(1)]
            assert len(hit) == 1, 'id not found or not unique: ' + p
            cur = hit[0]
        elif isinstance(cur, dict):
            assert p in cur, 'key not found: ' + p
            cur = cur[p]
        else:
            raise AssertionError('cannot descend into ' + type(cur).__name__ + ' at ' + p)
    return cur


def main():
    raw = open(CW, encoding='utf-8').read()
    data = json.loads(raw)
    out = raw
    changed = 0
    report = []
    for path, new in EDITS:
        parts = path.split('.')
        field = parts[-1]
        parent = walk_get(data, parts[:-1])
        assert field in parent, 'field missing: ' + path
        old = parent[field]
        assert old != new, 'no-op edit: ' + path
        if new is None:
            # 删键：定位到该 beat 的 id 行之后、第一个同 beat 内的 speakerBond 行整行吃掉
            beat_id = None
            for i, p in enumerate(parts):
                if p == 'beats':
                    beat_id = parts[i + 1].split('=', 1)[1]
                    break
            assert beat_id, 'drop needs beats.id in path: ' + path
            val = re.escape(json.dumps(old, ensure_ascii=False))
            pat = re.compile(
                r'(\n[ \t]*"id": "' + re.escape(beat_id) + r'",'
                r'(?:(?!\n[ \t]*"id")(?!\n[ \t]*"speakerBond")[\s\S])*?)'
                r'\n[ \t]*"' + re.escape(field) + r'":\s*' + val + r',')
            hits = len(pat.findall(out))
            assert hits == 1, 'drop key expect 1 hit, got %d: %s' % (hits, path)
            out = pat.sub(r'\1', out, count=1)
            report.append(('DROP', path, old, '(删除字段)'))
        else:
            lit_old = json.dumps(old, ensure_ascii=False)
            lit_new = json.dumps(new, ensure_ascii=False)
            hits = out.count(lit_old)
            assert hits == 1, 'expect 1 hit, got %d: %s' % (hits, path)
            out = out.replace(lit_old, lit_new, 1)
            report.append(('EDIT', path, old, new))
        changed += 1
    for kind, path, old, new in report:
        print('[%s] %s' % (kind, path))
        print('   - ' + str(old))
        print('   + ' + str(new))
    print('\n共 %d 处' % changed)
    if APPLY:
        # 写盘前再验一次可解析
        json.loads(out)
        open(CW, 'w', encoding='utf-8', newline='\n').write(out)
        print('已写盘:', CW)
    else:
        print('（dry-run，未写盘）')


if __name__ == '__main__':
    main()
