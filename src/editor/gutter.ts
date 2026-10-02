/**
 * Gutter hit badges (FR-5, prototype P1): one badge per line with hits,
 * colored by the dominant category, with a title tooltip. Clicking a badge
 * requests a block clear for that line (FR-13 dual entry, wired by the
 * shell via clearBlockRequestFacet).
 */

import { gutter, GutterMarker, type BlockInfo } from "@codemirror/view";
import type { Category, Hit } from "../core/categories";
import type { Locale } from "../core/i18n";
import { t } from "../core/i18n";
import {
	clearBlockRequestFacet,
	inspectConfigFacet,
	inspectHitsField,
} from "./inspectState";
import { colorClass } from "./widgets";

/** Severity order used to break count ties: red, blue, yellow. */
const CATEGORY_PRIORITY: Category[] = ["invisible", "spaceLike", "semantic"];

function lineHits(hits: Hit[], line: BlockInfo): Hit[] {
	let lo = 0;
	let hi = hits.length - 1;
	let start = hits.length;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const hit = hits[mid];
		if (hit && hit.index + hit.length > line.from) {
			start = mid;
			hi = mid - 1;
		} else {
			lo = mid + 1;
		}
	}
	const out: Hit[] = [];
	for (let i = start; i < hits.length; i++) {
		const hit = hits[i];
		if (!hit || hit.index >= line.to) break;
		out.push(hit);
	}
	return out;
}

function dominantColor(hits: Hit[]): string | null {
	const totals: Record<Category, number> = {
		invisible: 0,
		spaceLike: 0,
		semantic: 0,
	};
	for (const hit of hits) totals[hit.category] += hit.count;
	let best: Category | null = null;
	let bestCount = 0;
	for (const category of CATEGORY_PRIORITY) {
		if (totals[category] > bestCount) {
			best = category;
			bestCount = totals[category];
		}
	}
	return best ? colorClass(best) : null;
}

const badgeCache = new Map<string, HitBadge>();

class HitBadge extends GutterMarker {
	constructor(
		readonly color: string,
		readonly count: number,
		readonly locale: Locale,
	) {
		super();
	}

	override eq(other: HitBadge): boolean {
		return (
			other.color === this.color &&
			other.count === this.count &&
			other.locale === this.locale
		);
	}

	override toDOM(): HTMLElement {
		const span = createSpan({ cls: `gm-badge ${this.color}` });
		span.setText(String(this.count));
		span.title = t(this.locale, "badge.tip", { n: this.count });
		return span;
	}
}

function badgeFor(color: string, count: number, locale: Locale): HitBadge {
	const key = `${color}|${count}|${locale}`;
	let badge = badgeCache.get(key);
	if (!badge) {
		badge = new HitBadge(color, count, locale);
		badgeCache.set(key, badge);
	}
	return badge;
}

export const gutterExtension = gutter({
	class: "ghostmark-gutter",
	lineMarkerChange: (update) =>
		update.docChanged ||
		update.startState.facet(inspectConfigFacet) !==
			update.state.facet(inspectConfigFacet),
	lineMarker(view, line) {
		const config = view.state.facet(inspectConfigFacet);
		if (!config) return null;
		const hits = view.state.field(inspectHitsField, false) ?? [];
		const inLine = lineHits(hits, line);
		if (inLine.length === 0) return null;
		const color = dominantColor(inLine);
		if (!color) return null;
		const count = inLine.reduce((sum, h) => sum + h.count, 0);
		return badgeFor(color, count, config.locale);
	},
	domEventHandlers: {
		mousedown(view, line, event) {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return false;
			if (!target.classList.contains("gm-badge")) return false;
			const lineIndex = view.state.doc.lineAt(line.from).number - 1;
			for (const request of view.state.facet(clearBlockRequestFacet)) {
				request(view, lineIndex);
			}
			return true;
		},
	},
});
