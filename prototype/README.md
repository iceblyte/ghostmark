# Ghostmark — HTML 交互原型（v1.2）

对应《Ghostmark-需求分析》v1.2 与《Ghostmark-方案设计》v1.2 的全套 UI 原型，共 10 页。
风格定位：**Obsidian 原生融合风**（参考 gremlins 及 Excalidraw / Dataview 等热门插件的共同做法——严格复用宿主设计语言，颜色只承载三色语义）。

## 打开方式

双击 [index.html](./index.html) 即可（纯静态、零依赖、可离线）；
亦可起本地服务器：`python -m http.server 8642` 后访问 `http://127.0.0.1:8642/`。

## 页面清单

| 页面 | 文件 | 演示内容 | 需求 |
|---|---|---|---|
| P0 | index.html | 导航首页 + 三色色板 + 组件规范一览 | — |
| P1 | editor-live-preview.html | Live Preview · 检查模式 · 紧凑档 · hover · 徽标 · 状态栏 | FR-1~6 |
| P2 | editor-source.html | Source 模式 · 详细档 · frontmatter 污染 | FR-1/3 |
| P3 | clear-all.html | 清除全部：确认 Modal → Notice → 清除后 | FR-7 |
| P4 | clear-selection.html | 清除选区：选区态 + 确认 Modal（base64 手动删） | FR-8 |
| P5 | clear-block.html | 清除当前块：徽标入口 · 免确认 · 确认开关 · 零改动 | FR-13 |
| P6 | pick-codepoint.html | 拾取码点：Modal → 按类别建议动作 → 持久化 | FR-9 |
| P7 | command-palette.html | 五命令 · checkCallback 置灰（无选区 / 检查模式关） | FR-10 |
| P8 | settings.html | 设置四组：策略表 / 上下文规则 / 界面 / 语言 | FR-11/12 |
| P9 | mobile.html | 移动端双屏：无状态栏 · 命令面板唯一入口 | NFR-6 |

## 内置交互

- 每页顶部控制条：**深/浅主题**、**中文/English**、**紧凑/详细密度**（编辑器页）、**标注层开关**，选择经 localStorage 记忆；
- 编辑器页：悬停任意三色 widget 查看详情浮层；点击状态栏 `Ghost: N` 切换检查模式；点击行号槽徽标高亮所在块；
- P3–P6 演示条提供「执行 / 重置 / 确认弹窗 / 零改动」等状态切换；P7 输入框可实际过滤命令。

## 数字口径（与 fixture 对齐）

红 U+2062×108 + U+061C×216 = 324；蓝 U+2002×300 + U+2009×177 = 477；黄 ZWJ×4 + 肤色×1 = 5；
不可见合计 801，命中总数 **806**；数学块内 3 处 markOnly，清除全部实际清除 **798**。

## 结构

```
prototype/
├── common.css   # 设计令牌（双主题）、Obsidian 外壳、三色 widget、Modal/Notice/设置组件
├── common.js    # 中英文案表、主题/语言/密度/标注状态机、外壳注入、轻交互
└── *.html       # P0–P9 十个页面（编辑器内容为 fixture 等价中文样本）
```

仅供设计评审，非产品代码。
