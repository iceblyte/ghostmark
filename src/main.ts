import { EditorView } from "@codemirror/view";
import { MarkdownView, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	migrateSettings,
	type GhostmarkSettings,
} from "./core/policy";
import {
	configureInspect,
	INSPECT_OFF_EXTENSIONS,
	inspectCompartment,
	inspectConfigCompartment,
} from "./editor/inspectMode";
import { inspectConfigFacet, type InspectConfig } from "./editor/inspectState";
import { buildInspectConfig, obsidianLocale } from "./settings";
import { registerStatusBar } from "./statusBar";

export default class GhostmarkPlugin extends Plugin {
	settings: GhostmarkSettings = DEFAULT_SETTINGS;

	/** Global single-value inspect-mode state (design doc §5). */
	inspectEnabled = false;

	config: InspectConfig = buildInspectConfig(
		DEFAULT_SETTINGS,
		"en",
	);

	async onload() {
		this.settings = migrateSettings(await this.loadData());
		this.config = buildInspectConfig(this.settings, obsidianLocale());
		this.inspectEnabled =
			this.settings.inspectRemember && this.settings.inspectEnabled;

		this.registerEditorExtension([
			inspectConfigCompartment.of(inspectConfigFacet.of(this.config)),
			inspectCompartment.of(INSPECT_OFF_EXTENSIONS),
		]);

		registerStatusBar(this);

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.workspace.on("layout-change", () => {
					this.syncInspectAcrossEditors();
				}),
			);
			this.syncInspectAcrossEditors();
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.config = buildInspectConfig(this.settings, obsidianLocale());
		this.forEachEditorView((view) => {
			view.dispatch({
				effects: inspectConfigCompartment.reconfigure(
					inspectConfigFacet.of(this.config),
				),
			});
		});
	}

	setInspectEnabled(on: boolean): void {
		this.inspectEnabled = on;
		if (this.settings.inspectRemember && this.settings.inspectEnabled !== on) {
			this.settings.inspectEnabled = on;
			void this.saveData(this.settings);
		}
		this.syncInspectAcrossEditors();
	}

	forEachEditorView(callback: (view: EditorView) => void): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			const cmView = EditorView.findFromDOM(view.containerEl);
			if (cmView) callback(cmView);
		});
	}

	private syncInspectAcrossEditors(): void {
		this.forEachEditorView((view) =>
			configureInspect(view, this.inspectEnabled),
		);
	}
}
