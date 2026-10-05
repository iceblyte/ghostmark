# Tasks

## 1. core：策略表扩展（character-policy）

- [x] 1.1 `src/core/categories.ts`：按 design D5 新增 25 行策略行（13 红 + U+2028/2029 红默认 toSpace + 10 蓝），`Category` 联合类型增 `"base64"` 并修正所有 `Record<Category, …>` 初始化；运行 `npx vitest run src/core/categories.test.ts` 确认既有断言不回归
- [x] 1.2 `src/core/categories.ts`：`classifyUnknownCodepoint` 增补 `\p{Cc}` → invisible/remove 建议；单测覆盖 U+009C 建议"清除"、U+3000 建议不受影响（不进表）
- [x] 1.3 `src/core/i18n.ts`：为全部新增行补 `cp.*` 键（en 官方名 + zh 译名）；`npm test` 中 i18n 键集合一致性断言通过
- [x] 1.4 `src/core/scanner.test.ts`：新增策略行行为断言——U+202E 正文命中 remove、U+2028 转 `hello world`、U+2005 成串删/孤立转空格、U+2003 代码内转空格、U+000B/U+0085 红色命中、U+3000 与 \t/\n/\r 永不命中；`npx vitest run src/core/scanner.test.ts` 通过

## 2. core：base64 识别与清除（base64-marking）

- [x] 2.1 `src/core/scanner.ts`：实现 base64 扫描（design D2 正则 + 44 尾窗裁剪 + `;base64,` data URI 豁免 + `ScanOptions.base64` 开关 + 代码/数学上下文 markOnly）；单测覆盖 spec 全部场景：44 独立整段、56 粘连只标尾部 44 且 `localStorage` 保留、<20 与无 `=` 不命中、四连发各自成段、data URI 载荷豁免、路径/git SHA 不误报、代码块内 markOnly、开关关闭零命中
- [x] 2.2 `src/core/cleaner.ts`：`clean`/`summarizeHits` 对 `category === "base64"` 特判计数（`byCodepoint["base64"] += length`）；单测断言 report.total、`byCategory.base64`、弹窗汇总数字与 `ChangeReport` 无逐字符码点噪音
- [x] 2.3 端到端清除断言：含正文 token + 代码块 token + 粘词 token 的文本经 `scan` + `clean` 后正文段全删、代码段保留、粘词前缀保留、零残留；`npx vitest run src/core/cleaner.test.ts src/core/scanner.test.ts` 通过

## 3. core：设置模型与迁移

- [x] 3.1 `src/core/policy.ts`：`GhostmarkSettings` 增 `base64Marking: boolean`（默认 true）、`SCHEMA_VERSION` 3；`migrateSettings` 处理缺失字段；单测覆盖 schemaVersion 2 旧数据迁移（默认补齐、其余字段不动）与非法值回退

## 4. core：第二个 fixture（脱敏样本）

- [x] 4.1 用一次性脚本确定性生成 `src/core/fixtures/clipped-fixture.md`（design D8 十形态 base64 + 负例 + 新策略行全景 + 词内簇/指纹串 + ZWJ/数学块保护，正文全占位文字、token 为合成值），脚本用后即弃、成品入库
- [x] 4.2 `src/core/clipped-fixture.test.ts`：硬编码断言——每个新策略组至少 1 处命中、各 base64 形态命中数、负例（路径/URL/SHA/data URI/短串）零命中、清除后零残留（保护对象除外）、粘词前缀逐字节保留；`npx vitest run src/core/clipped-fixture.test.ts` 通过
- [x] 4.3 既有 `fixture.test.ts` 断言全绿（回归锚不动）：`npm test` 全量通过

## 5. editor 层：紫色类别与点击清除

- [x] 5.1 `src/editor/badgeModel.ts`：`BADGE_COLORS` 增 `{color: "purple", category: "base64"}`（排在红后）、`colorClass` 增分支；`badgeModel.test.ts` 增断言：base64 命中产出紫色段且变体为 clear、计数按字符数
- [x] 5.2 `src/editor/inspectState.ts`：`InspectConfig` 增 `base64: boolean` 并传入 `scan()`；新增 `clearHitRequestFacet`（design D3）；`npx tsc -noEmit -skipLibCheck` 通过
- [x] 5.3 `src/editor/widgets.ts`：base64 紫色字形（紧凑 `⌗ ×N`、详细 `b64 ×N`）、`eq` 不含回调、`toDOM` 内经 `clearHitRequestFacet` 挂点击清除；`inspectMode.ts` 对 base64 命中传入 hit 数据；手动确认：紫字形渲染、点击仅删该段、撤销恢复
- [x] 5.4 `src/editor/hover.ts`：base64 段悬停显示名称/长度/类别/建议动作与点击清除提示（i18n `note.base64`、`cp.base64`）；手动确认文案随语言切换
- [x] 5.5 `styles.css`：`.gm-w.purple`、`.gm-badge-seg.purple`、`.gm-dot.purple` 三色体系中紫色的原型样式（对照既有三色的对比度与密度）；手动确认 Source 与 Live Preview 双模式外观一致

## 6. 外壳层：命令、设置与装配

- [x] 6.1 `src/commands.ts`：新增 `jump-next`/`jump-prev` 命令（design D4：checkCallback 闸门、循环 + 循环 Notice、无标记 Notice、`setSelection` + `scrollIntoView(range, true)`）；单测覆盖光标在标记内取下一个、文末循环、无命中提示；手动确认跳转选中并滚动居中
- [x] 6.2 `src/commands.ts`：清除全部/选区/当前块包含 base64 段（config 传入 `base64` 选项）、确认弹窗增紫色行（`r.base64`）、Notice 文案增 `{p}`、移除 `m4.warn` "base64 需手动删除" 警告及其 i18n 键；单测：含 token 笔记的清除全部产生紫色计数且代码块内保留
- [x] 6.3 `src/settings.ts`：上下文规则组增"标记 base64 乱码"开关行（`base64Marking`）；`buildInspectConfig` 映射该字段；手动确认：切换后所有打开笔记立即生效且重启保留
- [x] 6.4 `src/main.ts`：注册 `clearHitRequestFacet` 实现（走 `applyCleanedChanges`，光标/滚动保持）；`src/statusBar.ts` 确认计数自动包含 base64（如需改动则修改并验证）；手动确认点击字形清除后无滚动跳变、`Ctrl/Cmd+Z` 一步恢复

## 7. 文档与验收

- [x] 7.1 README.md 与 README.zh-CN.md：命令清单 5 → 7（跳转两条）、设置项、base64 规则与开关、建议快捷键绑定说明
- [x] 7.2 `docs/验收清单.md`：新增三节手动验收——base64 紫色标记/点击清除/开关、跳转命令（含循环与置灰）、扩展字符表抽样（bidi、控制字符、U+2028 转空格、U+3000 不动）
- [ ] 7.3 全局三闸门：`npm test`、`npm run lint`、`npm run build` 全绿；对照《验收清单》新增节逐项手动核验通过
