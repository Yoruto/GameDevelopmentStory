# -*- coding: utf-8 -*-
"""事件文案优化对照报告：用「改动前备份 vs 当前」做语义 diff，保证 before/after 准确。

用法：python scripts/_build_copy_report.py
"""
import html
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEFORE = os.path.join(ROOT, 'scripts', '_cw_before_eventcopy.json')
AFTER = os.path.join(ROOT, 'activity', 'career-world.json')
TEXT_KEYS = ('displayName', 'text', 'label', 'title', 'body', 'bodyRemote', 'kicker')

# 只看事件相关子树
ROOTS = [
    ('devEvents.list', 'A · 开发事件', '106 条：叙述型（改质量）与抉择型（三选一）'),
    ('postLaunch.events', 'B · 发售后续事件', '15 条：上架后的热修、差评与玩家反馈'),
    ('producerEvents.list', 'C · 制作人事件', '5 条：转制作人之后的拍板'),
    ('idleGap', 'D · 空窗抉择', '1 条：没有在研项目时，整段空窗怎么安排'),
    ('eventLines.pathFork', 'E · 职业分叉', '1 条：晋升与转制作人的二选一'),
    ('eventLines.lines', 'F · 事件线（多拍剧情）', '9 条线：前辈 / 同事 / 后辈 / 合并 / 晋升 / 制作人 / 史诗作 / 回国'),
]


def diff(before, after, path, out):
    if isinstance(after, dict):
        if not isinstance(before, dict):
            before = {}
        for k, v in after.items():
            sub = path + '.' + k
            if k in TEXT_KEYS and isinstance(v, str):
                b = before.get(k)
                if b != v:
                    out.append((sub, b, v))
            else:
                diff(before.get(k), v, sub, out)
    elif isinstance(after, list):
        if not isinstance(before, list):
            before = []
        for i, v in enumerate(after):
            tag = 'id=%s' % v.get('id') if isinstance(v, dict) and v.get('id') else '[%d]' % i
            diff(before[i] if i < len(before) else {}, v, path + '.' + tag, out)


def get(data, dotted):
    cur = data
    for p in dotted.split('.'):
        cur = cur[p]
    return cur


def main():
    b = json.load(open(BEFORE, encoding='utf-8'))
    a = json.load(open(AFTER, encoding='utf-8'))
    allrows = []
    for prefix, title, desc in ROOTS:
        rows = []
        diff(get(b, prefix), get(a, prefix), prefix, rows)
        allrows.append((title, desc, rows))

    total = sum(len(r) for _, _, r in allrows)
    parts = ['<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
             '<title>事件文案优化对照表</title><style>',
             'body{font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;background:#f6f7f9;color:#1b1f24;margin:0;padding:28px 20px 64px;line-height:1.6}',
             'h1{font-size:22px;margin:0 0 6px}.sub{color:#5b6470;font-size:13px;margin-bottom:8px}',
             '.lead{background:#fff;border:1px solid #e5e8ec;border-left:4px solid #e3b23c;border-radius:8px;padding:12px 16px;margin:18px 0 26px;font-size:13.5px}',
             '.lead b{color:#8a6116}h2{font-size:16px;margin:32px 0 4px;padding-bottom:6px;border-bottom:2px solid #e3b23c}',
             '.gdesc{color:#6b7480;font-size:13px;margin:0 0 12px}',
             '.row{background:#fff;border:1px solid #e5e8ec;border-radius:8px;padding:10px 12px;margin-bottom:8px}',
             '.path{font-family:Consolas,monospace;font-size:11px;color:#8a94a0;margin-bottom:6px;word-break:break-all}',
             '.old{color:#94504f;font-size:13.5px;padding-left:18px;position:relative}',
             '.new{color:#1d6b3f;font-size:13.5px;padding-left:18px;position:relative;font-weight:500}',
             '.old:before{content:"原";position:absolute;left:0;color:#cda6a5;font-size:11px;top:3px}',
             '.new:before{content:"改";position:absolute;left:0;color:#93c2a7;font-size:11px;top:3px}',
             '.badge{display:inline-block;background:#e3b23c;color:#3a2c05;font-size:11px;border-radius:10px;padding:1px 8px;margin-left:8px;vertical-align:2px}',
             'code{background:#eef1f4;border-radius:3px;padding:1px 5px;font-size:12px}',
             '</style></head><body>',
             '<h1>游戏内事件文案优化对照表</h1>',
             '<div class="sub">共 <b>%d</b> 处文案改动 · 源文件 <code>activity/career-world.json</code></div>' % total,
             '<div class="lead">本轮修的三类问题：一是<b>标题与正文脱节</b>（标题说东、正文写西）；'
             '二是<b>句子本身不通</b>（如「拆小勤进」「好玩被写明白了」「气氛垫底」）；'
             '三是<b>出戏表达</b>（内部术语、年代违和的网络词、与选项说法不一致）。'
             '<br>另外修掉一个渲染层的表达错误：带说话人的剧情拍会渲染成「<code>名字：「正文」</code>」，'
             '而这些拍的正文原先写的是第三人称旁白，读起来等于「大伟：『例会上他当着全组改你的方案』」，'
             '已把 9 处正文改写成该角色真正的台词。</div>']

    for title, desc, rows in allrows:
        if not rows:
            continue
        parts.append('<h2>%s<span class="badge">%d 处</span></h2>' % (title, len(rows)))
        parts.append('<p class="gdesc">%s</p>' % desc)
        for path, old, new in rows:
            parts.append('<div class="row"><div class="path">%s</div>' % html.escape(path))
            if old is not None:
                parts.append('<div class="old">%s</div>' % html.escape(old))
            parts.append('<div class="new">%s</div></div>' % html.escape(new))

    parts.append('</body></html>')
    out = os.path.join(ROOT, 'event-copy-review.html')
    open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(parts))
    print('written:', out, 'total changes:', total)
    for title, _, rows in allrows:
        print('  %-22s %d' % (title, len(rows)))


if __name__ == '__main__':
    main()
