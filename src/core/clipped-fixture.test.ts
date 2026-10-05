import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildScanPolicy } from "./categories";
import { clean, summarizeHits } from "./cleaner";
import { scan } from "./scanner";

/**
 * Acceptance fixture for the 2026-10 expansion (specs: character-policy,
 * base64-marking). Watermark patterns mirror the local reference corpus:
 * word-interior clusters, end-of-line fingerprint strings (20×U+2002 +
 * 12×U+2009, byte-identical to the real sample), base64 tracking tokens
 * in every observed shape plus anti-false-positive negatives, and one
 * sample per expanded policy group. All prose is original placeholder
 * text; token values are synthetic.
 */
const fixturePath = fileURLToPath(
	new URL("./fixtures/clipped-fixture.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

const policy = buildScanPolicy();
const hits = scan(fixture, policy, { base64: true });

function codepoints(list: typeof hits): number {
	return list.reduce((sum, h) => sum + h.count, 0);
}

describe("clipped fixture: totals", () => {
	it("matches the documented counts", () => {
		const byAction = { remove: 0, toSpace: 0, keep: 0, markOnly: 0 };
		const byCategory = { invisible: 0, spaceLike: 0, semantic: 0, base64: 0 };
		for (const hit of hits) {
			byAction[hit.action] += hit.count;
			byCategory[hit.category] += hit.count;
		}
		// invisible 68 (42 cluster chars + 26 group samples), spaceLike 69
		// (2×32 fingerprint + 5 isolated runs), semantic 5, base64 10×44
		expect(byCategory).toEqual({
			invisible: 68,
			spaceLike: 69,
			semantic: 5,
			base64: 440,
		});
		expect(byAction).toEqual({
			remove: 481,
			toSpace: 7,
			keep: 5,
			markOnly: 89,
		});
		expect(hits).toHaveLength(90);
		expect(codepoints(hits)).toBe(582);
	});
});

describe("clipped fixture: expanded policy groups", () => {
	function entryCount(entryId: string): number {
		return hits
			.filter((h) => h.entryId === entryId)
			.reduce((sum, h) => sum + h.count, 0);
	}

	it("covers every expanded red group", () => {
		expect(entryCount("U+00AD")).toBe(1);
		expect(entryCount("U+202A-202E")).toBe(5);
		expect(entryCount("U+2066-2069")).toBe(4);
		expect(entryCount("U+FFF9-FFFB")).toBe(3);
		expect(entryCount("U+E0001")).toBe(1);
		expect(entryCount("U+E0020-E007F")).toBe(2);
		expect(entryCount("U+000B-000C")).toBe(2);
		expect(entryCount("U+007F")).toBe(1);
		expect(entryCount("U+0080-009F")).toBe(1);
		expect(entryCount("U+FDD0-FDEF")).toBe(2);
	});

	it("covers the line/paragraph separators and the new spaces", () => {
		expect(entryCount("U+2028")).toBe(1);
		expect(entryCount("U+2029")).toBe(1);
		expect(entryCount("U+2000")).toBe(1);
		expect(entryCount("U+2005")).toBe(1);
		expect(entryCount("U+200A")).toBe(1);
		expect(entryCount("U+205F")).toBe(1);
		expect(entryCount("U+1680")).toBe(1);
	});

	it("defaults the separators to toSpace", () => {
		for (const hit of hits) {
			if (hit.entryId === "U+2028" || hit.entryId === "U+2029") {
				expect(hit.action).toBe("toSpace");
			}
		}
	});
});

describe("clipped fixture: base64 shapes", () => {
	it("marks 10 segments totalling 440 characters", () => {
		const tokens = hits.filter((h) => h.category === "base64");
		// 2 standalone + 1 glued four-burst chain + 2 glued-to-word + 2 in code
		expect(tokens).toHaveLength(10);
		expect(codepoints(tokens)).toBe(440);
	});

	it("keeps every token 44 characters long", () => {
		for (const hit of hits) {
			if (hit.category === "base64") {
				expect(hit.length).toBe(44);
			}
		}
	});

	it("marks the inline and fenced code tokens as mark-only", () => {
		const codeTokens = hits.filter(
			(h) =>
				h.category === "base64" &&
				(h.block === "inlineCode" || h.block === "fencedCode"),
		);
		expect(codeTokens).toHaveLength(2);
		expect(codeTokens.every((h) => h.action === "markOnly")).toBe(true);
	});

	it("finds zero base64 hits in the negative section", () => {
		const start = fixture.indexOf("## 四、");
		const end = fixture.indexOf("## 五、");
		const negative = fixture.slice(start, end);
		const negativeHits = scan(negative, policy, { base64: true });
		expect(
			negativeHits.filter((h) => h.category === "base64"),
		).toHaveLength(0);
	});
});

describe("clipped fixture: clean behaviour", () => {
	const { text: cleaned, report } = clean(fixture, hits);

	it("preserves glued words in front of tokens", () => {
		expect(cleaned).toContain("localStorage");
		expect(cleaned).toContain("WebSocket");
	});

	it("keeps the data URI byte-identical", () => {
		expect(cleaned).toContain(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
		);
	});

	it("keeps code tokens and protected sequences byte-identical", () => {
		expect(cleaned).toContain('TOKEN = "');
		expect(cleaned).toContain("👨‍👩‍👧‍👦");
		expect(cleaned).toContain("👩🏻‍💻");
	});

	it("leaves zero actionable residue after one clean pass", () => {
		expect(report.total).toBe(488);
		const rescanned = scan(cleaned, policy, { base64: true });
		const residue = rescanned.filter(
			(h) => h.action === "remove" || h.action === "toSpace",
		);
		expect(residue).toHaveLength(0);
	});

	it("summarizes base64 under one aggregate key", () => {
		const summary = summarizeHits(fixture, hits);
		expect(summary.byCategoryCodepoint.base64).toEqual({ base64: 440 });
		expect(summary.actionable).toBe(488);
		expect(summary.markOnly).toBe(89);
	});
});
