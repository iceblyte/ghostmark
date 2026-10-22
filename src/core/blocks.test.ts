import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	badgeBlockRange,
	blockRangeAt,
	blockTypeAt,
	parseBlocks,
} from "./blocks";

const fixturePath = fileURLToPath(
	new URL("./fixtures/watermark-fixture.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");
const fixtureLines = fixture.split("\n");

describe("parseBlocks / blockTypeAt", () => {
	it("classifies frontmatter lines and prose after it", () => {
		const text = '---\ntitle: "T"\n---\n\nbody\n';
		const map = parseBlocks(text);
		expect(blockTypeAt(map, 0)).toBe("frontmatter");
		expect(blockTypeAt(map, 8)).toBe("frontmatter");
		expect(blockTypeAt(map, text.length - 2)).toBe("prose");
		expect(map.regions).toEqual([
			{ type: "frontmatter", startLine: 0, endLine: 2 },
		]);
	});

	it("treats an unterminated --- head as prose, not frontmatter", () => {
		const map = parseBlocks("---\ntitle: T\n\nbody\n");
		expect(blockTypeAt(map, 0)).toBe("prose");
	});

	it("covers fenced code lines including the fences", () => {
		const text = "```python\ndef x():\n    return 1\n```\nafter\n";
		const map = parseBlocks(text);
		expect(blockTypeAt(map, 0)).toBe("fencedCode");
		expect(blockTypeAt(map, 12)).toBe("fencedCode");
		expect(blockTypeAt(map, text.indexOf("after"))).toBe("prose");
		expect(map.regions).toEqual([
			{ type: "fencedCode", startLine: 0, endLine: 3 },
		]);
	});

	it("keeps an unclosed fence to the end of the text", () => {
		const map = parseBlocks("```python\ndef x():\n");
		expect(blockTypeAt(map, 9)).toBe("fencedCode");
	});

	it("does not close a ``` fence with a ~~~ line", () => {
		const map = parseBlocks("```python\ndef x():\n~~~\nmore\n```\n");
		expect(map.regions).toEqual([
			{ type: "fencedCode", startLine: 0, endLine: 4 },
		]);
	});

	it("covers $$ math blocks including the delimiters", () => {
		const text = "$$\nE = mc^2\n$$\nafter\n";
		const map = parseBlocks(text);
		expect(blockTypeAt(map, 0)).toBe("math");
		expect(blockTypeAt(map, text.indexOf("after"))).toBe("prose");
		expect(map.regions).toEqual([{ type: "math", startLine: 0, endLine: 2 }]);
	});

	it("marks inline code spans and wins over math inside backticks", () => {
		const text = "a `x $y$ z` b\n";
		const map = parseBlocks(text);
		expect(blockTypeAt(map, text.indexOf("$y$"))).toBe("inlineCode");
	});

	it("marks inline $...$ math spans", () => {
		const text = "\u884c\u5185\u516c\u5f0f $a + b$ \u4fdd\u6301\u539f\u6837\u3002\n";
		const map = parseBlocks(text);
		expect(blockTypeAt(map, text.indexOf("$a"))).toBe("math");
		expect(blockTypeAt(map, text.indexOf("a + b"))).toBe("math");
		expect(blockTypeAt(map, 0)).toBe("prose");
	});

	it("ignores currency-like dollar amounts", () => {
		const map = parseBlocks("\u4ef7\u683c $5 \u548c $10 \u5143\n");
		expect(blockTypeAt(map, 4)).toBe("prose");
	});

	it("skips escaped dollars", () => {
		const map = parseBlocks("a \\$5 b\n");
		expect(blockTypeAt(map, 4)).toBe("prose");
	});

	it("marks single-line $$...$$ pairs as math", () => {
		const text = "x $$E=mc^2$$ y\n";
		const map = parseBlocks(text);
		expect(blockTypeAt(map, text.indexOf("E=mc"))).toBe("math");
	});
});

describe("blockRangeAt six shapes", () => {
	it("resolves the whole frontmatter from any of its lines", () => {
		const fmClose = fixtureLines.findIndex((l, i) => i > 0 && l.trim() === "---");
		expect(blockRangeAt(fixture, 0)).toEqual({
			startLine: 0,
			endLine: fmClose,
			shape: "frontmatter",
		});
		expect(blockRangeAt(fixture, 2)).toEqual({
			startLine: 0,
			endLine: fmClose,
			shape: "frontmatter",
		});
	});

	it("resolves a whole fenced code block", () => {
		const open = fixtureLines.findIndex((l) => l.startsWith("```"));
		const close = fixtureLines.findIndex(
			(l, i) => i > open && l.trim() === "```",
		);
		expect(blockRangeAt(fixture, open + 2)).toEqual({
			startLine: open,
			endLine: close,
			shape: "fencedCode",
		});
	});

	it("resolves a whole $$ math block", () => {
		const open = fixtureLines.indexOf("$$");
		const close = fixtureLines.indexOf("$$", open + 1);
		expect(blockRangeAt(fixture, open + 1)).toEqual({
			startLine: open,
			endLine: close,
			shape: "mathBlock",
		});
	});

	it("resolves the whole quote run of consecutive > lines", () => {
		const text = "> q1\n> q2\n> q3\n\npara\n";
		expect(blockRangeAt(text, 1)).toEqual({
			startLine: 0,
			endLine: 2,
			shape: "quoteRun",
		});
		expect(blockRangeAt(text, 4)).toEqual({
			startLine: 4,
			endLine: 4,
			shape: "paragraph",
		});
	});

	it("resolves each list item as its own block", () => {
		const text = "1. item one\n2. item two\n\n- bullet\n";
		expect(blockRangeAt(text, 0)).toEqual({
			startLine: 0,
			endLine: 0,
			shape: "listItem",
		});
		expect(blockRangeAt(text, 1)).toEqual({
			startLine: 1,
			endLine: 1,
			shape: "listItem",
		});
		expect(blockRangeAt(text, 3)).toEqual({
			startLine: 3,
			endLine: 3,
			shape: "listItem",
		});
	});

	it("resolves each table row as its own block", () => {
		const text = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";
		expect(blockRangeAt(text, 0)).toEqual({
			startLine: 0,
			endLine: 0,
			shape: "tableRow",
		});
		expect(blockRangeAt(text, 1)).toEqual({
			startLine: 1,
			endLine: 1,
			shape: "tableRow",
		});
		expect(blockRangeAt(text, 2)).toEqual({
			startLine: 2,
			endLine: 2,
			shape: "tableRow",
		});
	});

	it("expands paragraphs across non-blank plain lines only", () => {
		const text = "p1\np2\n\np3\n```python\nx\n```\np4\n- item\n> quote\n";
		expect(blockRangeAt(text, 0)).toEqual({
			startLine: 0,
			endLine: 1,
			shape: "paragraph",
		});
		expect(blockRangeAt(text, 3)).toEqual({
			startLine: 3,
			endLine: 3,
			shape: "paragraph",
		});
		expect(blockRangeAt(text, 7)).toEqual({
			startLine: 7,
			endLine: 7,
			shape: "paragraph",
		});
	});

	it("reports the paragraph shape for plain prose", () => {
		const text = "one\ntwo\n";
		expect(blockRangeAt(text, 1)?.shape).toBe("paragraph");
	});

	it("returns null for blank lines and out-of-range lines", () => {
		const text = "a\n\nb\n";
		expect(blockRangeAt(text, 1)).toBeNull();
		expect(blockRangeAt(text, 99)).toBeNull();
		expect(blockRangeAt(text, -1)).toBeNull();
	});

	it("returns null for an empty text", () => {
		expect(blockRangeAt("", 0)).toBeNull();
	});
});

describe("badgeBlockRange", () => {
	const text = [
		"# 标题", // 0
		"", // 1
		"| 表头 | 列 |", // 2
		"| --- | --- |", // 3
		"| pyt\u2062hon | a |", // 4
		"| Hel\u2062lo | b |", // 5
		"", // 6
		"正文一行", // 7
		"",
	].join("\n");

	it("stretches a table row over the whole collapsed block", () => {
		// a Live Preview rendered table collapses its source lines into
		// one block; the badge click passes the block's whole span
		const from = text.indexOf("| 表头");
		const to = text.indexOf("| Hel") + "| Hel\u2062lo | b |".length;
		const badge = badgeBlockRange(text, from, to);
		expect(badge).not.toBeNull();
		expect(badge?.range).toEqual({
			startLine: 2,
			endLine: 5,
			shape: "table",
		});
		expect(badge?.start).toBe(from);
		expect(text.slice(badge!.start, badge!.end)).toContain("pyt\u2062hon");
	});

	it("keeps the single-line range for a single-line block", () => {
		const from = text.indexOf("正文一行");
		const to = from + "正文一行".length;
		const badge = badgeBlockRange(text, from, to);
		expect(badge?.range).toEqual({
			startLine: 7,
			endLine: 7,
			shape: "paragraph",
		});
		expect(badge?.start).toBe(from);
		expect(badge?.end).toBe(to);
	});

	it("keeps a whole-region shape when the block spans the collapsed range", () => {
		const fenced = "```python\nx\u2062\ny\n```\nafter\n";
		const from = 0;
		const to = fenced.indexOf("```", 1) + 3;
		const badge = badgeBlockRange(fenced, from, to);
		expect(badge?.range).toEqual({
			startLine: 0,
			endLine: 3,
			shape: "fencedCode",
		});
	});

	it("resolves a frontmatter span by its offsets", () => {
		const fm = '---\ntitle: "T"\n---\n\nbody\n';
		const badge = badgeBlockRange(fm, 0, fm.indexOf("---", 1) + 3);
		expect(badge?.range).toEqual({
			startLine: 0,
			endLine: 2,
			shape: "frontmatter",
		});
	});

	it("returns null for empty or out-of-document offsets", () => {
		expect(badgeBlockRange(text, 5, 5)).toBeNull();
		expect(badgeBlockRange(text, -1, 5)).toBeNull();
		expect(badgeBlockRange(text, 0, text.length + 1)).toBeNull();
		expect(badgeBlockRange("", 0, 1)).toBeNull();
	});
});
