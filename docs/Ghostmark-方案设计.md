# Ghostmark — 方案设计

| | |
|---|---|
| 插件名 | **Ghostmark**（manifest id: `ghostmark`） |
| 文档 | 方案设计（需求与验收标准见《Ghostmark-需求分析》） |
| 版本 | v1.1 修订稿（v1 冻结稿 + 评审修订，见文末修订记录） |

---

## 1. 设计目标与原则

对应《需求分析》§3–§4，设计遵循四条原则：

1. **宁可漏删，不可误删**——分类器对语义字符（emoji ZWJ、ZWNJ）默认保护；一切清除动作有确认、可撤销。
2. **看得见才信得过**——检查模式把不可见事物全部显形，清除动作的效果肉眼可验收。
3. **策略即数据**——码点策略是可序列化的纯数据表，随设置持久化、随拾取码点增长，天然可测试。
4. **核心与宿主解耦**——分类/扫描/清理是无依赖纯函数（`core/`），Obsidian API 只出现在外壳层，全部单测落在 `core/`。

---

## 2. 总体架构

```
src/
├── core/                  # 纯函数，零 Obsidian 依赖，vitest 全覆盖
│   ├── categories.ts      # 字符分类定义、默认策略表、码点元数据
│   ├── blocks.ts          # 块级解析：frontmatter / 围栏代码 / 行内代码 / 数学块 / 正文
│   ├── scanner.ts         # 扫描文本 → Hit[]（码点 + 类别 + 上下文 + 动作）
│   ├── cleaner.ts         # Hit[] → 新文本 + ChangeReport（分类计数）
│   ├── i18n.ts            # en/zh 文案表与取词 t()（locale 注入，纯函数可测）
│   └── fixtures/          # 合成测试样本（§8.2）
├── editor/
│   ├── inspectMode.ts     # CM6 扩展装配：Compartment 开关 + 装饰构建
│   ├── widgets.ts         # 行内字形 widget（三色、两档密度）
│   ├── hover.ts           # hoverTooltip 详情
│   └── gutter.ts          # 行号槽徽标
├── statusBar.ts           # 状态栏计数与点击开关（Obsidian 外壳 API；仅桌面注册）
├── commands.ts            # 四个命令（FR-7~10）
├── settings.ts            # 设置面板、持久化与 schema 迁移（§7）
└── main.ts                # 插件入口
```

依赖方向：`editor/`、`statusBar.ts`、`commands.ts`、`settings.ts` → `core/`；`core/` 不 import 任何 Obsidian / CodeMirror 模块。（v1.1 注：`statusBar.ts` 自 `editor/` 移出——它是 Obsidian 外壳 API 而非 CM6 扩展，原先的归属与依赖方向声明有出入。）

---

## 3. 技术选型

选型原则：**跟随官方模板，只为有明确收益处偏离**。Ghostmark 是零 UI 框架、零运行时依赖的单文件插件，任何工具都要回答"它给这个形态带来了什么"。以下为 2026-09 调研结论。

### 3.1 选型对比

| 领域 | 选型 | 版本锁定 | 主要落选方案与理由 |
|---|---|---|---|
| 宿主 | Obsidian 公开 API + CM6 标准扩展点 | minAppVersion `1.0.0`（官方模板基准） | 不 patch 内部（Non-goal 已排除） |
| 语言 | TypeScript（strict） | ^5.8（官方模板） | JSDoc / 纯 JS：core 引擎的迭代重构依赖类型系统 |
| 构建 | esbuild | 0.25.5（官方模板**钉版**） | Vite + vite-plugin-obsidian：HMR 与框架集成是其全部收益，本插件无自定义视图、设置面板用原生 API，收益趋近于零且多一条社区依赖链；rolldown / tsdown / Bun build：对单文件 CJS 产物无增量收益、缺官方背书 |
| 测试 | vitest | ^4（2026 主流，支持由 Node 直跑） | node:test：启动最快但断言 / 覆盖率生态与 watch DX 弱，core/ 用例数量大，DX 值得这点 devDependency；Jest：TS/ESM 配置繁琐、启动重 |
| Lint | ESLint 9 flat + typescript-eslint + **eslint-plugin-obsidianmd** | ^9.39 / ^8.59 / ^0.4（官方模板自带） | Biome 全量替代：性能再强也无用——`eslint-plugin-obsidianmd` 是官方定制的上架规范机检实现，属合规刚需、无替代品；Biome 仅可选配作格式化器 |
| UI | 原生 Setting API + CM6 原生装饰，**不引入 React / Svelte / Vue** | — | 框架的价值在自定义视图与复杂状态 UI，本插件两者皆无，引入即纯负担 |
| 包管理 | npm | Node ≥ 18（官方模板要求） | pnpm / bun：单人仓库无实质差别，跟随官方模板减少变量 |
| 运行时依赖 | **0 dependencies** | — | 任何运行时依赖都进 main.js 产物、扩大审计面，上架负分 |

本插件依赖的 Obsidian API 面（全部为长期稳定公开 API）：`registerEditorExtension`、`addStatusBarItem`（桌面）、`addCommand`（含 `checkCallback`）、`Modal`、`Notice`、`Setting`、`loadData/saveData`、`Editor.transaction`；CM6：`Compartment`、`StateEffect`、`ViewPlugin`、`Decoration.replace({ widget })`、`hoverTooltip`、`gutter`。

### 3.2 兼容性与演进策略

- **版本追踪**：`obsidian` 类型库取 `latest`（官方模板同款），CI 以 `tsc -noEmit` 校验；esbuild 钉版、其余 caret，依赖升级走独立 PR + CI 全绿。
- **minAppVersion**：`1.0.0` 起步，仅当被迫使用新 API 时上调，不主动追新。
- **移动端**：CM6 装饰与命令在移动端可用；`addStatusBarItem` 官方文档明确 "Not available on mobile"——状态栏仅桌面注册（`Platform.isMobile` 守卫），移动端入口为命令面板（对应 NFR-6）。
- **设置 schema 演进**：`data.json` 顶层带 `schemaVersion`；新增字段一律向后兼容（旧数据缺字段按默认值补齐），迁移函数集中在 `settings.ts`。

## 4. 字符策略引擎（core）

### 4.1 数据结构

```ts
type Action = 'remove' | 'toSpace' | 'keep';
type Category = 'invisible' | 'spaceLike' | 'semantic';   // 红 / 蓝 / 黄
type BlockType = 'frontmatter' | 'fencedCode' | 'inlineCode' | 'math' | 'prose';

interface CharPolicy {
  codepoint: string;      // 形如 "U+2062"
  category: Category;
  action: Action;         // 策略表中的基础动作
  name: string;           // Unicode 名称，用于展示
}

interface Hit {
  index: number;          // 文本内偏移
  length: number;         // 命中串长度（空格成串时 >1）
  codepoint: string;      // 首字符
  category: Category;
  block: BlockType;       // 所处上下文
  action: Action;         // 经上下文规则调制后的最终动作
}

interface ChangeReport {
  total: number;
  byCodepoint: Record<string, number>;
  byCategory: Record<Category, number>;
}
```

### 4.2 默认策略表

| 类别 | 码点 | 默认动作 |
|---|---|---|
| 红·无语义不可见 | U+200B、U+2060、U+2061、U+2062、U+2063、U+2064、U+061C、U+180E、U+200E、U+200F、U+FFFE、U+FFFF、U+FEFF（**仅非文件头位置**；文件头 BOM 不动） | `remove`，**含代码块与行内代码**（这些字符在代码中只可能是污染） |
| 蓝·空格类 | U+2002、U+2009、U+2007、U+202F、U+00A0 | 正文：**成串（≥2）删除、孤立转普通空格**（`toSpace`）；代码块/行内代码：一律转普通空格（直接删会破坏 Python 缩进与语法） |
| 黄·受保护语义 | U+200D ZWJ（**永久保护，写死**）、U+200C ZWNJ（默认保留 + 独立开关）、U+FE00–FE0F 变体选择符 | `keep`；仅做可视化标记 |

用户可在设置中把任意码点的动作改为 `remove / toSpace / keep`；拾取码点（FR-9）新增的字符**按类别写入建议动作**（不可见→`remove`、空格类→`toSpace`、语义→`keep`），追加进本表，持久化于 `settings.customPolicies`。

> U+200E/U+200F（LRM/RLM）默认 `remove` 与《需求分析》§1.3 对 gremlins 的批评不矛盾：#625 教训的实质是 ZWNJ 承载构词语义、必须默认保护（本表"黄类"已如此）；本产品内容画像无 RTL 语言，LRM/RLM 在非 RTL 文本中出现即视为污染，且两码点可逐码点改回 `keep`。

### 4.3 上下文规则（策略调制层）

扫描分两步：`blocks.ts` 先做**块级解析**，划分五类区间；`scanner.ts` 再逐字符按"策略表 + 区间类型"调制出最终动作：

| 区间 | 规则 |
|---|---|
| 数学块（`$$…$$` 与行内 `$…$`） | **默认全部只标记不清除**（`markOnly`），设置可改为 `clean`——防 MathML 转写来源的 U+2062 承载真实乘法语义 |
| 围栏/行内代码 | 红·不可见 = remove；蓝·空格类 = toSpace；黄·语义 = keep |
| 正文 | 按策略表；蓝·空格类执行"成串删除、孤立转空格" |
| frontmatter | 同正文（标题被水印污染是 [#918](https://github.com/obsidianmd/obsidian-clipper/issues/918) 的实锤场景） |
| U+FEFF 文件头 | 识别为 BOM，永不处理 |

**ZWJ emoji 保护**：扫描到 U+200D 时检查其前后码点——若任一侧属于 emoji 组合序列成员（`\p{Extended_Pictographic}`、肤色修饰符 U+1F3FB–1F3FF、区域指示符、变体选择符，用 JS 原生 Unicode property escapes 实现），则该 ZWJ 及整个序列判为受保护；夹在中英文之间的孤立 ZWJ 仍保持默认 keep（v1 不做激进判定，原则见 §1.1）。

### 4.4 扫描器与清理器

- `scanner.ts`：线性单趟扫描 + 空格成串合并，输出 `Hit[]`。纯函数签名 `(text, policy, settings) → Hit[]`。
- `cleaner.ts`：按 `Hit.action` **从后向前**构造新文本（避免偏移失效），同时产出 `ChangeReport`。纯函数签名 `(text, hits) → { text, report }`。
- 执行（命令层）：`editor.transaction` 一次性替换——Obsidian 原生单步撤销即成立，随后 Notice 报告 `ChangeReport`。

---

## 5. 检查模式（editor）

- **开关**：`Compartment` + `StateEffect` 挂卸装饰扩展；入口为命令/快捷键/状态栏点击；状态持久化（记住上次状态，默认关）。
- **装饰**：`ViewPlugin` + `Decoration.replace({ widget })`。零宽字符本身不占宽度，纯高亮不可见，**必须用替换字形**；空格类叠加背景色 mark。
- **widget**（`widgets.ts`）：行内小字形。紧凑档每类一个符号——红底 `⌷` / 蓝底 `␣` / 黄底 `⌦`；详细档直接显示码点缩写（`2062`）。密度读设置。
- **hover**（`hover.ts`）：CM6 `hoverTooltip` 显示名称 + `U+XXXX` + 类别 + 建议动作（如"建议：清除（无语义不可见字符）"）。
- **gutter**（`gutter.ts`）：行级命中计数徽标。
- **状态栏**（`statusBar.ts`）：`Ghost: N`（N 为当前笔记命中数），点击切换检查模式。仅桌面注册（`Platform.isMobile` 守卫）；移动端无状态栏 API，入口为命令面板（§3.2）。
- **性能**：装饰只构建可见视口范围（CM6 `viewport`）。成本核算：万字符级**全文单趟扫描为亚毫秒级**，v1 采用"全文扫描 + 视口过滤装饰"的最简实现，**不做**按块缓存与增量失效（YAGNI）；仅当超长文档实测超出 NFR-3 预算时，再演进为按块增量。

---

## 6. 命令与交互（commands.ts）

| 命令 | 行为 |
|---|---|
| `Ghostmark: 切换检查模式` | 开/关装饰；状态栏与命令面板同步状态 |
| `Ghostmark: 清除全部标记` | 仅当前笔记：扫描 → Modal 确认（分类计数）→ 单事务替换 → Notice 报告 |
| `Ghostmark: 清除选区` | 对选区同上；无选区时经 `checkCallback` 动态置灰（命令面板不可用） |
| `Ghostmark: 拾取码点` | 光标处字符 → Modal 显示 `U+XXXX / 名称 / 类别` → 确认后按类别写入建议动作（不可见→`remove`、空格类→`toSpace`、语义→`keep`）加入策略表，并提示可到设置中修改动作 |

---

## 7. 设置（settings.ts）

四组，每项对应一个真实决策：

1. **字符策略表**：默认表（§4.2）逐码点列出，动作三选一；`customPolicies` 追加区。
2. **上下文规则**：数学块 `markOnly | clean`（默认 markOnly）；ZWNJ `keep | remove`（默认 keep）；代码块内空格类转普通空格（默认开）。
3. **界面**：检查模式记住上次状态（默认关）；标记密度 `compact | detailed`；清除前确认（默认开）；状态栏显示（默认开）。
4. **语言**：`auto | 英文 | 中文`（默认 auto，跟随 Obsidian 界面语言，手动选择可覆盖）。文案集中于 `core/i18n.ts`，UI 层只经 `t()` 取词，无散落硬编码。

技术栈与版本锁定见 §3 技术选型（官方 sample-plugin 模板、TypeScript + esbuild、零运行时依赖）。

---

## 8. 测试设计

### 8.1 单元测试（vitest，针对 core/）

- 分类器：每个默认码点 → 正确类别与动作；
- 扫描器：块级解析边界（frontmatter / 围栏代码 / 行内代码 / 数学块 / 正文）、空格成串合并、BOM 位置识别；
- 清理器：动作执行正确性、`ChangeReport` 计数、从后向前替换的偏移正确性；
- 保护规则：emoji ZWJ 序列（含肤色修饰、家庭组合）逐字节保留；数学块默认产出零清除动作；代码块内 U+2002 → 普通空格而非删除；
- i18n：en / zh 两张文案表**键集合完全一致**（缺键即测试失败）；注入各 locale 断言 `t()` 产出正确语言，`auto` 判定逻辑单测覆盖。

### 8.2 合成 fixture（入库）

真实样本剪自付费内容：其水印模式固化进 fixture 后，真实文件已删除、不再留存。

仓库入库的是确定性生成的合成样本 `src/core/fixtures/watermark-fixture.md` 。精确构成：

- **词内隐形字符簇**：U+2062 ×108（标题 1 簇、数学块 1 簇、正文 34 簇）、U+061C ×216（正文 93 簇，其中 63 个双字符簇、30 个三字符簇）；
- **行尾指纹串**：14 条标准串（每条 32 字符 = 20×U+2002 + 12×U+2009，与真实样本逐字符一致）+ 1 条变体串（28 字符 = 19×U+2002 + 9×U+2009），合计 U+2002 ×299、U+2009 ×177；
- **代码块**：其一含单个 U+2002（使 U+2002 总数补足 300），测试"代码块内空格类转普通空格"；另一代码块干净，测试零误伤；
- **base64 追踪 token**：44 字符合成值 10 个、共 48 处，重复分布支撑 v2 指纹启发式；
- **保护场景**：emoji ZWJ 序列段落（家庭组合 👨‍👩‍👧‍👦 与肤色修饰 👩🏻‍💻，共 4 个 ZWJ + 1 个肤色修饰符）、一个含 U+2062 的数学块（默认 markOnly）。

不可见字符合计 801，与样本 A 完全持平。验收断言见《需求分析》§6。

---

## 9. 开发流程与里程碑

### 9.1 开发环境

- Node ≥ 18，npm；官方 sample-plugin 模板初始化。
- **独立开发 vault**（不入库）：以 pjeby/hot-reload 插件监视构建产物自动重载；`npm run dev`（esbuild watch）保存即生效。
- 调试样本：入库 fixture（§8.2）即日常验收样本，不依赖任何真实付费内容。

### 9.2 流程思路：core 先行的 TDD

1. **core/ 引擎先行**：fixture 计数断言（需求 §6.1–6.5）驱动 `categories → blocks → scanner → cleaner` 的实现（vitest watch，红→绿）。"不误删"由测试背书，而非手工回归——这是把 #625 类事故挡在编码阶段的关键。
2. **外壳层跟随**：core 断言全绿后才动 `editor/`、`commands.ts`、`settings.ts`；外壳依赖真实 Obsidian 宿主，按《需求分析》§6.6–6.7 的手动验收清单逐项核验。
3. **每个 FR 合并前**：单测 + 手动验收双过闸，避免"编辑器里看着对、引擎算错"的假阳性。

### 9.3 里程碑

| 里程碑 | 内容 | 完成判据 |
|---|---|---|
| **M0 脚手架** | 模板初始化：esbuild / tsconfig / ESLint（含 obsidianmd 规则）/ vitest 装配；manifest、目录骨架、GitHub Actions | `npm run build / lint / test` 三闸门全绿 |
| **M1 core 引擎** | categories / blocks / scanner / cleaner + i18n + fixture 全量断言 | 需求 §6.1–6.5 计数与保护断言全部通过 |
| **M2 检查模式** | inspectMode / widgets / hover / gutter / statusBar | 三色两档密度、hover、徽标手动验收通过；万字符 fixture 无卡顿（NFR-3） |
| **M3 命令与设置** | 四命令（`checkCallback`）、Modal 确认、设置四组 + 语言切换 + `customPolicies` 持久化 | 清除全部 / 清除选区 / 拾取码点端到端可用；单步撤销成立；语言切换无遗漏 |
| **M4 打磨与发布** | README（英 / 中）、错误兜底、manifest 终检、上架规范自查、版本脚本演练 | 构建可复现、零网络请求；`eslint-plugin-obsidianmd` 零错误；GitHub Release 流程走通 |

### 9.4 Git 与 CI

- 单主干（main）+ 短特性分支；里程碑内任务按"一 PR 一可验证行为"切分。
- GitHub Actions 三闸门：`eslint .`（含 obsidianmd 合规规则）+ `tsc -noEmit` + `vitest run`，全绿方可合并。
- 发布：官方模板 `version-bump.mjs` 维护 manifest / versions.json；打 tag 触发构建，`main.js / manifest.json / versions.json` 附至 GitHub Release，随后向 obsidian-releases 提交（社区上架流程）。

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 误删合法内容 | 上下文分类器 + 黄类永久保护 + 执行前确认 + 单步撤销 + git；ZWNJ/ZWJ 默认保留 |
| 大文档性能 | 视口内构建装饰；万字符级全文单趟扫描亚毫秒级（§5），实测超 NFR-3 预算再引入按块缓存 |
| 数学块边界误判（代码块内的 `$` 不是公式） | 块级解析器独立成 `blocks.ts` 并重点测试 |
| 新网站出现未知水印字符 | 拾取码点（v1，按类别建议动作）→ 规则库与指纹启发式（v2） |
| U+FEFF 文件头是合法 BOM | 仅处理非文件头位置 |
| Obsidian API 演进 | 只用公开 API 与 CM6 标准扩展点（§3.1 API 面清单）；不做内部 hack（Non-goal 已排除真第四模式） |
| 移动端状态栏缺失（平台限制） | `Platform.isMobile` 守卫仅桌面注册；移动端以命令面板为入口（§3.2 / NFR-6） |
| i18n 文案遗漏或键位漂移 | en/zh 键集合一致性单测（§8.1）；文案仅经 `t()` 取词 |
| 设置 schema 演进破坏旧数据 | `data.json` 带 `schemaVersion`，迁移集中于 `settings.ts`（§3.2） |

---

## 11. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| v1 | — | 设计冻结稿 |
| v1.1 | 2026-09-30 | 评审修订：新增 §3 技术选型（构建 / 测试 / Lint / UI 对比与版本锁定）与 §3.2 兼容性策略（minAppVersion / 移动端 / 设置 schema 迁移）；新增 §9 开发流程与里程碑（M0–M4、core 先行 TDD、Git / CI / 发布）；补 LRM/RLM 默认动作论证（§4.2）；§5 性能策略简化为"全文扫描 + 视口过滤"（去按块增量缓存，YAGNI）；`statusBar.ts` 移出 `editor/`；§7 设置增语言切换、FR-9 改按类别建议动作；§8 增 i18n 测试；§10 增移动端 / i18n / 依赖漂移 / schema 迁移风险。全文章节重编号 |
