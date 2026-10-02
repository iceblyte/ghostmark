import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildScanPolicy } from "./categories";
import { scan } from "./scanner";

const policy = buildScanPolicy();

const fixturePath = fileURLToPath(
	new URL("./fixtures/watermark-fixture.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

function codepoints(hits: ReturnType<typeof scan>): number {
	return hits.reduce((sum, h) => sum + h.count, 0);
}

describe("scanner: prose rules", () => {
	it("emits one hit per invisible character", () => {
		const hits = scan("pyt\u2062\u2062hon Hel\u061c\u061clo", policy);
		expect(hits).toHaveLength(4);
		expect(hits.every((h) => h.action === "remove")).toBe(true);
		expect(hits[0]).toMatchObject({
			codepoint: "U+2062",
			category: "invisible",
			block: "prose",
		});
	});

	it("merges a space-like run and removes it whole when ≥2", () => {
		const hits = scan("a\u2002\u2002\u2002b", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({
			action: "remove",
			count: 3,
			length: 3,
		});
	});

	it("converts an isolated space-like char to a plain space", () => {
		const hits = scan("a\u2002b", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "toSpace", count: 1 });
	});

	it("merges mixed-width fingerprint runs into one hit", () => {
		const run = "\u2002\u2009".repeat(16);
		const hits = scan(`text ${run}\n`, policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "remove", count: 32 });
	});

	it("respects a keep override for a space-like char", () => {
		const keep = buildScanPolicy(undefined, { "U+2002": "keep" });
		const hits = scan("a\u2002\u2002b", keep);
		// kept hits remain marked (they exist but are not touched)
		expect(hits).toHaveLength(2);
		expect(hits.every((h) => h.action === "keep")).toBe(true);
	});

	it("respects a remove override for ZWNJ in prose", () => {
		const removeZwnj = buildScanPolicy(undefined, { "U+200C": "remove" });
		const hits = scan("a\u200cb", removeZwnj);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "remove", codepoint: "U+200C" });
	});

	it("never removes ZWJ even if an override asks for it", () => {
		const hostile = buildScanPolicy(undefined, { "U+200D": "remove" });
		expect(scan("\uD83D\uDC68\u200D\uD83D\uDC69", hostile)).toMatchObject([
			{ action: "keep", codepoint: "U+200D" },
		]);
	});
});

describe("scanner: code rules", () => {
	it("converts space-like chars to plain spaces inside fenced code", () => {
		const hits = scan("```python\n    \u2002x\n```", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({
			action: "toSpace",
			block: "fencedCode",
		});
	});

	it("removes invisible chars inside fenced code", () => {
		const hits = scan("```\na\u2062b\n```", policy);
		expect(hits[0]).toMatchObject({ action: "remove", block: "fencedCode" });
	});

	it("keeps semantic chars inside code", () => {
		const hits = scan("```\na\u200cb\n```", policy);
		expect(hits[0]).toMatchObject({ action: "keep", block: "fencedCode" });
	});

	it("handles inline code spans", () => {
		const hits = scan("a `\u2002 x` b", policy);
		expect(hits[0]).toMatchObject({
			action: "toSpace",
			block: "inlineCode",
		});
	});

	it("follows the prose run rule in code when codeToSpace is off", () => {
		const hits = scan("```\n\u2002\u2002\n```", policy, {
			codeToSpace: false,
		});
		expect(hits[0]).toMatchObject({ action: "remove", count: 2 });
	});
});

describe("scanner: math rules", () => {
	it("marks math block hits only by default", () => {
		const hits = scan("$$\na\u2062b\u2002\u2002c\n$$", policy);
		expect(hits).toHaveLength(2);
		expect(hits.every((h) => h.action === "markOnly")).toBe(true);
		expect(hits.every((h) => h.block === "math")).toBe(true);
	});

	it("cleans math blocks when mathMode is clean", () => {
		const hits = scan("$$\na\u2062b\u2002\u2002c\n$$", policy, {
			mathMode: "clean",
		});
		expect(hits.map((h) => h.action)).toEqual(["remove", "remove"]);
	});

	it("marks inline math spans only", () => {
		const hits = scan("$a\u2062 + b$", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "markOnly", block: "math" });
	});

	it("does not treat $5 and $10 amounts as math", () => {
		expect(scan("$5 \u548c $10", policy)).toHaveLength(0);
	});
});

describe("scanner: frontmatter and BOM", () => {
	it("treats frontmatter like prose", () => {
		const hits = scan("---\ntitle: x\u2062y\n---\n", policy);
		expect(hits[0]).toMatchObject({
			action: "remove",
			block: "frontmatter",
		});
	});

	it("never emits a hit for a leading BOM", () => {
		const hits = scan("\uFEFFa\u2062b", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]?.index).toBe(2);
	});

	it("removes U+FEFF outside the file head", () => {
		const hits = scan("a\uFEFFb", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "remove", codepoint: "U+FEFF" });
	});
});

describe("scanner: emoji protection", () => {
	it("marks ZWJ as protected and leaves pictographs unmarked", () => {
		const family = "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66";
		const hits = scan(family, policy);
		expect(hits).toHaveLength(3);
		expect(hits.every((h) => h.action === "keep")).toBe(true);
		expect(codepoints(hits)).toBe(3);
	});

	it("synthesizes a protected hit for a ZWJ-adjacent skin modifier", () => {
		const technologist = "\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDCBB";
		const hits = scan(technologist, policy);
		expect(hits).toHaveLength(2);
		expect(hits[0]).toMatchObject({
			codepoint: "U+1F3FB",
			action: "keep",
			entryId: "U+1F3FB",
		});
		expect(hits[1]).toMatchObject({ codepoint: "U+200D", action: "keep" });
	});

	it("does not mark skin modifiers without an adjacent ZWJ", () => {
		expect(scan("\uD83D\uDC4D\uD83C\uDFFB", policy)).toHaveLength(0);
	});

	it("keeps variation selectors via the policy range", () => {
		const hits = scan("\u2713\uFE0F", policy);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({
			entryId: "U+FE00-FE0F",
			action: "keep",
		});
	});
});

describe("scanner: custom policies", () => {
	it("scans picked codepoints", () => {
		const extended = buildScanPolicy(undefined, undefined, [
			{
				codepoint: "U+2065",
				category: "invisible",
				action: "remove",
				name: "(unassigned)",
			},
		]);
		const hits = scan("a\u2065b", extended);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ action: "remove" });
	});
});

describe("scanner: fixture totals", () => {
	it("matches the documented numbers on the fixture", () => {
		const hits = scan(fixture, policy);

		const byAction = { remove: 0, toSpace: 0, keep: 0, markOnly: 0 };
		const byCategory = { invisible: 0, spaceLike: 0, semantic: 0 };
		let actionedCps = 0;
		for (const h of hits) {
			byAction[h.action] += h.count;
			byCategory[h.category] += h.count;
			if (h.action === "remove" || h.action === "toSpace") {
				actionedCps += h.count;
			}
		}
		// red 324 (321 cleared + 3 math mark-only), blue 477, yellow 5.
		// Prose blue runs (≥2) are removed whole, so almost all blue lands
		// under "remove"; only the single code-block en space converts.
		expect(byCategory).toEqual({ invisible: 324, spaceLike: 477, semantic: 5 });
		expect(byAction).toEqual({
			remove: 797,
			toSpace: 1,
			keep: 5,
			markOnly: 3,
		});
		expect(codepoints(hits)).toBe(806);
		expect(actionedCps).toBe(798);
	});
});
