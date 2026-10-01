# -*- coding: utf-8 -*-
"""Ghostmark 合成 fixture 生成器（初始版本留档）。

⚠️ fixtures/watermark-fixture.md 自初始版本起由社区通过 PR 维护；
重新运行本脚本会覆盖社区贡献，仅当需要从零重建初始 fixture 时使用。

初始版本精确复刻真实剪藏样本（付费内容，模式固化后已删除）的三类反爬
水印模式，正文全部为无版权占位文字。

生成器自校准：先统计模板中的槽位数量，再反推每个簇的长度（2~3 字符）使总数
精确命中目标；脚本内置计数断言，任何造成偏差的改动都会被拒绝写入。

用法（在仓库根目录执行）:
    python tools/make_fixture.py
"""
import base64
import hashlib
import os
import re

# ── 目标计数（与《需求分析》§1.2 / §6.1 一致）──────────────────────────
TARGET = {
    "U+2062": 108,   # INVISIBLE TIMES（正文词内簇 + 标题 + 数学块）
    "U+061C": 216,   # ARABIC LETTER MARK（正文词内簇）
    "U+2002": 300,   # EN SPACE（行尾指纹串 + 代码块 1）
    "U+2009": 177,   # THIN SPACE（行尾指纹串）
    "base64 处数": 48,
    "base64 去重": 10,
}

# ── 水印构件（复刻真实样本的形态）─────────────────────────────────────
# 标准指纹串：32 字符 = 20×U+2002 + 12×U+2009（与真实样本逐字符一致）
FP_STD = ("\u2002" * 15 + "\u2009" + "\u2002" + "\u2009" * 5 + "\u2002"
          + "\u2009" * 4 + "\u2002" * 2 + "\u2009" + "\u2002" + "\u2009")
# 变体指纹串：28 字符 = 19×U+2002 + 9×U+2009（真实样本存在不同长度的变体）
FP_VAR = "\u2002" * 19 + "\u2009" * 9
assert FP_STD.count("\u2002") == 20 and FP_STD.count("\u2009") == 12 and len(FP_STD) == 32
assert FP_VAR.count("\u2002") == 19 and FP_VAR.count("\u2009") == 9 and len(FP_VAR) == 28

# base64 追踪 token：44 字符 [A-Za-z0-9+/]{43}= ，10 个不同合成值
TOKENS = [
    base64.b64encode(hashlib.sha256(f"ghostmark-fixture-token-{i}".encode()).digest()).decode()
    for i in range(10)
]
assert all(len(t) == 44 and t.endswith("=") for t in TOKENS)
assert len(set(TOKENS)) == 10

# ── 模板 ──────────────────────────────────────────────────────────────
# 槽位记号：{A}=下一个 U+2062 簇，{B}=下一个 U+061C 簇，{FP}=标准指纹串，
#           {FPV}=变体指纹串，{T}=base64 token，{S}=单个 U+2002
TEMPLATE = """---
title: "合成水印样{A}本（占位文本）"
source: "https://example.com/posts/1234567890/sections/9876543210"
created: 2026-09-30
---

# Ghostmark 合成水印样本

> 本文件由 `make_fixture.py` 确定性生成，用于插件测试与公开仓库演示。
> 正文全部为无版权占位文字，水印模式精确复刻真实样本：
> 词内隐形字符簇、行尾空宽空格指纹串、正文内嵌 base64 追踪 token。{FP}

## 一、占位章节：词内字符簇

本段占位文字用于复刻词内水印模式。占位{B}{B}{B}文字会在单词内部插入两{A}到三{B}{B}{B}个一簇的隐{A}形字符，模{A}{B}{B}{B}拟真实站{A}点把字符塞{B}{B}{B}进词语中间{B}{B}{B}的做法，这{B}{B}{B}类字符在渲{A}染时完全不可{B}{B}{B}见，却会破{A}{B}{B}坏搜索与链{A}接等基础功能{B}{B}{B}，是清理的主{A}{B}要目标。{FP}{T}{T}{T}{T}

## 二、占位章节：行尾指纹串

第二类水印出现在段落结尾。占位段落按固定周期重复一串由两种宽度空格组{B}{B}{B}成的指纹，肉{A}眼只见一段空{B}{B}{B}白，实际携带{A}{B}{B}编码信息，是{A}清理时的另一{B}{B}{B}个主要目标{A}。{FP}{T}{T}{T}{T}

1. 占位列表项一：描述占位功{B}{B}能的第一条验收{A}标准，文字仅{B}{B}用于占位。{FP}{T}{T}{T}{T}
2. 占位列表项二：描述占位功{B}{B}能的第二条验收{A}标准，文字仅{B}{B}用于占位。{FP}{T}{T}{T}{T}
3. 占位列表项三：描述占位功{B}{B}能的第三条验收{A}标准，文字仅{B}{B}用于占位。{FP}{T}{T}{T}{T}

## 三、占位章节：追踪 token

第三类水印是直接粘在正文后面的 base64 追踪串，属于可见垃圾，其形态为四十四个字{A}符、以等号结{B}{B}{B}尾。
占位{B}{B}{A}段落需要逐{B}{B}{A}个识别并把{B}{B}{B}它们交给选{A}区清除或规{B}{B}{B}则库处理。{FP}{T}{T}{T}{T}

又是占位段落：追踪 token 会以四连发的方式出现在本 fixture 的多个段{A}{B}{B}落之后，共十{A}{B}{B}个不同取值、{A}{B}{B}四十八处出现{A}{B}{B}，重复率本身{A}{B}{B}就是指纹特征{A}{B}{B}。{FP}{T}{T}{T}{T}

占位补充段落：真实样本中同一个追踪值会反复出现，占位文本同样如{A}此，以便测{B}{B}{B}试重复指纹启{A}{B}{B}发式。{FP}{T}{T}{T}{T}

占位补白段落：本小节以一句占位{A}文字收束，仅用于承{B}{B}{B}载标准指纹串。{FP}

## 四、占位章节：受保护对象

emoji 组合序列必须逐字节保留：占位团队 👨‍👩‍👧‍👦 与占位工程师 👩🏻‍💻 正在协作，这里的 ZWJ 是合{A}法语义字{A}符。{FP}{T}{T}{T}{T}

数学块默认只标记不清除，块内含一个 U+2062 用于验证该策{A}略：

$$
\\alpha{A}\\beta = \\gamma + \\delta
$$

行内公式 $a + b$ 保持原样。{FP}{T}{T}{T}{T}

## 五、占位章节：代码块

围栏代码块内的无语义不可见字符按策略清理，空格类转普通空{A}格：{FP}{T}{T}{T}{T}

```python
def placeholder(items):
    total = 0
    label = "hello{S}world"  # 此处为单个 U+2002，测试代码块内空格转普通空格
    for item in items:
        total = total + item
    return total, label
```

第二个代码块保持干净，测试零误伤：{FP}

```python
print("placeholder", [1, 2, 3])
```

## 六、收尾

占位结尾段落：本 fixture 的每一类计数都在生成脚本中硬编码断言，任何手{B}{B}{B}工编辑导致{A}{B}{B}的偏差都会{B}{B}{B}被生成器拒绝{A}{B}{B}写入。{FPV}{T}{T}{T}{T}
"""


def mix(n: int, twos: int) -> list:
    """长度 n、含 twos 个 2、其余为 3 的确定性簇尺寸序列（Bresenham 均匀分布）。"""
    return [2 if (i * twos) // n > ((i - 1) * twos) // n else 3 for i in range(1, n + 1)]


def slots(key: str) -> int:
    return TEMPLATE.count("{" + key + "}")


def main() -> None:
    n_a, n_b = slots("A"), slots("B")
    n_fp, n_fpv, n_t, n_s = slots("FP"), slots("FPV"), slots("T"), slots("S")
    print(f"槽位统计：A={n_a} B={n_b} FP={n_fp} FPV={n_fpv} T={n_t} S={n_s}")

    assert n_fp == 14, f"标准指纹串应为 14 条，实际 {n_fp}"
    assert n_fpv == 1, f"变体指纹串应为 1 条，实际 {n_fpv}"
    assert n_t == TARGET["base64 处数"], f"token 槽位应为 48，实际 {n_t}"
    assert n_s == 1, f"S 槽位应为 1，实际 {n_s}"

    t2062 = TARGET["U+2062"]
    assert 2 * n_a <= t2062 <= 3 * n_a, f"A 槽位 {n_a} 个无法凑出 {t2062}（需 36~54）"
    a_sizes = mix(n_a, 3 * n_a - t2062)

    t061c = TARGET["U+061C"]
    assert 2 * n_b <= t061c <= 3 * n_b, f"B 槽位 {n_b} 个无法凑出 {t061c}（需 72~108）"
    b_sizes = mix(n_b, 3 * n_b - t061c)
    print(f"簇构成：2062 → {n_a} 簇（{3 * n_a - t2062} 个双字符簇）；"
          f"061C → {n_b} 簇（{3 * n_b - t061c} 个双字符簇）")

    out, i = [], 0
    a_iter, b_iter, t_idx = iter(a_sizes), iter(b_sizes), 0
    while i < len(TEMPLATE):
        if TEMPLATE[i] == "{":
            j = TEMPLATE.index("}", i)
            key = TEMPLATE[i + 1:j]
            if key == "A":
                out.append("\u2062" * next(a_iter))
            elif key == "B":
                out.append("\u061c" * next(b_iter))
            elif key == "FP":
                out.append(FP_STD)
            elif key == "FPV":
                out.append(FP_VAR)
            elif key == "T":
                out.append(TOKENS[t_idx % 10])
                t_idx += 1
            elif key == "S":
                out.append("\u2002")
            else:
                raise SystemExit(f"未知槽位 {{{key}}}")
            i = j + 1
        else:
            out.append(TEMPLATE[i])
            i += 1
    text = "".join(out)
    assert "{" not in text, "模板展开后仍残留槽位记号"

    b64 = re.findall(r"[A-Za-z0-9+/]{43}=", text)
    counts = {
        "U+2062": text.count("\u2062"),
        "U+061C": text.count("\u061c"),
        "U+2002": text.count("\u2002"),
        "U+2009": text.count("\u2009"),
        "base64 处数": len(b64),
        "base64 去重": len(set(b64)),
    }
    ok = True
    for k, v in TARGET.items():
        good = counts[k] == v
        ok &= good
        print(f"  [{'OK' if good else 'FAIL'}] {k}: 期望 {v}，实际 {counts[k]}")
    if not ok:
        raise SystemExit("计数断言失败，未写入文件")

    path = os.path.join("fixtures", "watermark-fixture.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"已写入 {path}（{len(text)} 字符）")


if __name__ == "__main__":
    main()
