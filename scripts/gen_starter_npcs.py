# -*- coding: utf-8 -*-
"""向 activity/career-world.json 注入「真实业界 NPC（前辈）」，并按真实归属塞进游戏里已有的真实公司。

设计要点
--------
- NPC 用真实业界人物，带固定四维属性 stats={program,design,art,music}（0-100），不成长。
  （sim 的 mentor 绑定目前只读取 name/alias/title/tags/departYear/successor*，stats 作为
   人设数据落库；若以后想让师父把属性传给徒弟，再接 mentor 系统即可。）
- 这些人放进游戏「已经存在」的真实公司（史克威尔/卡普空/世嘉/暴雪/id Software/大宇/金山…），
  不另造虚构公司——真实公司本就是 joinable 的初始可加入公司。
- 已清理上一轮误造的 4 家虚构公司（chenxing/nierin/pixelforge/eurocraft）及其 12 个重复 NPC、
  4 部 catalog 作品：它们把真实人物挂在了假公司里，而史克威尔本来就有坂口博信。

幂等
----
- 公司清理：按 id 集合删除，已删则跳过。
- NPC 新增：按 senior.id 去重（同公司内 & 全局），已存在则跳过。
- 不新增任何 title（真实公司自带 catalog，不会触发「joinable 公司必须有 catalog」测试）。

改完：python3 scripts/sync_config.py && node tests/run-sim-tests.js
"""
from __future__ import print_function

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAREER = os.path.join(ROOT, "activity", "career-world.json")

# 上一轮误造的虚构公司（真实人物应归位到真实公司），此处清理
INVENTED_COMPANIES = {"chenxing", "nierin", "pixelforge", "eurocraft"}
INVENTED_TITLES = {"chenxing-swd1", "nierin-ffd", "pixelforge-dooml", "eurocraft-god"}


def S(program, design, art, music):
    return {"program": program, "design": design, "art": art, "music": music}


# (company_id, senior) —— senior 真人归属到真实公司
NEW_SENIORS = [
    # ===== 日本 =====
    ("square", {"id": "uematsu", "name": "植松伸夫", "alias": "植松伸夫", "title": "音乐总监",
                "bio": "最终幻想配乐之父，旋律一响青春就回来了。", "tags": ["music"],
                "stats": S(48, 70, 55, 97)}),
    ("square", {"id": "amano", "name": "天野喜孝", "alias": "天野喜孝", "title": "美术总监",
                "bio": "最终幻想的视觉灵魂，线条里全是异世界。", "tags": ["art"],
                "stats": S(50, 75, 96, 60)}),
    ("capcom", {"id": "inafune", "name": "稻船敬二", "alias": "稻船敬二", "title": "美术总监",
                "bio": "洛克人、鬼武者的画手，机械线条信手拈来。", "tags": ["art", "design"],
                "stats": S(60, 82, 92, 58)}),
    ("capcom", {"id": "tsujimoto", "name": "辻本宪三", "alias": "辻本宪三", "title": "社长",
                "bio": "卡普空掌门人，把街机手感做成信仰。", "tags": ["producer"],
                "stats": S(55, 80, 50, 50)}),
    ("sega", {"id": "nakayuji", "name": "中裕司", "alias": "中裕司", "title": "首席程序",
               "bio": "音速小子之父，把速度感写进了每一帧。", "tags": ["program", "design"],
               "stats": S(92, 85, 55, 50)}),
    ("sega", {"id": "nanba", "name": "名越稔洋", "alias": "名越稔洋", "title": "制作人",
              "bio": "如龙系列生父，把昭和街头搬进了游戏。", "tags": ["design"],
              "stats": S(55, 88, 72, 60)}),
    ("namco", {"id": "nakamura", "name": "中村雅哉", "alias": "中村雅哉", "title": "创始人",
               "bio": "吃豆人缔造者，迷宫设计开山鼻祖。", "tags": ["producer"],
               "stats": S(70, 78, 55, 52)}),
    ("konami", {"id": "igarashi", "name": "五十岚孝司", "alias": "五十岚孝司", "title": "制作人",
                "bio": "恶魔城（igavan）之父，鞭子甩出了哥特浪漫。", "tags": ["producer", "design"],
                "stats": S(58, 88, 70, 65)}),
    ("fromsoftware", {"id": "kami", "name": "神直利", "alias": "神直利", "title": "社长",
                      "bio": "FromSoftware 创始人，硬核动作的根。", "tags": ["producer"],
                      "stats": S(50, 75, 55, 52)}),
    ("atlus", {"id": "soejima", "name": "副岛成记", "alias": "副岛成记", "title": "美术总监",
               "bio": "女神异闻录的人设之神，红帽风衣封神。", "tags": ["art"],
               "stats": S(50, 78, 94, 62)}),
    ("falcom", {"id": "katom", "name": "加藤正人", "alias": "加藤正人", "title": "剧本",
                "bio": "轨迹系列剧本担当，把国家史诗写成连续剧。", "tags": ["design"],
                "stats": S(45, 92, 60, 70)}),
    ("koei", {"id": "shibasawa", "name": "涩泽光", "alias": "涩泽光", "title": "制作人",
              "bio": "信长之野望系列制作人，历史模拟的代名词。", "tags": ["producer", "design"],
              "stats": S(55, 90, 55, 55)}),
    ("squareEnix", {"id": "saitou", "name": "齐藤阳介", "alias": "齐藤阳介", "title": "制作人",
                    "bio": "最终幻想与勇者斗恶龙统筹人，项目管理的定海神针。", "tags": ["producer"],
                    "stats": S(52, 82, 55, 55)}),
    ("snk", {"id": "funamizu", "name": "船水紀孝", "alias": "船水紀孝", "title": "制作人",
             "bio": "拳皇系列核心制作人，格斗节奏的大师。", "tags": ["producer", "design"],
             "stats": S(55, 82, 75, 60)}),

    # ===== 美国 =====
    ("idsoftware", {"id": "romero", "name": "约翰·罗梅洛", "alias": "Romero", "title": "主程序",
                    "bio": "DOOM 联合缔造者，死亡竞赛的布道者。", "tags": ["program", "design"],
                    "stats": S(90, 88, 55, 50)}),
    ("blizzard", {"id": "brevik", "name": "大卫·布雷维克", "alias": "Brevik", "title": "主程序",
                  "bio": "暗黑破坏神奠基人，战利品掉落的节奏大师。", "tags": ["program", "design"],
                  "stats": S(93, 82, 52, 50)}),
    ("bethesda", {"id": "lefall", "name": "朱利安·里法特", "alias": "Julian", "title": "设计",
                  "bio": "上古卷轴之父，把开放世界写成了诗。", "tags": ["design"],
                  "stats": S(70, 85, 55, 55)}),
    ("bioware", {"id": "muzyka", "name": "雷·穆兹卡", "alias": "Ray", "title": "联合创始人",
                 "bio": "BioWare 联合创始人，角色扮演的叙事先驱。", "tags": ["producer"],
                 "stats": S(55, 80, 55, 55)}),
    ("westwood", {"id": "castle", "name": "路易斯·卡斯特", "alias": "Louis", "title": "主程/美术",
                  "bio": "Westwood 联合创始人，命令与征服的视觉源头。", "tags": ["program", "art"],
                  "stats": S(78, 80, 65, 52)}),
    ("sierra", {"id": "kenwilliams", "name": "肯·威廉", "alias": "Ken", "title": "联合创始人",
                "bio": "Sierra 联合创始人，图形冒险游戏的拓荒者。", "tags": ["program", "producer"],
                "stats": S(80, 75, 50, 52)}),
    ("lucasarts", {"id": "lucas", "name": "乔治·卢卡斯", "alias": "Lucas", "title": "创始人",
                   "bio": "星战之父，把电影叙事带进了游戏。", "tags": ["producer"],
                   "stats": S(45, 78, 60, 65)}),
    ("naughtyDog", {"id": "rubin", "name": "杰森·鲁宾", "alias": "Rubin", "title": "联合创始人",
                    "bio": "顽皮狗联合创始人，把角色演出做到电影级。", "tags": ["program", "art"],
                    "stats": S(78, 82, 80, 52)}),
    ("epic", {"id": "bleszinski", "name": "克里夫·布莱辛斯基", "alias": "Cliff", "title": "设计",
              "bio": "战争机器设计核心，枪械手感的教科书。", "tags": ["design"],
              "stats": S(55, 90, 75, 55)}),
    ("bungie", {"id": "seropian", "name": "亚历克斯·瑟罗皮安", "alias": "Alex", "title": "联合创始人",
                "bio": "Bungie 联合创始人，光环宇宙的起点。", "tags": ["producer"],
                "stats": S(52, 80, 55, 55)}),
    ("firaxis", {"id": "reynolds", "name": "布莱恩·雷诺兹", "alias": "Brian", "title": "设计",
                 "bio": "Alpha Centauri 设计者，把 4X 做成哲学。", "tags": ["design"],
                 "stats": S(70, 92, 55, 55)}),
    ("maxis", {"id": "bradshaw", "name": "露西·布拉德肖", "alias": "Lucy", "title": "制作人",
               "bio": "模拟人生系列制作人，生活模拟的操盘手。", "tags": ["producer"],
               "stats": S(50, 82, 60, 58)}),
    ("lookingGlass", {"id": "neurath", "name": "保罗·内亚里", "alias": "Paul", "title": "创始人",
                      "bio": "Looking Glass 创始人，系统模拟的宗师。", "tags": ["design", "producer"],
                      "stats": S(60, 88, 60, 55)}),
    ("ensemble", {"id": "goodman", "name": "里克·古德曼", "alias": "Rick", "title": "设计",
                  "bio": "帝国时代设计者，即时战略的教科书。", "tags": ["design"],
                  "stats": S(60, 90, 55, 55)}),
    ("rare", {"id": "hollis", "name": "马丁·霍利斯", "alias": "Martin", "title": "设计",
              "bio": "黄金眼 007 设计者，主视角射击的奠基人之一。", "tags": ["design"],
              "stats": S(55, 88, 60, 58)}),
    ("obsidian", {"id": "avellone", "name": "克里斯·阿瓦隆", "alias": "Avellone", "title": "剧本/设计",
                  "bio": "辐射、星球大战旧共和国武僧的叙事大脑。", "tags": ["design"],
                  "stats": S(45, 94, 60, 68)}),
    ("bullfrog", {"id": "edgar", "name": "莱斯·埃德加", "alias": "Les", "title": "联合创始人",
                  "bio": "Bullfrog 联合创始人，上帝游戏的同谋。", "tags": ["producer"],
                  "stats": S(52, 80, 55, 55)}),

    # ===== 中国 =====
    ("softstar", {"id": "yaocn", "name": "姚壮宪", "alias": "姚工", "title": "制作总监",
                  "bio": "仙剑奇侠传之父，一句话撑起一整代人的青春。", "tags": ["producer", "design"],
                  "stats": S(62, 95, 70, 60)}),
    ("softstar", {"id": "caimh", "name": "蔡明宏", "alias": "蔡头", "title": "主策划",
                  "bio": "轩辕剑系列掌门，世界观写得比小说还厚。", "tags": ["design"],
                  "stats": S(55, 90, 65, 58)}),
    ("kingsoft", {"id": "qiubj", "name": "求伯君", "alias": "求总", "title": "技术顾问",
                  "bio": "西山居创始人，键盘上敲出来的江湖。", "tags": ["producer", "program"],
                  "stats": S(92, 70, 50, 55)}),
    ("gamescience", {"id": "yangqi", "name": "杨奇", "alias": "杨奇", "title": "美术总监",
                     "bio": "黑神话悟空美术总监，把东方写实美学拉满。", "tags": ["art"],
                     "stats": S(55, 80, 95, 58)}),

    # ===== 欧洲 =====
    ("supergiant", {"id": "kasavin", "name": "格雷格·卡萨文", "alias": "Greg", "title": "叙事",
                    "bio": "堡垒、黑帝斯叙事设计，把散文写成战斗。", "tags": ["design"],
                    "stats": S(50, 92, 65, 72)}),
    ("remedy", {"id": "leppala", "name": "安西·勒帕宁", "alias": "Anssi", "title": "主程",
                "bio": "控制、心灵杀手技术核心，把叙事融进引擎。", "tags": ["program"],
                "stats": S(85, 78, 55, 55)}),
    ("arkane", {"id": "hsmith", "name": "哈维·史密斯", "alias": "Harvey", "title": "设计",
                "bio": "耻辱系列主设计，沉浸式模拟的旗手。", "tags": ["design"],
                "stats": S(55, 92, 65, 58)}),

    # ===== 韩国 =====
    ("nexon", {"id": "kimjk", "name": "金俊圭", "alias": "金俊圭", "title": "创始人",
               "bio": "Nexon 创始人，把休闲网游做成国民级。", "tags": ["producer"],
               "stats": S(50, 78, 55, 55)}),
]


def validate_senior(s, ctx):
    assert set(s.keys()) >= {"id", "name", "alias", "title", "bio", "tags", "stats"}, \
        "%s senior 字段缺失" % ctx
    for k in ("program", "design", "art", "music"):
        assert 0 <= s["stats"][k] <= 100, "%s senior %s stats.%s 越界" % (ctx, s["id"], k)
    assert len(s["tags"]) >= 1, "%s senior %s 无 tags" % (ctx, s["id"])


def main():
    data = json.load(open(CAREER, "r", encoding="utf-8"))

    # ---- 1) 清理上一轮虚构公司 + 其作品 + openingOffer ----
    before_co = len(data["companies"])
    data["companies"] = [c for c in data["companies"] if c["id"] not in INVENTED_COMPANIES]
    removed_co = before_co - len(data["companies"])

    before_t = len(data["titles"])
    data["titles"] = [t for t in data["titles"] if t["id"] not in INVENTED_TITLES]
    removed_t = before_t - len(data["titles"])

    before_d = len(data["titleDetails"])
    data["titleDetails"] = [x for x in data["titleDetails"] if x["id"] not in INVENTED_TITLES]
    removed_d = before_d - len(data["titleDetails"])

    oo = data.get("openingOffer")
    if isinstance(oo, dict) and "companyIds" in oo:
        before_oo = len(oo["companyIds"])
        oo["companyIds"] = [c for c in oo["companyIds"] if c not in INVENTED_COMPANIES]
        removed_oo = before_oo - len(oo["companyIds"])
    else:
        removed_oo = 0

    # ---- 2) 校验目标公司存在 & 收集已用 senior id（全局去重）----
    comp_by_id = {c["id"]: c for c in data["companies"]}
    used_ids = set()
    for c in data["companies"]:
        for s in (c.get("seniors") or []):
            used_ids.add(s["id"])

    added = 0
    skipped = 0
    for cid, s in NEW_SENIORS:
        validate_senior(s, cid)
        co = comp_by_id.get(cid)
        if co is None:
            print("跳过：目标公司不存在 ->", cid, "(senior", s["id"], ")")
            skipped += 1
            continue
        if s["id"] in used_ids:
            print("跳过已存在 senior:", s["id"], "@", cid)
            skipped += 1
            continue
        co.setdefault("seniors", []).append(s)
        used_ids.add(s["id"])
        added += 1
        print("注入 senior:", s["id"], "-", s["name"], "@", cid)

    with open(CAREER, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("完成。删除虚构公司=%d 作品=%d 作品详情=%d openingOffer=%d；"
          "新增 senior=%d 跳过=%d。companies=%d titles=%d"
          % (removed_co, removed_t, removed_d, removed_oo, added, skipped,
             len(data["companies"]), len(data["titles"])))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("gen_real_npcs failed:", e, file=sys.stderr)
        sys.exit(1)
