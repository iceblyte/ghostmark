/**
 * Gutter badge model: the color registry, per-category segment
 * aggregation and tooltip variant selection. Pure functions — no
 * Obsidian or CodeMirror imports — so the badge presentation is
 * unit-testable.
 *
 * Extending with a new color: add an entry to BADGE_COLORS (order =
 * severity order for ties), add a matching `.gm-badge-seg.<id>` CSS
 * rule, and map the category to it in colorClass. Any aggregated color
 * missing from the registry is appended after the known ones instead of
 * being dropped, so counts can never silently disappear.
 */

import type { Category, Hit } from "../core/categories";

/** Ordered color registry (severity order: red, blue, yellow, …). */
export const BADGE_COLORS: ReadonlyArray<{
	color: string;
	category: Category;
}> = [
	{ color: "red", category: "invisible" },
	{ color: "blue", category: "spaceLike" },
	{ color: "yellow", category: "semantic" },
];

/** UI color for a category (prototype three-color system). */
export function colorClass(category: Category): string {
	if (category === "invisible") return "red";
	if (category === "spaceLike") return "blue";
	return "yellow";
}

export interface BadgeSegment {
	color: string;
	count: number;
}

/** Per-color codepoint counts on a line, in registry order. */
export function badgeSegments(hits: Hit[]): BadgeSegment[] {
	const totals = new Map<string, number>();
	for (const hit of hits) {
		const color = colorClass(hit.category);
		totals.set(color, (totals.get(color) ?? 0) + hit.count);
	}
	const segments: BadgeSegment[] = [];
	for (const { color } of BADGE_COLORS) {
		const count = totals.get(color);
		if (count) segments.push({ color, count });
	}
	// defensive: colors not in the registry are appended, never dropped
	const known = new Set(BADGE_COLORS.map((c) => c.color));
	for (const [color, count] of totals) {
		if (!known.has(color)) segments.push({ color, count });
	}
	return segments;
}

export type BadgeVariant = "clear" | "space" | "passive";

export interface BadgeVariantInfo {
	variant: BadgeVariant;
	/** Codepoints on the line that would actually be cleaned. */
	actionedCount: number;
	/** All codepoints on the line (kept / mark-only included). */
	totalCount: number;
}

/**
 * What the line's hits would do: any removal (red chars, or blue runs
 * of ≥2 whose final action is remove) → "clear"; only conversions →
 * "space"; only keep / mark-only → "passive".
 */
export function badgeVariant(hits: Hit[]): BadgeVariantInfo {
	let removeCount = 0;
	let spaceCount = 0;
	let totalCount = 0;
	for (const hit of hits) {
		totalCount += hit.count;
		if (hit.action === "remove") removeCount += hit.count;
		else if (hit.action === "toSpace") spaceCount += hit.count;
	}
	if (removeCount > 0) {
		return { variant: "clear", actionedCount: removeCount + spaceCount, totalCount };
	}
	if (spaceCount > 0) {
		return { variant: "space", actionedCount: spaceCount, totalCount };
	}
	return { variant: "passive", actionedCount: 0, totalCount };
}
