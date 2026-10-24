# Proposal

## Why

1.2.1 验收后用户报告：光标在视口内时点击徽标清除正常（无闪烁），但把页面滑到光标不可见后再点击徽标，清除正确而**页面会闪烁**（视口先跳到光标处绘制一帧，再弹回）。

**根因**：视口被滚到光标处的滚动发生在浏览器一帧生命周期的后期（rAF 回调之后、绘制之前的光标 reveal / 宿主延迟滚动），而 rAF 回调里的恢复在该帧绘制**之前**执行、必然被随后的 reveal 覆盖，只能下一帧扳回——这一先一后就构成了用户看到的闪烁帧。撤销路径同样存在（CM6 history 的 scrollIntoView 在 measure 阶段落地，同样晚于插件 update 监听器里注册的 rAF）。仅靠 rAF 逐帧断言无法消除闪烁。

## What Changes

- **视口锚定扩展泛化**：`undoViewport` 重命名为 `viewportAnchor`，从"仅撤销"泛化为两类锚定对象——撤销/重做事务（按 CM6 `userEvent` 标注识别）与**清除事务**（`applyCleanedChanges` 在 `editor.transaction` 前调用 `pinViewportAcrossNextTransaction()`，同一同步 dispatch 消费该标记）。
- **恢复机制统一为"scroll 事件同步回写 + rAF 兜底"**：锚定窗口内监听 `scrollDOM` 的 scroll 事件，任何滚动偏差在事件处理器内**同步回写** `scrollTop/scrollLeft`。关键依据：由 reveal 步骤触发的 scroll 事件在绘制前派发，监听器内回写可赶在绘制前生效，闪烁帧不再被绘制；rAF 循环仅作兜底，连续 4 帧无滚动对抗即释放（上限 30 帧）。
- **范围限定**：清除语义、确认弹窗、Notice、单步撤销、撤销路径行为均不变；不新增设置项。

## Capabilities

### Modified Capabilities

- `gutter-badge-clear`: "清除事务的视口稳定性" Requirement 修订——恢复必须在受影响帧**绘制前**生效（scroll 事件监听器内同步回写 scrollDOM + rAF 兜底），不允许经由宿主调度的 `editor.scrollTo`，也不允许仅依赖 rAF 回调恢复。

## Impact

- `src/editor/viewportAnchor.ts`（原 `undoViewport.ts`，重命名 + 泛化）、`src/editor/viewportAnchor.test.ts`。
- `src/commands.ts`（`applyCleanedChanges` 简化为 pin + transaction）、`src/main.ts`（扩展注册）。
- 验收：光标在视口外点击徽标清除无闪烁、撤销/重做视口稳定不回归、普通编辑与视口内清除零变化。
