# Design

## Context

归档 change（expand-marks-and-navigation）交付的架构：`inspectHitsField` 持有全量扫描命中；`blockTypeAt` 区分 frontmatter 上下文；`frontmatterHidden`（外壳层）用叶子状态（`mode === "source"` 且 `source === false`）判定 Live Preview；行号槽徽标走"分段色彩注册表（BADGE_COLORS）+ clearBlockRequestFacet（点击清除所在块）"模式。Live Preview 下属性面板覆盖 frontmatter，命中在其中不可渲染——这是徽标要补的盲区。

用户已确认交互决策：徽标点击 = 清除 frontmatter。

## Goals / Non-Goals

**Goals:**

- 徽标只依赖既有管线：扫描字段、分段模型、清除当前块命令，不引入第二套清理逻辑。
- 徽标对编辑器的选区、光标、坐标计算与 Obsidian 自身的 frontmatter 处理**结构性零影响**。

**Non-Goals:**

- 不在属性面板内部渲染任何装饰（Obsidian 不公开其内部结构，做不到也不尝试）。
- 不新增设置项（徽标随检查模式与命中存在性自然开合）。
- 不改变 mark-navigation 的 frontmatter 绕行规则与清除/计数管线。

## Decisions

### D1. 徽标在编辑器文档流之外（返工决策）

**第一版（已回退）**把徽标做成 frontmatter 末端的块级 widget 装饰，用户验收发现三重严重回归：① 该 widget 进入插件装饰集后同时进入本插件的 `EditorView.atomicRanges` 供给，在 frontmatter 边界形成"原子墙"，鼠标选区被 CodeMirror 强制移出——表现为选中跳到段落开头、选区与实际不一致；② 挂载点落在 Obsidian 属性面板的替换范围内，Live Preview 下徽标被吞掉不显示；③ 外来块级 DOM 插入 frontmatter 行结构之间，Source 模式下 frontmatter 区域显示异常。

**现行方案**：徽标是**编辑器文档流之外的 DOM 元素**——每个 markdown 叶子一个固定摘要条，锚定于 `.markdown-source-view` 内、`.cm-editor` 之前（编辑器内容区上方）。由 `FrontmatterBadgeController`（外壳模块）管理生命周期，用 WeakMap 跟踪每叶子的元素；视图销毁时元素随 DOM 消失，模式切换后由事件重算重新创建。作为 CM 之外的兄弟节点，它结构上不可能影响选区、坐标或文档渲染。

位置取舍：固定摘要条不随内容滚动（始终可见于笔记视图顶部），而非精确夹在属性面板与首行之间——这是编辑器完整性与视觉贴合法则之间的明确取舍，用户验收若偏好其他锚点可在 CSS/挂载点层调整，不影响规格行为。

### D2. 模式与数据感知走事件重算，不经装饰状态

无新增状态字段。`FrontmatterBadgeController.update()` 在 `layout-change`（模式/布局切换）、`active-leaf-change`（切笔记）、检查模式开关与设置变更时全量重算所有叶子；`editor-change` 只对被编辑的叶子做单叶重算（键击路径，与状态栏同频）。显示条件 = Live Preview（`frontmatterHidden`）∧ 检查模式开启 ∧ frontmatter 命中数 ≥ 1（`badgeModel.frontmatterBadge` 纯函数聚合，base64 开关经扫描结果天然生效）。

### D3. 点击清除直接走清除当前块管线

摘要条点击直接调用 `clearCurrentBlock(host, view.editor, 0)`——第 0 行即 frontmatter 块，既有解析、确认开关、Notice 分类计数与单步撤销全部复用。清理（或撤销）引发文档变更 → `editor-change` → 单叶重算 → 徽标随命中归零消失、恢复后重现。零新命令、零新设置。

### D4. 分段模型复用 badgeModel

`badgeModel.ts` 增加纯函数 `frontmatterBadge(hits)`：过滤 `block === "frontmatter"` 的命中后走既有 `badgeSegments`，返回 `{ segments, count }`（单测覆盖多类别聚合、字符数计数、非 frontmatter 排除）。

## Risks / Trade-offs

- [layout-change 事件频率高] → 处理器为每叶子一次布尔计算 + 扫描，量级与状态栏既有行为相同。
- [依赖 Obsidian 视图 DOM 结构（`.markdown-source-view` / `.cm-editor`）] → 查询失败时回退 `containerEl`，元素缺失时按事件重算重建；这是社区插件通用的挂载层级，风险可控。
- [固定条不随内容滚动] → 取舍见 D1；徽标信息在滚动后仍可见反而是增益。
- [editor-change 每键击重算单叶] → 一次全文扫描，与状态栏同频；万字符级亚毫秒。
- [base64 开关影响 N] → 扫描结果本就随开关变化，徽标计数天然一致（spec 场景已覆盖语义）。

## Migration Plan

无设置与数据结构变更；`schemaVersion` 保持 3。回滚 = 还原构建产物。

## Open Questions

无——交互决策（点击清除）与返工方案（文档流外固定摘要条）均已确认/验证。
