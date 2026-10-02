import { EditorView } from "@codemirror/view";
import { MarkdownView, Plugin } from "obsidian";
import { buildScanPolicy } from "./core/categories";
import { t } from "./core/i18n";
import {
	configureInspect,
	INSPECT_OFF_EXTENSIONS,
	inspectCompartment,
	inspectConfigCompartment,
} from "./editor/inspectMode";
import {
	inspectConfigFacet,
	type InspectConfig,
} from "./editor/inspectState";
import { registerStatusBar } from "./statusBar";

export default class GhostmarkPlugin extends Plugin {
	/** Global single-value inspect-mode state (design doc §5). */
	inspectEnabled = false;

	config: InspectConfig = {
		policy: buildScanPolicy(),
		density: "compact",
		locale: "en",
		mathMode: "markOnly",
		codeToSpace: true,
		nameFor: (entryId) => {
			const localized = t("en", `cp.${entryId}`);
			return localized === `cp.${entryId}` ? entryId : localized;
		},
	};

	async onload() {
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

	setInspectEnabled(on: boolean): void {
		this.inspectEnabled = on;
		this.syncInspectAcrossEditors();
	}

	private syncInspectAcrossEditors(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			const cmView = EditorView.findFromDOM(view.containerEl);
			if (cmView) configureInspect(cmView, this.inspectEnabled);
		});
	}
}
