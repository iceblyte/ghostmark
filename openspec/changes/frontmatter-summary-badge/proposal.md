# Proposal

## Why

Live Preview 会用 Obsidian 的属性面板覆盖 frontmatter 区域：frontmatter 中的水印字符检查模式"看不见也够不着"（装饰不渲染、导航绕行），形成可见性盲区。Ghostmark 的设计理念是**使不可见水印字符显形**——需要在属性面板之后显示一个"frontmatter 含 N 处标记"的摘要徽标，把盲区里的标记重新带回用户视野并联动清理。

## What Changes

- **新增 frontmatter 摘要徽标**：仅在 Live Preview 且检查模式开启、frontmatter 实际存在命中（N ≥ 1，含红/紫/蓝各类）时渲染，位置紧随属性面板之后、正文首行之前；徽标按类别分段显示计数（复用行号槽徽标的分段色彩体系）。
- **点击清除**：点击徽标对 frontmatter 块执行策略清理——复用既有"清除当前块"管线与"块清除前确认"开关；清理后随命中数归零自动消失；单步撤销成立。
- **模式感知**：纯 Source 模式下 frontmatter 以原文渲染、标记本就可见，徽标不渲染；两种模式切换时徽标即时出现/消失。
- **范围限定**：不改变导航的 frontmatter 绕行规则（`mark-navigation` 主规格）；不影响扫描、清除命令与状态栏计数；无新增设置项。

## Capabilities

### New Capabilities

- `frontmatter-summary-badge`: Live Preview 下 frontmatter 标记的摘要徽标——存在条件、分段计数展示、点击清除、模式感知与清理联动。

### Modified Capabilities

（无——`mark-navigation` 的 frontmatter 绕行行为保持不变，徽标是补充的可见性设施而非导航目标。）

## Impact

- **编辑器层**（`src/editor/`）：新增 frontmatter 徽标装饰（块级 widget，挂载于 frontmatter 区域末端）；`badgeModel.ts` 增加按块聚合的分段模型（纯函数，可单测）；装饰构建需感知叶子模式（Live Preview 判定复用外壳已有逻辑）。
- **外壳层**：`main.ts` 在模式切换（`layout-change`）时触发装饰重建；徽标点击走既有 `clearCurrentBlock`（frontmatter 块，含确认开关与撤销）。
- **核心/i18n**：徽标文案与悬停提示新增 i18n 键（en/zh 键集合一致性由既有单测兜底）；无需改 scanner/cleaner/policy。
- **文档**：README（英/中）与 `docs/验收清单.md` 增加对应条目。
