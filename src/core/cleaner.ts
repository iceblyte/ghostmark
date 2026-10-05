/**
 * Cleaner: applies Hit actions back-to-front (so earlier offsets stay
 * valid) and reports what changed. Pure functions — no Obsidian or
 * CodeMirror imports.
 */

import {
	formatCodepoint,
	type Category,
	type ChangeReport,
	type Hit,
} from "./categories";

export interface CleanResult {
	text: string;
	report: ChangeReport;
}

/** Apply all actionable hits (remove / toSpace) in one pass. */
export function clean(text: string, hits: Hit[]): CleanResult {
	const report: ChangeReport = {
		total: 0,
		byCodepoint: {},
		byCategory: { invisible: 0, spaceLike: 0, semantic: 0, base64: 0 },
	};
	let out = text;
	// hits arrive ascending; going backwards keeps offsets valid
	for (let k = hits.length - 1; k >= 0; k--) {
		const hit = hits[k];
		if (!hit) continue;
		if (hit.action === "keep" || hit.action === "markOnly") continue;
		const replacement = hit.action === "toSpace" ? " " : "";
		out =
			out.slice(0, hit.index) +
			replacement +
			out.slice(hit.index + hit.length);
		countSpan(text, hit, report);
	}
	return { text: out, report };
}

function countSpan(text: string, hit: Hit, report: ChangeReport): void {
	if (hit.category === "base64") {
		// one aggregate key instead of one entry per ASCII character
		report.byCodepoint.base64 = (report.byCodepoint.base64 ?? 0) + hit.length;
		report.byCategory.base64 += hit.length;
		report.total += hit.length;
		return;
	}
	const end = hit.index + hit.length;
	let i = hit.index;
	while (i < end) {
		const cp = text.codePointAt(i) ?? 0;
		const key = formatCodepoint(cp);
		report.byCodepoint[key] = (report.byCodepoint[key] ?? 0) + 1;
		report.byCategory[hit.category] += 1;
		report.total += 1;
		i += cp > 0xffff ? 2 : 1;
	}
}

export interface HitSummary {
	/** Codepoints per category across all hits (kept and marked included). */
	byCategory: Record<Category, number>;
	/** Codepoints per category and codepoint id, for the confirm modal. */
	byCategoryCodepoint: Record<Category, Record<string, number>>;
	/** Codepoints whose final action is mark-only (math by default). */
	markOnly: number;
	/** Codepoints the cleaner would actually touch (remove / toSpace). */
	actionable: number;
}

/** Aggregate hits into the numbers shown by the confirm modals. */
export function summarizeHits(text: string, hits: Hit[]): HitSummary {
	const summary: HitSummary = {
		byCategory: { invisible: 0, spaceLike: 0, semantic: 0, base64: 0 },
		byCategoryCodepoint: {
			invisible: {},
			spaceLike: {},
			semantic: {},
			base64: {},
		},
		markOnly: 0,
		actionable: 0,
	};
	for (const hit of hits) {
		if (hit.category === "base64") {
			summary.byCategory.base64 += hit.length;
			summary.byCategoryCodepoint.base64.base64 =
				(summary.byCategoryCodepoint.base64.base64 ?? 0) + hit.length;
			if (hit.action === "markOnly") summary.markOnly += hit.length;
			if (hit.action === "remove" || hit.action === "toSpace") {
				summary.actionable += hit.length;
			}
			continue;
		}
		const end = hit.index + hit.length;
		let i = hit.index;
		while (i < end) {
			const cp = text.codePointAt(i) ?? 0;
			const key = formatCodepoint(cp);
			summary.byCategory[hit.category] += 1;
			summary.byCategoryCodepoint[hit.category][key] =
				(summary.byCategoryCodepoint[hit.category][key] ?? 0) + 1;
			if (hit.action === "markOnly") summary.markOnly += 1;
			if (hit.action === "remove" || hit.action === "toSpace") {
				summary.actionable += 1;
			}
			i += cp > 0xffff ? 2 : 1;
		}
	}
	return summary;
}
