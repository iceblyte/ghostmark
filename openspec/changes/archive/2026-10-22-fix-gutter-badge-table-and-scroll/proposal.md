# Proposal

## Why

上线后收到两个真实 Bug 报告：

1. **Live Preview 下表格徽标点击"无命中"**：Obsidian 把表格的多行 markdown 源码用块级 widget 折叠渲染。CM6 gutter 的 `lineMarker` / `domEventHandlers` 收到的是覆盖整个折叠区间的 BlockInfo（CM 官方文档确认），因此徽标计数聚合的是**整张表格**的命中；但点击处理只解析 `doc.lineAt(line.from)` 的**第一行**行号，`blockRangeAt` 返回 `tableRow`（单行），水印在数据行上时扫描结果为零命中，提示"该块无命中"。源码模式无折叠 widget，逐行徽标一一对应，所以一切正常。徽标的"计数范围"与"清除范围"不一致，违背设计原则"看得见才信得过"。
2. **清除后页面跳回光标位置**：`applyCleanedChanges` 在 `editor.transaction` 中显式传 `selection`，Obsidian 对带 selection 的事务会把新光标滚动进可视区（发生在事务 DOM 更新之后的 measure 阶段）；`df2a373` 引入的同步 `editor.scrollTo` 恢复执行时机早于宿主滚动落地，被覆盖。用户把页面滑离光标后点击徽标，视口被强制拉回光标处。

## What Changes

- **徽标点击清除语义**：行号槽徽标点击改为传递所在行块（BlockInfo）的完整偏移区间 `{from, to}`——与徽标计数完全同一区间；`clearCurrentBlock` 接受该区间并对其直接扫描清理。Live Preview 折叠表格上点击徽标即清除整张表格（用户已确认）；单行行块的徽标行为不变。**光标路径的 FR-13 语义不变**（命令仍是"表格行"粒度）。
- **清除事务的视口稳定**：`applyCleanedChanges` 移除显式 `selection` 与手动光标映射（CM 自动把选区映射过 changes，单步撤销不受影响），保留滚动守卫并增加 `requestAnimationFrame` 异步再断言一次恢复，兜住宿主在事务后补做的滚动。
- **撤销的视口稳定（用户验收轮追加）**：CM6 历史命令源码（`@codemirror/commands` history.ts `pop()`）确认撤销事务携带 `scrollIntoView: true` 与 `userEvent: "undo"`——清除后光标在视口外时，Ctrl+Z 会把恢复出来的选区（光标原位置）强制滚入视区。新增常驻扩展 `undoViewport`：撤销/重做事务发生时在 update 监听器中读取更新前滚动位置（先于 measure 阶段的滚动落地），下一帧再断言恢复；恢复的选区本就可见时为无操作。
- **i18n**：新增 `block.table`（en/zh），整表清除时确认弹窗按"表格"而非"表格行"描述块形态。
- **范围限定**：不改 scanner / cleaner / policy；不改跳转命令；不新增设置项。

## Capabilities

### New Capabilities

- `gutter-badge-clear`: 行号槽徽标点击清除的区间语义（行块级，与徽标计数一致）与清除事务的视口稳定性。

## Impact

- **编辑器层**：`src/editor/gutter.ts`（mousedown 传区间）、`src/editor/inspectState.ts`（facet 签名）。
- **外壳层**：`src/main.ts`（facet 接线）、`src/commands.ts`（`clearCurrentBlock` 双入口、`applyCleanedChanges` 重写）。
- **核心**：`src/core/blocks.ts` 新增纯函数 `badgeBlockRange`（区间 → 行范围解析，单测覆盖）；`src/core/i18n.ts` 新增 `block.table`。
- **验收**：Live Preview 表格徽标清整表、视口不跳、源码模式与光标命令零回归。
