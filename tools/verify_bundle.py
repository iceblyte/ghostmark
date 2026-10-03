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
    ("设置：collapsedGroups 迁移字段保留", "collapsedGroups" in js),
    ("设置：旧折叠样式 gm-collapsible 已移除", "gm-collapsible" not in js),
    ("动作值：toSpace 统一（无小写键残留）", '"tospace"' not in js and "'tospace'" not in js),
    ("Fix-1：滚动保持 getScrollInfo/scrollTo", "getScrollInfo" in js and "scrollTo" in js),
    ("Fix-1b：分组导航 gm-group-nav（点击进子页面）", "gm-group-nav" in js),
    ("Fix-1c：子页面头部 gm-subpage-head", "gm-subpage-head" in js),
    ("Fix-1d：返回键 s.back / 计数 s.codepoints", "s.back" in js and "s.codepoints" in js),
    ("Fix-2：设置页实时刷新 isShown", "isShown" in js),
    ("Fix-3：死胡同提示 n.pick.sel.none 已移除", "n.pick.sel.none" not in js),
    ("Fix-3c：勾选列表 gm-pick-list", "gm-pick-list" in js),
    ("Fix-3d：勾选文案 m6.list.desc / btn.add.n", "m6.list.desc" in js and "btn.add.n" in js),
    ("Fix-3b：空状态提示 s.custom.empty", "s.custom.empty" in js),
    ("Fix-4：添加行整行布局 gm-add-row", "gm-add-row" in js),
    ("Fix-5：inspectRemember 默认开启", "inspectRemember:!0" in js),
]

ok = True
for name, passed in checks:
    print(("PASS" if passed else "FAIL") + "  " + name)
    ok = ok and passed
sys.exit(0 if ok else 1)
