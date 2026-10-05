/**
 * Settings tab (FR-11, prototype P8): the character policy table shows
 * three navigable category pages (FR-12 feedback: editing happens on its
 * own page), plus the picked-additions section with a manual add row,
 * context rules, interface and language. Rendered through the declarative
 * settings API (getSettingDefinitions, Obsidian 1.13+) so every entry
 * shows up in Obsidian's settings search; rows with rich labels are
 * rendered imperatively via `render` callbacks. Changes apply instantly
 * and persist (saveSettings also re-pushes the InspectConfig to every
 * editor).
 */

import {
	getLanguage,
	Notice,
	PluginSettingTab,
	type App,
	type Plugin,
	type SettingDefinition,
	type SettingDefinitionGroup,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
import {
	classifyUnknownCodepoint,
	formatCodepoint,
	DEFAULT_POLICY_ENTRIES,
	type Action,
	type Category,
	type CharPolicy,
	type PolicyEntry,
} from "./core/categories";
import {
	effectivePolicy,
	resetPolicies,
	type GhostmarkSettings,
} from "./core/policy";
import { resolveLocale, t, type Locale } from "./core/i18n";
import type { InspectConfig } from "./editor/inspectState";

/** i18n keys are lowercase; core Action values are camelCase. */
function actionLabel(
	locale: Locale,
	prefix: "act" | "opt",
	action: string,
): string {
	return t(locale, `${prefix}.${action.toLowerCase()}`);
}

function charOf(id: string): string {
	const cp = Number.parseInt(id.replace(/^U\+/, ""), 16);
	return Number.isNaN(cp) ? "" : String.fromCodePoint(cp);
}

function entryLabel(entry: PolicyEntry, locale: Locale): string {
	const zh = t("zh", `cp.${entry.id}`);
	return zh === `cp.${entry.id}` || zh === entry.name
		? entry.name
		: `${entry.name} · ${zh}`;
}

/** Everything the tab needs from the plugin, injected to avoid a cycle. */
export interface GhostmarkTabDeps {
	getSettings(): GhostmarkSettings;
	setSettings(settings: GhostmarkSettings): void;
	getLocale(): Locale;
	saveSettings(): Promise<void>;
	setStatusBarVisible(on: boolean): void;
}

/**
 * Obsidian's UI locale via the official getLanguage() (since 1.8.7, below
 * our minAppVersion). zh / zh-TW … map to "zh", everything else to "en".
 */
export function obsidianLocale(): Locale {
	return getLanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function buildInspectConfig(
	settings: GhostmarkSettings,
	hostLocale: Locale,
): InspectConfig {
	const locale = resolveLocale(settings.language, hostLocale);
	return {
		policy: effectivePolicy(settings),
		density: settings.density,
		locale,
		mathMode: settings.mathMode,
		codeToSpace: settings.codeToSpace,
		nameFor: (entryId) => {
			const custom = settings.customPolicies[entryId];
			if (custom) return custom.name || entryId;
			const localized = t(locale, `cp.${entryId}`);
			return localized === `cp.${entryId}` ? entryId : localized;
		},
	};
}

function tagFor(category: Category): { cls: string; text: string } {
	if (category === "invisible") return { cls: "red", text: "red" };
	if (category === "spaceLike") return { cls: "blue", text: "blue" };
	return { cls: "yellow", text: "yellow" };
}

export class GhostmarkSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private deps: GhostmarkTabDeps,
	) {
		super(app, plugin);
	}

	private get settings(): GhostmarkSettings {
		return this.deps.getSettings();
	}

	private get L(): Locale {
		return this.deps.getLocale();
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			this.policyTableGroup(),
			this.customPoliciesGroup(),
			this.contextRulesGroup(),
			this.interfaceGroup(),
			this.languageGroup(),
		];
	}

	/** Wire declarative controls to the injected settings store. */
	override getControlValue(key: string): unknown {
		return this.settings[key as keyof GhostmarkSettings];
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		// Control keys are GhostmarkSettings field names by construction.
		const store = this.settings as unknown as Record<string, unknown>;
		store[key] = value;
		if (key === "statusBar" && typeof value === "boolean") {
			this.deps.setStatusBarVisible(value);
		}
		await this.deps.saveSettings();
		// Re-derive the definitions: the language switch relocalizes every
		// label, and the ZWNJ rule is mirrored by the locked policy row.
		if (key === "language" || key === "zwnjAction") this.update();
	}

	/** Character policy table: description plus one page per category. */
	private policyTableGroup(): SettingDefinitionGroup {
		const L = this.L;
		return {
			type: "group",
			heading: t(L, "s.g1"),
			items: [
				this.noteDef(t(L, "s.d1")),
				this.categoryPage("invisible"),
				this.categoryPage("spaceLike"),
				this.categoryPage("semantic"),
			],
		};
	}

	/** Navigable sub-page listing every codepoint of one category. */
	private categoryPage(
		category: "invisible" | "spaceLike" | "semantic",
	): SettingDefinitionPage {
		const L = this.L;
		const labels = {
			invisible: "s.red",
			spaceLike: "s.blue",
			semantic: "s.yellow",
		} as const;
		const entries = DEFAULT_POLICY_ENTRIES.filter(
			(entry) => entry.category === category,
		);
		const items: SettingDefinition[] = [];
		for (const entry of entries) {
			items.push(this.policyRow(entry));
			if (entry.id === "U+FEFF") {
				items.push(this.noteDef(t(L, "s.feff")));
			}
		}
		return {
			type: "page",
			name: t(L, labels[category]),
			desc: t(L, "s.codepoints", { n: entries.length }),
			items,
		};
	}

	/** One policy row: rich codepoint label plus its action dropdown. */
	private policyRow(entry: PolicyEntry): SettingDefinition {
		const L = this.L;
		const locked = entry.options.length <= 1;
		return {
			name: entryLabel(entry, L),
			aliases: [entry.id],
			render: (setting) => {
				setting.setName(
					createFragment((frag) => {
						const wrap = createSpan({ cls: "gm-setting-name" });
						wrap.createSpan({ cls: "gm-cp", text: entry.id });
						wrap.createSpan({
							cls: "gm-entry-name",
							text: entryLabel(entry, L),
						});
						const tag = tagFor(entry.category);
						wrap.createSpan({ cls: `gm-tag ${tag.cls}`, text: tag.text });
						if (locked) {
							wrap.createSpan({ cls: "gm-tag lock", text: t(L, "s.lock") });
						}
						frag.appendChild(wrap);
					}),
				);

				setting.addDropdown((dd) => {
					const options: Record<string, string> = {};
					for (const action of entry.options) {
						options[action] = actionLabel(L, "opt", action);
					}
					dd.addOptions(options);
					if (locked) dd.selectEl.disabled = true;
					const current =
						entry.id === "U+200C"
							? this.settings.zwnjAction
							: (this.settings.policyOverrides[entry.id] ?? entry.action);
					dd.setValue(current);
					dd.onChange(async (value) => {
						this.applyRowAction(
							entry,
							value as GhostmarkSettings["zwnjAction"],
						);
						await this.deps.saveSettings();
					});
				});
			},
		};
	}

	private applyRowAction(
		entry: PolicyEntry,
		action: GhostmarkSettings["zwnjAction"],
	): void {
		if (entry.id === "U+200C") {
			this.settings.zwnjAction = action;
			return;
		}
		if (action === entry.action) {
			delete this.settings.policyOverrides[entry.id];
		} else {
			this.settings.policyOverrides[entry.id] = action;
		}
	}

	/** Picked additions: manual add row, one row per entry, reset. */
	private customPoliciesGroup(): SettingDefinitionGroup {
		const L = this.L;
		const items: SettingDefinition[] = [this.customAddRow()];
		const entries = Object.entries(this.settings.customPolicies);
		if (entries.length === 0) {
			items.push(this.noteDef(t(L, "s.custom.empty")));
		}
		for (const [key, custom] of entries) {
			items.push(this.customRow(key, custom));
		}
		items.push(this.resetRow());
		return {
			type: "group",
			heading: t(L, "s.custom"),
			items,
		};
	}

	/** One picked codepoint: rich label, action dropdown, delete button. */
	private customRow(key: string, custom: CharPolicy): SettingDefinition {
		const L = this.L;
		return {
			name: `${key} ${custom.name || t(L, "pick.name.unknown")}`,
			aliases: [charOf(key)],
			render: (setting) => {
				setting.setClass("gm-picked-row");
				setting.setName(
					createFragment((frag) => {
						const wrap = createSpan({ cls: "gm-setting-name" });
						wrap.createSpan({ cls: "gm-cp", text: charOf(key) });
						wrap.createSpan({ cls: "gm-cp", text: key });
						wrap.createSpan({
							cls: "gm-entry-name",
							text: custom.name || t(L, "pick.name.unknown"),
						});
						const tag = tagFor(custom.category);
						wrap.createSpan({ cls: `gm-tag ${tag.cls}`, text: tag.text });
						wrap.createSpan({
							cls: "gm-tag picked",
							text: t(L, "s.picked"),
						});
						frag.appendChild(wrap);
					}),
				);
				setting.addDropdown((dd) =>
					dd
						.addOptions({
							remove: actionLabel(L, "opt", "remove"),
							toSpace: actionLabel(L, "opt", "toSpace"),
							keep: actionLabel(L, "opt", "keep"),
						})
						.setValue(custom.action)
						.onChange(async (value) => {
							custom.action = value as GhostmarkSettings["zwnjAction"];
							await this.deps.saveSettings();
						}),
				);
				setting.addExtraButton((btn) => {
					btn.setIcon("trash");
					// setTooltip needs Obsidian 1.1.0; aria-label shows the
					// native tooltip on every supported version.
					btn.extraSettingsEl.setAttribute("aria-label", t(L, "s.delete"));
					btn.onClick(async () => {
						delete this.settings.customPolicies[key];
						await this.deps.saveSettings();
						this.update();
					});
				});
			},
		};
	}

	/**
	 * Manual addition row (FR-9 without the editor): accepts a codepoint
	 * ("U+2065", "2065") or a pasted character; "auto" resolves the
	 * category-based suggested action at add time.
	 */
	private customAddRow(): SettingDefinition {
		const L = this.L;
		let input = "";
		let choice: Action | "auto" = "auto";

		const submit = async (): Promise<void> => {
			const trimmed = input.trim();
			if (!trimmed) return;
			const cp = this.parseCodepointInput(trimmed);
			if (cp === null || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
				new Notice(t(L, "n.add.invalid"));
				return;
			}
			if (effectivePolicy(this.settings).has(cp)) {
				new Notice(t(L, "n.pick.known"));
				return;
			}
			const suggestion = classifyUnknownCodepoint(cp);
			const id = formatCodepoint(cp);
			this.settings.customPolicies[id] = {
				codepoint: id,
				category: suggestion.category,
				action: choice === "auto" ? suggestion.action : choice,
				name: "",
			};
			const action =
				this.settings.customPolicies[id]?.action ?? suggestion.action;
			await this.deps.saveSettings();
			new Notice(
				createFragment((frag) => {
					frag.createDiv({
						text: t(L, "n6.ok", {
							cp: id,
							act: actionLabel(L, "act", action),
						}),
					});
					frag.createDiv({
						cls: "gm-notice-undo",
						text: t(L, "n6.more"),
					});
				}),
			);
			this.update();
		};

		return {
			name: t(L, "s.add"),
			render: (setting) => {
				setting.setClass("gm-add-row");
				setting.addText((text) => {
					text
						.setPlaceholder(t(L, "s.add.placeholder"))
						.onChange((value) => {
							input = value;
						});
					text.inputEl.setAttribute("aria-label", t(L, "s.add"));
					text.inputEl.addEventListener("keydown", (event) => {
						if (event.key === "Enter") void submit();
					});
				});
				setting.addDropdown((dd) =>
					dd
						.addOptions({
							auto: t(L, "opt.auto"),
							remove: actionLabel(L, "opt", "remove"),
							toSpace: actionLabel(L, "opt", "toSpace"),
							keep: actionLabel(L, "opt", "keep"),
						})
						.setValue("auto")
						.onChange((value) => {
							choice = value as Action | "auto";
						}),
				);
				setting.addExtraButton((btn) => {
					btn.setIcon("plus");
					// setTooltip needs Obsidian 1.1.0; aria-label shows the
					// native tooltip on every supported version.
					btn.extraSettingsEl.setAttribute("aria-label", t(L, "s.add"));
					btn.onClick(() => void submit());
				});
			},
		};
	}

	/** Reset button row: clear table edits and picked codepoints. */
	private resetRow(): SettingDefinition {
		const L = this.L;
		return {
			name: t(L, "s.reset"),
			render: (setting) => {
				setting.addButton((btn) =>
					btn.setButtonText(t(L, "s.reset")).onClick(async () => {
						this.deps.setSettings(resetPolicies(this.settings));
						await this.deps.saveSettings();
						this.update();
					}),
				);
			},
		};
	}

	/** Explanatory text row: no control, excluded from settings search. */
	private noteDef(text: string): SettingDefinition {
		return { name: "", desc: text, searchable: false };
	}

	private contextRulesGroup(): SettingDefinitionGroup {
		const L = this.L;
		return {
			type: "group",
			heading: t(L, "s.g2"),
			items: [
				{
					name: t(L, "s.math"),
					desc: t(L, "s.math.d"),
					control: {
						type: "dropdown",
						key: "mathMode",
						options: {
							markOnly: t(L, "opt.markonly"),
							clean: t(L, "opt.clean"),
						},
					},
				},
				{
					name: t(L, "s.zwnj"),
					desc: t(L, "s.zwnj.d"),
					control: {
						type: "dropdown",
						key: "zwnjAction",
						options: {
							keep: t(L, "opt.keep"),
							remove: t(L, "opt.remove"),
						},
					},
				},
				{
					name: t(L, "s.codespace"),
					desc: t(L, "s.codespace.d"),
					control: { type: "toggle", key: "codeToSpace" },
				},
			],
		};
	}

	private interfaceGroup(): SettingDefinitionGroup {
		const L = this.L;
		return {
			type: "group",
			heading: t(L, "s.g3"),
			items: [
				{
					name: t(L, "s.remember"),
					desc: t(L, "s.remember.d"),
					control: { type: "toggle", key: "inspectRemember" },
				},
				{
					name: t(L, "s.density"),
					desc: t(L, "s.density.d"),
					control: {
						type: "dropdown",
						key: "density",
						options: {
							compact: t(L, "opt.compact"),
							detailed: t(L, "opt.detailed"),
						},
					},
				},
				{
					name: t(L, "s.confirmall"),
					desc: t(L, "s.confirmall.d"),
					control: { type: "toggle", key: "confirmBeforeAll" },
				},
				{
					name: t(L, "s.confirmblk"),
					desc: t(L, "s.confirmblk.d"),
					control: { type: "toggle", key: "confirmBeforeBlock" },
				},
				{
					name: t(L, "s.statusbar"),
					desc: t(L, "s.statusbar.d"),
					control: { type: "toggle", key: "statusBar" },
				},
			],
		};
	}

	private languageGroup(): SettingDefinitionGroup {
		const L = this.L;
		return {
			type: "group",
			heading: t(L, "s.g4"),
			items: [
				{
					name: t(L, "s.lang"),
					desc: t(L, "s.lang.d"),
					control: {
						type: "dropdown",
						key: "language",
						options: {
							auto: t(L, "opt.auto"),
							en: "English",
							zh: "简体中文",
						},
					},
				},
			],
		};
	}

	/** "U+2065" / "u+2065" / "2065" / a pasted character → codepoint. */
	private parseCodepointInput(input: string): number | null {
		const hex = /^(?:u\+)?([0-9a-f]{1,6})$/i.exec(input);
		if (hex?.[1]) return Number.parseInt(hex[1], 16);
		const cp = input.codePointAt(0);
		return cp === undefined ? null : cp;
	}
}
