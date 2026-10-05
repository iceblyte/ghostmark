import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildScanPolicy } from "./categories";
import { clean, summarizeHits } from "./cleaner";
import { scan } from "./scanner";

const policy = buildScanPolicy();

const fixturePath = fileURLToPath(
	new URL("./fixtures/watermark-fixture.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

describe("clean", () => {
	it("removes invisible characters and counts them", () => {
		const { text, report } = clean("pyt\u2062hon", scan("pyt\u2062hon", policy));
		expect(text).toBe("python");
		expect(report.total).toBe(1);
		expect(report.byCodepoint).toEqual({ "U+2062": 1 });
		expect(report.byCategory).toEqual({
			invisible: 1,
			spaceLike: 0,
			semantic: 0,
			base64: 0,
		});
	});

	it("replaces a toSpace span with one plain space", () => {
		const source = "a\u2002b";
		const { text, report } = clean(source, scan(source, policy));
		expect(text).toBe("a b");
		expect(report.byCodepoint).toEqual({ "U+2002": 1 });
	});

	it("deletes a whole space run", () => {
		const source = "a\u2002\u2002\u2002b";
		const { text } = clean(source, scan(source, policy));
		expect(text).toBe("ab");
	});

	it("leaves keep and mark-only hits untouched", () => {
		const source = "\uD83D\uDC68\u200D\uD83D\uDC69 and $$a\u2062b$$";
		const { text, report } = clean(source, scan(source, policy));
		expect(text).toBe(source);
		expect(report.total).toBe(0);
	});

	it("keeps offsets valid with many hits (back-to-front)", () => {
		const source =
			"\u2062a\u2002b\u061c\u061cc\u2002\u2009\u2002d\u2062";
		const { text, report } = clean(source, scan(source, policy));
		// the isolated en space converts to a plain space, the rest is removed
		expect(text).toBe("a bcd");
		// 2062 x2, 061C x2, 2002 x3 (one converted, two in the run), 2009 x1
		expect(report.total).toBe(8);
		expect(report.byCodepoint).toEqual({
			"U+2062": 2,
			"U+061C": 2,
			"U+2002": 3,
			"U+2009": 1,
		});
	});

	it("does not mutate the input text", () => {
		const source = "a\u2062b";
		clean(source, scan(source, policy));
		expect(source).toBe("a\u2062b");
	});

	it("returns the text unchanged for an empty hit list", () => {
		const { text, report } = clean("plain", []);
		expect(text).toBe("plain");
		expect(report.total).toBe(0);
	});

	it("handles astral codepoints from custom policies", () => {
		const extended = buildScanPolicy(undefined, undefined, [
			{
				codepoint: "U+E0000",
				category: "invisible",
				action: "remove",
				name: "(tag)",
			},
		]);
		const source = "a\u{E0000}b";
		const { text, report } = clean(source, scan(source, extended));
		expect(text).toBe("ab");
		expect(report.byCodepoint).toEqual({ "U+E0000": 1 });
	});
});

describe("clean: base64 tokens", () => {
	const T = "M2pzpiGaOITdXr3Fb0HrULkJXq6Mc/ZvF8S3p5OQqjA=";

	it("removes prose tokens, keeps code tokens, preserves glued words", () => {
		const source = `段落一 ${T}\n\n\`\`\`python\nK = "${T}"\n\`\`\`\n\nlocalStorage${T} 结束\n`;
		const hits = scan(source, policy, { base64: true });
		const { text, report } = clean(source, hits);
		expect(text).toBe(
			`段落一 \n\n\`\`\`python\nK = "${T}"\n\`\`\`\n\nlocalStorage 结束\n`,
		);
		// 44 (prose) + 44 (glued, word preserved) — the code token stays
		expect(report.total).toBe(88);
		expect(report.byCategory.base64).toBe(88);
		expect(report.byCodepoint.base64).toBe(88);
		// no per-character codepoint noise from ASCII tokens
		expect(Object.keys(report.byCodepoint)).toEqual(["base64"]);
	});

	it("summarizes base64 segments under one aggregate key", () => {
		const source = `a ${T} b ${T}`;
		const summary = summarizeHits(source, scan(source, policy, { base64: true }));
		expect(summary.byCategory.base64).toBe(88);
		expect(summary.byCategoryCodepoint.base64).toEqual({ base64: 88 });
		expect(summary.actionable).toBe(88);
		expect(summary.markOnly).toBe(0);
	});

	it("counts code-context tokens as mark-only, not actionable", () => {
		const source = `\`K = "${T}"\``;
		const summary = summarizeHits(source, scan(source, policy, { base64: true }));
		expect(summary.markOnly).toBe(44);
		expect(summary.actionable).toBe(0);
	});
});

describe("summarizeHits", () => {
	it("aggregates per category with the math mark-only split", () => {
		const summary = summarizeHits(fixture, scan(fixture, policy));
		expect(summary.byCategory).toEqual({
			invisible: 324,
			spaceLike: 477,
			semantic: 5,
			base64: 0,
		});
		expect(summary.byCategoryCodepoint.invisible).toEqual({
			"U+2062": 108,
			"U+061C": 216,
		});
		expect(summary.byCategoryCodepoint.spaceLike).toEqual({
			"U+2002": 300,
			"U+2009": 177,
		});
		expect(summary.byCategoryCodepoint.semantic).toEqual({
			"U+200D": 4,
			"U+1F3FB": 1,
		});
		expect(summary.markOnly).toBe(3);
		expect(summary.actionable).toBe(798);
	});

	it("counts actionable codepoints for a small sample", () => {
		const source = "a\u2062\u2002\u2002b";
		const summary = summarizeHits(source, scan(source, policy));
		expect(summary.actionable).toBe(3);
		expect(summary.markOnly).toBe(0);
	});
});
