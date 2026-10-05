# Proposal

## Why

Ghostmark v1.1 的默认策略表只覆盖 21 行码点，而真实站点的水印技术远不止于此：用户实测反馈"很多不可见字符没有被标记"。经对 `reference/` 下 35 篇剪藏文档（61 万字符）的扫描验证，现有引擎对其中 4 种水印字符（U+2002/U+061C/U+2009/U+2062）的覆盖率已是 100%（12,895 处全部命中）——缺口在于**策略表未收录的其他 Unicode 不可见/可疑字符**（bidi 控制、软连字符、控制字符、标签字符等）。同一批文档还包含 1,122 处 base64 追踪串（仅 10 个唯一值，形态 `[A-Za-z0-9+/]{43}=`），当前完全不被标记，只能手动清理；而偏好逐处确认的用户在长文档里滑动寻找标记也很低效。

## What Changes

- **扩展默认字符策略表**（21 行 → 46 行）：新增 bidi 方向控制（U+202A–202E、U+2066–2069）、软连字符 U+00AD、行间注释锚 U+FFF9–FFFB、语言标签字符 U+E0001 与 U+E0020–E007F、C0/C1 控制字符（排除 \t \n \r）、非字符 U+FDD0–FDEF、空宽空格补全（U+2000/2001/2003–2006/2008/200A、U+205F、U+1680）、行/段分隔符 U+2028/2029（默认转空格，避免删字符后单词粘连）。全角空格 U+3000 不收录（中文排版合法用法）。
- **base64 乱码标记与清除**：新增第四色（紫）类别 `base64`。规则：标记以 `=` 结尾、长度 ≥20 的 base64 串；与单词粘连时只标记尾部 44 字符窗口，保护被粘连的正常文本；data URI（内嵌图片）豁免；代码块/行内代码内仅标记不清除。每段字形可点击单独清除；"清除全部 / 清除选区"在开关开启时一并清除 base64 段（确认弹窗增加紫色计数）；设置中新增"标记 base64 乱码"开关（默认开）。
- **标记跳转导航**：新增"跳转到下一处标记 / 跳转到上一处标记"两条命令（文末/文首循环），光标选中标记处并滚动到可见位置；检查模式关闭时命令面板置灰（与"清除当前块"的可见性闸门规则一致）。
- **新增脱敏测试 fixture**：从 `reference/` 提取水印模式（不复制受版权保护的正文与真实 token 值），生成第二个合成样本 `src/core/fixtures/clipped-fixture.md`，覆盖新策略行、base64 各形态与防误报负例（路径 / URL / git SHA / data URI）。
- **文档同步**：README（英/中）与手动验收清单补充新功能条目。

## Capabilities

### New Capabilities

- `character-policy`: 默认字符策略表的收录范围与各码点默认动作（本变更将其从 21 行扩展到 46 行，并明确空宽空格、bidi 控制、控制字符等新增组的动作规则）。
- `base64-marking`: base64 乱码的识别规则、紫色标记、逐段点击清除、清除全部/选区的包含关系与设置开关。
- `mark-navigation`: 检查模式下的标记跳转命令（下一处/上一处、循环、选中与滚动、可用性闸门）。

### Modified Capabilities

<!-- openspec/specs/ 目前为空（项目尚无已归档 spec），无既有能力需要修改。 -->

## Impact

- **核心引擎**（`src/core/`）：`categories.ts`（Category 联合类型新增 `base64`、策略表扩充、i18n 键）、`scanner.ts`（base64 扫描与粘连窗口规则）、`cleaner.ts`（ChangeReport/汇总按 base64 段计数）、`policy.ts`（设置字段 `base64Marking`、schemaVersion 2 → 3 迁移）、`i18n.ts`（约 40 个新码点名 + 新功能文案，en/zh 键集合一致性由既有单测兜底）。
- **编辑器层**（`src/editor/`）：`widgets.ts`（紫色字形、base64 标签、点击清除回调）、`badgeModel.ts`（BADGE_COLORS 注册表新增紫色段）、`inspectState.ts`（InspectConfig 增加 base64 开关）、`inspectMode.ts`/`hover.ts`（base64 装饰与悬停文案）。
- **外壳层**：`commands.ts`（两条跳转命令、清除命令包含 base64、确认弹窗紫色行、移除"base64 需手动删除"警告）、`settings.ts`（新开关行）、`statusBar.ts`（计数自动包含 base64，无需改动逻辑）。
- **测试与文档**：新增 `clipped-fixture.md` 及其计数断言测试；既有 fixture 断言不变（回归保障）；README / README.zh-CN / docs/验收清单.md 更新。
- **兼容性**：设置迁移向后兼容（旧 `data.json` 缺 `base64Marking` 按默认值补齐）；无破坏性变更；无新增运行时依赖。
