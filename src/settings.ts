/**
 * Settings tab (FR-11, prototype P8): four groups — character policy
 * table (21 default rows + picked additions), context rules, interface
 * and language. Changes apply instantly and persist (saveSettings also
 * re-pushes the InspectConfig to every editor).
 */

import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import {
	DEFAULT_POLICY_ENTRIES,
	type Category,
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
function actionLabel(locale: Locale, prefix: "act" | "opt", action: string): string {
	return t(locale, `${prefix}.${action.toLowerCase()}`);
}

function charOf(id: string): string {
	const cp = Number.parseInt(id.replace(/^U\+/, ""), 16);
	return Number.isNaN(cp) ? "" : String.fromCodePoint(cp);
}

/**
 * Obsidian's UI locale. Read from localStorage("language") — the official
 * getLanguage() would force minAppVersion 1.8.7, which the design doc
 * keeps at 1.0.0. zh / zh-TW … map to "zh", everything else to "en".
 */
export function obsidianLocale(): Locale {
	const lang = window.localStorage.getItem("language") ?? "en";
	return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
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

/** Everything the tab needs from the plugin, injected to avoid a cycle. */
export interface GhostmarkTabDeps {
	getSettings(): GhostmarkSettings;
	setSettings(settings: GhostmarkSettings): void;
	getLocale(): Locale;
	saveSettings(): Promise<void>;
	setStatusBarVisible(on: boolean): void;
}

function tagFor(category: Category): { cls: string; text: string } {
	if (category === "invisible") return { cls: "red", text: "red" };
	if (category === "spaceLike") return { cls: "blue", text: "blue" };
	return { cls: "yellow", text: "yellow" };
}

function entryLabel(entry: PolicyEntry, locale: Locale): string {
	const zh = t("zh", `cp.${entry.id}`);
	return zh === `cp.${entry.id}` || zh === entry.name
		? entry.name
		: `${entry.name} · ${zh}`;
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const L = this.L;

		this.displayPolicyTable();
		this.displayContextRules();
		this.displayInterface();
		new Setting(containerEl)
			.setName(t(L, "s.lang"))
			.setDesc(t(L, "s.lang.d"))
			.addDropdown((dd) =>
				dd
					.addOptions({
						auto: t(L, "opt.auto"),
						en: "English",
						zh: "简体中文",
					})
					.setValue(this.settings.language)
					.onChange(async (value) => {
						this.settings.language = value as GhostmarkSettings["language"];
						await this.deps.saveSettings();
						this.display();
					}),
			);
	}

	private heading(text: string): void {
		new Setting(this.containerEl).setName(text).setHeading();
	}

	private note(text: string): void {
		this.containerEl.createDiv({
			cls: "setting-item-description",
			text,
		});
	}

	private subHead(cls: string | null, text: string): void {
		const head = createDiv({ cls: "gm-sub-head" });
		if (cls) head.createSpan({ cls: `gm-dot ${cls}` });
		head.createSpan({ text });
		this.containerEl.appendChild(head);
	}

	private displayPolicyTable(): void {
		const L = this.L;

		this.heading(t(L, "s.g1"));
		this.note(t(L, "s.d1"));

		for (const category of ["invisible", "spaceLike", "semantic"] as const) {
			this.displayCategoryHead(category);
			if (this.settings.collapsedGroups[category]) continue;
			for (const entry of DEFAULT_POLICY_ENTRIES) {
				if (entry.category !== category) continue;
				this.displayPolicyRow(entry);
				if (entry.id === "U+FEFF") {
					this.note(t(L, "s.feff"));
				}
			}
		}

		this.displayCustomPolicies();
	}

	private displayCategoryHead(category: Category): void {
		const L = this.L;
		const labels = {
			invisible: "s.red",
			spaceLike: "s.blue",
			semantic: "s.yellow",
		} as const;
		const collapsed = this.settings.collapsedGroups[category];
		const head = createDiv({ cls: "gm-sub-head gm-collapsible" });
		head.createSpan({
			cls: "gm-caret",
			text: collapsed ? "▸" : "▾",
		});
		head.createSpan({ cls: `gm-dot ${tagFor(category).cls}` });
		head.createSpan({ text: t(L, labels[category]) });
		head.addEventListener("click", () => {
			this.settings.collapsedGroups[category] = !collapsed;
			void this.deps.saveSettings();
			this.display();
		});
		this.containerEl.appendChild(head);
	}

	private displayPolicyRow(entry: PolicyEntry): void {
		const L = this.L;
		const locked = entry.options.length <= 1;
		const setting = new Setting(this.containerEl);
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
				this.applyRowAction(entry, value as GhostmarkSettings["zwnjAction"]);
				await this.deps.saveSettings();
				this.display();
			});
		});
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

	private displayCustomPolicies(): void {
		const L = this.L;

		this.subHead(null, t(L, "s.custom"));

		for (const [key, custom] of Object.entries(this.settings.customPolicies)) {
			const setting = new Setting(this.containerEl).setClass("gm-picked-row");
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
					this.display();
				});
			});
		}

		new Setting(this.containerEl).addButton((btn) =>
			btn.setButtonText(t(L, "s.reset")).onClick(async () => {
				this.deps.setSettings(resetPolicies(this.settings));
				await this.deps.saveSettings();
				this.display();
			}),
		);
	}

	private displayContextRules(): void {
		const L = this.L;

		this.heading(t(L, "s.g2"));

		new Setting(this.containerEl)
			.setName(t(L, "s.math"))
			.setDesc(t(L, "s.math.d"))
			.addDropdown((dd) =>
				dd
					.addOptions({
						markOnly: t(L, "opt.markonly"),
						clean: t(L, "opt.clean"),
					})
					.setValue(this.settings.mathMode)
					.onChange(async (value) => {
						this.settings.mathMode = value as GhostmarkSettings["mathMode"];
						await this.deps.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.zwnj"))
			.setDesc(t(L, "s.zwnj.d"))
			.addDropdown((dd) =>
				dd
					.addOptions({
						keep: t(L, "opt.keep"),
						remove: t(L, "opt.remove"),
					})
					.setValue(this.settings.zwnjAction)
					.onChange(async (value) => {
						this.settings.zwnjAction = value as GhostmarkSettings["zwnjAction"];
						await this.deps.saveSettings();
						this.display();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.codespace"))
			.setDesc(t(L, "s.codespace.d"))
			.addToggle((toggle) =>
				toggle.setValue(this.settings.codeToSpace).onChange(async (value) => {
					this.settings.codeToSpace = value;
					await this.deps.saveSettings();
				}),
			);
	}

	private displayInterface(): void {
		const L = this.L;

		this.heading(t(L, "s.g3"));

		new Setting(this.containerEl)
			.setName(t(L, "s.remember"))
			.setDesc(t(L, "s.remember.d"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.inspectRemember)
					.onChange(async (value) => {
						this.settings.inspectRemember = value;
						await this.deps.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.density"))
			.setDesc(t(L, "s.density.d"))
			.addDropdown((dd) =>
				dd
					.addOptions({
						compact: t(L, "opt.compact"),
						detailed: t(L, "opt.detailed"),
					})
					.setValue(this.settings.density)
					.onChange(async (value) => {
						this.settings.density = value as GhostmarkSettings["density"];
						await this.deps.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.confirmall"))
			.setDesc(t(L, "s.confirmall.d"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.confirmBeforeAll)
					.onChange(async (value) => {
						this.settings.confirmBeforeAll = value;
						await this.deps.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.confirmblk"))
			.setDesc(t(L, "s.confirmblk.d"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.confirmBeforeBlock)
					.onChange(async (value) => {
						this.settings.confirmBeforeBlock = value;
						await this.deps.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t(L, "s.statusbar"))
			.setDesc(t(L, "s.statusbar.d"))
			.addToggle((toggle) =>
				toggle.setValue(this.settings.statusBar).onChange(async (value) => {
					this.settings.statusBar = value;
					this.deps.setStatusBarVisible(value);
					await this.deps.saveSettings();
				}),
			);
	}
}
