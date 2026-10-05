# Design

## Context

现有架构（设计文档 §2）：`src/core/` 为零依赖纯函数（categories / blocks / scanner / cleaner / policy / i18n），`src/editor/` 为 CM6 扩展（装饰、hover、gutter、共享扫描状态），外壳层为 commands / settings / statusBar / main。策略表 21 行；扫描器单趟线性扫描、空格成串合并；清除走"从后向前"单事务。

本变更前的事实核查（对 `reference/` 35 篇文档、61 万字符的实测）：现有扫描器对 U+2002/U+061C/U+2009/U+2062 的覆盖率 100%（12,895 处全命中），U+FE0F（⭐️ 的变体选择符）也按黄类标记——"漏标记"来自策略表收录范围，不是扫描器缺陷。同批文档含 base64 token 1,122 处（10 个唯一值）、粘词形态 111 处，data URI 零例。

用户已确认的四个决策：全面扩展字符表 / base64 通用规则 / 清除命令一并清除 base64 / 双向跳转命令。

## Goals / Non-Goals

**Goals:**

- 默认表扩展到 46 行后，`buildScanPolicy`、设置子页面（categoryPage 按 category 过滤渲染）、fixture 断言全部无感扩容。
- base64 成为与红/蓝/黄并列的第四类别，复用既有 Hit → 装饰 → 徽标 → 清除管线，只在关键分叉点特判。
- 跳转命令零新状态：复用 `scan()` 结果与 Obsidian `Editor` API。

**Non-Goals:**

- 不做 base64 内容解码校验（形态判断已足够，解码会有性能与误判复杂度）。
- 不做"跳转到第 N 处""标记总览面板"（路线图 v2 的审计视图范畴）。
- 不改既有 fixture（`watermark-fixture.md`）与其断言——它是 v1 行为的回归锚。
- 不收录 U+3000、U+2065（未收录码点走拾取码点兜底）。

## Decisions

### D1. base64 作为 `Category` 联合类型的新成员，而非独立命中类型

`Category = "invisible" | "spaceLike" | "semantic" | "base64"`。理由：Hit 的消费方（装饰构建、徽标聚合、hover、清除管线、汇总）全部按 category 分派——联合类型加一个成员后，TypeScript 会把所有需要特判的位置（`Record<Category, number>` 初始化、`colorClass`、i18n `cat.*`）逐个标红，编译器即迁移清单。备选"独立 HitVariant 类型"需要平行管线，违背"策略即数据、单管线"的架构原则。

连带修改点（编译器驱动）：`ChangeReport.byCategory`、`summarizeHits`、`badgeModel.BADGE_COLORS`（注册表新增 `{color: "purple", category: "base64"}`，排在红之后——base64 与红同属"确认垃圾"，注册表顺序即徽标段顺序）、`widgets.COMPACT_GLYPH`（紫档符号 `⌗`）、`commands.colorClassOf`、`settings.tagFor`、i18n `cat.base64`。

### D2. base64 识别：单正则 + 尾窗裁剪 + 三个豁免守卫

```
/(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{20,}={1,2}(?![A-Za-z0-9+/=])/g
```

- 前后向断言锚定**最大连续串**的边界：`localStorage<token>`（56 字符）整体成为一个匹配。
- 命中后裁剪：串长 > 44 → 只标记尾部 44 字符窗口（`[A-Za-z0-9+/]{43}=`），保护粘词前缀；20–44 → 整段。理由：base64 合法串长是 4 的倍数，56 与 48 无法从长度判别"合法整串"与"单词+44 水印"，而真实样本中粘词形态的语义主体永远是尾部 44 窗口（`7311`、`localStorage` 等前缀是正文文本）；44 窗口裁剪最坏情况是把一段 >44 的合法整串标掉尾部 44 字符——这在散文正文里几乎不存在，且可撤销、可关闭开关。
- data URI 豁免：命中起点向前看，若紧邻前缀以 `;base64,` 结尾（`\bdata:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,$`，限同一行内）则跳过该匹配。
- 上下文调制沿用 blocks.ts：`fencedCode | inlineCode | math` → `markOnly`，prose / frontmatter → `remove`。
- 备选对比：严格 44 形态（用户否——其他长度变体会漏）；熵/字符多样性启发式（否——复杂度高、边界不可预期、测试难写）。

扫描器集成：`ScanOptions` 增加 `base64?: boolean`（默认 false 保持纯函数行为兼容），码点主循环结束后做一遍正则扫描（`scan()` 仍单文档两趟，均为线性，万字符级亚毫秒预算不变）。base64 命中构造 `Hit`：`codepoint: "base64"`、`entryId: "base64"`、`count = length`（ASCII 一码单元一字符）、`category: "base64"`。

### D3. 逐段点击清除：复用 clearBlockRequestFacet 模式

新增 `clearHitRequestFacet = Facet.define<(view: EditorView, hit: Hit) => void>()`。`buildDecorations(view)` 构建 widget 时对 base64 命中传入 hit 数据；`GhostWidget.toDOM(view)` 内 `view.state.facet(clearHitRequestFacet)` 调用外壳注入的回调——与 FR-13 徽标点击的装配方式完全一致（main.ts 注册实现）。外壳实现走既有 `applyCleanedChanges`（单事务 + 光标映射 + 滚动保持），`Ctrl/Cmd+Z` 单步撤销自动成立。

widget 点击机制（已核实）：CM6 `WidgetType.toDOM(view)` 能拿到 view；`ignoreEvent()` 返回 true（现状）时编辑器不消费 widget 内 DOM 事件，自挂监听器正常接收。`eq()` 不比较回调（回调经 facet 在 toDOM 时获取，非构造参数），避免闭包身份破坏重绘优化。

markOnly 段（代码块内）点击同样清除——批量命令不碰 markOnly，显式单段操作是用户直接意图。

### D4. 跳转命令：commands.ts + Obsidian Editor API，不进 CM6 层

`jump-next` / `jump-prev` 两条命令，`checkCallback` 校验"编辑器存在 && inspectEnabled"（与 clear-block 闸门一致）。实现：

- 命中集 = `scanEditor(editor, config)`（与清除命令同一来源，自动包含 base64 与 markOnly 命中）；
- 光标偏移 = `editor.posToOffset(editor.getCursor("head"))`；
- next：第一个 `hit.index > cursor` 的命中（光标在某命中内时自然取下一个）；prev：最后一个 `hit.index < cursor` 的命中；
- 无后继/前驱 → 循环到首/末命中并 Notice 提示；
- 定位 = `editor.setSelection(from, to)` + `editor.scrollIntoView({from, to}, true)`（API 已在本地 `obsidian@1.13.1` 类型定义核实，minAppVersion 1.13.0 之下早已存在）；
- 无命中 → Notice，光标不动。

选区高亮而非仅移动光标的理由：零宽字符字形为 replace 装饰且 atomic，选区能给出明确的"就是它"反馈。

### D5. 策略表扩展的行组织：连续组用区间行，其余单码点行

新增 25 行（13 红 + 2 红·默认 toSpace + 10 蓝），沿用 `PolicyEntry` 的 lo/hi 区间能力：

| 组 | 行 | 默认动作 | options |
|---|---|---|---|
| bidi 嵌入/覆盖 | `U+202A-202E`（1 行区间） | remove | RED_OPTIONS |
| bidi 隔离 | `U+2066-2069`（1 行区间） | remove | RED_OPTIONS |
| 弃用格式 | `U+206A-206F`（1 行区间） | remove | RED_OPTIONS |
| 行间注释 | `U+FFF9-FFFB`（1 行区间） | remove | RED_OPTIONS |
| 语言标签 | `U+E0001` + `U+E0020-E007F`（2 行） | remove | RED_OPTIONS |
| 控制字符 | `U+0000-0008`、`U+000B-000C`、`U+000E-001F`、`U+007F`、`U+0080-009F`（5 行） | remove | RED_OPTIONS |
| 非字符 | `U+FDD0-FDEF`（1 行区间） | remove | RED_OPTIONS |
| 软连字符 | `U+00AD`（1 行） | remove | RED_OPTIONS |
| 行/段分隔符 | `U+2028`、`U+2029`（2 行） | **toSpace** | RED_OPTIONS |
| 空格类补全 | `U+2000` `U+2001` `U+2003` `U+2004` `U+2005` `U+2006` `U+2008` `U+200A` `U+205F` `U+1680`（10 行） | toSpace | BLUE_OPTIONS |

区间行牺牲逐码点动作粒度（同 `U+FE00-FE0F` 先例），换取设置页可读性；bidi/控制字符组内动作差异无实际意义。

U+2028/2029 归红类但默认 `toSpace`：`Action` 与 `Category` 本就正交（策略行的 action 字段独立于 category），`RED_OPTIONS` 三选一不变；删除会使两侧单词粘连，转空格保守（spec 场景 `hello<U+2028>world` → `hello world`）。注意既有上下文规则"红类在代码块内一律 remove"对这两行同样生效——代码块内的 U+2028 是污染，此为既有设计意图，不特判。

`classifyUnknownCodepoint` 增补 `\p{Cc}` → `{category: "invisible", action: "remove"}`（在 `Zs`/`Cf` 判断之后），使拾取建议与新表一致（spec 场景 U+009C）。

i18n：为每行补 `cp.*` 键（en 官方名 + zh 译名），en/zh 键集合一致性由既有 i18n 单测兜底。新增码点默认**不在** reference 与旧 fixture 中出现，不影响既有计数断言。

### D6. 设置与配置管线

- `GhostmarkSettings` 增 `base64Marking: boolean`（默认 true）；`SCHEMA_VERSION` 2 → 3；`migrateSettings` 缺字段按默认补齐（既有模式），`rawSchema < 2` 的 inspectRemember 升级分支保持不动。开关行放"上下文规则"组（`control: {type: "toggle", key: "base64Marking"}`，声明式设置 API 既有模式）。
- `InspectConfig` 增 `base64: boolean`，`buildInspectConfig` 映射；`scanState`、`scanEditor`、状态栏、块清除的四处 `scan()` 调用统一传该选项——`saveSettings` 已有的"重建 config + 版本号广播"机制让开关切换即时作用于所有编辑器，无需新代码路径。

### D7. 计数与报告的 base64 特判

`clean()`/`summarizeHits()` 的 `countSpan` 按"码点"逐字符聚合，对 44 字符 ASCII 串会产生 44 条无意义条目。特判：`hit.category === "base64"` 时 `byCodepoint["base64"] += hit.length`（`summarizeHits.byCategoryCodepoint` 同理），`total`/`byCategory` 按字符数累加。Notice 文案（`n3.ok`/`n4.ok`/`n5.ok`）增加 `{p}`（紫）插值；确认弹窗增加紫色行（pill 复用"清除"）。既有 i18n 键的格式串更新不改变键集合。

### D8. 第二个 fixture：`src/core/fixtures/clipped-fixture.md`

从 reference 提取**模式**而非内容（脱敏）：正文全部改写为无版权占位文字，保留真实的注入形态——

- 词内 U+2062/U+061C 簇、行尾 `20×U+2002 + 12×U+2009` 指纹串（与 reference 逐字符同构）；
- base64 十形态：行尾独立 / 四连发 / 粘词（`localStorage`、`WebSocket` 前缀）/ 行内代码内 / 围栏代码块内；
- 负例：文件路径、URL、40 位 git SHA、短串（<20）、data URI 内嵌图（`data:image/png;base64,…` 合成载荷）、`=` 不在末尾的无效形态；
- 新增策略行全景段：每个新增组至少一个真实码点（控制字符、bidi、软连字符、非字符、U+2028/2029、新空格类）；
- 保护对象：emoji ZWJ 序列、数学块（含 U+2062，默认 markOnly）。

生成方式与 v1 fixture 一致：实现期用一次性脚本确定性生成并提交成品文件，计数在 `clipped-fixture.test.ts` 中硬编码断言（无字符遗漏、清除后零残留、负例零命中、粘词前缀保留）。token 值用与 v1 fixture 同法的合成值（10 个唯一、44 字符、`=` 结尾）。

## Risks / Trade-offs

- [base64 规则误伤散文中的合法 base64] → 三层缓解：代码上下文 markOnly、data URI 豁免、开关可关；所有清除走单步撤销；确认弹窗紫色计数让用户在执行前可见将删多少。
- [44 窗口裁剪把 >44 的合法整串标掉尾部] → 仅影响散文中的裸 base64 长串（罕见）；点击清除前有字形可见；保留 20–44 整段与 >44 尾窗的确定性规则便于测试。
- [U+2028/2029 在代码块内被 remove 使代码行粘连] → 代码块内格式控制字符本就视为污染（既有红类规则），实际发生率极低；单步撤销兜底。
- [控制字符 C0 收录可能命中粘贴引入的二进制片段] → 这正是期望行为（此类内容即污染）；红色标记 + 可确认清除。
- [Category 联合类型扩员的迁移遗漏] → TypeScript 对 `Record<Category, …>` 与 switch 穷尽性报错兜底；i18n 键集合一致性单测兜底文案。
- [scanner 增加第二趟正则扫描的性能] → 线性趟，万字符级亚毫秒（NFR-3 预算不变）；开关关闭时零成本。
- [跳转在超大文档全量扫描] → 复用清除命令既有路径（每次命令执行一次全文扫描，已有实现同款），非热路径。

## Migration Plan

设置迁移集中于 `migrateSettings`（schemaVersion 3）：旧 data.json 缺 `base64Marking` 自动补默认值 true，无破坏。功能上线即生效，无需用户操作；回滚 = 还原 main.js，旧版本读新 data.json 时走既有"未知字段丢弃 + 缺字段补默认"路径，同样安全。

## Open Questions

无——四个方向性决策均已与用户确认（全面扩展 / 通用规则 / 一并清除 / 双向跳转），其余为可测试的实现细节。
