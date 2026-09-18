#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成 agent-browser batch 的 stdin JSON（数组的数组）。

用法:
  python gen_batch.py out.json [--run-seconds N] [--shot PATH] [--no-rank] [--months N]

生成的 JSON 用 `agent-browser ... batch < out.json` 喂进去。

三个必须知道的坑：
  * batch 走**命令行参数**时其分词器会吃掉引号（`q('#month-chart')` → `q(#month-chart)`，
    报 "Private field '#month' must be declared"）。eval 一律走 stdin JSON。
  * 本沙箱下 agent-browser 前台执行会被 SIGTERM 收掉，必须 run_in_background。
  * 事件/颁奖弹窗（#dlg-mask）会挡住「下一月」和底部导航，推进器必须一并处理。
"""
import argparse
import json

URL = "file:///E:/GameDevelopmentStory/h5/index.html"

# 页面内自动推进器：事件选项 → 弹窗确定 → 点弹窗本体（颁奖揭晓）→ 下一月
AUTO = (
    "(()=>{const q=s=>document.querySelector(s);"
    "const vis=e=>!!e&&e.getClientRects().length>0;"
    "if(window.__auto)clearInterval(window.__auto);window.__autoN=0;"
    "window.__auto=setInterval(()=>{"
    "const o=q('#dlg-extra [data-event-opt]');if(vis(o)){o.click();return}"
    "const d=q('#dlg');if(vis(d)){"
    "const k=q('#dlg-ok');if(vis(k)){k.click();return}d.click();return}"
    "const t=q('#btn-tick');if(vis(t)&&!t.disabled){t.click();window.__autoN++}"
    "},90);return 'auto-on'})()"
)
STOP = "(()=>{if(window.__auto)clearInterval(window.__auto);return window.__autoN})()"


def auto_to(year_month):
    """推进器：跑到指定「年.月」就自己停下。

    为什么需要它：观测量有峰值的月份（例如 2007.10 会让「下月发售」显示
    2007-11 的 6 款名单，是全数据集最长的一个月），靠 --run-seconds 猜时间
    落不准。到达目标月即 clearInterval，剩下的交给 DISMISS。
    """
    target = year_month[0] * 12 + year_month[1]
    return (
        "(()=>{const q=s=>document.querySelector(s);"
        "const vis=e=>!!e&&e.getClientRects().length>0;"
        "const G=window.GDS;"
        "const s0=()=>G&&G.ui&&G.ui.session?G.ui.session.state:null;"
        "const at=()=>{const s=s0();return s?(s.year*12+s.month):-1};"
        "if(window.__auto)clearInterval(window.__auto);window.__autoN=0;"
        "window.__auto=setInterval(()=>{"
        "if(at()>=" + str(target) + "){clearInterval(window.__auto);window.__autoDone=1;return}"
        "const o=q('#dlg-extra [data-event-opt]');if(vis(o)){o.click();return}"
        "const d=q('#dlg');if(vis(d)){"
        "const k=q('#dlg-ok');if(vis(k)){k.click();return}d.click();return}"
        "const t=q('#btn-tick');if(vis(t)&&!t.disabled){t.click();window.__autoN++}"
        "},90);return 'auto-to-" + str(target) + "'})()"
    )

# 收尾：把还开着的弹窗清掉。
# 注意颁奖弹窗（年度盛典）的确定按钮不一定叫 #dlg-ok，所以退化成
# 「点 #dlg-mask 里最后一个非取消按钮」，都没有则点弹窗本体揭晓。
DISMISS = (
    "(()=>{const q=s=>document.querySelector(s);"
    "const m=q('#dlg-mask'),d=q('#dlg');"
    "const vis=e=>!!e&&e.getClientRects().length>0;let n=0;"
    "for(let i=0;i<20;i++){"
    "if(!vis(m))break;"
    "const bs=[].slice.call(m.querySelectorAll('button')).filter(vis)"
    ".filter(b=>b.className.indexOf('dlg-cancel')<0);"
    "if(bs.length){bs[bs.length-1].click();n++}"
    "else if(vis(d)){d.click();n++}else break}"
    "return 'dismiss:'+n})()"
)

# 打开排行榜：先真点底部按钮（真实路径），失败再用同一按钮的 JS click 兜底
NAV_JS = (
    "(()=>{const b=document.getElementById('dock-rank-l1');"
    "if(b){b.click();return 'dock-clicked'}return 'no-dock-btn'})()"
)


def build(run_seconds, shot, to_rank, months, vw, vh, stop_at=None):
    s = [
        ["open", URL],
        ["set", "viewport", str(vw), str(vh)],
        ["reload"],
        ["wait", "--load", "load"],
        ["click", "#btn-start"],
        ["wait", "1500"],
        ["snapshot", "-i"],          # 拿 offer 的 ref
        ["click", "@e2"],            # 第一份 offer：入职
        ["wait", "1500"],
    ]
    if stop_at:
        # 定点停下：给足执行时间，靠页面内条件退出而不是靠 sleep 猜。
        # 实测推进速度约 3–4.4 月/秒（受动画影响），按 3 月/秒预算再留 15 秒余量；
        # 多给的时间不会过冲（推进器到点自己停）。
        months_n = stop_at[0] * 12 + stop_at[1] - (1998 * 12 + 1)
        budget = int(months_n / 3.0) * 1000 + 15000
        s += [
            ["eval", auto_to(stop_at)],
            ["wait", str(budget)],
            ["eval", "(()=>{const G=window.GDS;const s=G&&G.ui&&G.ui.session?G.ui.session.state:null;"
                     "if(window.__auto)clearInterval(window.__auto);"
                     "return (s?s.year+'.'+s.month:'?')+' calls='+window.__autoN+' done='+(window.__autoDone||0)})()"],
            ["eval", DISMISS],
            ["wait", "700"],
            ["eval", DISMISS],
            ["wait", "700"],
            # 必须在这里读 title：这是「此刻」的探针报告。
            # 漏掉它的话，唯一一次 QA 输出来自 `open` 阶段——那时 set viewport 还没执行，
            # 量到的是默认视口（1262×624），会被误读成「视口没生效」。
            ["get", "title"],
        ]
    elif run_seconds > 0:
        s += [
            ["eval", AUTO],
            ["wait", str(int(run_seconds * 1000))],
            ["eval", STOP],
            ["eval", DISMISS],
            ["wait", "700"],
            ["eval", DISMISS],
            ["wait", "700"],
            ["get", "title"],
        ]
    for _ in range(months):
        s += [["click", "#btn-tick"], ["wait", "260"]]
    if to_rank:
        s += [
            ["eval", DISMISS],
            ["wait", "800"],
            ["snapshot", "-i"],
            ["click", "#dock-rank-l1"],
            ["wait", "1200"],
            ["eval", NAV_JS],
            ["wait", "1600"],
            ["get", "title"],
            ["snapshot"],
        ]
    s += [["errors"]]
    if shot:
        s.append(["screenshot", shot])
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--run-seconds", type=float, default=0)
    ap.add_argument("--months", type=int, default=0)
    ap.add_argument("--vw", type=int, default=390)
    ap.add_argument("--vh", type=int, default=844)
    ap.add_argument("--shot", default="")
    ap.add_argument("--no-rank", action="store_true")
    ap.add_argument("--stop-at", default="", help="定点停下，如 2007-10（推进器跑到该月即停）")
    a = ap.parse_args()
    stop_at = None
    if a.stop_at:
        y, m = a.stop_at.split("-")
        stop_at = (int(y), int(m))
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(build(a.run_seconds, a.shot, not a.no_rank, a.months, a.vw, a.vh, stop_at), f)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
