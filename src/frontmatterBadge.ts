/**
 * Live Preview frontmatter summary badge (frontmatter-summary-badge
 * spec). Rendered OUTSIDE the CodeMirror document as a slim bar between
 * the view header and the editor, one per markdown leaf.
 *
 * The first implementation drew this badge as a block widget inside the
 * editor's decoration set, which had to be reverted: it was swallowed by
 * Obsidian's own frontmatter replacement in Live Preview, and — being
 * part of the plugin's `atomicRanges` — it broke mouse selection around
 * the frontmatter boundary. A DOM sibling of the editor is structurally
 * incapable of affecting selection, coordinates or rendering inside the
 * document.
 *
 * Shown only when the leaf is in Live Preview, inspect mode is on and
 * the frontmatter holds marks. Clicking clears the frontmatter through
 * the existing block-clear pipeline (lineIndex 0) — the same confirm
 * gate, notice and single-step undo semantics as the gutter badges.
 */

import { MarkdownView } from "obsidian";
import { frontmatterBadge, type FrontmatterBadge } from "./editor/badgeModel";
import { scan } from "./core/scanner";
import { t } from "./core/i18n";
import {
	clearCurrentBlock,
	frontmatterHidden,
	type CommandsHost,
} from "./commands";

export class FrontmatterBadgeController {
	private badges = new WeakMap<MarkdownView, HTMLElement>();

	constructor(private host: CommandsHost) {}

	/** Recompute every open markdown leaf (layout/leaf/setting changes). */
	update(): void {
		this.host.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) this.updateLeaf(leaf.view);
		});
	}

	/** Recompute a single leaf (per-keystroke editor changes). */
	updateLeaf(view: MarkdownView): void {
		let badge: FrontmatterBadge | null = null;
		if (this.host.inspectEnabled && frontmatterHidden(view)) {
			const hits = scan(view.editor.getValue(), this.host.config.policy, {
				mathMode: this.host.config.mathMode,
				codeToSpace: this.host.config.codeToSpace,
				base64: this.host.config.base64,
			});
			const fm = frontmatterBadge(hits);
			if (fm.count > 0) badge = fm;
		}
		if (!badge) {
			this.remove(view);
			return;
		}
		this.render(this.ensureElement(view), badge);
	}

	private ensureElement(view: MarkdownView): HTMLElement {
		const existing = this.badges.get(view);
		const parent =
			view.containerEl.querySelector<HTMLElement>(".markdown-source-view") ??
			view.containerEl;
		if (existing && existing.parentElement === parent) return existing;
		this.remove(view);
		const el = createDiv({ cls: "gm-fm-badge" });
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			clearCurrentBlock(this.host, view.editor, 0);
		});
		const editor = parent.querySelector<HTMLElement>(":scope > .cm-editor");
		if (editor) parent.insertBefore(el, editor);
		else parent.prepend(el);
		this.badges.set(view, el);
		return el;
	}

	private render(el: HTMLElement, badge: FrontmatterBadge): void {
		el.textContent = "";
		const segments = el.createSpan({ cls: "gm-badge" });
		for (const segment of badge.segments) {
			segments.createSpan({
				cls: `gm-badge-seg ${segment.color}`,
				text: String(segment.count),
			});
		}
		el.createSpan({
			cls: "gm-fm-badge-text",
			text: t(this.host.config.locale, "fm.badge", { n: badge.count }),
		});
		el.title = t(this.host.config.locale, "badge.tip", { n: badge.count });
	}

	private remove(view: MarkdownView): void {
		const el = this.badges.get(view);
		if (el) {
			el.remove();
			this.badges.delete(view);
		}
	}
}
