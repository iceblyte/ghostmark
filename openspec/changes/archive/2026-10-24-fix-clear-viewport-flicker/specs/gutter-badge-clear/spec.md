# Spec Delta

## Purpose

修订 `gutter-badge-clear` capability 的"清除事务的视口稳定性"Requirement：恢复机制必须在受影响帧绘制前生效，消除光标在视口外时清除的单帧闪烁。

## MODIFIED Requirements

### Requirement: 清除事务的视口稳定性

清除类命令的编辑器事务 SHALL NOT 因事务中的选区处理或宿主的事务后光标 reveal 而触发视口滚动：事务只携带 `changes`，选区由编辑器自动映射；视口恢复 SHALL 通过常驻编辑器扩展在锚定窗口内**同步回写**实现——scroll 事件监听器内直接写 `scrollDOM`（scroll 事件在绘制前派发，回写可赶在绘制前生效，不产生闪烁帧），并以 rAF 循环兜底，连续数帧无滚动对抗后释放。SHALL NOT 经由落地时机由宿主调度的 `editor.scrollTo` 恢复，也 SHALL NOT 仅依赖 rAF 回调恢复（浏览器一帧内 rAF 先于光标 reveal 滚动步骤执行，rAF 恢复必然晚一帧绘制）。

#### Scenario: 光标在视口外时点击徽标不跳动且无闪烁

- **WHEN** 光标停留于 A 处，用户滚动页面使 A 移出视口，随后点击可见徽标完成一次清除
- **THEN** 清除生效，视口停留在用户滚动后的位置，全程不出现"跳到光标再弹回"的闪烁帧

#### Scenario: 光标在视口内时行为不变

- **WHEN** 光标在视口内，点击可见徽标完成一次清除
- **THEN** 清除生效，视口无任何滚动变化（恢复为无操作）

#### Scenario: 单步撤销保持

- **WHEN** 任意清除事务完成后执行撤销
- **THEN** 一步撤销恢复清除前的文本

## UNCHANGED Requirements

- "徽标点击清除与计数同区间"（上一变更引入，本变更不触及）
- "撤销的视口稳定性"（上一变更引入，本变更仅统一其实现文件命名，行为不变）
