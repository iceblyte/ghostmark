# base64-marking Specification

## Purpose

把剪藏笔记中最常见的可见垃圾——base64 追踪串——纳入检查模式：以第四色（紫）标记、逐段点击清除、随清除命令一并清理，并提供设置开关。识别规则以 reference 样本（1,122 处、形态 `[A-Za-z0-9+/]{43}=`）为基准泛化。

## Requirements

### Requirement: base64 乱码的识别规则

插件 SHALL 以如下规则识别 base64 乱码段（设置开关开启时）：

- 目标为"由 `[A-Za-z0-9+/]` 组成、长度 ≥20、且以 1–2 个 `=` 结尾"的最大连续串；
- 当该串与相邻的字母数字文本粘连成更长的连续串时，SHALL 只标记该串的**尾部 44 个字符**（即已知水印形态 `[A-Za-z0-9+/]{43}=` 所占窗口），被粘连的正常单词（如 `localStorage`、`WebSocket` 前缀）MUST NOT 进入标记范围；
- 串长在 20–44 之间时标记整段；
- 同一行连续出现的多个 token（含空格分隔的连发形态）各自成为独立标记段。

#### Scenario: 独立 token 被完整标记

- **WHEN** 正文行尾出现 `M2pzpiGaOITdXr3Fb0HrULkJXq6Mc/ZvF8S3p5OQqjA=`（44 字符）
- **THEN** 该 44 字符成为一段紫色标记

#### Scenario: 粘连 token 只标记尾部窗口

- **WHEN** 正文出现 `localStorageM2pzpiGaOITdXr3Fb0HrULkJXq6Mc/ZvF8S3p5OQqjA=`（56 字符连续串）
- **THEN** 仅尾部 44 字符被标记，`localStorage` 不在标记范围内，点击清除后单词保留

#### Scenario: 短于 20 字符或不带等号的串不标记

- **WHEN** 文本包含 15 字符的 `[A-Za-z0-9+/]` 串，或不含 `=` 结尾的长字母数字串
- **THEN** 不产生 base64 标记

#### Scenario: 连发 token 各自成段

- **WHEN** 同一行出现 4 个以空格分隔的 44 字符 token
- **THEN** 产生 4 段独立标记，可分别点击清除

### Requirement: 防误报豁免

以下情形 SHALL NOT 被 base64 规则命中：

- data URI 的 base64 载荷（`data:<mime>;base64,<payload>`，内嵌图片等合法内容）；
- 不以 `=` 结尾的串：文件路径（如 `backend/app/routers/health`）、URL、git SHA 等天然不满足规则；
- 无效形态（`=` 不在末尾、`=` 多于 2 个）的串。

#### Scenario: data URI 载荷豁免

- **WHEN** 笔记内嵌 `data:image/png;base64,iVBORw0KGgo...`（载荷远超 20 字符）
- **THEN** 载荷不产生 base64 标记

#### Scenario: 路径与哈希不误报

- **WHEN** 笔记包含 `backend/app/routers/health` 或 40 位十六进制 git SHA
- **THEN** 均不产生 base64 标记

### Requirement: 代码上下文内仅标记不清除

围栏代码块、行内代码与数学块内的 base64 段 SHALL 标记为紫色但最终动作为"仅标记"（markOnly）：批量清除命令（清除全部 / 清除选区 / 清除当前块）MUST NOT 触碰它们（代码中存在合法 base64 常量），但用户逐段点击清除 SHALL 对其可用（显式意图优先）。

#### Scenario: 代码块内 token 不随清除全部删除

- **WHEN** 围栏代码块内存在 base64 段，执行"清除全部标记"
- **THEN** 代码块内该段保留，其余上下文的 base64 段被清除

#### Scenario: 代码块内 token 可点击清除

- **WHEN** 用户点击行内代码中的 base64 段字形
- **THEN** 该段被移除且可单步撤销

### Requirement: 紫色标记与悬停详情

base64 段在检查模式中 SHALL 以紫色字形标记（紧凑档一枚紫色符号 + 字符数，详细档显示 `b64` 缩写 + 字符数）；所在行的行号槽徽标 SHALL 增加紫色计数段；悬停 SHALL 显示名称（如"Base64 追踪串"）、段长度、类别与建议动作"清除"及"点击字形可清除该段"的提示。状态栏命中计数 SHALL 包含 base64 段字符数。

#### Scenario: 紫色字形与徽标段

- **WHEN** 检查模式开启，正文行存在 2 段 base64 token
- **THEN** 两处各显示紫色字形（紧凑档含 ×44 计数），该行徽标出现紫色段计数 88，状态栏计数同步增加

#### Scenario: 悬停详情

- **WHEN** 悬停 base64 段字形
- **THEN** 显示名称、段长度（44 字符）、紫色类别点、建议动作"清除"与点击清除提示

### Requirement: 逐段点击清除

点击 base64 段字形 SHALL 仅移除该段（一次编辑事务，Obsidian 原生单步撤销成立），光标保持在原位附近，不滚动页面。该交互 SHALL 不受"清除前确认"设置影响（单段操作无需确认）。

#### Scenario: 点击清除单段

- **WHEN** 用户点击某段 base64 字形
- **THEN** 仅该 44 字符被移除，同段其他标记与段外内容零改动，`Ctrl/Cmd+Z` 一步恢复

#### Scenario: 光标与滚动位置保持

- **WHEN** 用户在浏览到页面中部时点击清除某段
- **THEN** 编辑器不发生滚动跳变

### Requirement: 批量清除命令包含 base64 段

设置开关开启时，"清除全部标记 / 清除选区 / 清除当前块"SHALL 把可清除（非 markOnly）的 base64 段纳入清理与计数；确认弹窗 SHALL 新增紫色类别行（计数与说明）；执行后的 Notice SHALL 包含紫色计数。既有"选区内 base64 需手动删除"的警告文案 SHALL 移除。

#### Scenario: 清除全部包含 base64

- **WHEN** 笔记含 10 段正文 base64 token 与 3 处红色字符，执行"清除全部标记"
- **THEN** 确认弹窗显示紫色计数 440 与红色计数，确认后全部移除，Notice 报告紫色计数，单步撤销完整恢复

#### Scenario: 清除选区包含 base64

- **WHEN** 用户选中含 2 段 base64 的文本执行"清除选区"
- **THEN** 选区内 2 段被清除且不再出现"base64 需手动删除"警告

### Requirement: 设置开关

设置 SHALL 新增"标记 base64 乱码"开关（默认开启，持久化保存并随设置 schema 迁移向后兼容）。关闭后：扫描 SHALL NOT 产生 base64 命中——不标记、不计数、不参与任何清除命令；重新开启后立即恢复。

#### Scenario: 开关关闭时完全静默

- **WHEN** 用户关闭"标记 base64 乱码"，笔记含大量 base64 token
- **THEN** 检查模式无紫色标记、徽标无紫色段、状态栏不含其计数，"清除全部标记"不改动任何 base64 内容

#### Scenario: 旧版本设置迁移

- **WHEN** 旧版本（schemaVersion 2）的 data.json 缺少该开关字段
- **THEN** 迁移后开关取默认值"开启"，其余设置保持不变
