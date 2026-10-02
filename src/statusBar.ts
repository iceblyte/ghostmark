/**
 * Status bar item (FR-6, prototype P1): "Ghost: N" with the current
 * note's hit count, clicking toggles inspect mode. Desktop only — the
 * mobile entry is the command palette (NFR-6).
 */

import {
	MarkdownView,
	Platform,
	type Component,
	type Workspace,
} from "obsidian";
import { scan } from "./core/scanner";
import type { InspectConfig } from "./editor/inspectState";

/**
 * Minimal host contract so the status bar does not import the plugin
 * class (which would be a module cycle).
 */
interface StatusBarHost extends Component {
	app: { workspace: Workspace };
	config: InspectConfig;
	inspectEnabled: boolean;
	setInspectEnabled(on: boolean): void;
	addStatusBarItem(): HTMLElement;
}

export class GhostmarkStatusBar {
	private el: HTMLElement;
	private countEl: HTMLElement;

	constructor(private plugin: StatusBarHost) {
		this.el = plugin.addStatusBarItem();
		this.el.addClass("ghostmark-status");
		this.el.createSpan({ cls: "ghost-dot" });
		this.el.createSpan({ text: "Ghost: " });
		this.countEl = this.el.createEl("b", { text: "0" });

		plugin.registerDomEvent(this.el, "click", () => {
			this.plugin.setInspectEnabled(!this.plugin.inspectEnabled);
			this.update();
		});

		plugin.registerEvent(
			plugin.app.workspace.on("active-leaf-change", () => this.update()),
		);
		plugin.registerEvent(
			plugin.app.workspace.on("editor-change", () => this.update()),
		);
		plugin.registerEvent(
			plugin.app.workspace.on("layout-change", () => this.update()),
		);
		this.update();
	}

	update(): void {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const count = view
			? scan(view.editor.getValue(), this.plugin.config.policy, {
					mathMode: this.plugin.config.mathMode,
					codeToSpace: this.plugin.config.codeToSpace,
				}).reduce((sum, h) => sum + h.count, 0)
			: 0;
		this.countEl.setText(String(count));
		this.el.toggleClass("is-off", !this.plugin.inspectEnabled);
	}
}

export function registerStatusBar(plugin: StatusBarHost): void {
	if (Platform.isMobile) return;
	new GhostmarkStatusBar(plugin);
}
