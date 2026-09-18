# -*- coding: utf-8 -*-
"""平衡性分析：角色属性 -> 开发加成（生涯档）。
复用 career.js 中 sim.careerMonthlyContributionByDim 的确定性公式，
加载真实 config（activity/career-world.json 即 config.careerWorld）。
"""
import json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "activity", "career-world.json")
OUT = os.path.join(ROOT, "activity", "balance-analysis.json")

with open(SRC, "r", encoding="utf-8") as f:
    world = json.load(f)  # 这就是 config.careerWorld

DIMS = ["program", "design", "art", "music"]

player = world["player"]
prod = world.get("producerCareer", {})
jobRanks = world["jobRanks"]
contribMult = jobRanks["contribMult"]          # index by rank (1..6)
ref = world["scoreFromLive"]["attrRef"]         # =100
monthly = player["monthlyContribution"]         # 2
mainM = player["contribMainMult"]               # 1.15
offM = player["contribOffMult"]                 # 0.4

print("== 参数 ==")
print("monthlyContribution =", monthly, "| contribMainMult =", mainM, "| contribOffMult =", offM, "| attrRef =", ref)
print("contribMult[rank] =", contribMult)
print("producerCareer.monthlyContributionAllDims =", prod.get("monthlyContributionAllDims"))

def monthly_by_dim(stats, role_stat, rank, is_producer=False, skill=0):
    rankM = contribMult[rank]
    if is_producer:
        base = prod.get("monthlyContributionAllDims", 1)
        attr = stats.get(role_stat, 0) / ref
        if prod.get("monthlyContributionRankScale", True) is not False:
            base = base * rankM * attr
        return {d: base + skill for d in DIMS}
    mm = player.get("contribMainMult", 1)
    om = player.get("contribOffMult", 0)
    base = player["monthlyContribution"] * rankM
    out = {}
    for k in DIMS:
        attr = stats.get(k, 0) / ref
        out[k] = base * attr * (mm if k == role_stat else om)
    if role_stat:
        out[role_stat] += skill
    return out

# 自然职级映射：属性档对应其成长阶段的典型职级
tier_rank = {30: 1, 50: 3, 80: 6}
months_list = [6, 12, 24]

print("\n== 职员（非制作人）月贡献与开发周期累计 ==")
print("模型：作品起始四维 = 开发者自身四维（经营局 5.1「基础=制作人四维」口径）；每月叠加月贡献。")
rows = []
for tier in (30, 50, 80):
    rank = tier_rank[tier]
    stats = {d: tier for d in DIMS}
    by = monthly_by_dim(stats, "program", rank)
    main_m = by["program"]
    off_m = by["art"]
    print(f"\n--- 全属性 {tier} (rank {rank}) ---")
    print(f"  月贡献: 主职维={main_m:.3f}  非主职维={off_m:.3f}")
    for M in months_list:
        final_main = tier + main_m * M
        final_off = tier + off_m * M
        rows.append({"tier": tier, "rank": rank, "months": M,
                     "main_monthly": round(main_m, 3), "off_monthly": round(off_m, 3),
                     "final_main": round(final_main, 1), "final_off": round(final_off, 1)})
        print(f"  {M:>2}月: 主职维终值≈{final_main:6.1f}  非主职维终值≈{final_off:6.1f}")

print("\n== 制作人（全加成不变）对比 ==")
prod_rows = []
for tier in (30, 50, 80):
    rank = tier_rank[tier]
    stats = {d: tier for d in DIMS}
    by = monthly_by_dim(stats, "program", rank, is_producer=True)
    v = by["program"]
    print(f"全属性 {tier} (rank {rank}): 每维月贡献={v:.3f}  | 24月每维终值≈{tier + v*24:.1f}")
    prod_rows.append({"tier": tier, "rank": rank, "monthly_per_dim": round(v, 3),
                      "final_per_dim_24": round(tier + v*24, 1)})

# ---- 名作基础数值（eraStatScale）验证 ----
quality = world["quality"]
era = quality.get("eraStatScale", {})
print("\n== 名作基础数值 eraStatScale 验证 ==")
print("eraStatScale:", era)

def era_mult(year):
    if not era or era.get("enabled") is False:
        return 1
    if year is None:
        return 1
    sy, ey = era.get("startYear", 1995), era.get("endYear", 2025)
    sm, em = era.get("startMult", 1), era.get("endMult", 1)
    if ey <= sy:
        return sm if year <= sy else em
    t = (year - sy) / (ey - sy)
    t = max(0, min(1, t))
    return sm + (em - sm) * t

titles = world.get("titles", [])
landmarks = [t for t in titles if t.get("landmark")]
landmarks.sort(key=lambda t: (t.get("releaseYear", 0), t.get("releaseMonth", 0)))
print(f"总目录作品 {len(titles)}，其中 landmark {len(landmarks)}")

# 抽样：每 ~6 年取最早一个 landmark，展示 原始均值 vs era 缩放后均值
sample_years = [1996, 2002, 2008, 2014, 2017, 2025]
samples = []
for y in sample_years:
    cand = [t for t in landmarks if t.get("releaseYear") == y]
    if not cand:
        continue
    t = cand[0]
    raw = {k: t.get("stats", {}).get(k, 0) for k in DIMS}
    raw_mean = sum(raw.values()) / 4
    m = era_mult(y)
    scaled = {k: round(raw[k] * m) for k in DIMS}
    scaled_mean = sum(scaled.values()) / 4
    samples.append({"title": t.get("id"), "year": y, "raw_mean": round(raw_mean, 1),
                    "era_mult": round(m, 3), "scaled_mean": round(scaled_mean, 1)})
    print(f"  {t.get('id'):12s} {y}: 原始均值 {raw_mean:5.1f} × {m:.3f} = 缩放后 {scaled_mean:5.1f}")

# 早期 vs 后期 landmark 整体均值对比（按 2010 分界）
early = [t for t in landmarks if (t.get("releaseYear") or 0) <= 2005]
late = [t for t in landmarks if (t.get("releaseYear") or 0) >= 2015]
def era_scaled_mean(title):
    y = title.get("releaseYear")
    m = era_mult(y)
    s = title.get("stats", {})
    return sum(s.get(k, 0) for k in DIMS) / 4 * m
if early and late:
    em = sum(era_scaled_mean(t) for t in early) / len(early)
    lm = sum(era_scaled_mean(t) for t in late) / len(late)
    rm = sum(sum(t.get("stats", {}).get(k, 0) for k in DIMS)/4 for t in early)/len(early)
    rl = sum(sum(t.get("stats", {}).get(k, 0) for k in DIMS)/4 for t in late)/len(late)
    print(f"\n早期(≤2005) landmark 原始均值 {rm:.1f} → era缩放后 {em:.1f}")
    print(f"后期(≥2015) landmark 原始均值 {rl:.1f} → era缩放后 {lm:.1f}")
    print(f"缩放后 后期/早期 比值 = {lm/em:.2f}")

result = {
    "params": {"monthlyContribution": monthly, "contribMainMult": mainM,
               "contribOffMult": offM, "attrRef": ref, "contribMult": contribMult,
               "producerAllDims": prod.get("monthlyContributionAllDims")},
    "staff_rows": rows,
    "producer_rows": prod_rows,
    "era_samples": samples,
    "era_summary": {"early_raw": rm if early else None, "early_scaled": em if early else None,
                    "late_raw": rl if late else None, "late_scaled": lm if late else None},
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print("\n已写出", OUT)
