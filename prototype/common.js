/* ============================================================
   Ghostmark 原型共享脚本：双主题 / 中英文案 / 密度 / 标注层
   以及 Obsidian 外壳注入、widget 填充与轻交互
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- i18n 文案表 ---------------- */
  var I18N = {
    zh: {
      "bar.theme.dark": "主题 · 深色", "bar.theme.light": "主题 · 浅色",
      "bar.lang": "语言 · 中文", "bar.lang.en": "Language · 中文",
      "bar.density.compact": "密度 · 紧凑", "bar.density.detailed": "密度 · 详细",
      "bar.annos.on": "标注 · 开", "bar.annos.off": "标注 · 关",
      "bar.home": "索引",

      "status.words": "字", "status.chars": "字符",
      "ghost.tip": "{n} 处命中 · 点击切换检查模式",
      "badge.tip": "本行 {n} 处命中 · 点击清除当前块",
      "mode.edit": "编辑", "mode.read": "阅读", "side.outline": "大纲",

      "cat.red": "无语义不可见", "cat.blue": "空格类", "cat.yellow": "受保护语义",
      "act.remove": "清除", "act.tospace": "转普通空格", "act.keep": "保留",
      "tip.suggest": "建议",
      "note.mathonly": "数学块内：默认仅标记，不清除",
      "note.codespace": "代码块内：转普通空格（防破坏缩进）",
      "note.zwj": "ZWJ 承载 emoji 组合语义，永久保护",
      "note.skin": "肤色修饰符，永久保护",
      "note.run": "空格成串（≥2）→ 整串删除",

      "cap.p1": "P1 · 编辑器 — Live Preview · 检查模式 · 紧凑档",
      "cap.p2": "P2 · 编辑器 — Source 模式 · 检查模式 · 详细档",
      "cap.p3": "P3 · 清除全部 — 确认 Modal → Notice → 清除后",
      "cap.p4": "P4 · 清除选区 — 选区态 + 确认 Modal",
      "cap.p5": "P5 · 清除当前块 — 徽标入口 · 免确认 + Notice",
      "cap.p6": "P6 · 拾取码点 — Modal → 写入策略表",
      "cap.p7": "P7 · 命令面板 — 五命令 · 置灰态",
      "cap.p8": "P8 · 设置 — 四组完整面板",
      "cap.p9": "P9 · 移动端 — 检查模式 + 命令面板入口",

      "p1.anno.t": "P1 标注",
      "p1.1": "<b>三色语义</b>：红 = 无语义不可见（垃圾）、蓝 = 空格类、黄 = 受保护语义。全部装饰来自 CM6 替换字形 widget，零宽字符必须替换才能显形。",
      "p1.2": "<b>行内 widget</b>：紧凑档每类一个符号（红 <code>⌷</code> / 蓝 <code>␣</code> / 黄 <code>⌦</code>）；悬停任意 widget 可见详情浮层，红色虚线框为固定展示示例。",
      "p1.3": "<b>行号槽徽标</b>：显示该行命中计数，按主导类别着色；点击徽标高亮其所在块（FR-13 双入口之一）。",
      "p1.4": "<b>状态栏</b>：<code>Ghost: 806</code> 常驻命中总数，点击切换检查模式（试试点它）。仅桌面注册。",
      "p1.5": "<b>可见垃圾</b>：base64 追踪 token 不属于策略表，检查模式不做标记，靠「清除选区」手动删除（见 P4）。",

      "p2.anno.t": "P2 标注", "p2.hint": "与 P1 同一笔记的 Source 呈现 · 详细档（码点缩写）为默认密度 ·",
      "p2.1": "<b>Source 模式</b>：原始 Markdown 全部可见（frontmatter / 围栏 / 数学记号），装饰同样生效——CM6 扩展在双编辑模式可用。",
      "p2.2": "<b>详细档密度</b>：widget 直接显示码点缩写（如 <code>2062</code>、<code>2002 ×20</code>），与紧凑档在原型控制条随时切换。",
      "p2.3": "<b>frontmatter 标题污染</b>：<code>title</code> 内混入 U+061C 双簇——正是 obsidian-clipper #918 的实锤场景，frontmatter 同正文参与清理。",

      "m3.title": "清除全部标记", "m4.title": "清除选区", "m5.title": "清除当前块", "m6.title": "拾取码点",
      "m3.desc": "将对当前笔记执行策略清理，确认后一次性替换，可单步撤销：",
      "m4.desc": "仅对选中文本执行策略清理，不影响其余内容：",
      "m5.desc": "光标所在块（段落，2 行）。默认免确认，直接执行：",
      "m6.desc": "该字符不在默认策略表中，已按类别给出建议动作，可修改后加入：",
      "r.red": "无语义不可见字符", "r.blue": "空格类字符", "r.yellow": "受保护语义字符",
      "r.red.sub": "U+2062 ×108 · U+061C ×216", "r.blue.sub": "U+2002 ×300 · U+2009 ×177",
      "r.yellow.sub": "ZWJ ×4 · 肤色修饰符 ×1",
      "r.red.sub.s": "词内隐形簇 ×3", "r.blue.sub.s": "行尾指纹串 ×1（8 个字符）",
      "r.red.sub.b": "词内簇（9 个字符）", "r.blue.sub.b": "成串 ×1（3 个字符）",
      "pill.remove": "清除", "pill.tospace": "转空格", "pill.keep": "保留", "pill.markonly": "仅标记",
      "m3.math": "数学块内 3 处 U+2062 仅标记（默认不动），已从清除计数中扣除。",
      "m4.warn": "选区内的 base64 追踪 token 是可见垃圾，不属于策略表字符——请手动选中后删除（FR-8 设计意图）。",
      "m6.ctx": "光标处字符", "m6.cp": "码点", "m6.name": "Unicode 名称", "m6.cat": "类别", "m6.act": "建议动作",
      "btn.cancel": "取消", "btn.clear": "清除 {n}", "btn.pick": "加入策略表",
      "btn.clear798": "清除 798", "btn.clear14": "清除 14", "btn.clear12": "清除 12",
      "r.math": "数学块内 U+2062（仅标记）",
      "p3.hint": "初始态即打开确认弹窗；点击「清除 798」执行，Notice 出现、编辑器转为清除后状态。",
      "p4.hint": "紫色高亮为 Obsidian 原生选区；点击「清除 14」执行。",
      "n3.ok": "已清除 798 处标记（红 321 · 蓝 477）",
      "n3.undo": "单步撤销，原文可完整恢复",
      "n4.ok": "已清除选区 14 处标记（红 6 · 蓝 8）",
      "n5.ok": "已清除当前块 12 处（红 9 · 蓝 3）· 块外零改动",
      "n5.zero": "该块无命中（或全部为保留/仅标记），未做修改",
      "n6.ok": "已将 U+2064（动作：清除）加入策略表",
      "n6.more": "可在设置 → 字符策略表中修改动作",
      "demo.reset": "重置演示", "demo.run": "执行清除", "demo.confirm": "查看确认弹窗（设置开启后）",
      "demo.zero": "零改动示例", "demo.repick": "重新打开弹窗",
      "demo.nosel": "模拟：无选区", "demo.noinspect": "模拟：检查模式关闭", "demo.back": "恢复全部可用",
      "demo.inspect": "检查模式 开 / 关", "demo.hint1": "示例为 fixture 等价节选：本页可见 47 处 / 全文 806 处 ·",
      "p1.statusword": "状态栏", "p1.statushint": "可点击切换检查模式",

      "p3.anno.t": "P3 标注",
      "p3.1": "<b>确认 Modal</b>：分类计数汇总逐类列出，数学块仅标记项单列说明；执行按钮为警示样式（mod-warning），显示精确清除数。",
      "p3.2": "<b>执行后</b>：右上角 Notice 报告分类计数 + 撤销提示；编辑器回到无装饰状态。点击演示条「重置演示」可还原。",
      "p3.3": "<b>单事务替换</b>：清理走一次 <code>editor.transaction</code>，Obsidian 原生撤销栈自动成立。",

      "p4.anno.t": "P4 标注",
      "p4.1": "<b>选区态</b>：紫色高亮为 Obsidian 原生选区色；命令经 <code>checkCallback</code> 动态校验——无选区时命令面板置灰（见 P7）。",
      "p4.2": "<b>可见垃圾不归策略管</b>：base64 token 无码点规则，Modal 明示需手动删除，避免「以为没清干净」的误解。",

      "p5.anno.t": "P5 标注", "p5.hint": "光标所在块已预高亮（徽标入口）。可直接执行免确认清除，或查看确认弹窗与零改动路径。",
      "p5.1": "<b>块 = 六形态</b>：空行分界段落 / 列表项 / 连续引用行 / 表格行 / 代码或数学块整块 / frontmatter 整块。此处演示「段落」。",
      "p5.2": "<b>免确认需可见</b>：块清除默认免确认，因此强制检查模式开启（关闭时命令置灰）；徽标点击与命令共用同一确认规则。",
      "p5.3": "<b>零改动路径</b>：块内无命中或全部 keep/markOnly 时提示且文本不变。",

      "p6.anno.t": "P6 标注", "p6.hint": "新网站出现未知水印字符时的兜底入口：光标停在字符上 → 执行命令。",
      "p6.1": "<b>兜底未知水印</b>：新网站的未知字符 → 光标停在其上执行命令，按类别写入建议动作（不可见→清除、空格→转空格、语义→保留）。",
      "p6.2": "<b>持久化</b>：写入 <code>settings.customPolicies</code>，设置面板可见、可改、可重置（见 P8 拾取追加区）。",

      "p7.anno.t": "P7 标注", "p7.hint": "「清除选区」无选区时、「清除当前块」检查模式关闭时动态置灰；输入框可实际过滤。",
      "p7.ph": "输入命令…",
      "cmd.toggle": "Ghostmark: 切换检查模式", "cmd.clearall": "Ghostmark: 清除全部标记",
      "cmd.clearsel": "Ghostmark: 清除选区", "cmd.clearblock": "Ghostmark: 清除当前块",
      "cmd.pick": "Ghostmark: 拾取码点", "cmd.settings": "Obsidian: 打开设置",
      "p7.why.nosel": "（无选区）", "p7.why.noinspect": "（检查模式未开启）",
      "p7.1": "<b>五个命令</b>：切换检查模式 / 清除全部 / 清除选区 / 清除当前块 / 拾取码点，均进命令面板并配建议快捷键。",
      "p7.2": "<b>checkCallback 置灰</b>：「清除选区」无选区时、「清除当前块」检查模式关闭时动态置灰并显示原因。用上方演示按钮切换状态。",
      "p7.3": "<b>移动端入口</b>：命令面板是移动端唯一入口（NFR-6），见 P9。",

      "p8.anno.t": "P8 标注", "p8.hint": "开关 / 下拉均为可交互视觉件（不持久化）；策略表含全部 21 个默认码点 + 拾取追加区。",
      "nav.options": "选项", "nav.editor": "编辑器", "nav.files": "文件与链接", "nav.appearance": "外观", "nav.hotkeys": "快捷键",
      "nav.core": "核心插件", "nav.core1": "日记", "nav.core2": "白板", "nav.core3": "大纲", "nav.community": "社区插件",
      "s.g1": "字符策略表", "s.d1": "策略即数据：每个码点的动作可改为 清除 / 转空格 / 保留；变更即时生效并随设置持久化。",
      "s.red": "红 · 无语义不可见（默认清除，含代码块）", "s.blue": "蓝 · 空格类（正文成串删除、孤立转空格）",
      "s.yellow": "黄 · 受保护语义（仅标记）", "s.lock": "写死保护", "s.feff": "U+FEFF 仅处理非文件头位置；文件头 BOM 永不处理。",
      "s.custom": "拾取追加区（customPolicies）", "s.reset": "重置为默认表", "s.picked": "拾取于 P6 演示",
      "s.g2": "上下文规则", "s.math": "数学块处理", "s.math.d": "默认仅标记；MathML 转写来源的 U+2062 可能承载真实乘法语义。",
      "s.zwnj.d": "波斯语等语言承载构词语义，误删会毁掉复合词（#625 教训）。",
      "s.codespace": "代码块内空格类转普通空格", "s.codespace.d": "直接删除会破坏 Python 缩进与语法。",
      "s.g3": "界面", "s.remember": "记住检查模式状态", "s.remember.d": "重启后保持上次开关（默认关闭）。",
      "s.density": "标记密度", "s.density.d": "紧凑 = 每类一个符号；详细 = 显示码点缩写。",
      "s.confirmall": "全部 / 选区清除前确认", "s.confirmall.d": "每次弹窗复核分类计数（默认开）。",
      "s.confirmblk": "块清除前确认", "s.confirmblk.d": "默认关——免确认以检查模式可见性为闸门（互补规则）。",
      "s.statusbar": "状态栏显示命中数", "s.statusbar.d": "仅桌面；移动端以命令面板为入口。",
      "s.g4": "语言", "s.lang": "界面语言", "s.lang.d": "默认跟随 Obsidian 界面语言；覆盖全部 UI 文案（hover / Modal / 设置 / Notice）。",
      "opt.remove": "清除", "opt.tospace": "转空格", "opt.keep": "保留", "opt.markonly": "仅标记", "opt.clean": "清理",
      "opt.auto": "自动", "opt.compact": "紧凑", "opt.detailed": "详细",
      "p8.1": "<b>策略即数据</b>：默认表逐码点三动作（清除 / 转空格 / 保留），红蓝黄分段；ZWJ 写死永久保护，不可改。",
      "p8.2": "<b>拾取追加区</b>：FR-9 拾取的码点（如 P6 的 U+2064）追加于此，高亮显示、可改动作、可整体重置。",
      "p8.3": "<b>确认开关拆两项</b>：全部/选区默认开（免可见强确认）；块清除默认关（免确认以检查模式为闸门）——互补规则见方案设计 §6。",
      "p8.4": "<b>语言</b>：auto 跟随 Obsidian，手动选择覆盖；全部文案集中于 <code>i18n.ts</code>，en/zh 键集合一致性由单测兜底。",

      "p9.anno.t": "P9 标注", "p9.hint": "isDesktopOnly: false：装饰与命令全平台可用；仅状态栏为桌面专属。",
      "mob.a": "屏 A · 检查模式 · 无状态栏", "mob.b": "屏 B · 命令面板 · 唯一入口",
      "p9.1": "<b>无状态栏</b>：移动端无 <code>addStatusBarItem</code> API——对照桌面端，底部为键盘工具条而非状态栏。",
      "p9.2": "<b>装饰可用</b>：CM6 检查模式在移动端完整可用（NFR-6）。",
      "p9.3": "<b>命令面板为唯一入口</b>：五个命令均可达；检查模式开启时「清除当前块」可用。",

      "idx.tag": "检查并清除剪藏笔记中的不可见水印字符 —— HTML 交互原型（多页 · 双主题 · 中英双语）",
      "idx.how": "每页顶部控制条可切换深浅主题 / 中英语言 / 标记密度 / 标注层；编辑器页内 widget 可悬停查看详情。",
      "idx.sec1": "语义三色", "idx.sec2": "组件规范", "idx.sec3": "页面导航",
      "sw.red": "红 · 无语义不可见", "sw.blue": "蓝 · 空格类", "sw.yellow": "黄 · 受保护语义",
      "sw.neu": "中性面 · Obsidian 默认主题",
      "sw.bg1": "编辑区 background-primary", "sw.bg2": "侧栏 background-secondary",
      "sw.fg": "正文 text-normal", "sw.ac": "强调色 accent hsl(254,80%,68%)",
      "cp.widget": "行内 widget（紧凑 / 详细）", "cp.badge": "Gutter 徽标（可点击）",
      "cp.status": "状态栏项", "cp.hover": "Hover 详情浮层（固定展示）", "cp.btn": "按钮体系", "cp.notice": "Notice 通知",
      "c.p1.name": "编辑器 · Live Preview", "c.p1.desc": "检查模式全貌：三色 widget、行号槽徽标、hover 详情、状态栏计数，点击状态栏可开关检查模式。",
      "c.p2.name": "编辑器 · Source 模式", "c.p2.desc": "原始 Markdown 视图 + 详细档密度（码点缩写），frontmatter 标题污染演示。",
      "c.p3.name": "清除全部", "c.p3.desc": "分类计数确认 Modal → 执行 → Notice 报告 → 清除后零标记，before / after 同页演示。",
      "c.p4.name": "清除选区", "c.p4.desc": "选区态 + 确认 Modal；base64 可见垃圾需手动删除的设计说明。",
      "c.p5.name": "清除当前块", "c.p5.desc": "徽标点击入口、块范围高亮、免确认 Notice、确认开关与零改动路径。",
      "c.p6.name": "拾取码点", "c.p6.desc": "未知字符 → 码点信息 Modal → 按类别写入建议动作 → 持久化。",
      "c.p7.name": "命令面板", "c.p7.desc": "五个命令与建议快捷键；checkCallback 动态置灰（无选区 / 检查模式关闭）。",
      "c.p8.name": "设置", "c.p8.desc": "字符策略表 / 上下文规则 / 界面 / 语言四组完整面板，拾取追加区与确认双开关。",
      "c.p9.name": "移动端", "c.p9.desc": "双屏：检查模式装饰可用（无状态栏）、命令面板唯一入口。",
      "idx.foot": "Ghostmark 原型 v1.2 · 与《需求分析》《方案设计》v1.2 对应 · 仅供设计评审"
    },

    en: {
      "bar.theme.dark": "Theme · Dark", "bar.theme.light": "Theme · Light",
      "bar.lang": "Language · EN",
      "bar.density.compact": "Density · Compact", "bar.density.detailed": "Density · Detailed",
      "bar.annos.on": "Notes · On", "bar.annos.off": "Notes · Off",
      "bar.home": "Index",

      "status.words": "words", "status.chars": "chars",
      "ghost.tip": "{n} hits · Click to toggle inspect mode",
      "badge.tip": "{n} hits in this line · Click to clear current block",
      "mode.edit": "Editing", "mode.read": "Reading", "side.outline": "Outline",

      "cat.red": "Invisible · no semantics", "cat.blue": "Space-like", "cat.yellow": "Protected · semantic",
      "act.remove": "Remove", "act.tospace": "Convert to space", "act.keep": "Keep",
      "tip.suggest": "Suggested",
      "note.mathonly": "In math block: mark only by default",
      "note.codespace": "In code block: convert to space (protects indentation)",
      "note.zwj": "ZWJ carries emoji semantics — permanently protected",
      "note.skin": "Skin-tone modifier — permanently protected",
      "note.run": "Space run (≥2) → whole run removed",

      "cap.p1": "P1 · Editor — Live Preview · Inspect mode · Compact",
      "cap.p2": "P2 · Editor — Source mode · Inspect mode · Detailed",
      "cap.p3": "P3 · Clear all — confirm modal → notice → after",
      "cap.p4": "P4 · Clear selection — selection state + confirm modal",
      "cap.p5": "P5 · Clear current block — gutter entry · no-confirm + notice",
      "cap.p6": "P6 · Pick codepoint — modal → policy table",
      "cap.p7": "P7 · Command palette — five commands · disabled states",
      "cap.p8": "P8 · Settings — full four-group panel",
      "cap.p9": "P9 · Mobile — inspect mode + palette entry",

      "p1.anno.t": "P1 notes",
      "p1.1": "<b>Three semantic colors</b>: red = invisible garbage, blue = space-like, yellow = protected semantics. All decorations are CM6 replace-glyph widgets — zero-width characters must be replaced to become visible.",
      "p1.2": "<b>Inline widgets</b>: compact mode uses one glyph per category (red <code>⌷</code> / blue <code>␣</code> / yellow <code>⌦</code>). Hover any widget for details; the dashed outline one is pinned for demo.",
      "p1.3": "<b>Gutter badges</b>: per-line hit counts colored by dominant category; click to highlight the enclosing block (FR-13 dual entry).",
      "p1.4": "<b>Status bar</b>: <code>Ghost: 806</code> always-on hit count — click to toggle inspect mode (try it). Desktop only.",
      "p1.5": "<b>Visible garbage</b>: the base64 tracking token is not in the policy table, so it is not decorated — remove it via Clear selection (see P4).",

      "p2.anno.t": "P2 notes", "p2.hint": "Same note as P1 in Source view · detailed density (codepoint abbreviations) as default ·",
      "p2.1": "<b>Source mode</b>: raw Markdown fully visible (frontmatter / fences / math markers); decorations still apply — the CM6 extension works in both editing modes.",
      "p2.2": "<b>Detailed density</b>: widgets show codepoint abbreviations (<code>2062</code>, <code>2002 ×20</code>); switch anytime from the control bar.",
      "p2.3": "<b>Polluted frontmatter</b>: a U+061C cluster inside <code>title</code> — the exact scenario proven in obsidian-clipper #918; frontmatter is cleaned like prose.",

      "m3.title": "Clear all marks", "m4.title": "Clear selection", "m5.title": "Clear current block", "m6.title": "Pick codepoint",
      "m3.desc": "Policy-based clean of the whole note. One-shot replace after confirm, single-step undo:",
      "m4.desc": "Policy-based clean of the selected text only:",
      "m5.desc": "Block at cursor (paragraph, 2 lines). No confirm by default:",
      "m6.desc": "This character is not in the default policy table. A category-based action is suggested — adjust and add:",
      "r.red": "Invisible characters (no semantics)", "r.blue": "Space-like characters", "r.yellow": "Protected semantic characters",
      "r.red.sub": "U+2062 ×108 · U+061C ×216", "r.blue.sub": "U+2002 ×300 · U+2009 ×177",
      "r.yellow.sub": "ZWJ ×4 · skin modifier ×1",
      "r.red.sub.s": "in-word clusters ×3", "r.blue.sub.s": "trailing fingerprint run ×1 (8 chars)",
      "r.red.sub.b": "in-word clusters (9 chars)", "r.blue.sub.b": "one run (3 chars)",
      "p5.hint": "The block at cursor is pre-highlighted (gutter-badge entry). Run clear without confirm, or preview the confirm modal and the zero-change path.",
      "pill.remove": "Remove", "pill.tospace": "→ Space", "pill.keep": "Keep", "pill.markonly": "Mark only",
      "m3.math": "3 × U+2062 inside the math block are mark-only (untouched by default) and excluded from the count.",
      "m4.warn": "The base64 tracking token inside the selection is visible garbage, not a policy character — select and delete it manually (intent of FR-8).",
      "m6.ctx": "Character at cursor", "m6.cp": "Codepoint", "m6.name": "Unicode name", "m6.cat": "Category", "m6.act": "Suggested action",
      "btn.cancel": "Cancel", "btn.clear": "Clear {n}", "btn.pick": "Add to policy table",
      "btn.clear798": "Clear 798", "btn.clear14": "Clear 14", "btn.clear12": "Clear 12",
      "r.math": "U+2062 in math block (mark-only)",
      "p3.hint": "The confirm modal opens initially; click “Clear 798” to run — a notice appears and the editor switches to the cleaned state.",
      "p4.hint": "The purple highlight is the native selection; click “Clear 14” to run.",
      "n3.ok": "Cleared 798 marks (red 321 · blue 477)",
      "n3.undo": "Single-step undo — the original text is fully recoverable",
      "n4.ok": "Cleared 14 marks in selection (red 6 · blue 8)",
      "n5.ok": "Cleared 12 marks in current block (red 9 · blue 3) · zero change outside",
      "n5.zero": "No eligible hits in this block (all keep / mark-only) — text unchanged",
      "n6.ok": "U+2064 (action: remove) added to policy table",
      "n6.more": "Change it anytime in Settings → Character policy table",
      "demo.reset": "Reset demo", "demo.run": "Run clear", "demo.confirm": "Confirm modal (if enabled)",
      "demo.zero": "Zero-change case", "demo.repick": "Reopen modal",
      "demo.nosel": "Simulate: no selection", "demo.noinspect": "Simulate: inspect off", "demo.back": "Restore all enabled",
      "demo.inspect": "Inspect on / off", "demo.hint1": "Fixture-equivalent excerpt: 47 visible here / 806 in the full note ·",
      "p1.statusword": "status bar", "p1.statushint": "click to toggle inspect mode",

      "p3.anno.t": "P3 notes",
      "p3.1": "<b>Confirm modal</b>: per-category counts, math mark-only listed separately; the action button uses the warning style (mod-warning) with the exact count.",
      "p3.2": "<b>After run</b>: notice top-right reports counts + undo hint; editor returns to clean state. Use “Reset demo” in the demo bar to restore.",
      "p3.3": "<b>Single transaction</b>: cleaning applies as one <code>editor.transaction</code>, so Obsidian's native undo works out of the box.",

      "p4.anno.t": "P4 notes",
      "p4.1": "<b>Selection state</b>: the purple highlight is Obsidian's native selection color; the command validates via <code>checkCallback</code> — grayed out in the palette when nothing is selected (see P7).",
      "p4.2": "<b>Visible garbage is out of policy scope</b>: base64 tokens have no codepoint rule; the modal says so explicitly to avoid “why isn't it clean” confusion.",

      "p5.anno.t": "P5 notes", "p5.hint": "The block at cursor is pre-highlighted (gutter-badge entry). Run clear without confirm, or preview the confirm modal and the zero-change path.",
      "p5.1": "<b>Block = six shapes</b>: blank-line paragraph / list item / quote run / table row / whole code or math block / whole frontmatter. This demo shows a paragraph.",
      "p5.2": "<b>No-confirm requires visibility</b>: block clear is confirm-free by default, therefore requires inspect mode on (command grayed otherwise); badge click shares the same rule.",
      "p5.3": "<b>Zero-change path</b>: if the block has no eligible hits, notify and leave text untouched.",

      "p6.anno.t": "P6 notes", "p6.hint": "The fallback entry for unknown watermarks from new sites: rest the cursor on the character, then run the command.",
      "p6.1": "<b>Fallback for unknown watermarks</b>: unknown char from a new site → rest the cursor on it and run the command; a category-based action is suggested (invisible → remove, space → to-space, semantic → keep).",
      "p6.2": "<b>Persisted</b>: written into <code>settings.customPolicies</code>; visible, editable and resettable in Settings (see P8).",

      "p7.anno.t": "P7 notes", "p7.hint": "“Clear selection” grays out with no selection; “Clear current block” grays out with inspect off — the input actually filters.",
      "p7.ph": "Type a command…",
      "cmd.toggle": "Ghostmark: Toggle inspect mode", "cmd.clearall": "Ghostmark: Clear all marks",
      "cmd.clearsel": "Ghostmark: Clear selection", "cmd.clearblock": "Ghostmark: Clear current block",
      "cmd.pick": "Ghostmark: Pick codepoint", "cmd.settings": "Obsidian: Open settings",
      "p7.why.nosel": "(no selection)", "p7.why.noinspect": "(inspect mode is off)",
      "p7.1": "<b>Five commands</b>: toggle inspect / clear all / clear selection / clear current block / pick codepoint — all in the palette with suggested hotkeys.",
      "p7.2": "<b>checkCallback graying</b>: “Clear selection” without a selection and “Clear current block” with inspect off are dynamically disabled with reasons. Toggle with the demo buttons above.",
      "p7.3": "<b>Mobile entry</b>: the palette is the only entry on mobile (NFR-6) — see P9.",

      "p8.anno.t": "P8 notes", "p8.hint": "Toggles and dropdowns are interactive visuals (not persisted); the table lists all 21 default codepoints plus the picked additions.",
      "nav.options": "Options", "nav.editor": "Editor", "nav.files": "Files & links", "nav.appearance": "Appearance", "nav.hotkeys": "Hotkeys",
      "nav.core": "Core plugins", "nav.core1": "Daily notes", "nav.core2": "Canvas", "nav.core3": "Outline", "nav.community": "Community plugins",
      "s.g1": "Character policy table", "s.d1": "Policy is data: every codepoint's action can be set to remove / to-space / keep; changes apply instantly and persist.",
      "s.red": "Red · invisible, no semantics (removed by default, incl. code blocks)", "s.blue": "Blue · space-like (runs removed, isolated → space)",
      "s.yellow": "Yellow · protected semantics (mark only)", "s.lock": "Locked", "s.feff": "U+FEFF is handled only outside the file head; a leading BOM is never touched.",
      "s.custom": "Picked additions (customPolicies)", "s.reset": "Reset to defaults", "s.picked": "picked in P6 demo",
      "s.g2": "Context rules", "s.math": "Math block handling", "s.math.d": "Mark only by default; U+2062 from MathML transcodes may carry real multiplication semantics.",
      "s.zwnj.d": "ZWNJ carries word-formation semantics in e.g. Persian; deleting it breaks compound words (lesson of #625).",
      "s.codespace": "Convert space-like chars to plain spaces in code blocks", "s.codespace.d": "Deleting them outright would break Python indentation and syntax.",
      "s.g3": "Interface", "s.remember": "Remember inspect mode state", "s.remember.d": "Keep the last on/off state across restarts (off by default).",
      "s.density": "Mark density", "s.density.d": "Compact = one glyph per category; detailed = codepoint abbreviation.",
      "s.confirmall": "Confirm before clear-all / clear-selection", "s.confirmall.d": "Review category counts every time (on by default).",
      "s.confirmblk": "Confirm before block clear", "s.confirmblk.d": "Off by default — confirm-free clearing is gated by inspect-mode visibility.",
      "s.statusbar": "Show hit count in status bar", "s.statusbar.d": "Desktop only; mobile uses the command palette.",
      "s.g4": "Language", "s.lang": "Interface language", "s.lang.d": "Follow the Obsidian UI language by default; covers all UI strings (hover / modal / settings / notice).",
      "opt.remove": "Remove", "opt.tospace": "To space", "opt.keep": "Keep", "opt.markonly": "Mark only", "opt.clean": "Clean",
      "opt.auto": "Auto", "opt.compact": "Compact", "opt.detailed": "Detailed",
      "p8.1": "<b>Policy is data</b>: the default table lists every codepoint with three actions (remove / to-space / keep), grouped red-blue-yellow; ZWJ is hard-locked to keep.",
      "p8.2": "<b>Picked additions</b>: codepoints picked via FR-9 (e.g. U+2064 from P6) are appended here — highlighted, editable, resettable.",
      "p8.3": "<b>Confirm split in two</b>: all/selection confirm on by default; block confirm off by default (visibility is the gate) — the complementary rule in the design doc §6.",
      "p8.4": "<b>Language</b>: auto follows Obsidian; manual choice overrides. All strings live in <code>i18n.ts</code>; en/zh key parity is unit-tested.",

      "p9.anno.t": "P9 notes", "p9.hint": "isDesktopOnly: false: decorations and commands work everywhere; only the status bar is desktop-specific.",
      "mob.a": "Screen A · Inspect mode · no status bar", "mob.b": "Screen B · Command palette · the only entry",
      "p9.1": "<b>No status bar</b>: mobile has no <code>addStatusBarItem</code> API — compared to desktop, the bottom strip is the keyboard bar, not a status bar.",
      "p9.2": "<b>Decorations available</b>: CM6 inspect mode works fully on mobile (NFR-6).",
      "p9.3": "<b>Palette is the only entry</b>: all five commands reachable; “Clear current block” is enabled while inspect mode is on.",

      "idx.tag": "Detect and clean invisible watermark characters in clipped notes — interactive HTML prototypes (multi-page · dual theme · bilingual)",
      "idx.how": "Each page's top bar toggles dark/light theme, EN/中文 language, mark density and the annotation layer; hover any widget in editor pages for details.",
      "idx.sec1": "Semantic colors", "idx.sec2": "Components", "idx.sec3": "Pages",
      "sw.red": "Red · invisible garbage", "sw.blue": "Blue · space-like", "sw.yellow": "Yellow · protected semantic",
      "sw.neu": "Neutrals · Obsidian default theme",
      "sw.bg1": "editor background-primary", "sw.bg2": "sidebar background-secondary",
      "sw.fg": "text text-normal", "sw.ac": "accent hsl(254,80%,68%)",
      "cp.widget": "Inline widgets (compact / detailed)", "cp.badge": "Gutter badge (clickable)",
      "cp.status": "Status bar item", "cp.hover": "Hover tooltip (pinned)", "cp.btn": "Buttons", "cp.notice": "Notice",
      "c.p1.name": "Editor · Live Preview", "c.p1.desc": "Full inspect mode: three-color widgets, gutter badges, hover details, status bar count — click the status item to toggle.",
      "c.p2.name": "Editor · Source mode", "c.p2.desc": "Raw Markdown view + detailed density (codepoint abbreviations), polluted frontmatter demo.",
      "c.p3.name": "Clear all", "c.p3.desc": "Category-count confirm modal → run → notice → clean editor; before/after on one page.",
      "c.p4.name": "Clear selection", "c.p4.desc": "Selection state + confirm modal; manual handling of visible base64 garbage.",
      "c.p5.name": "Clear current block", "c.p5.desc": "Badge entry, block-range highlight, confirm-free notice, optional confirm and zero-change path.",
      "c.p6.name": "Pick codepoint", "c.p6.desc": "Unknown char → codepoint modal → category-based suggested action → persisted.",
      "c.p7.name": "Command palette", "c.p7.desc": "Five commands with suggested hotkeys; checkCallback dynamic graying (no selection / inspect off).",
      "c.p8.name": "Settings", "c.p8.desc": "Full four groups: policy table, context rules, interface, language — picked additions and dual confirm toggles.",
      "c.p9.name": "Mobile", "c.p9.desc": "Two screens: inspect decorations available (no status bar), palette as the only entry.",
      "idx.foot": "Ghostmark prototype v1.2 · mirrors the requirement & design docs v1.2 · for design review only"
    }
  };

  /* ---------------- 状态 ---------------- */
  var state = {
    theme: localStorage.getItem("gm-theme") || "dark",
    lang: localStorage.getItem("gm-lang") || "zh",
    density: localStorage.getItem("gm-density") ||
             document.body.getAttribute("data-default-density") || "compact",
    annos: localStorage.getItem("gm-annos") !== "off"
  };
  function save() {
    localStorage.setItem("gm-theme", state.theme);
    localStorage.setItem("gm-lang", state.lang);
    localStorage.setItem("gm-density", state.density);
    localStorage.setItem("gm-annos", state.annos ? "on" : "off");
  }
  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || I18N.zh[key] || key;
  }
  function tf(key, vars) {
    var s = t(key);
    Object.keys(vars || {}).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }

  /* ---------------- Obsidian 外壳模板 ---------------- */
  var ICONS = {
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/></svg>',
    graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="10" cy="18" r="2.4"/><path d="M8.3 6.9l7.4.7M16 9.8l-4.6 6.2M7.9 8.2l1.4 7.5"/></svg>',
    canvas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M13 7.5h4M7.5 13v4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1L20 7l-3-3L5 16z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2z"/><path d="M8 3v18"/></svg>'
  };

  /* 文件名 / 文件夹名属于笔记内容，不随界面语言切换 */
  function chromeTitlebar() {
    return '<div class="titlebar"><div class="tabs">' +
      '<div class="tab active"><span>API 设计指南（剪藏）.md</span><span class="t-close">✕</span></div>' +
      '<div class="tab"><span>会议纪要 0901.md</span></div>' +
      '</div><div class="win-controls"><i></i><i></i><i></i></div></div>';
  }
  function chromeRibbon() {
    return '<div class="ribbon">' +
      '<div class="rb on">' + ICONS.doc + '</div>' +
      '<div class="rb">' + ICONS.search + '</div>' +
      '<div class="rb">' + ICONS.graph + '</div>' +
      '<div class="rb">' + ICONS.canvas + '</div>' +
      '<div class="spacer"></div>' +
      '<div class="rb">' + ICONS.gear + '</div>' +
      '</div>';
  }
  function chromeSidebar() {
    return '<div class="sidebar">' +
      '<div class="tree-item folder"><span class="chev">▾</span><span>剪藏</span></div>' +
      '<div class="tree-item file active"><span>API 设计指南（剪藏）.md</span></div>' +
      '<div class="tree-item file"><span>会议纪要 0901.md</span></div>' +
      '<div class="tree-item folder"><span class="chev">▸</span><span>项目</span></div>' +
      '<div class="tree-item folder"><span class="chev">▸</span><span>日常笔记</span></div>' +
      '</div>';
  }
  function chromeRightbar() {
    return '<div class="rightbar"><div class="side-h" data-i18n="side.outline">大纲</div>' +
      '<div class="ol-item">接口命名规范</div>' +
      '<div class="ol-item">请求与响应</div>' +
      '<div class="ol-item lv2">配置示例</div>' +
      '<div class="ol-item">附录：水印样本</div>' +
      '</div>';
  }
  function chromeStatus(el) {
    var w = el.getAttribute("data-words") || "537";
    var c = el.getAttribute("data-chars") || "1,426";
    var g = el.getAttribute("data-ghost") || "806";
    return '<div class="statusbar">' +
      '<span><b class="mono">' + w + '</b> <span data-i18n="status.words">字</span></span>' +
      '<span><b class="mono">' + c + '</b> <span data-i18n="status.chars">字符</span></span>' +
      '<span class="status-ghost" data-action="toggle-inspect"><span class="ghost-dot"></span>Ghost: <b>' + g + '</b></span>' +
      '</div>';
  }
  function mountChrome() {
    document.querySelectorAll("[data-chrome-titlebar]").forEach(function (el) { el.outerHTML = chromeTitlebar(); });
    document.querySelectorAll("[data-chrome-ribbon]").forEach(function (el) { el.outerHTML = chromeRibbon(); });
    document.querySelectorAll("[data-chrome-left]").forEach(function (el) { el.outerHTML = chromeSidebar(); });
    document.querySelectorAll("[data-chrome-right]").forEach(function (el) { el.outerHTML = chromeRightbar(); });
    document.querySelectorAll("[data-chrome-status]").forEach(function (el) { el.outerHTML = chromeStatus(el); });
    document.querySelectorAll(".view-header").forEach(function (el) {
      if (el.getAttribute("data-done")) return;
      el.setAttribute("data-done", "1");
      el.innerHTML = '<span class="crumb">剪藏</span><span class="crumb">/</span>' +
        '<span class="crumb cur">API 设计指南（剪藏）</span>' +
        '<span style="flex:1"></span>' +
        '<span class="rb" style="color:var(--accent)" title="' + t("mode.edit") + '">' + ICONS.pencil + '</span>' +
        '<span class="rb" style="color:var(--text-faint)" title="' + t("mode.read") + '">' + ICONS.book + '</span>';
    });
  }

  /* ---------------- widget 填充与浮层 ---------------- */
  function fillWidgets() {
    var detailed = state.density === "detailed";
    document.querySelectorAll(".gm-w").forEach(function (w) {
      var g = w.getAttribute("data-g") || "";
      var cp = w.getAttribute("data-cp") || "";
      var n = w.getAttribute("data-n") ? parseInt(w.getAttribute("data-n"), 10) : 0;
      var txt = detailed ? (cp + (n ? " ×" + n : "")) : (g + (n ? " ×" + n : ""));
      var gt = w.querySelector(".gt");
      if (!gt) { gt = document.createElement("span"); gt.className = "gt"; w.insertBefore(gt, w.firstChild); }
      gt.textContent = txt;
      var tip = w.querySelector(".tip");
      if (tip) tip.remove();
      tip = document.createElement("span");
      tip.className = "tip" + (w.getAttribute("data-tip") === "r" ? " r" : "");
      var cat = w.getAttribute("data-cat");
      var act = w.getAttribute("data-act");
      var note = w.getAttribute("data-note");
      var html = "<b>" + (w.getAttribute("data-nm") || "") + "</b>";
      html += '<span class="trow">U+' + cp + (n ? " · ×" + n : "") +
        ' · <i class="dot ' + cat + '"></i>' + t("cat." + cat) + "</span>";
      if (note) html += '<span class="tnote">' + t(note) + "</span>";
      if (act) html += '<span class="trow2">' + t("tip.suggest") + ": " + t("act." + act) + "</span>";
      tip.innerHTML = html;
      w.appendChild(tip);
    });
    document.querySelectorAll(".gut .badge").forEach(function (b) {
      b.title = tf("badge.tip", { n: b.textContent });
    });
    var gh = document.querySelector(".status-ghost");
    if (gh) gh.title = tf("ghost.tip", { n: (gh.getAttribute("data-ghost") || (gh.querySelector("b") ? gh.querySelector("b").textContent : "")) });
  }

  /* ---------------- 控制条 ---------------- */
  function buildBar() {
    var mount = document.querySelector("[data-proto-mount]");
    if (!mount || mount.getAttribute("data-built")) return;
    mount.setAttribute("data-built", "1");
    var bar = document.createElement("div");
    bar.className = "proto-bar";
    var hasDensity = document.body.hasAttribute("data-has-density");
    bar.innerHTML =
      '<div class="pb-group">' +
      '<button class="pb-btn" id="pb-theme"></button>' +
      '<button class="pb-btn" id="pb-lang"></button>' +
      (hasDensity ? '<button class="pb-btn" id="pb-density"></button>' : "") +
      '<button class="pb-btn" id="pb-annos"></button>' +
      "</div>" +
      '<div class="pb-group"><a class="pb-btn" href="index.html" style="text-decoration:none" id="pb-home"></a></div>';
    mount.appendChild(bar);
    document.getElementById("pb-theme").onclick = function () {
      state.theme = state.theme === "dark" ? "light" : "dark"; save(); refresh();
    };
    document.getElementById("pb-lang").onclick = function () {
      state.lang = state.lang === "zh" ? "en" : "zh"; save(); refresh();
    };
    if (hasDensity) document.getElementById("pb-density").onclick = function () {
      state.density = state.density === "compact" ? "detailed" : "compact"; save(); refresh();
    };
    document.getElementById("pb-annos").onclick = function () {
      state.annos = !state.annos; save(); refresh();
    };
  }

  function refresh() {
    document.body.classList.toggle("theme-dark", state.theme === "dark");
    document.body.classList.toggle("theme-light", state.theme === "light");
    document.body.classList.toggle("density-detailed", state.density === "detailed");
    document.body.classList.toggle("annos-off", !state.annos);
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
    var bt = document.getElementById("pb-theme");
    if (bt) bt.textContent = t(state.theme === "dark" ? "bar.theme.dark" : "bar.theme.light");
    var bl = document.getElementById("pb-lang");
    if (bl) bl.textContent = t(state.lang === "zh" ? "bar.lang" : "bar.lang.en");
    var bd = document.getElementById("pb-density");
    if (bd) {
      bd.textContent = t(state.density === "compact" ? "bar.density.compact" : "bar.density.detailed");
      bd.classList.toggle("on", state.density === "detailed");
    }
    var ba = document.getElementById("pb-annos");
    if (ba) {
      ba.textContent = t(state.annos ? "bar.annos.on" : "bar.annos.off");
      ba.classList.toggle("on", state.annos);
    }
    var bh = document.getElementById("pb-home");
    if (bh) bh.textContent = t("bar.home");
    fillWidgets();
  }

  /* ---------------- 轻交互 ---------------- */
  function bindActions() {
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-action],[data-demo],[data-close],[data-blk],.n-close,.switch");
      if (!el) return;

      if (el.classList.contains("n-close")) { el.closest(".notice").hidden = true; return; }

      if (el.hasAttribute("data-close")) {
        var ov = document.getElementById(el.getAttribute("data-close"));
        if (ov) ov.hidden = true; return;
      }

      if (el.hasAttribute("data-action")) {
        if (el.getAttribute("data-action") === "toggle-inspect")
          document.body.classList.toggle("inspect-off");
        return;
      }

      if (el.hasAttribute("data-blk")) {
        var id = el.getAttribute("data-blk");
        el.classList.toggle("blk-on");
        document.querySelectorAll('.line[data-blk="' + id + '"]').forEach(function (l) {
          l.classList.toggle("blk-hl", el.classList.contains("blk-on"));
        });
        return;
      }

      if (el.classList.contains("switch")) { el.classList.toggle("on"); return; }

      var demo = el.getAttribute("data-demo");
      if (!demo) return;
      var ov, n;
      switch (demo) {
        case "p3-run":
          ov = document.getElementById("ov3"); if (ov) ov.hidden = true;
          n = document.getElementById("n3"); if (n) n.hidden = false;
          document.body.classList.add("clean"); break;
        case "p3-reset":
          ov = document.getElementById("ov3"); if (ov) ov.hidden = false;
          n = document.getElementById("n3"); if (n) n.hidden = true;
          document.body.classList.remove("clean"); break;
        case "p4-run":
          ov = document.getElementById("ov4"); if (ov) ov.hidden = true;
          n = document.getElementById("n4"); if (n) n.hidden = false;
          document.body.classList.add("clean"); break;
        case "p4-reset":
          ov = document.getElementById("ov4"); if (ov) ov.hidden = false;
          n = document.getElementById("n4"); if (n) n.hidden = true;
          document.body.classList.remove("clean"); break;
        case "p5-run":
          ov = document.getElementById("ov5c"); if (ov) ov.hidden = true;
          n = document.getElementById("n5"); if (n) n.hidden = false;
          var z5 = document.getElementById("n5z"); if (z5) z5.hidden = true;
          document.body.classList.add("clean"); break;
        case "p5-confirm":
          ov = document.getElementById("ov5c"); if (ov) ov.hidden = false; break;
        case "p5-zero":
          n = document.getElementById("n5z"); if (n) n.hidden = false;
          var ok = document.getElementById("n5"); if (ok) ok.hidden = true; break;
        case "p5-reset":
          ["n5", "n5z"].forEach(function (id) { var e = document.getElementById(id); if (e) e.hidden = true; });
          ov = document.getElementById("ov5c"); if (ov) ov.hidden = true;
          document.body.classList.remove("clean"); break;
        case "p6-run":
          ov = document.getElementById("ov6"); if (ov) ov.hidden = true;
          n = document.getElementById("n6"); if (n) n.hidden = false;
          document.body.classList.add("picked"); break;
        case "p6-reset":
          ov = document.getElementById("ov6"); if (ov) ov.hidden = false;
          n = document.getElementById("n6"); if (n) n.hidden = true;
          document.body.classList.remove("picked"); break;
        case "p7-nosel": document.body.classList.toggle("no-sel");
          document.body.classList.remove("inspect-off");
          syncDemoButtons(); break;
        case "p7-noinspect": document.body.classList.toggle("inspect-off");
          document.body.classList.remove("no-sel");
          syncDemoButtons(); break;
        case "p7-reset": document.body.classList.remove("no-sel", "inspect-off");
          var o7 = document.getElementById("ov7"); if (o7) o7.hidden = false;
          syncDemoButtons(); break;
      }
    });

    // 命令面板过滤
    var filter = document.getElementById("cmd-filter");
    if (filter) filter.addEventListener("input", function () {
      var q = filter.value.toLowerCase();
      document.querySelectorAll("#p-list .cmd").forEach(function (c) {
        c.style.display = !q || (c.textContent.toLowerCase().indexOf(q) >= 0) ? "" : "none";
      });
    });

    // Esc 关闭最上层弹层
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      var ovs = Array.prototype.filter.call(document.querySelectorAll(".overlay:not([hidden])"), function (o) { return true; });
      if (ovs.length) ovs[ovs.length - 1].hidden = true;
    });
  }

  function syncDemoButtons() {
    var b1 = document.querySelector('[data-demo="p7-nosel"]');
    var b2 = document.querySelector('[data-demo="p7-noinspect"]');
    if (b1) b1.classList.toggle("on", document.body.classList.contains("no-sel"));
    if (b2) b2.classList.toggle("on", document.body.classList.contains("inspect-off"));
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    mountChrome();
    buildBar();
    bindActions();
    refresh();
    syncDemoButtons();
  });
})();
