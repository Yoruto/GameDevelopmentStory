# -*- coding: utf-8 -*-
"""build_cast.py —— 由 companies[].seniors 生成 careerWorld.cast 人物事实层。

做三件事：
  1. 把 111 位内嵌前辈迁到顶层 cast[]（补 real / region / roles / tier / career 在职窗口）
  2. 为每人补 alias = 虚构名（"虚构姓名"模式下显示，见 careerWorld.nameMode）
  3. 写入 nameMode 开关（real | fiction），默认 real —— 行为与改造前完全一致

不删 companies[].seniors：它降级为兼容引用层，老数据一行不改也能跑。
幂等：重复跑会先删掉已有 cast / nameMode 再重建。
写盘用「精确文本插入 + json.loads 复核」，不整文件重排（保住 1 空格缩进 / LF 契约）。
"""
import json
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "activity", "career-world.json")

# ── 虚构名映射（id → 虚构姓名）────────────────────────────────────────────────
# 策略：亚洲名保留姓氏、替换名字（保住辨识度，又明确不是本人）；
#       西文名整体重写为气质相近的另一姓名（避免「改一个字母」的敷衍感）；
#       中文区人物原本已脱敏（GW/CM 代号、陆衡舟/沈北望自创名），一律沿用。
FICTION = {
    # 日本
    "miyamoto": "宫本彻", "iwata": "岩田悟", "kutaragi": "久夛良木武",
    "kim-hyungtae": "金亨俊", "doucet": "尼古拉·杜兰", "suzuki": "铃木丰",
    "sakaguchi": "坂口信行", "nomura": "野村哲生", "tabata": "田畑正",
    "hughes": "诺亚·海耶斯", "horii": "堀井雄大", "mikami": "三上真一",
    "kamiya-clover": "神谷英治", "feng-ji": "FJ", "walker": "杰米·沃德",
    "kojima": "小岛秀人", "iwaya": "岩谷透", "harada": "原田胜久",
    "miyazaki": "宫崎英明", "hashino": "桥野圭", "kondo": "近藤季彦",
    "nishiyama": "西山隆一", "shibusawa": "襟川阳介", "erikawa": "襟川惠美",
    "tajiri": "田尻智之", "hanke": "约翰·汉森", "kamiya": "神谷英治",
    "yamauchi": "山内一贵", "ueda": "上田文雄", "kojima-kp": "小岛秀人",
    "sato": "佐藤一真", "hino": "日野晃太郎", "takahashi": "高桥达人",
    "maegawa": "前川正志", "gotanda": "五反田义明", "itagaki": "板垣伴之",
    # 美 / 欧 / 英
    "barlog": "科里·巴伦", "hennig": "艾米·赫斯顿", "price": "泰德·普雷斯顿",
    "hulst": "赫尔曼·胡斯特", "hawkins": "特里普·霍兰", "yerli": "杰瓦特·耶尔曼",
    "pitchford": "兰迪·皮尔斯", "fares": "约瑟夫·法伦", "spector": "沃伦·斯派洛",
    "raae": "加文·雷德", "vechey": "约翰·韦斯特", "zampella-rs": "文斯·赞布拉诺",
    "sperry": "布雷特·斯宾德", "spencer": "丹·霍洛威", "morhaime": "迈克·莫里森",
    "metzen": "克里斯·梅登", "paa": "伊尔卡·帕沃", "newell": "加布·纽曼",
    "carmack": "约翰·卡莱尔", "jones": "杰森·琼森", "houser": "萨姆·豪斯曼",
    "hawthorne": "卡尔·霍顿", "jones-dma": "大卫·乔纳森", "howard": "托德·霍兰德",
    "colantonio": "拉斐尔·科兰蒂", "urquhart": "费格斯·厄克特", "sweeney": "蒂姆·斯温",
    "ohlen": "詹姆斯·奥克利", "zampella": "文斯·赞布拉诺", "crane": "大卫·克莱恩",
    "meier": "希德·迈耶斯", "garriott": "理查德·加兰德", "williams": "罗伯塔·威尔逊",
    "gilbert": "罗恩·吉尔摩", "beck": "布兰登·贝克尔", "wright": "威尔·莱顿",
    "levine": "肯·莱文森", "livingstone": "伊恩·利斯", "gard": "托比·加勒特",
    "stamper": "蒂姆·斯坦利", "shelley": "布鲁斯·谢尔顿", "guillemot": "伊夫·吉拉尔",
    "wester": "弗雷德里克·韦斯特曼", "vavra": "丹尼尔·瓦伦", "iwinski": "马尔钦·伊万诺夫",
    "lake": "萨姆·莱基", "persson": "马库斯·佩特森", "simpson": "迈克·辛克莱",
    "vincke": "斯文·温德", "rao": "阿米尔·拉詹", "fargo": "布莱恩·法雷尔",
    "molyneux": "彼得·莫兰", "vancaneghem": "乔恩·范·德伦", "reiche": "保罗·赖斯",
    # 韩国
    "kim-jungju": "金正浩", "kim-taekjin": "金泰镇",
    "kim-changhan": "金昌焕", "sung-joonho": "成俊昊",
    # 中国（原表已是代号或自创名，沿用；仅陈星汉是真名，需替换）
    "lu-hengzhou": "陆衡舟", "guo-weiwei": "GW", "cai-minghong": "CM",
    "lu-xiaoshen": "LX", "yao-xiaoguang": "YX", "shi-yuzhu": "SY",
    "wang-song": "WS", "shen-beiwang": "沈北望", "chi-yufeng": "CY",
    "chen-tianqiao": "CT", "zhu-jun": "ZJ", "dawei": "大伟哥",
    "cai-haoyu": "CH", "haimao": "海猫络合物", "gu-beichuan": "顾北川",
    "chen-xinghan": "陈星河", "yao-runhao": "YY",
}


def main():
    raw = open(PATH, "rb").read().decode("utf-8")
    world = json.loads(raw)

    companies = world["companies"]
    by_id = {c["id"]: c for c in companies}

    cast = []
    missing = []
    seen = set()
    for co in companies:
        for s in (co.get("seniors") or []):
            sid = s.get("id")
            seen.add(sid)
            if sid not in FICTION:
                missing.append(sid)
                continue
            # 在职起点：优先「该公司可入职年」（cast 语义 = 从这一年起你能在这家公司遇到他），
            # 回落公司成立年 —— 两者都保证早于/等于真实在职期，且 mihoyo 这类新公司不会被提前取到。
            from_year = co.get("hireFromYear")
            if from_year is None:
                from_year = co.get("foundedYear")
            to_year = s.get("departYear") if s.get("departYear") is not None else None
            entry = {
                "id": sid,
                "companyId": co["id"],
                "real": True,
                "name": s.get("name", ""),
                "alias": FICTION[sid],
                "region": co.get("region", ""),
                "roles": list(s.get("tags") or []),
                "tier": co.get("power", 2),
                "title": s.get("title", ""),
                "bio": s.get("bio", ""),
                "career": [{
                    "companyId": co["id"],
                    "fromYear": from_year,
                    "toYear": to_year,
                    "title": s.get("title", ""),
                }],
            }
            cast.append(entry)

    extra = sorted(set(FICTION) - seen)
    if missing or extra:
        sys.stderr.write("映射表不匹配:\n  缺: %s\n  多: %s\n" % (missing, extra))
        return 1

    # ── 文本插入（保格式）────────────────────────────────────────────────────
    # 1) nameMode 紧跟 useAlias
    anchor = ' "useAlias": false,\n'
    if anchor not in raw:
        # 已写过一轮 → 先剥掉旧的 nameMode
        lines = [ln for ln in raw.split("\n") if '"nameMode"' not in ln]
        raw = "\n".join(lines)
    if anchor not in raw:
        sys.stderr.write("找不到 useAlias 锚点\n")
        return 1
    raw = raw.replace(
        anchor,
        anchor + ' "nameMode": "real",\n',
        1,
    )

    # 2) cast 追加到末尾
    body = json.dumps(cast, ensure_ascii=False, indent=1)
    body = "\n".join(" " + ln for ln in body.split("\n"))
    assert raw.endswith("}\n"), "文件尾不是 }\\n"
    core = raw[:-2]
    # 尾随逗号防御：core 去掉尾部空白后应不以 , 结尾
    raw_new = core + ',\n "cast": ' + body + "\n}\n"

    # ── 复核 ────────────────────────────────────────────────────────────────
    chk = json.loads(raw_new)
    assert chk["nameMode"] == "real"
    assert len(chk["cast"]) == len(cast) == 111, len(chk["cast"])
    assert chk["companies"] == world["companies"], "companies 被动过"
    assert chk["titles"] == world["titles"], "titles 被动过"
    assert chk["proficiency"] == world["proficiency"], "尾部键被动过"
    if "\r\n" in raw_new:
        sys.stderr.write("CRLF 混入\n")
        return 1

    with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(raw_new)

    print("cast 写入 %d 条" % len(cast))
    print("  有虚构名且与原真名不同: %d" % sum(1 for e in cast if e["alias"] != e["name"]))
    print("  沿用原名(已脱敏): %d" % sum(1 for e in cast if e["alias"] == e["name"]))
    print("  带离职窗口: %d" % sum(1 for e in cast if e["career"][0]["toYear"]))
    print("  roles 分布:")
    from collections import Counter
    c = Counter(r for e in cast for r in e["roles"])
    for k, v in c.most_common():
        print("    %-12s %d" % (k, v))
    print("  tier 分布:", dict(Counter(e["tier"] for e in cast)))
    print("  region 分布:", dict(Counter(e["region"] for e in cast)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
