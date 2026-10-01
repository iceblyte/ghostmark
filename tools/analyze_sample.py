# -*- coding: utf-8 -*-
"""Ghostmark 前期调研工具：盘点 markdown 文件中的不可见/可疑字符。

用法:
    python analyze_sample.py <笔记路径>

仅本地使用——请勿把含真实剪藏内容的文件提交进仓库。
"""
import sys
import collections
import unicodedata

# 已知水印/可疑码点（与《方案设计》§3.2 默认策略表一致）
SUSPECT_RANGES = [
    (0x200B, 0x200D),   # ZWSP / ZWNJ / ZWJ
    (0x2060, 0x2064),   # 词连接符与不可见数学算符
    (0x061C, 0x061C),   # ALM
    (0x00AD, 0x00AD),   # 软连字符
    (0x180E, 0x180E),   # 蒙古元音分隔符
    (0x2000, 0x200A), (0x202F, 0x202F), (0x00A0, 0x00A0),  # 空格类
    (0x202A, 0x202E), (0x2066, 0x2069),  # 双向控制
    (0xFEFF, 0xFEFF), (0xFFFE, 0xFFFF),
]


def is_suspect(ch: str) -> bool:
    o = ord(ch)
    if ch in "\n\r\t":
        return False
    if any(lo <= o <= hi for lo, hi in SUSPECT_RANGES):
        return True
    return unicodedata.category(ch) in ("Cf", "Cc", "Co", "Cn")


def main(path: str) -> None:
    s = open(path, encoding="utf-8").read()
    print("总字符数:", len(s))

    counts = collections.Counter(ch for ch in s if is_suspect(ch))
    print("\n== 不可见/可疑字符清单 ==")
    total = 0
    for ch, n in counts.most_common():
        o = ord(ch)
        try:
            name = unicodedata.name(ch)
        except ValueError:
            name = "(无名)"
        print(f"  U+{o:04X} {name} x{n}")
        total += n
    print("  总计:", total)

    print("\n== 上下文示例（每类前 5 处，目标字符以 ⟦U+XXXX⟧ 显形）==")
    seen = set()
    for i, ch in enumerate(s):
        if ch not in counts or ch in seen:
            continue
        seen.add(ch)
        ctx = s[max(0, i - 25): i + 25].replace("\n", "⏎").replace(ch, f"⟦U+{ord(ch):04X}⟧")
        print(f"  U+{ord(ch):04X}: {ctx!r}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
