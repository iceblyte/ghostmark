# Ghostmark — 方案设计

| | |
|---|---|
| 插件名 | **Ghostmark**（manifest id: `ghostmark`） |
| 文档 | 方案设计（需求与验收标准见《Ghostmark-需求分析》） |
| 版本 | v1 设计冻结稿 |

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
│   └── fixtures/          # 合成测试样本（§7.2）
├── editor/
│   ├── inspectMode.ts     # CM6 扩展装配：Compartment 开关 + 装饰构建
│   ├── widgets.ts         # 行内字形 widget（三色、两档密度）
│   ├── hover.ts           # hoverTooltip 详情
│   ├── gutter.ts          # 行号槽徽标
│   └── statusBar.ts       # 状态栏计数与点击开关
├── commands.ts            # 四个命令（FR-7~10）
├── settings.ts            # 设置面板与持久化（§6）
└── main.ts                # 插件入口
```

依赖方向：`editor/`、`commands.ts`、`settings.ts` → `core/`；`core/` 不 import 任何 Obsidian / CodeMirror 模块。

---

## 3. 字符策略引擎（core）

### 3.1 数据结构

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

### 3.2 默认策略表

| 类别 | 码点 | 默认动作 |
|---|---|---|
| 红·无语义不可见 | U+200B、U+2060、U+2061、U+2062、U+2063、U+2064、U+061C、U+180E、U+200E、U+200F、U+FFFE、U+FFFF、U+FEFF（**仅非文件头位置**；文件头 BOM 不动） | `remove`，**含代码块与行内代码**（这些字符在代码中只可能是污染） |
| 蓝·空格类 | U+2002、U+2009、U+2007、U+202F、U+00A0 | 正文：**成串（≥2）删除、孤立转普通空格**（`toSpace`）；代码块/行内代码：一律转普通空格（直接删会破坏 Python 缩进与语法） |
| 黄·受保护语义 | U+200D ZWJ（**永久保护，写死**）、U+200C ZWNJ（默认保留 + 独立开关）、U+FE00–FE0F 变体选择符 | `keep`；仅做可视化标记 |

用户可在设置中把任意码点的动作改为 `remove / toSpace / keep`；拾取码点（FR-9）新增的字符追加进本表，持久化于 `settings.customPolicies`。

### 3.3 上下文规则（策略调制层）

扫描分两步：`blocks.ts` 先做**块级解析**，划分五类区间；`scanner.ts` 再逐字符按"策略表 + 区间类型"调制出最终动作：

| 区间 | 规则 |
|---|---|
| 数学块（`$$…$$` 与行内 `$…$`） | **默认全部只标记不清除**（`markOnly`），设置可改为 `clean`——防 MathML 转写来源的 U+2062 承载真实乘法语义 |
| 围栏/行内代码 | 红·不可见 = remove；蓝·空格类 = toSpace；黄·语义 = keep |
| 正文 | 按策略表；蓝·空格类执行"成串删除、孤立转空格" |
| frontmatter | 同正文（标题被水印污染是 [#918](https://github.com/obsidianmd/obsidian-clipper/issues/918) 的实锤场景） |
| U+FEFF 文件头 | 识别为 BOM，永不处理 |

**ZWJ emoji 保护**：扫描到 U+200D 时检查其前后码点——若任一侧属于 emoji 组合序列成员（`\p{Extended_Pictographic}`、肤色修饰符 U+1F3FB–1F3FF、区域指示符、变体选择符，用 JS 原生 Unicode property escapes 实现），则该 ZWJ 及整个序列判为受保护；夹在中英文之间的孤立 ZWJ 仍保持默认 keep（v1 不做激进判定，原则见 §1.1）。

### 3.4 扫描器与清理器

- `scanner.ts`：线性单趟扫描 + 空格成串合并，输出 `Hit[]`。纯函数签名 `(text, policy, settings) → Hit[]`。
- `cleaner.ts`：按 `Hit.action` **从后向前**构造新文本（避免偏移失效），同时产出 `ChangeReport`。纯函数签名 `(text, hits) → { text, report }`。
- 执行（命令层）：`editor.transaction` 一次性替换——Obsidian 原生单步撤销即成立，随后 Notice 报告 `ChangeReport`。

---

## 4. 检查模式（editor）

- **开关**：`Compartment` + `StateEffect` 挂卸装饰扩展；入口为命令/快捷键/状态栏点击；状态持久化（记住上次状态，默认关）。
- **装饰**：`ViewPlugin` + `Decoration.replace({ widget })`。零宽字符本身不占宽度，纯高亮不可见，**必须用替换字形**；空格类叠加背景色 mark。
- **widget**（`widgets.ts`）：行内小字形。紧凑档每类一个符号——红底 `⌷` / 蓝底 `␣` / 黄底 `⌦`；详细档直接显示码点缩写（`2062`）。密度读设置。
- **hover**（`hover.ts`）：CM6 `hoverTooltip` 显示名称 + `U+XXXX` + 类别 + 建议动作（如"建议：清除（无语义不可见字符）"）。
- **gutter**（`gutter.ts`）：行级命中计数徽标。
- **状态栏**（`statusBar.ts`）：`Ghost: N`（N 为当前笔记命中数），点击切换检查模式。
- **性能**：装饰只构建可见视口范围（CM6 `viewport`），扫描结果按块缓存、编辑时增量失效；万字符级文档无感（NFR-3）。

---

## 5. 命令与交互（commands.ts）

| 命令 | 行为 |
|---|---|
| `Ghostmark: 切换检查模式` | 开/关装饰；状态栏与命令面板同步状态 |
| `Ghostmark: 清除全部标记` | 仅当前笔记：扫描 → Modal 确认（分类计数）→ 单事务替换 → Notice 报告 |
| `Ghostmark: 清除选区` | 对选区同上；无选区时禁用并提示 |
| `Ghostmark: 拾取码点` | 光标处字符 → Modal 显示 `U+XXXX / 名称 / 类别` → 确认后以 `remove` 加入策略表，并提示可到设置中修改动作 |

---

## 6. 设置（settings.ts）

三组，每项对应一个真实决策：

1. **字符策略表**：默认表（§3.2）逐码点列出，动作三选一；`customPolicies` 追加区。
2. **上下文规则**：数学块 `markOnly | clean`（默认 markOnly）；ZWNJ `keep | remove`（默认 keep）；代码块内空格类转普通空格（默认开）。
3. **界面**：检查模式记住上次状态（默认关）；标记密度 `compact | detailed`；清除前确认（默认开）；状态栏显示（默认开）。

技术栈：官方 sample-plugin 模板，TypeScript + esbuild；无运行时依赖。

---

## 7. 测试设计

### 7.1 单元测试（vitest，针对 core/）

- 分类器：每个默认码点 → 正确类别与动作；
- 扫描器：块级解析边界（frontmatter / 围栏代码 / 行内代码 / 数学块 / 正文）、空格成串合并、BOM 位置识别；
- 清理器：动作执行正确性、`ChangeReport` 计数、从后向前替换的偏移正确性；
- 保护规则：emoji ZWJ 序列（含肤色修饰、家庭组合）逐字节保留；数学块默认产出零清除动作；代码块内 U+2002 → 普通空格而非删除。

### 7.2 合成 fixture（入库）

真实样本剪自付费内容：其水印模式固化进 fixture 后，真实文件已删除、不再留存。

仓库入库的是确定性生成的合成样本 `src/core/fixtures/watermark-fixture.md` 。精确构成：

- **词内隐形字符簇**：U+2062 ×108（标题 1 簇、数学块 1 簇、正文 34 簇）、U+061C ×216（正文 93 簇，其中 63 个双字符簇、30 个三字符簇）；
- **行尾指纹串**：14 条标准串（每条 32 字符 = 20×U+2002 + 12×U+2009，与真实样本逐字符一致）+ 1 条变体串（28 字符 = 19×U+2002 + 9×U+2009），合计 U+2002 ×299、U+2009 ×177；
- **代码块**：其一含单个 U+2002（使 U+2002 总数补足 300），测试"代码块内空格类转普通空格"；另一代码块干净，测试零误伤；
- **base64 追踪 token**：44 字符合成值 10 个、共 48 处，重复分布支撑 v2 指纹启发式；
- **保护场景**：emoji ZWJ 序列段落（家庭组合 👨‍👩‍👧‍👦 与肤色修饰 👩🏻‍💻，共 4 个 ZWJ + 1 个肤色修饰符）、一个含 U+2062 的数学块（默认 markOnly）。

不可见字符合计 801，与样本 A 完全持平。验收断言见《需求分析》§6。

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| 误删合法内容 | 上下文分类器 + 黄类永久保护 + 执行前确认 + 单步撤销 + git；ZWNJ/ZWJ 默认保留 |
| 大文档性能 | 视口内构建装饰、扫描按块缓存增量失效 |
| 数学块边界误判（代码块内的 `$` 不是公式） | 块级解析器独立成 `blocks.ts` 并重点测试 |
| 新网站出现未知水印字符 | 拾取码点（v1）→ 规则库与指纹启发式（v2） |
| U+FEFF 文件头是合法 BOM | 仅处理非文件头位置 |
| Obsidian API 演进 | 只用公开 API 与 CM6 标准扩展点；不做内部 hack（Non-goal 已排除真第四模式） |
