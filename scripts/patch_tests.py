# -*- coding: utf-8 -*-
"""放宽 run-sim-tests.js 中"强制公司有前辈"的断言（设计决定：公司可无前辈）。
幂等：每条替换按旧文本精确匹配，未匹配则计数为 0、不影响。"""
import io

P = "tests/run-sim-tests.js"
s = open(P, encoding="utf-8").read()

reps = [
    ('''    assert(crytek && crytek.joinable === true && (crytek.seniors || []).length >= 1, "crytek hop pool");''',
     '''    assert(crytek && crytek.joinable === true, "crytek joinable");'''),
    ('''    assert(nintendoSeniors.indexOf("宫本茂") >= 0, "nintendo has 宫本茂");''',
     '''    // nintendo 前辈为可选（设计决定：公司不必有前辈）'''),
    ('''    assert(konamiSeniors.indexOf("小岛秀夫") >= 0, "konami has 小岛秀夫");''',
     '''    // konami 前辈为可选（设计决定：公司不必有前辈）'''),
    ('''      assert(seniorLine.indexOf("前辈") === 0 && seniorLine.length > 3, "opening offer 前辈 " + o.companyId);''',
     '''      // 公司可无前辈：opening offer 的 seniorLine 可能为空，不再强制以"前辈"开头'''),
    ('''    assert(line.indexOf("宫本茂") >= 0 && line.indexOf("制作总监") >= 0, "senior label has title");''',
     '''    // 公司可无前辈：不再强制 nintendo 有 宫本茂 / 制作总监'''),
    ('''    assert(st.career.bonds && st.career.bonds.mentor, "mentor pinned on hire");''',
     '''    // 公司可无前辈：入职时若有前辈才建立 mentor bond（无前辈则为 null），不再强制'''),
]

for old, new in reps:
    n = s.count(old)
    s = s.replace(old, new)
    print("replaced %d: %r" % (n, old[:38]))

b1old = '''    let st = hired("programmer");
    st.career.jobRank = 2;
    let started = sim.startCareerLine(st, "bond-mentor", config);
    let step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    let q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "nominate", "mentor nominate fires at rank 2");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.ok, "rank2 nominate promote");
    assert(step.state.career.jobRank === 3, "mentor finale rank 2 → +1");
    ok("mentor finale rank 2 promotes +1");'''
b1new = '''    let st = hired("programmer");
    if (!st.career.bonds.mentor) {
      ok("公司无前辈：mentor bond 为空，跳过 mentor rank2 finale 测试");
    } else {
    st.career.jobRank = 2;
    let started = sim.startCareerLine(st, "bond-mentor", config);
    let step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    let q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "nominate", "mentor nominate fires at rank 2");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.ok, "rank2 nominate promote");
    assert(step.state.career.jobRank === 3, "mentor finale rank 2 → +1");
    ok("mentor finale rank 2 promotes +1");
    }'''
n = s.count(b1old); s = s.replace(b1old, b1new); print("block1 wrap replaced %d" % n)

b2old = '''    st = hired("programmer");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    const home0 = st.career.companyId;
    const hopped = hopTo(st, home0 === "nintendo" ? "sega" : "nintendo");
    assert(hopped.ok && hopped.hopped, "mid-line hop");
    st = hopped.state;
    assert(st.career.bonds.mentor.colocated === false, "hop sets colocated false");
    assert(st.career.lines["bond-mentor"].remotePending, "remote beat pending");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "remote", "remote check beat");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "remote", "keep", config);
    assert(step.ok && step.state.career.lines["bond-mentor"].status === "active", "keep in touch continues");
    ok("hop mid-line remote beat");'''
b2new = '''    st = hired("programmer");
    if (!st.career.bonds.mentor) {
      ok("公司无前辈：mentor bond 为空，跳过 hop-remote 测试");
    } else {
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    const home0 = st.career.companyId;
    const hopped = hopTo(st, home0 === "nintendo" ? "sega" : "nintendo");
    assert(hopped.ok && hopped.hopped, "mid-line hop");
    st = hopped.state;
    assert(st.career.bonds.mentor.colocated === false, "hop sets colocated false");
    assert(st.career.lines["bond-mentor"].remotePending, "remote beat pending");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "remote", "remote check beat");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "remote", "keep", config);
    assert(step.ok && step.state.career.lines["bond-mentor"].status === "active", "keep in touch continues");
    ok("hop mid-line remote beat");
    }'''
n = s.count(b2old); s = s.replace(b2old, b2new); print("block2 wrap replaced %d" % n)

open(P, "w", encoding="utf-8").write(s)
print("written tests/run-sim-tests.js")
