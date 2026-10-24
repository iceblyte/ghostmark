# Tasks

## 1. core（纯函数与 i18n）

- [x] 1.1 `src/core/blocks.ts`：新增 `badgeBlockRange(text, from, to)`——解析徽标行块偏移区间为 `BlockLineRange`（首行 `blockRangeAt` 定形态，末行按折叠区间扩展；`tableRow` 扩展为多行时形态升级 `table`；越界/空区间返回 null）；`BlockShape` 联合类型增 `"table"`
- [x] 1.2 `src/core/blocks.test.ts`：补单测——表格折叠区间（首行无命中、数据行有命中）→ 整表行范围与 `table` 形态；单行区间 → 原行为；越界区间 → null
- [x] 1.3 `src/core/i18n.ts`：新增 `block.table`（zh "表格" / en "table"），en/zh 键集合一致性测试通过

## 2. 编辑器层与外壳接线

- [x] 2.1 `src/editor/inspectState.ts`：`clearBlockRequestFacet` 签名改为 `(view, target: { from: number; to: number })`
- [x] 2.2 `src/editor/gutter.ts`：mousedown 传递 `line.from` / `line.to` 偏移区间（与 `lineHits` 同一约定）
- [x] 2.3 `src/main.ts`：facet 接线适配新签名

## 3. 命令层

- [x] 3.1 `src/commands.ts`：`applyCleanedChanges` 重写——移除显式 `selection` 与手动光标映射；保留滚动守卫并加 `requestAnimationFrame` 异步再断言
- [x] 3.2 `src/commands.ts`：`clearCurrentBlock` 接受可选偏移区间（徽标入口走 `badgeBlockRange`，光标入口走原 `blockRangeAt` 路径，FR-13 语义不变）；确认弹窗形态标签支持 `block.table`

## 4. 验证

- [x] 4.1 三闸门全绿：`npm test` / `npm run lint` / `npm run build`
- [x] 4.2 手动验收（Live Preview 表格徽标清整表且计数一致、光标在视口外时视口不跳、源码模式回归、光标命令表格行粒度、单步撤销）

## 5. 撤销的视口稳定（用户验收轮追加）

- [x] 5.1 `src/editor/undoViewport.ts`：常驻 ViewPlugin 扩展——撤销/重做事务（`userEvent: undo|redo|select.undo|select.redo`）时记录更新前滚动位置，rAF 下一帧再断言；`isUndoLikeTransaction` 纯函数 + 单测（历史事件匹配 / 编辑与选区事件不匹配 / 无标注不匹配）
- [x] 5.2 `src/main.ts`：`registerEditorExtension` 注册 `undoViewportExtension`（检查模式关闭时同样生效）
- [x] 5.3 spec delta 增"撤销的视口稳定性" Requirement；三闸门复验 + 手动验收（视口外撤销不跳、视口内撤销零滚动变化、重做同规则）
