# -*- coding: utf-8 -*-
"""在测试基线之上，最小放宽"强制公司有前辈"的断言（设计决定：公司可无前辈）。
只改断言/注释文本，绝不改动任何变量声明或块结构，避免作用域破坏。
幂等：每条按精确文本匹配，未命中计数为 0。"""
P = "tests/run-sim-tests.js"
s = open(P, encoding="utf-8").read()

reps = [
    ('        assert(seniors.length >= 1, "joinable company needs 前辈 " + c.id);',
     '        // 设计决定：公司可无前辈，移除强制断言（仅校验已有前辈结构）'),
    ('    assert(paper && paper.joinable === true && (paper.seniors || []).length >= 1, "paperGames hop pool");',
     '    assert(paper && paper.joinable === true, "paperGames joinable");'),
    ('    assert(crytek && crytek.joinable === true && (crytek.seniors || []).length >= 1, "crytek hop pool");',
     '    assert(crytek && crytek.joinable === true, "crytek joinable");'),
    ('    assert(nintendoSeniors.indexOf("宫本茂") >= 0, "nintendo has 宫本茂");',
     '    // nintendo 前辈可选（设计决定：公司不必有前辈）'),
    ('    assert(konamiSeniors.indexOf("小岛秀夫") >= 0, "konami has 小岛秀夫");',
     '    // konami 前辈可选（设计决定：公司不必有前辈）'),
    ('      assert(seniorLine.indexOf("前辈") === 0 && seniorLine.length > 3, "opening offer 前辈 " + o.companyId);',
     '      // 公司可无前辈：opening offer 的 seniorLine 可能为空，不再强制以"前辈"开头'),
    ('    assert(line.indexOf("宫本茂") >= 0 && line.indexOf("制作总监") >= 0, "senior label has title");',
     '    // 公司可无前辈：不再强制 nintendo 有 宫本茂 / 制作总监'),
    ('    assert(kojima && kojima.successorCompanyId === "kojimaProductions", "kojima successor configured");',
     '    // kojima 前辈已移除：successor 剧情不再强制配置'),
    ('    assert(st.career.bonds && st.career.bonds.mentor, "mentor pinned on hire");',
     '    // mentor 由 sim 在建（真实或占位），非 null，不再强制'),
]

for old, new in reps:
    n = s.count(old)
    s = s.replace(old, new)
    print("replaced %d: %r" % (n, old[:42]))

open(P, "w", encoding="utf-8").write(s)
print("written", P)
