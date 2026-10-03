import { EditorView } from "@codemirror/view";
import {
	type Editor,
	MarkdownView,
	Plugin,
	editorInfoField,
} from "obsidian";
import { t } from "./core/i18n";
import {
	DEFAULT_SETTINGS,
	migrateSettings,
	type GhostmarkSettings,
} from "./core/policy";
import {
	clearCurrentBlock,
	registerCommands,
	runPickCodepoint,
} from "./commands";
import { INSPECT_EXTENSIONS } from "./editor/inspectMode";
import {
	clearBlockRequestFacet,
	inspectRuntime,
	inspectRuntimeEffect,
	setInspectRuntime,
} from "./editor/inspectState";
import { buildInspectConfig, obsidianLocale } from "./settings";
import { GhostmarkSettingTab } from "./settings";
import { GhostmarkStatusBar, registerStatusBar } from "./statusBar";

export default class GhostmarkPlugin extends Plugin {
	settings: GhostmarkSettings = DEFAULT_SETTINGS;

	/** Global single-value inspect-mode state (design doc §5). */
	inspectEnabled = false;

	private statusBar: GhostmarkStatusBar | null = null;

	config = buildInspectConfig(DEFAULT_SETTINGS, "en");

	async onload() {
		this.settings = migrateSettings(await this.loadData());
		this.inspectEnabled =
			this.settings.inspectRemember && this.settings.inspectEnabled;
		this.config = buildInspectConfig(this.settings, obsidianLocale());
		// Snapshot the runtime BEFORE the extensions register: every editor
		// state created from now on reads it at creation time, so new
		// editors, plugin re-enables and file switches all start in the
		// right state without any sync pass.
		setInspectRuntime(this.inspectEnabled, this.config);

		this.registerEditorExtension([
			...INSPECT_EXTENSIONS,
			// Gutter badge → clear the block containing that line (FR-13)
			clearBlockRequestFacet.of((view, lineIndex) => {
				const editor = view.state.field(editorInfoField).editor;
				if (editor) clearCurrentBlock(this, editor, lineIndex);
			}),
		]);

		registerStatusBar(this);
		registerCommands(this);

		// Editor context menu entry for pick-codepoint (FR-9)
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor: Editor) => {
				menu.addItem((item) =>
					item
						.setTitle(t(this.config.locale, "cmd.pick"))
						.setIcon("crosshair")
						.onClick(() => runPickCodepoint(this, editor)),
				);
			}),
		);

		this.addSettingTab(
			new GhostmarkSettingTab(this.app, this, {
				getSettings: () => this.settings,
				setSettings: (settings) => {
					this.settings = settings;
				},
				getLocale: () => this.config.locale,
				saveSettings: () => this.saveSettings(),
				setStatusBarVisible: (on) => this.setStatusBarVisible(on),
			}),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.config = buildInspectConfig(this.settings, obsidianLocale());
		setInspectRuntime(this.inspectEnabled, this.config);
		this.forEachEditorView((view) => {
			view.dispatch({ effects: inspectRuntimeEffect.of(inspectRuntime.version) });
		});
	}

	setInspectEnabled(on: boolean): void {
		if (this.inspectEnabled !== on) {
			this.inspectEnabled = on;
			setInspectRuntime(on, this.config);
			this.forEachEditorView((view) => {
				view.dispatch({ effects: inspectRuntimeEffect.of(inspectRuntime.version) });
			});
			if (this.settings.inspectRemember) {
				this.settings.inspectEnabled = on;
				void this.saveData(this.settings);
			}
		}
		this.statusBar?.update();
	}

	setStatusBarVisible(on: boolean): void {
		this.statusBar?.setVisible(on);
	}

	forEachEditorView(callback: (view: EditorView) => void): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			const cmView = EditorView.findFromDOM(view.containerEl);
			if (cmView) callback(cmView);
		});
	}
}
