# Tasks

## 1. 模型与状态（core / 纯函数）

- [x] 1.1 `src/editor/badgeModel.ts`：增纯函数 `frontmatterBadge(hits)`（过滤 `block === "frontmatter"` 后走既有 `badgeSegments`，返回分段与总计数）；`badgeModel.test.ts` 增断言：多类别分段、计数按字符数、非 frontmatter 命中被排除
- [x] 1.2 `src/editor/flash.ts` 旁新增（或并入 `inspectState.ts`）`frontmatterBadgeField` 状态字段 + `frontmatterBadgeEffect` 效果（存 Live Preview 布尔值，文档变更不清除）；状态机单测：初始值、效果设置、同值不重复派发由外壳负责（字段侧只验证存取）

## 2. 徽标渲染与点击（editor 层）

- [x] 2.1 `src/editor/widgets.ts`（或独立文件）：`FrontmatterBadgeWidget` 块级 widget——分段渲染复用 `gm-badge` 分段结构、`data-nm` 悬停提示（`badge.tip`）、`toDOM` 挂点击调用 `clearBlockRequestFacet`（`lineIndex = 0`）；`eq` 按 segments/locale 比较；`npx tsc -noEmit -skipLibCheck` 通过
- [x] 2.2 `src/editor/inspectMode.ts`：`buildDecorations` 在 Live Preview 字段为真且 frontmatter 命中 ≥1 时，于 frontmatter span 末端挂块级装饰；装饰插件在徽标字段/运行时/文档变化时重建；装饰随检查模式关闭而消失
- [x] 2.3 `styles.css`：`gm-fm-badge` 容器样式（与属性面板间距、正文首行不重叠）；手动确认 Source 与 Live Preview 外观切换

## 3. 外壳接线与 i18n

- [x] 3.1 `src/main.ts`：`layout-change` 事件中按叶子计算 `frontmatterHidden` 并条件 dispatch `frontmatterBadgeEffect`（值变化才派发）；确认模式切换时徽标即时开合
- [x] 3.2 `src/core/i18n.ts`：增 `fm.badge`（"frontmatter 含 {n} 处标记"）等键，en/zh 键集合一致性断言通过；悬停复用 `badge.tip`
- [x] 3.3 点击链路验证：点击徽标 → frontmatter 块清除（确认开关两种取值各验一次）→ Notice 计数 → 单步撤销 → 徽标随命中归零消失、撤销后重现；清除命令与状态栏计数无回归

## 4. 文档与全局验证

- [x] 4.1 README.md 与 README.zh-CN.md：检查模式章节补徽标说明（出现条件、分段计数、点击清除）
- [x] 4.2 `docs/验收清单.md`：新增"frontmatter 摘要徽标"节（Live Preview 显示/Source 隐藏/分段计数/点击清除/确认开关联动/模式切换即时性/撤销联动）
- [x] 4.3 三闸门全绿：`npm test`、`npm run lint`、`npm run build`；既有 162 项测试零回归；对照验收清单新节手动核验

## 5. 返工（用户验收轮：编辑器内块级 widget 引发严重回归）

- [x] 5.1 根因：块级 widget 随插件装饰集进入本插件 `atomicRanges` 供给，在 frontmatter 边界形成原子墙 → 鼠标选区被强制移出（跳段、选区不一致）；挂载点落在 Obsidian 属性面板替换范围内（Live Preview 被吞）；外来块级 DOM 干扰 Source 模式 frontmatter 行结构
- [x] 5.2 重做：移除块级 widget（fmBadge.ts）、frontmatterBadgeField/Effect 及其状态机测试；新增 `src/frontmatterBadge.ts` 控制器——编辑器文档流外的固定摘要条（每叶子一个，锚定 `.cm-editor` 之前，WeakMap 跟踪），点击直接调 `clearCurrentBlock(editor, 0)`；接线 layout-change / active-leaf-change / editor-change / 检查模式开关 / 设置变更
- [x] 5.3 验证：三闸门全绿 + 165 项测试零回归（badgeModel 聚合测试保留）；spec/design/proposal 措辞同步为固定摘要条方案；验收清单第 14 节更新待宿主复核
