# Ghostmark

**检查并清除剪藏笔记中的不可见水印字符。**

用 Obsidian Web Clipper 剪藏网页时，部分站点会在正文里注入不可见水印字符——词内的零宽字符簇、段尾的空宽空格指纹串、隐藏的双向控制符。它们渲染时完全不可见，却会破坏搜索、双链、diff，甚至毁掉你复制进终端的代码。Ghostmark 把它们全部显形，并以"上下文感知、执行前确认、单步可撤销"的方式清理。

> 场景源自 [obsidian-clipper #918](https://github.com/obsidianmd/obsidian-clipper/issues/918)；另见 [#625](https://github.com/obsidianmd/obsidian-clipper/issues/625)（ZWNJ 默认受保护的原因）与 [#916](https://github.com/obsidianmd/obsidian-clipper/issues/916)。

## 功能

- **检查模式**——一个开关（命令 / 状态栏点击 / 快捷键），Source 与 Live Preview 双模式可用，全仓库生效，可记忆上次状态。
- **三色语义**
  - 🔴 **红 · 无语义不可见**（U+200B、U+2060–U+2064、U+061C、U+180E、U+200E/F、U+FFFE/F、U+FEFF；默认清除，含代码块）；
  - 🔵 **蓝 · 空格类**（U+2002、U+2009、U+2007、U+202F、U+00A0）：成串（≥2）整串删除、孤立转普通空格；代码块内逐一转普通空格，保住缩进；
  - 🟡 **黄 · 受保护语义**（ZWJ 写死保护、ZWNJ、变体选择符）：仅标记，默认不动。
- **两档密度**——紧凑（每类一个符号）与详细（码点缩写，如 `2062`、`2002 ×20`）。
- **悬停详情**——名称、码点、类别、上下文说明与建议动作。
- **行号槽徽标**——按行显示命中计数（按主导类别着色），点击徽标清除所在块。
- **状态栏**——`Ghost: N` 常驻显示当前笔记命中数（仅桌面），点击切换检查模式。
- **清除全部 / 清除选区**——确认弹窗分类计数，单事务替换，单步撤销。base64 追踪 token 是*可见*垃圾、不属于策略表，请手动选中删除（选区弹窗会提醒）。
- **清除当前块**——段落 / 列表项 / 引用块 / 表格行 / 整个代码或数学块 / frontmatter。默认免确认，因此仅在检查模式开启时可用（免确认以可见性为闸门）；可在设置中开启确认。
- **拾取码点**——光标停在未知字符上执行命令，查看码点信息与按类别给出的建议动作，确认后加入策略表。新网站的未知水印从此一条命令搞定。
- **数学安全**——`$$…$$` 与行内 `$…$` 内的命中默认仅标记；MathML 转写可能让 U+2062 承载真实的乘法语义。如需清理可在设置中改为"清理"。
- **界面语言**——中文 / English，默认跟随 Obsidian。

## 命令

| 命令 | 建议快捷键 |
| --- | --- |
| Ghostmark: 切换检查模式 | `Ctrl/Cmd + Alt + I` |
| Ghostmark: 清除全部标记 | `Ctrl/Cmd + Alt + K` |
| Ghostmark: 清除选区 | —（需选区） |
| Ghostmark: 清除当前块 | —（需检查模式开启） |
| Ghostmark: 拾取码点 | — |

## 安装

暂未上架社区插件市场，手动安装：

1. 从 [Releases](../../releases) 下载 `main.js`、`manifest.json`（或自行构建）；
2. 放入 `<vault>/.obsidian/plugins/ghostmark/`；
3. 在 *设置 → 第三方插件* 中启用 **Ghostmark**。

## 开发

```bash
npm install
npm run dev     # esbuild watch
npm run build   # tsc -noEmit + 生产构建 → main.js
npm run lint    # eslint（含 eslint-plugin-obsidianmd 上架规范）
npm test        # vitest（core 引擎 + fixture 验收断言）
```

核心引擎（`src/core/`）为纯 TypeScript，不依赖 Obsidian / CodeMirror，全部单测基于入库的合成样本 `src/core/fixtures/watermark-fixture.md`（不可见字符 801 个：U+2062 ×108、U+061C ×216、U+2002 ×300、U+2009 ×177，另有 ZWJ ×4、肤色修饰符 ×1——命中 806，可清除 798）。

**开发 vault 建议**：每次构建后将 `main.js`、`manifest.json`、`styles.css` 复制到测试 vault 的 `.obsidian/plugins/ghostmark/`；或配合 [pjeby/hot-reload](https://github.com/pjeby/hot-reload) 与 `npm run dev` 实现保存即重载。

## 许可

[MIT](LICENSE)
