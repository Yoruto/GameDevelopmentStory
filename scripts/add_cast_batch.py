# -*- coding: utf-8 -*-
"""add_cast_batch.py —— careerWorld.cast 第二批：补真实人物（阶段 3）。

补什么（按实测缺口优先级）：
  1) 驻员 programmer / art —— 改造前全库只有 13 / 4 人，是「队友贴近真实角色」最大的短板
  2) freelance 作曲 18 + 插画/概念 8 —— 一次覆盖 75 家公司的 music 缺口
     （现实里音乐与美术本就大量外包，所以它们不该绑公司）

原则是**宁缺毋滥**：只写确有其人的从业者、以及其在行业内的真实岗位。
不确定的公司一律留白 —— 由 sim.castFor 返回 null 落到随机角色，这正是拍板要的降级链路。

字段顺序：
  STAFF    = (companyId, id, 真名, 虚构名, roles, title, bio)          # region/tier 从公司取
  FREELANCE= (id, 真名, 虚构名, region, roles, title, bio, fromYear)   # 不绑公司

虚构名规则与第一批一致：亚洲名保留姓氏换名；西文名整体重写为气质相近的另一姓名。
"""
import json
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "activity", "career-world.json")

# ── 驻员：真实人物 + 所属公司 ────────────────────────────────────────────────
STAFF = [
    # ── 日本 ──────────────────────────────────────────────────────────────
    ("nintendo", "nakago", "中乡俊彦", "中乡俊也", ["programmer"], "程序组长",
     "马里奥和塞尔达的代码他都过手，先跑通再谈创意。"),
    ("nintendo", "imamura", "今村孝矢", "今村孝也", ["art"], "角色设计",
     "F-Zero 和星际火狐的形象出自他手，草稿本不离身。"),
    ("sony", "cerny", "马克·塞尔尼", "马克·塞尔文", ["programmer"], "硬件架构",
     "先把机器做对，再谈游戏怎么做。"),
    ("sega", "naka", "中裕司", "中裕史", ["programmer"], "索尼克组组长",
     "跑得比谁都快的角色，得配一个同样快的程序。"),
    ("sega", "ohshima", "大岛直人", "大岛直纪", ["art"], "角色设计",
     "蓝刺猬的圆脸和红鞋，都是他定下来的。"),
    ("square", "gebelli", "纳西尔·格贝利", "纳赛尔·贝尔", ["programmer"], "主程序",
     "把一整部史诗塞进卡带的容量里。"),
    ("square", "amano", "天野喜孝", "天野芳孝", ["art"], "美术",
     "他的笔触让幻想有了重量。"),
    ("squareEnix", "kawazu", "河津秋敏", "河津明", ["design", "producer"], "制作人",
     "沙加系列的自由度是他的执念。"),
    ("capcom", "akiman", "安田朗", "安田亮", ["art"], "角色设计",
     "春丽的腿和隆的拳，都是他画出来的。"),
    ("capcom", "okamoto", "冈本吉起", "冈本吉纪", ["producer"], "制作人",
     "街机厅里的胜负，他比谁都上心。"),
    ("konami", "shinkawa", "新川洋司", "新川洋介", ["art"], "艺术总监",
     "水墨和机械混在一起，就成了他的签名。"),
    ("namco", "ono", "小野浩", "小野浩司", ["art"], "像素美术",
     "吃豆人和铁板阵的点阵，一颗一颗是他摆的。"),
    ("atlus", "kaneko", "金子一马", "金子一真", ["art"], "恶魔设计",
     "神和魔都从他的素描本里走出来。"),
    ("atlus", "soejima", "副岛成记", "副岛成纪", ["art"], "角色设计",
     "青春和异色，他能画在同一张脸上。"),
    ("gamefreak", "sugimori", "杉森建", "杉森健", ["art"], "角色设计",
     "一百多只怪兽，每一只都是他先画出来。"),
    ("gamefreak", "masuda", "增田顺一", "增田顺二", ["programmer", "design"], "开发部长",
     "配乐和程序都写过，他说数据平衡是门手艺。"),
    ("fromsoftware", "zin", "神直利", "神直纪", ["programmer", "producer"], "会长",
     "公司是他从做企业软件起家的，代码底子比谁都硬。"),
    ("platinum", "inaba", "稻叶敦志", "稻叶敦", ["producer"], "制作人",
     "动作要打得爽，也要卖得动。"),
    ("treasure", "iuchi", "井内洋", "井内广", ["programmer"], "创始人",
     "弹幕和像素，他能同时做得漂亮。"),
    # ── 美国 ──────────────────────────────────────────────────────────────
    ("naughtyDog", "druckmann", "尼尔·德鲁克曼", "尼尔·德鲁曼", ["design", "producer"], "创意总监",
     "故事和玩法，是从同一个脑子里长出来的。"),
    ("naughtyDog", "balestra", "克里斯托夫·巴莱斯特拉", "克里斯·巴伦", ["programmer"], "联合总裁",
     "先把工具做顺手，团队才跑得起来。"),
    ("insomniac", "hastings", "布莱恩·黑斯廷斯", "布莱恩·霍尔", ["producer"], "创始人",
     "手感和节奏，他盯得比谁都细。"),
    ("blizzard", "pearce", "弗兰克·皮尔斯", "弗兰克·佩里", ["programmer"], "联合创始人",
     "服务器撑得住，才有资格谈玩法。"),
    ("blizzard", "didier", "桑威斯·迪迪埃", "塞姆·迪兰", ["art"], "艺术总监",
     "画风要一眼认出来，这是他的规矩。"),
    ("valve", "antonov", "维克托·安东诺夫", "维克托·安东", ["art"], "艺术总监",
     "反乌托邦的街景，一半是他走街串巷拍回来的。"),
    ("valve", "laidlaw", "马克·莱德劳", "马克·劳伦斯", ["design"], "编剧",
     "把物理实验室写成了一场事故。"),
    ("idsoftware", "acarmack", "阿德里安·卡马克", "阿德里安·卡森", ["art"], "美术",
     "怪物和枪械的像素，他画得比谁都快。"),
    ("idsoftware", "romero", "约翰·罗梅罗", "约翰·罗梅洛", ["design", "programmer"], "设计师",
     "关卡里每扇门后面，都有他埋的惊喜。"),
    ("bungie", "lehto", "马库斯·莱托", "马库斯·莱恩", ["art"], "艺术总监",
     "盔甲要有重量，天空要有尺度。"),
    ("bungie", "butcher", "克里斯·布彻", "克里斯·布莱克", ["programmer"], "网络架构",
     "两百万人的服务器，他盯过夜。"),
    ("rockstar", "garbut", "亚伦·加伯特", "亚伦·加德纳", ["art"], "艺术总监",
     "城市的每一条街都被人手打磨过。"),
    ("epic", "bleszinski", "克里夫·布莱辛斯基", "克里夫·布莱克", ["design", "producer"], "设计总监",
     "枪感要重，怪物要大。"),
    ("epic", "perna", "克里斯·佩尔纳", "克里斯·佩里", ["art"], "美术总监",
     "引擎能跑的光影，他先想好要什么效果。"),
    ("bioware", "muzyka", "雷·穆兹卡", "雷·穆尔", ["producer"], "联合创始人",
     "先问玩家想成为谁，再问他想打什么。"),
    ("bioware", "zeschuk", "格雷格·泽舒克", "格雷格·泽恩", ["producer"], "联合创始人",
     "医生转行做游戏，诊断的是玩家的耐心。"),
    ("origin", "croberts", "克里斯·罗伯茨", "克里斯·罗伯特", ["design", "producer"], "制作人",
     "他要的不是一款游戏，是一整个宇宙。"),
    ("sierra", "kwilliams", "肯·威廉姆斯", "肯·威尔逊", ["producer"], "创始人",
     "先让玩家愿意点开第二个画面。"),
    ("lucasarts", "schafer", "蒂姆·谢弗", "蒂姆·谢菲尔德", ["design"], "设计师",
     "笑点和谜题，他都当同一件事做。"),
    ("riot", "merrill", "马克·梅里尔", "马克·梅森", ["producer"], "联合创始人",
     "玩家骂什么，他就先改什么。"),
    ("ensemble", "goodman", "托尼·古德曼", "托尼·戈德曼", ["producer"], "创始人",
     "帝国时代的每一棵树，他都要它有用。"),
    ("firaxis", "briggs", "杰夫·布里格斯", "杰夫·布莱尔", ["design"], "联合创始人",
     "历史被切成回合，他说这样才好下咽。"),
    ("maxis", "jbraun", "杰夫·布劳恩", "杰夫·布朗", ["producer"], "联合创始人",
     "模拟城市卖得好，他说是因为人人都想当市长。"),
    ("toysForBob", "fford", "弗雷德·福特", "弗雷德·福斯特", ["programmer"], "联合创始人",
     "平台跳跃的手感，是他一行行调出来的。"),
    # ── 欧洲 / 英国 ───────────────────────────────────────────────────────
    ("rare", "mayles", "史蒂夫·梅尔斯", "史蒂夫·梅耶", ["art"], "角色设计",
     "毛茸茸和方块脸，他两种都画得可爱。"),
    ("rare", "sutherland", "克里斯·萨瑟兰", "克里斯·索顿", ["programmer"], "主程序",
     "帧数不掉，是他在底下扛着。"),
    ("ubisoft", "desilets", "帕特里斯·德西莱", "帕特里斯·德兰", ["design", "producer"], "创意总监",
     "在人群里跑酷这件事，他想了很多年。"),
    ("cdpr", "badowski", "亚当·巴多夫斯基", "亚当·巴德", ["design", "producer"], "游戏总监",
     "每个支线都要让人记得住。"),
    ("mojang", "bergensten", "延斯·伯根斯滕", "延斯·贝里", ["programmer"], "主程序",
     "每周更一次，玩家提什么先做什么。"),
    ("dice", "liliegren", "弗雷德里克·利利格伦", "弗雷德里克·林德", ["producer"], "创始人",
     "载具物理要多真，他亲自去开。"),
]

# ── 自由职业：作曲 / 插画概念（不绑公司，任何公司在岗期间都可合作） ──────────
FREELANCE = [
    # (id, 真名, 虚构名, region, roles, title, bio, fromYear)
    ("uematsu", "植松伸夫", "植松伸之", "jp", ["music"], "作曲",
     "旋律先于画面存在，这是他的信条。", 1987),
    ("mitsuda", "光田康典", "光田康介", "jp", ["music"], "作曲",
     "凯尔特和管弦乐，他把它们放进同一个世界。", 1992),
    ("meguro", "目黑将司", "目黑将二", "jp", ["music"], "作曲",
     "酸性爵士配上都市异闻，一听就是他。", 1995),
    ("yamaoka", "山冈晃", "山冈晃弘", "jp", ["music"], "作曲",
     "噪音也是旋律，他证明了这一点。", 1994),
    ("koshiro", "古代祐三", "古代祐介", "jp", ["music"], "作曲",
     "八位机的音源被他榨到了极限。", 1986),
    ("shimomura", "下村阳子", "下村洋子", "jp", ["music"], "作曲",
     "战斗曲能让人记十几年。", 1988),
    ("kondo-koji", "近藤浩治", "近藤浩二", "jp", ["music"], "作曲",
     "一段旋律要能在脑子里循环一整年。", 1984),
    ("sakuraba", "樱庭统", "樱庭彻", "jp", ["music"], "作曲",
     "战斗和哀愁，他换手就来。", 1989),
    ("tanaka", "田中公平", "田中公人", "jp", ["music"], "作曲",
     "热血这件事，他有专门的写法。", 1985),
    ("ito", "伊藤贤治", "伊藤贤二", "jp", ["music"], "作曲",
     "圣剑传说的曲子，他写得比自己预想的更久。", 1990),
    ("sakimoto", "崎元仁", "崎元仁志", "jp", ["music"], "作曲",
     "管弦乐里的战争感，是他的手艺。", 1989),
    ("iwadare", "岩垂德行", "岩垂德彦", "jp", ["music"], "作曲",
     "冒险出发前的那一段，他最拿手。", 1991),
    ("hibino", "日比野则彦", "日比野则之", "jp", ["music"], "作曲",
     "潜入时的呼吸声，也是配乐。", 1998),
    ("zimmer", "汉斯·季默", "汉斯·齐格勒", "us", ["music"], "作曲",
     "低音一压下来，气氛就满了。", 1988),
    ("soule", "杰里米·索尔", "杰里米·索尔兹", "us", ["music"], "作曲",
     "雪原和松林，他有专门的音色。", 1994),
    ("zur", "伊南娜·祖尔", "伊南·祖尔", "us", ["music"], "作曲",
     "末世废土的铜管，他吹得有温度。", 1993),
    ("jackwall", "杰克·沃尔", "杰克·沃伦", "us", ["music"], "作曲",
     "科幻要有铜管，也要有电子音。", 1995),
    ("chenzhiyi", "陈致逸", "陈知逸", "cn", ["music"], "作曲",
     "国风旋律写成交响，是他先动的手。", 2011),
    ("yuki", "结城信辉", "结城信彦", "jp", ["art"], "插画",
     "一笔下去就有风，他说这是手感。", 1988),
    ("iwasaki", "岩崎美奈子", "岩崎美奈", "jp", ["art"], "插画",
     "少女的侧脸，她画得比谁都稳。", 1994),
    ("kawamori", "河森正治", "河森正次", "jp", ["art"], "机械设计",
     "变形这件事，他能算得清清楚楚。", 1984),
    ("izubuchi", "出渕裕", "出渕宽", "jp", ["art"], "机械设计",
     "线条要干净，结构要讲得通。", 1985),
    ("yoshida", "吉田明彦", "吉田晃", "jp", ["art"], "艺术总监",
     "厚重和清透，他能放进同一张画里。", 1993),
    ("minaba", "箕星太朗", "箕星太郎", "jp", ["art"], "插画",
     "线稿干净、上色透亮，一眼认得出。", 2002),
    ("mullins", "克雷格·马林斯", "克雷格·莫兰", "us", ["art"], "概念设计",
     "他没有风格，因为什么风格他都能画。", 1990),
    ("terada", "寺田克也", "寺田克己", "jp", ["art"], "插画",
     "线条又野又准，看一眼就忘不掉。", 1992),
]


def main():
    raw = open(PATH, "rb").read().decode("utf-8")
    world = json.loads(raw)
    cast = world["cast"]
    ids = set(p["id"] for p in cast)
    by_company = {c["id"]: c for c in world["companies"]}

    added = []
    # 1) 驻员
    for company_id, cid, name, alias, roles, title, bio in STAFF:
        assert cid not in ids, "id 冲突: " + cid
        co = by_company.get(company_id)
        assert co is not None, "公司不存在: " + company_id
        # 注：不要求公司已有 seniors —— dice 本就是 0 前辈的公司，新增驻员正好补上它。
        # 引擎侧 sim.careerSeniors 会把「只在 cast 里」的人并入前辈名单，无需双写 seniors。
        from_year = co.get("hireFromYear")
        if from_year is None:
            from_year = co.get("foundedYear")
        ids.add(cid)
        added.append({
            "id": cid,
            "companyId": company_id,
            "real": True,
            "name": name,
            "alias": alias,
            "region": co.get("region", ""),
            "roles": list(roles),
            "tier": co.get("power", 2),
            "title": title,
            "bio": bio,
            "career": [{
                "companyId": company_id,
                "fromYear": from_year,
                "toYear": None,
                "title": title,
            }],
        })
    # 2) 自由职业
    for cid, name, alias, region, roles, title, bio, from_year in FREELANCE:
        assert cid not in ids, "id 冲突: " + cid
        ids.add(cid)
        added.append({
            "id": cid,
            "companyId": None,
            "real": True,
            "attach": "freelance",
            "name": name,
            "alias": alias,
            "region": region,
            "roles": list(roles),
            "tier": 3,
            "title": title,
            "bio": bio,
            "career": [{
                "companyId": None,
                "fromYear": from_year,
                "toYear": None,
                "title": title,
            }],
        })

    # ── 追加到 cast 数组末尾（文本操作，不整文件重排）──────────────────────
    marker = "\n ]\n}\n"
    assert raw.endswith(marker), "文件尾结构变了"
    blocks = []
    for e in added:
        b = json.dumps(e, ensure_ascii=False, indent=1)
        b = "\n".join(" " + ln for ln in b.split("\n"))
        blocks.append(b)
    raw_new = raw[:-len(marker)] + ",\n" + ",\n".join(blocks) + marker

    chk = json.loads(raw_new)
    assert len(chk["cast"]) == len(cast) + len(added)
    assert chk["companies"] == world["companies"], "companies 被动过"
    assert chk["nameMode"] == "real"
    assert "\r\n" not in raw_new
    with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(raw_new)

    from collections import Counter
    print("新增 cast %d 条（驻员 %d / 自由职业 %d），总计 %d"
          % (len(added), len(STAFF), len(FREELANCE), len(chk["cast"])))
    cov = Counter()
    for p in chk["cast"]:
        if p.get("attach") == "freelance":
            continue
        for r in p["roles"]:
            cov[r] += 1
    print("驻员岗位覆盖:", dict(cov))
    print("无驻员覆盖的公司岗位缺口（由 random 兜底）:")
    miss = Counter()
    for c in chk["companies"]:
        roles = set(r for p in chk["cast"]
                    if p.get("companyId") == c["id"] and p.get("attach") != "freelance"
                    for r in p["roles"])
        for k in ["producer", "design", "programmer", "art"]:
            if k not in roles:
                miss[k] += 1
    print("  ", dict(miss))
    return 0


if __name__ == "__main__":
    sys.exit(main())
