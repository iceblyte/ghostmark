/**
 * Gutter hit badges (FR-5, prototype P1): one badge per line with hits,
 * rendered as color segments (one per category, each showing its own
 * codepoint count — see badgeModel.ts for the registry), with a title
 * tooltip. Clicking a badge requests a block clear for that line
 * (FR-13 dual entry, wired by the shell via clearBlockRequestFacet).
 */

import { gutter, GutterMarker, type BlockInfo } from "@codemirror/view";
import type { Hit } from "../core/categories";
import type { Locale } from "../core/i18n";
import { t } from "../core/i18n";
import {
	badgeSegments,
	badgeVariant,
	type BadgeSegment,
	type BadgeVariant,
} from "./badgeModel";
import {
	clearBlockRequestFacet,
	inspectHitsField,
	inspectRuntime,
	inspectRuntimeField,
} from "./inspectState";

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

const badgeCache = new Map<string, HitBadge>();

class HitBadge extends GutterMarker {
	constructor(
		readonly segments: BadgeSegment[],
		readonly locale: Locale,
		readonly variant: BadgeVariant,
		readonly tipCount: number,
	) {
		super();
	}

	key(): string {
		return (
			this.segments.map((s) => `${s.color}${s.count}`).join("|") +
			`|${this.locale}|${this.variant}|${this.tipCount}`
		);
	}

	override eq(other: HitBadge): boolean {
		return other.key() === this.key();
	}

	override toDOM(): HTMLElement {
		const span = createSpan({
			cls: `gm-badge${this.variant === "passive" ? " passive" : ""}`,
		});
		for (const segment of this.segments) {
			span.createSpan({
				cls: `gm-badge-seg ${segment.color}`,
				text: String(segment.count),
			});
		}
		const tipKey =
			this.variant === "clear"
				? "badge.tip"
				: this.variant === "space"
					? "badge.tip.space"
					: "badge.tip.keep";
		span.title = t(this.locale, tipKey, { n: this.tipCount });
		return span;
	}
}

function badgeFor(
	segments: BadgeSegment[],
	locale: Locale,
	variant: BadgeVariant,
	tipCount: number,
): HitBadge {
	const badge = new HitBadge(segments, locale, variant, tipCount);
	const cached = badgeCache.get(badge.key());
	if (cached) return cached;
	badgeCache.set(badge.key(), badge);
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
		const segments = badgeSegments(inLine);
		if (segments.length === 0) return null;
		const info = badgeVariant(inLine);
		const count =
			info.variant === "space" ? info.actionedCount : info.totalCount;
		return badgeFor(segments, config.locale, info.variant, count);
	},
	domEventHandlers: {
		mousedown(view, line, event) {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return false;
			if (!target.closest(".gm-badge")) return false;
			const lineIndex = view.state.doc.lineAt(line.from).number - 1;
			for (const request of view.state.facet(clearBlockRequestFacet)) {
				request(view, lineIndex);
			}
			return true;
		},
	},
});
