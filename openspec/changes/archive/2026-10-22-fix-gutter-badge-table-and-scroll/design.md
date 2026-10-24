# Design

## D1 — 徽标点击的区间语义

CM6 gutter 的 `lineMarker` / `domEventHandlers` 接收 **BlockInfo**：对被块级 widget（如 Obsidian Live Preview 的表格渲染）折叠的多行区间，它覆盖整个折叠范围（`from` = 首行行首，`to` = 末行行尾）。既有实现只取 `doc.lineAt(line.from)` 的首行行号，造成"计数 = 整表、清除 = 首行"的错位。

修复：mousedown 直接传递 `line.from` / `line.to`，`clearCurrentBlock` 对 `[from, to)` 偏移区间扫描清理——**清除范围恒等于徽标计数范围**。行范围与块形态标签由 `core/blocks.ts` 新增的纯函数 `badgeBlockRange(text, from, to)` 解析：以首行调用 `blockRangeAt` 得基准形态，末行按折叠区间扩展；`tableRow` 形态被扩展为多行时标签升级为 `table`（i18n 新键 `block.table`）。

不选"只清首行并提示剩余"（用户已否决）：徽标数字是用户的清除预期，数字与实际清除数必须一致。

## D2 — 光标命令的 FR-13 语义保持

无区间入参（命令面板 / 右键路径）时仍走 `editor.getCursor("from").line` → `blockRangeAt`，表格仍是"表格行"粒度——FR-13 的六形态定义不变，本变更只修徽标入口。

## D3 — 视口稳定

Obsidian 对带 `selection` 的 `editor.transaction` 会在事务 DOM 更新后把光标滚动进可视区，且同步的 `editor.scrollTo` 恢复先于该滚动落地而被覆盖。修复分两层：

1. **消除触发源**：事务只含 `changes`。CM 自动把选区映射过 changes（与被删除的手动映射算法等价），光标相对位置不丢，单步撤销不变；
2. **异步兜底**：事务后同步检查一次滚动，并在 `requestAnimationFrame` 再断言一次——覆盖宿主在 measure 阶段补做的滚动。

## D4 — 风险与对策

| 风险 | 对策 |
|---|---|
| BlockInfo `to` 的边界（含/不含末行换行）在不同折叠场景下的差异 | 清理直接以 `[from, to)` 为准，与 `lineHits` 的 `hit.index < line.to` 同一约定，计数与清除天然一致；`badgeBlockRange` 对越界区间判空返回 |
| 折叠块非表格（如内嵌 transclusion） | 通用规则兜底：形态取首行 `blockRangeAt`，区间扩展到折叠末行——清除范围仍与徽标计数一致 |
| 移除 selection 后光标行为变化 | CM 自动映射与原手动映射算法逐位置等价；块清除路径另有单测与手动验收兜底 |
