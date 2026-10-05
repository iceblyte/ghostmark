/**
 * Live Preview frontmatter summary badge (frontmatter-summary-badge
 * spec): a block widget rendered after the properties panel that
 * summarizes the marks the panel hides — segmented per category, like
 * the gutter badges. Clicking it clears the frontmatter block through
 * the same facet the gutter badges use (lineIndex 0 is the frontmatter),
 * so confirmation, notice and undo semantics are shared.
 */

import { WidgetType, type EditorView } from "@codemirror/view";
import type { Locale } from "../core/i18n";
import { t } from "../core/i18n";
import type { BadgeSegment } from "./badgeModel";
import { clearBlockRequestFacet } from "./inspectState";

export class FrontmatterBadgeWidget extends WidgetType {
	constructor(
		readonly segments: BadgeSegment[],
		readonly count: number,
		readonly locale: Locale,
	) {
		super();
	}

	private key(): string {
		return (
			this.segments.map((s) => `${s.color}${s.count}`).join("|") +
			`|${this.locale}|${this.count}`
		);
	}

	override eq(other: FrontmatterBadgeWidget): boolean {
		return other.key() === this.key();
	}

	override toDOM(view: EditorView): HTMLElement {
		const wrap = createDiv({ cls: "gm-fm-badge" });
		const badge = wrap.createSpan({ cls: "gm-badge" });
		for (const segment of this.segments) {
			badge.createSpan({
				cls: `gm-badge-seg ${segment.color}`,
				text: String(segment.count),
			});
		}
		wrap.createSpan({
			cls: "gm-fm-badge-text",
			text: t(this.locale, "fm.badge", { n: this.count }),
		});
		wrap.title = t(this.locale, "badge.tip", { n: this.count });
		wrap.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			for (const request of view.state.facet(clearBlockRequestFacet)) {
				request(view, 0);
			}
		});
		return wrap;
	}

	override ignoreEvent(): boolean {
		return true;
	}
}
