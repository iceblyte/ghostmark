# Design

## Context

归档 change（expand-marks-and-navigation）交付的架构：`inspectHitsField` 持有全量扫描命中；`blockTypeAt` 区分 frontmatter 上下文；`frontmatterHidden`（外壳层）用叶子状态（`mode === "source"` 且 `source === false`）判定 Live Preview；行号槽徽标走"分段色彩注册表（BADGE_COLORS）+ clearBlockRequestFacet（点击清除所在块）"模式。Live Preview 下属性面板覆盖 frontmatter，命中在其中不可渲染——这是徽标要补的盲区。

用户已确认交互决策：徽标点击 = 清除 frontmatter。

## Goals / Non-Goals

**Goals:**

- 徽标只依赖既有管线：扫描字段、分段模型、清除当前块命令，不引入第二套清理逻辑。
- 模式感知复用既有"外壳推送效果 → 状态字段 → 装饰重建"机制（与 inspectRuntimeEffect 同款）。

**Non-Goals:**

- 不在属性面板内部渲染任何装饰（Obsidian 不公开其内部结构，做不到也不尝试）。
- 不新增设置项（徽标随检查模式与命中存在性自然开合）。
- 不改变 mark-navigation 的 frontmatter 绕行规则与清除/计数管线。

## Decisions

### D1. 徽标 = frontmatter 末端的块级 widget 装饰

在 frontmatter 区域结束位置（`blockTypeAt` 已知 frontmatter span）挂 `Decoration.widget({ widget, block: true, side: 1 })`：渲染在属性面板之后、正文首行之前，不占用正文行、不干扰原子区间与选区。widget 为块级 `FrontmatterBadgeWidget`（复用 `gm-badge` 分段样式 + 新增 `gm-fm-badge` 容器样式）。

备选"行装饰 class + CSS ::before"被否：内容文本（计数分段）需要 DOM 结构与事件处理，widget 是 CM6 的正规载体。

### D2. 模式感知经 StateEffect 推送，不在装饰构建时探测

装饰构建（`buildDecorations`）读一个新状态字段 `frontmatterBadgeField`（存 Live Preview 布尔值），构建逻辑保持纯读。外壳在 `layout-change` 事件中对每个编辑器叶子计算 `frontmatterHidden`（既有函数）并 dispatch 效果——与 `inspectRuntimeEffect` 的广播机制同款。模式切换触发 `layout-change`，徽标即时开合。

纯 Source / 阅读模式判定收口在外壳的既有函数，装饰层不重复实现模式探测逻辑。

### D3. 点击清除走既有 clearBlockRequestFacet

`FrontmatterBadgeWidget.toDOM` 挂点击处理，调用 `view.state.facet(clearBlockRequestFacet)` 并传 `lineIndex = 0`——frontmatter 从第 0 行开始，`blockRangeAt(0)` 恰好返回 frontmatter 块（既有解析能力），因此徽标点击与行号槽徽标点击完全同路：同一确认开关、同一 Notice、同一撤销语义。零新命令、零新设置。

### D4. 分段模型复用 badgeModel

`badgeModel.ts` 增加纯函数 `frontmatterBadge(hits)`：过滤 `block === "frontmatter"` 的命中后走既有 `badgeSegments`/`badgeWidthPx`，返回 `{ segments, count }`（可单测）。widget `eq` 比较 segments 与 locale，避免无谓重绘。

### D5. 可见性条件集中判定

渲染条件 = Live Preview（状态字段）∧ 检查模式开启（既有运行时）∧ frontmatter 命中数 ≥ 1（含 base64 段，受 `base64Marking` 开关影响的扫描结果天然正确）。判定散落在 `buildDecorations` 一处，widget 自身不做条件判断。

## Risks / Trade-offs

- [layout-change 事件频率高] → 处理器只做一次布尔计算与条件 dispatch（值不变时不派发），成本可忽略。
- [块级 widget 与 Obsidian 属性面板的边界冲突] → 挂点选在 frontmatter span 末尾（`side: 1`），属性面板是 Obsidian 的覆盖装饰，两者不重叠；实机验收覆盖 Live Preview 与模式往返。
- [撤销后徽标刷新] → 撤销即文档变更，扫描字段重算，装饰自然重建；无需额外订阅。
- [base64 开关影响 N] → 扫描结果本就随开关变化，徽标计数天然一致（spec 场景已覆盖语义）。

## Migration Plan

无设置与数据结构变更；`schemaVersion` 保持 3。回滚 = 还原构建产物。

## Open Questions

无——交互决策（点击清除）已与用户确认；其余为实现细节。
