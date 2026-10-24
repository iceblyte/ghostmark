# Tasks

- [x] 1. 视口锚定扩展泛化
  - [ ] 1.1 `undoViewport.ts` → `viewportAnchor.ts`：保留 `isUndoLikeTransaction` 与撤销识别；新增 `pinViewportAcrossNextTransaction()` 标记消费机制
  - [ ] 1.2 恢复机制统一为 scroll 事件监听器内同步回写（绘制前生效）+ rAF 兜底，连续 4 帧无对抗即释放（上限 30 帧）；测试文件同步改名
- [x] 2. 清除路径接入
  - [ ] 2.1 `commands.ts` `applyCleanedChanges`：移除 `editor.scrollTo` 恢复，改为 transaction 前 pin
  - [ ] 2.2 `main.ts` 扩展注册更新
- [x] 3. 三闸门全绿：`npm test` / `npm run lint` / `npm run build`
- [x] 4. 手动验收：光标在视口外点击徽标清除无闪烁；视口内清除、撤销/重做、普通编辑零回归
