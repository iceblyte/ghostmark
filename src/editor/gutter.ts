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
	inspectHitsField,
	inspectRuntime,
	inspectRuntimeField,
} from "./inspectState";
import { colorClass } from "./widgets";

/** Severity order used to break count ties: red, blue, yellow. */
const CATEGORY_PRIORITY: Category[] = ["invisible", "spaceLike", "semantic"];

type BadgeVariant = "clear" | "space" | "passive";

function badgeVariant(hits: Hit[]): { variant: BadgeVariant; count: number } {
	let removeCount = 0;
	let spaceCount = 0;
	let totalCount = 0;
	for (const hit of hits) {
		totalCount += hit.count;
		if (hit.action === "remove") removeCount += hit.count;
		else if (hit.action === "toSpace") spaceCount += hit.count;
	}
	if (removeCount > 0) return { variant: "clear", count: totalCount };
	if (spaceCount > 0) return { variant: "space", count: spaceCount };
	return { variant: "passive", count: totalCount };
}

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
		readonly variant: BadgeVariant,
	) {
		super();
	}

	override eq(other: HitBadge): boolean {
		return (
			other.color === this.color &&
			other.count === this.count &&
			other.locale === this.locale &&
			other.variant === this.variant
		);
	}

	override toDOM(): HTMLElement {
		const span = createSpan({
			cls: `gm-badge ${this.color}${this.variant === "passive" ? " passive" : ""}`,
		});
		span.setText(String(this.count));
		const tipKey =
			this.variant === "clear"
				? "badge.tip"
				: this.variant === "space"
					? "badge.tip.space"
					: "badge.tip.keep";
		span.title = t(this.locale, tipKey, { n: this.count });
		return span;
	}
}

function badgeFor(
	color: string,
	count: number,
	locale: Locale,
	variant: BadgeVariant,
): HitBadge {
	const key = `${color}|${count}|${locale}|${variant}`;
	let badge = badgeCache.get(key);
	if (!badge) {
		badge = new HitBadge(color, count, locale, variant);
		badgeCache.set(key, badge);
	}
	return badge;
}

export const gutterExtension = gutter({
	class: "ghostmark-gutter",
	lineMarkerChange: (update) =>
		update.docChanged ||
		update.state.field(inspectRuntimeField, false) !==
			update.startState.field(inspectRuntimeField, false),
	lineMarker(view, line) {
		if (!inspectRuntime.enabled) return null;
		const config = inspectRuntime.config;
		if (!config) return null;
		const hits = view.state.field(inspectHitsField, false) ?? [];
		const inLine = lineHits(hits, line);
		if (inLine.length === 0) return null;
		const color = dominantColor(inLine);
		if (!color) return null;
		const { variant, count } = badgeVariant(inLine);
		return badgeFor(color, count, config.locale, variant);
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
