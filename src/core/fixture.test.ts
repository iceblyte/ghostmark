import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
