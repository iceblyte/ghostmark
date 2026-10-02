/**
 * Inline glyph widgets for hits, styled after UI prototype P0–P2:
 * one compact glyph per category (red ⌷ / blue ␣ / yellow ⌦) or the
 * codepoint abbreviation in detailed density, with the prototype's
 * exact three-color palette (see styles.css).
 */

import { WidgetType } from "@codemirror/view";
import type { Category } from "../core/categories";
import type { Locale } from "../core/i18n";
import { t } from "../core/i18n";

export type Density = "compact" | "detailed";

const COMPACT_GLYPH: Record<Category, string> = {
	invisible: "⌷",
	spaceLike: "␣",
	semantic: "⌦",
};

export function colorClass(category: Category): string {
	if (category === "invisible") return "red";
	if (category === "spaceLike") return "blue";
	return "yellow";
}

export class GhostWidget extends WidgetType {
	constructor(
		readonly category: Category,
		readonly codepoint: string,
		readonly count: number,
		readonly markOnly: boolean,
		readonly density: Density,
		readonly locale: Locale,
	) {
		super();
	}

	override eq(other: GhostWidget): boolean {
		return (
			other.category === this.category &&
			other.codepoint === this.codepoint &&
			other.count === this.count &&
			other.markOnly === this.markOnly &&
			other.density === this.density &&
			other.locale === this.locale
		);
	}

	override toDOM(): HTMLElement {
		const el = createSpan();
		el.className = `gm-w ${colorClass(this.category)}${this.markOnly ? " markonly" : ""}`;
		el.setAttribute("data-cp", this.codepoint.slice(2));
		el.setAttribute("data-nm", t(this.locale, `cp.${this.codepoint}`));
		el.setAttribute("data-density", this.density);
		const gt = createSpan({ cls: "gt" });
		const label =
			this.density === "compact"
				? COMPACT_GLYPH[this.category]
				: this.codepoint.slice(2);
		gt.textContent = this.count > 1 ? `${label} ×${this.count}` : label;
		el.appendChild(gt);
		return el;
	}

	override ignoreEvent(): boolean {
		return true;
	}
}
