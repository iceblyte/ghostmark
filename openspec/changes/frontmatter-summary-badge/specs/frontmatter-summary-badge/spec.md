# Spec Delta

## Purpose

在 Live Preview 下补齐 frontmatter 的可见性盲区：Obsidian 属性面板覆盖 frontmatter 后，其中的水印字符对用户完全不可见，违背插件"使不可见水印字符显形"的设计理念。属性面板之后显示"frontmatter 含 N 处标记"摘要徽标，把盲区里的标记带回视野并联动清理。

## ADDED Requirements

### Requirement: 徽标的存在条件与位置

检查模式开启且当前叶子处于 Live Preview（属性面板覆盖 frontmatter）时，若 frontmatter 中存在至少一处标记（任何类别：红/紫/蓝/黄），SHALL 在属性面板之后、正文首行之前渲染"frontmatter 含 N 处标记"摘要徽标（N 为 frontmatter 内标记字符总数）。以下情形 SHALL NOT 渲染徽标：纯 Source 模式（frontmatter 以原文渲染，标记本就可见）；检查模式关闭；frontmatter 无任何命中（含"标记 base64 乱码"关闭时 base64 段不计入）。

#### Scenario: frontmatter 含标记时显示徽标

- **WHEN** Live Preview 下笔记的 frontmatter 含 3 处红色标记与 1 段 base64（44 字符），检查模式开启
- **THEN** 属性面板之后显示摘要徽标，N = 47

#### Scenario: frontmatter 干净时不显示

- **WHEN** Live Preview 下笔记 frontmatter 无任何命中
- **THEN** 不渲染徽标，正文区域无额外元素

#### Scenario: Source 模式不显示

- **WHEN** 同一笔记切换到纯 Source 模式
- **THEN** 徽标消失（frontmatter 原文与其中的字形标记直接可见）

### Requirement: 分段计数展示

徽标 SHALL 沿用行号槽徽标的分段色彩体系：存在的每个类别一段（红/紫/蓝/黄按严重度排序），各带自己的字符计数；悬停 SHALL 显示总计数与"点击清除当前块"提示（与行号槽徽标文案一致）。

#### Scenario: 分段计数

- **WHEN** frontmatter 含 3 处红色标记与 1 段 44 字符 base64
- **THEN** 徽标显示红色段 3 与紫色段 44

#### Scenario: 悬停提示

- **WHEN** 悬停徽标
- **THEN** 显示总计数与"点击清除当前块"提示

### Requirement: 点击清除 frontmatter

点击徽标 SHALL 对 frontmatter 块执行策略清理，行为与行号槽徽标点击（清除当前块）一致：同一扫描→清理管线、同一"块清除前确认"开关、同一 Notice 分类计数、单步撤销成立。frontmatter 中的 base64 段按其上下文规则参与（正文语境可清除）。清理（或撤销）导致命中数变化时，徽标 SHALL 随之更新，命中归零后消失。

#### Scenario: 点击清除

- **WHEN** 用户点击"frontmatter 含 4 处标记"徽标（块清除前确认关闭）
- **THEN** frontmatter 内可清除标记被单事务清除，Notice 报告分类计数，`Ctrl/Cmd+Z` 一步恢复

#### Scenario: 清理后徽标联动

- **WHEN** frontmatter 的可清除标记全部清理后
- **THEN** 若剩余标记为零（或全部为保留/仅标记且无可清除项）徽标消失；清理后 `Ctrl/Cmd+Z` 恢复原文时徽标重新出现

#### Scenario: 确认开关联动

- **WHEN** 设置开启"块清除前确认"，用户点击徽标
- **THEN** 先弹出清除当前块确认 Modal（frontmatter 块形态），确认后执行

### Requirement: 模式即时感知

用户在同一笔记内切换 Live Preview / Source 模式时，徽标 SHALL 即时出现或消失，无需重开笔记或重载插件。

#### Scenario: 模式切换即时更新

- **WHEN** 徽标显示中，用户切换到纯 Source 模式
- **THEN** 徽标立即消失且 frontmatter 标记以字形呈现
- **WHEN** 切回 Live Preview
- **THEN** 徽标立即恢复（命中仍存在时）
