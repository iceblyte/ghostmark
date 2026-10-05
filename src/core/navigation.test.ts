import { describe, expect, it } from "vitest";
import type { Hit } from "./categories";
import { pickJumpTarget } from "./navigation";

/**
 * Regression tests for the user-acceptance round: "jump to previous
 * never moves". The old rule picked the last hit with index < cursor;
 * after a jump the cursor head rests on that hit's END, so the rule
 * kept re-selecting the very same mark and the command appeared dead.
 */
function hitAt(index: number, length = 1): Hit {
	return {
		index,
		length,
		count: length,
		codepoint: "U+2062",
		category: "invisible",
		block: "prose",
		action: "remove",
		entryId: "U+2062",
	};
}

// marks at offsets 10, 20 and a 44-character base64 token at 30–74
const hits = [hitAt(10), hitAt(20), hitAt(30, 44)];

describe("pickJumpTarget: next", () => {
	it("picks the first hit after the cursor", () => {
		expect(pickJumpTarget(hits, 0, "next")?.index).toBe(10);
		expect(pickJumpTarget(hits, 12, "next")?.index).toBe(20);
	});

	it("skips the hit the cursor rests on at its end", () => {
		// head position after jumping to the token at 30
		expect(pickJumpTarget(hits, 74, "next")).toBeNull();
	});

	it("skips the hit the cursor rests on at its start", () => {
		expect(pickJumpTarget(hits, 20, "next")?.index).toBe(30);
	});

	it("returns null past the last hit (caller wraps)", () => {
		expect(pickJumpTarget(hits, 100, "next")).toBeNull();
	});
});

describe("pickJumpTarget: prev (the reported bug)", () => {
	it("moves off a hit whose end the cursor rests on", () => {
		// THE BUG: the old rule re-selected the token at 30 forever
		expect(pickJumpTarget(hits, 74, "prev")?.index).toBe(20);
	});

	it("moves off a hit whose start the cursor rests on", () => {
		expect(pickJumpTarget(hits, 30, "prev")?.index).toBe(20);
	});

	it("picks the nearest hit strictly before the cursor", () => {
		expect(pickJumpTarget(hits, 100, "prev")?.index).toBe(30);
		expect(pickJumpTarget(hits, 15, "prev")?.index).toBe(10);
	});

	it("returns null before the first hit (caller wraps)", () => {
		expect(pickJumpTarget(hits, 5, "prev")).toBeNull();
	});

	it("handles adjacent chain tokens (end of one = start of next)", () => {
		const chain = [hitAt(0, 44), hitAt(44, 44), hitAt(88, 44)];
		// cursor at the end of the second token → first token, not itself
		expect(pickJumpTarget(chain, 88, "prev")?.index).toBe(0);
		// cursor at the end of the last token → middle token
		expect(pickJumpTarget(chain, 132, "prev")?.index).toBe(44);
	});
});
