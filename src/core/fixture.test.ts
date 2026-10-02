import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { blockRangeAt, blockRangeToTextRange } from "./blocks";
import { buildScanPolicy } from "./categories";
import { clean } from "./cleaner";
import { scan } from "./scanner";

const fixturePath = fileURLToPath(
	new URL("./fixtures/watermark-fixture.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

function countCodepoint(text: string, codepoint: number): number {
	let n = 0;
	for (const ch of text) {
		if (ch.codePointAt(0) === codepoint) n++;
	}
	return n;
}

// Smoke gate: the fixture is the shared acceptance sample for every later
// milestone; if these counts drift, all downstream assertions are meaningless.
describe("watermark fixture integrity", () => {
	it("matches the documented per-codepoint counts", () => {
		expect(countCodepoint(fixture, 0x2062)).toBe(108);
		expect(countCodepoint(fixture, 0x061c)).toBe(216);
		expect(countCodepoint(fixture, 0x2002)).toBe(300);
		expect(countCodepoint(fixture, 0x2009)).toBe(177);
	});

	it("contains 48 base64 tracking tokens with 10 distinct values", () => {
		const tokens = fixture.match(/[A-Za-z0-9+/]{43}=/g) ?? [];
		expect(tokens).toHaveLength(48);
		expect(new Set(tokens).size).toBe(10);
	});
});

// Acceptance criteria §6.2–6.5 of the requirements doc, executed on the
// committed fixture: clear-all with the default policy.
describe("fixture acceptance: clear all with default policy", () => {
	const policy = buildScanPolicy();
	const hits = scan(fixture, policy);
	const { text: cleaned, report } = clean(fixture, hits);

	it("leaves zero actionable residue after clear-all (§6.2)", () => {
		const residue = scan(cleaned, policy).filter(
			(h) => h.action === "remove" || h.action === "toSpace",
		);
		expect(residue).toHaveLength(0);
		expect(report.total).toBe(798);
	});

	it("preserves emoji ZWJ sequences byte-for-byte (§6.3)", () => {
		const family =
			"\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66";
		const technologist = "\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDCBB";
		expect(cleaned).toContain(family);
		expect(cleaned).toContain(technologist);
		// the four ZWJ and the skin modifier are still there
		expect(countCodepoint(cleaned, 0x200d)).toBe(4);
		expect(countCodepoint(cleaned, 0x1f3fb)).toBe(1);
	});

	it("leaves the math block untouched by default (§6.4)", () => {
		// 105 of 108 U+2062 lived in prose and are gone; the math block's 3 stay
		expect(countCodepoint(cleaned, 0x2062)).toBe(3);
		expect(cleaned).toContain(
			"\\alpha\u2062\u2062\u2062\\beta = \\gamma + \\delta",
		);
	});

	it("converts code-block spaces to plain spaces without loss (§6.5)", () => {
		expect(countCodepoint(cleaned, 0x2002)).toBe(0);
		expect(countCodepoint(cleaned, 0x2009)).toBe(0);
		expect(cleaned).toContain('label = "hello world"');
		// 797 codepoints deleted, the single code en space converted 1:1
		expect(cleaned.length).toBe(fixture.length - 797);
	});
});

// Acceptance criterion §8 of the requirements doc: clear-current-block
// must touch only the block at the target line.
describe("fixture acceptance: clear current block (FR-13)", () => {
	const policy = buildScanPolicy();

	it("cleans a list item block and leaves the rest untouched", () => {
		const lines = fixture.split("\n");
		const line = lines.findIndex((l) => l.includes("\u061c"));
		const range = blockRangeAt(fixture, line);
		if (!range) throw new Error("no block at line");
		const { start, end } = blockRangeToTextRange(fixture, range);
		const slice = fixture.slice(start, end);
		const { text: cleanedSlice, report } = clean(slice, scan(slice, policy));
		expect(report.total).toBeGreaterThan(0);

		const result = fixture.slice(0, start) + cleanedSlice + fixture.slice(end);
		expect(result.length).toBe(fixture.length - report.total);
		// the bytes before and after the block are identical
		expect(result.slice(0, start)).toBe(fixture.slice(0, start));
	});

	it("reports zero change for a block without policy hits", () => {
		const lines = fixture.split("\n");
		const headingLine = lines.findIndex((l) => l === "## 六、收尾");
		const range = blockRangeAt(fixture, headingLine);
		if (!range) throw new Error("no block");
		const { start, end } = blockRangeToTextRange(fixture, range);
		const slice = fixture.slice(start, end);
		const actionable = scan(slice, policy).filter(
			(h) => h.action === "remove" || h.action === "toSpace",
		);
		expect(actionable).toHaveLength(0);
	});
});
