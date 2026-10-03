# -*- coding: utf-8 -*-
"""Bundle verification probes (ASCII-safe + escaped CJK)."""
import re
import sys

js = open("main.js", encoding="utf-8").read()

probe = "".join("\\u%04X" % ord(c) for c in "选区内无可清除标记")

checks = [
    ("检查模式：右键菜单 editor-menu", "editor-menu" in js),
    ("检查模式：gutter lineMarkerChange 配置", "lineMarkerChange" in js),
    ("检查模式：旧 Compartment 已移除", "inspectCompartment" not in js),
    ("检查模式：旧 configureInspect 已移除", "configureInspect" not in js),
    ("徽标：badge.tip.space 新文案键", "badge.tip.space" in js),
    ("徽标：badge.tip.keep 新文案键", "badge.tip.keep" in js),
    ("徽标：passive 样式类", " passive" in js),
    ("Notice：n3.keep 保留项提示", "n3.keep" in js),
    ("Notice：n.pick.batch 批量拾取", "n.pick.batch" in js),
    ("Notice：n.zero.sel base64 提醒（英文）", "Nothing to clean in the selection" in js),
    ("Notice：n.zero.sel 中文（转义形态）", probe in js),
    ("拾取：批量/单行删除 s.delete", "s.delete" in js),
    ("拾取：右键 crosshair 图标", "crosshair" in js),
    ("设置：collapsedGroups 折叠持久化", "collapsedGroups" in js),
    ("设置：gm-collapsible 样式类", "gm-collapsible" in js),
    ("动作值：toSpace 统一（无小写键残留）", '"tospace"' not in js and "'tospace'" not in js),
]

ok = True
for name, passed in checks:
    print(("PASS" if passed else "FAIL") + "  " + name)
    ok = ok and passed
sys.exit(0 if ok else 1)
