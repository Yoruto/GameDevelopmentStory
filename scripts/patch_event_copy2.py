# -*- coding: utf-8 -*-
"""事件文案补丁（第二批）：用语统一 + 选项标签补全 + 少量搭配修正。

与第一批同样的机制：按定位路径取当前值 → 精确文本替换 → 写盘保格式。
用法：python scripts/patch_event_copy2.py [--apply]
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

EDITS = [
 # --- 1. 维度用语回到玩家熟悉的通俗词（与选项 label / 原有的"画面·好玩·音乐"一致）---
 ("devEvents.list.id=screeningWow.text", "内部试映时，过场和场景把制作人看得愣住，画面当场被加码。"),
 ("devEvents.list.id=styleCut.text", "老板嫌这套又贵又怪，视觉方向收紧，画面先掉一档。"),
 ("devEvents.list.id=levelInspiration.text", "一条教会再考的关卡链跑通了，好玩这块终于立住。"),
 ("devEvents.list.id=featureCut.text", "核心系统被制作人砍掉一块，设计稿对不上现成关卡，好玩这块跟着塌了一块。"),
 ("devEvents.list.id=sysDocLock.text", "前期把循环和数值框架钉死，后面返工变少，好玩这块先站稳了。"),
 ("devEvents.list.id=scoreShrink.text", "外包预算被抽走，曲子只能用循环垫乐顶上，音乐这块明显空了一截。"),
 ("devEvents.list.id=animStutter.text", "一跑动画就卡。制作人让你这周定：画面降一档，还是继续做细。"),
 ("devEvents.list.id=ff7PreRenderLock.text", "预渲染过场的光影和运镜被制作人拍板，画面明显上了一个台阶。"),
 ("devEvents.list.id=ff7ThemeLock.text", "主题旋律写进过场后，整部都市故事的情绪，都被配乐托了起来。"),
 # --- 2. 选项标签补全（原标签省略过狠，读不出动作对象）---
 ("devEvents.list.id=saveBrokeAgain.choices.id=fixSave.label", "这周只修存档"),
 ("devEvents.list.id=allRedList.choices.id=hideUgly.label", "把明显的藏起来"),
 ("devEvents.list.id=downloadTooLong.choices.id=ignoreSize.label", "不管，先装下"),
 ("devEvents.list.id=buildLeaked.choices.id=rushFix.label", "赶紧修到能看"),
 ("devEvents.list.id=numbersExploded.choices.id=callHard.label", "不调，说很难"),
 ("devEvents.list.id=reviewEarly.choices.id=giveRunnable.label", "给能跑的版本"),
 ("devEvents.list.id=placeholderAudio.choices.id=shameFirst.label", "连夜换掉最丢人的"),
 ("devEvents.list.id=headphonesPain.choices.id=duckTalk.label", "说话时歌先让"),
 ("devEvents.list.id=onlyOneSong.choices.id=titleLoop.label", "放标题画面"),
 ("devEvents.list.id=copyPasteLevels.choices.id=cutDupes.label", "砍重复留精华"),
 ("devEvents.list.id=lastChange.choices.id=freeze.label", "都别动了"),
 ("devEvents.list.id=trailerNeedsSong.choices.id=bestOne.label", "把最好的给他们"),
 ("devEvents.list.id=prettyCutscene.choices.id=animate.label", "做成动画"),
 ("devEvents.list.id=colorFight.choices.id=moreSat.label", "加饱和度"),
 ("devEvents.list.id=hideEaster.choices.id=titleGag.label", "标题画面藏一句"),
 ("devEvents.list.id=trailerTooPretty.choices.id=honestTrailer.label", "预告用实机画面"),
 ("devEvents.list.id=tempSfxStill.choices.id=replaceAll.label", "这周全部换掉"),
 ("devEvents.list.id=menuIsBoxes.choices.id=prettyMenu.label", "把菜单做漂亮"),
 # --- 3. 少量搭配修正 ---
 ("eventLines.lines.id=bond-junior.beats.id=blame.body", "一次回滚本来该记在你名下，{juniorName} 先认了。"),
]


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


def replace_once(out, parts, lit_old, lit_new, path):
    """在 out 中把 lit_old 替换为 lit_new。若全局不唯一，用路径里的 id 锚点限定范围。"""
    hits = out.count(lit_old)
    if hits == 1:
        return out.replace(lit_old, lit_new, 1)
    assert hits > 1, 'expect >=1 hit, got 0: ' + path
    for p in parts:
        if not p.startswith('id='):
            continue
        anchor = json.dumps(p.split('=', 1)[1], ensure_ascii=False)
        ms = list(re.finditer(r'\n[ \t]*"id": ' + re.escape(anchor) + r',', out))
        if len(ms) != 1:
            continue
        start = ms[0].start()
        seg = out[start:start + 4000]
        if seg.count(lit_old) == 1:
            return out[:start] + seg.replace(lit_old, lit_new, 1) + out[start + 4000:]
    raise AssertionError('cannot disambiguate (%d hits): %s' % (hits, path))


def main():
    raw = open(CW, encoding='utf-8').read()
    data = json.loads(raw)
    out = raw
    for path, new in EDITS:
        parts = path.split('.')
        field = parts[-1]
        parent = walk_get(data, parts[:-1])
        assert field in parent, 'field missing: ' + path
        old = parent[field]
        assert old != new, 'no-op edit: ' + path
        hit_before = out.count(json.dumps(old, ensure_ascii=False))
        out = replace_once(out, parts, json.dumps(old, ensure_ascii=False),
                           json.dumps(new, ensure_ascii=False), path)
        print('[EDIT] %s%s' % (path, '' if hit_before == 1 else '  (同名 %d 处，按事件块限定)' % hit_before))
        print('   - ' + old)
        print('   + ' + new)
    print('\n共 %d 处' % len(EDITS))
    if APPLY:
        json.loads(out)
        open(CW, 'w', encoding='utf-8', newline='\n').write(out)
        print('已写盘:', CW)
    else:
        print('（dry-run，未写盘）')


if __name__ == '__main__':
    main()
