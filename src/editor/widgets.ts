/**
 * Inline glyph widgets for hits, styled after UI prototype P0–P2:
 * one compact glyph per category (red ⌷ / purple ⌗ / blue ␣ / yellow ⌦)
 * or the codepoint abbreviation in detailed density, with the prototype's
 * exact color palette (see styles.css). Base64 glyphs take an onClear
 * callback — clicking the glyph clears that one segment; the callback is
 * deliberately excluded from eq() so decoration rebuilds never force
 * widget redraws.
 */

import { WidgetType } from "@codemirror/view";
import type { Category } from "../core/categories";
import type { Locale } from "../core/i18n";
import { t } from "../core/i18n";
import { colorClass } from "./badgeModel";

export type Density = "compact" | "detailed";

const COMPACT_GLYPH: Record<Category, string> = {
	invisible: "⌷",
	spaceLike: "␣",
	semantic: "⌦",
	base64: "⌗",
};

const DETAILED_LABEL: Record<Category, (codepoint: string) => string> = {
	invisible: (cp) => cp.slice(2),
	spaceLike: (cp) => cp.slice(2),
	semantic: (cp) => cp.slice(2),
	base64: () => "b64",
};

const DATA_CP: Record<Category, (codepoint: string) => string> = {
	invisible: (cp) => cp.slice(2),
	spaceLike: (cp) => cp.slice(2),
	semantic: (cp) => cp.slice(2),
	base64: () => "base64",
};

export class GhostWidget extends WidgetType {
	constructor(
		readonly category: Category,
		readonly codepoint: string,
		readonly count: number,
		readonly markOnly: boolean,
		readonly density: Density,
		readonly locale: Locale,
		readonly flashGen: number = 0,
		readonly onClear?: () => void,
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
			other.locale === this.locale &&
			// a new generation must redraw the widget so the CSS pulse
			// restarts even when the flash lands on the same mark again
			other.flashGen === this.flashGen
		);
	}

	override toDOM(): HTMLElement {
		const el = createSpan();
		el.className = `gm-w ${colorClass(this.category)}${this.markOnly ? " markonly" : ""}${this.onClear ? " clearable" : ""}${this.flashGen > 0 ? " gm-flash" : ""}`;
		el.setAttribute("data-cp", DATA_CP[this.category](this.codepoint));
		el.setAttribute("data-nm", t(this.locale, `cp.${this.codepoint}`));
		el.setAttribute("data-density", this.density);
		const gt = createSpan({ cls: "gt" });
		const label =
			this.density === "compact"
				? COMPACT_GLYPH[this.category]
				: DETAILED_LABEL[this.category](this.codepoint);
		gt.textContent = this.count > 1 ? `${label} ×${this.count}` : label;
		el.appendChild(gt);
		if (this.onClear) {
			el.addEventListener("mousedown", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.onClear?.();
			});
		}
		return el;
	}

	override ignoreEvent(): boolean {
		return true;
	}
}
