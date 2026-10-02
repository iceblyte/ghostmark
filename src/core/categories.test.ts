import { describe, expect, it } from "vitest";
import {
	buildScanPolicy,
	classifyUnknownCodepoint,
	DEFAULT_POLICY_ENTRIES,
	formatCodepoint,
	isEmojiSequenceMember,
	parseCodepointId,
} from "./categories";

describe("default policy table", () => {
	it("has 21 rows: 13 red, 5 blue, 3 yellow", () => {
		expect(DEFAULT_POLICY_ENTRIES).toHaveLength(21);
		const byCategory = {
			invisible: 0,
			spaceLike: 0,
			semantic: 0,
		};
		for (const entry of DEFAULT_POLICY_ENTRIES) {
			byCategory[entry.category]++;
		}
		expect(byCategory).toEqual({ invisible: 13, spaceLike: 5, semantic: 3 });
	});

	it("gives every red codepoint the remove action", () => {
		for (const entry of DEFAULT_POLICY_ENTRIES) {
			if (entry.category !== "invisible") continue;
			expect(entry.action).toBe("remove");
			expect(entry.options).toContain("remove");
		}
	});

	it("gives every blue codepoint the toSpace action", () => {
		for (const entry of DEFAULT_POLICY_ENTRIES) {
			if (entry.category !== "spaceLike") continue;
			expect(entry.action).toBe("toSpace");
			expect(entry.options).toContain("toSpace");
		}
	});

	it("hard-locks ZWJ to keep and leaves ZWNJ / variation selectors editable", () => {
		const zwj = DEFAULT_POLICY_ENTRIES.find((e) => e.id === "U+200D");
		expect(zwj?.options).toEqual(["keep"]);

		const zwnj = DEFAULT_POLICY_ENTRIES.find((e) => e.id === "U+200C");
		expect(zwnj?.options).toEqual(["keep", "remove"]);

		const vs = DEFAULT_POLICY_ENTRIES.find((e) => e.id === "U+FE00-FE0F");
		expect(vs?.lo).toBe(0xfe00);
		expect(vs?.hi).toBe(0xfe0f);
	});
});

describe("buildScanPolicy", () => {
	it("expands all 36 covered codepoints including the variation selector range", () => {
		const policy = buildScanPolicy();
		// 20 single codepoints + 16 range codepoints
		expect(policy.size).toBe(36);
		expect(policy.get(0x2062)).toEqual({
			category: "invisible",
			action: "remove",
			entryId: "U+2062",
		});
		expect(policy.get(0xfe0f)).toEqual({
			category: "semantic",
			action: "keep",
			entryId: "U+FE00-FE0F",
		});
		expect(policy.get(0xfe00)?.entryId).toBe("U+FE00-FE0F");
	});

	it("applies per-row overrides", () => {
		const policy = buildScanPolicy(DEFAULT_POLICY_ENTRIES, {
			"U+200C": "remove",
		});
		expect(policy.get(0x200c)?.action).toBe("remove");
		expect(policy.get(0x200d)?.action).toBe("keep");
	});

	it("applies range overrides to every covered codepoint", () => {
		const policy = buildScanPolicy(DEFAULT_POLICY_ENTRIES, {
			"U+FE00-FE0F": "remove",
		});
		expect(policy.get(0xfe00)?.action).toBe("remove");
		expect(policy.get(0xfe0f)?.action).toBe("remove");
	});

	it("appends picked codepoints (FR-9)", () => {
		const policy = buildScanPolicy(
			DEFAULT_POLICY_ENTRIES,
			{},
			[
				{
					codepoint: "U+2065",
					category: "invisible",
					action: "remove",
					name: "(unassigned)",
				},
			],
		);
		expect(policy.get(0x2065)).toEqual({
			category: "invisible",
			action: "remove",
			entryId: "U+2065",
		});
	});
});

describe("codepoint formatting", () => {
	it("formats four-digit and astral codepoints", () => {
		expect(formatCodepoint(0x2062)).toBe("U+2062");
		expect(formatCodepoint(0x061c)).toBe("U+061C");
		expect(formatCodepoint(0x1f3fb)).toBe("U+1F3FB");
	});

	it("round-trips through parseCodepointId", () => {
		expect(parseCodepointId("U+2062")).toBe(0x2062);
		expect(parseCodepointId("U+FE00-FE0F")).toBeNull();
		expect(parseCodepointId("nonsense")).toBeNull();
	});
});

describe("classifyUnknownCodepoint", () => {
	it("suggests remove for format characters", () => {
		expect(classifyUnknownCodepoint(0x00ad)).toEqual({
			category: "invisible",
			action: "remove",
		});
	});

	it("suggests toSpace for space separators", () => {
		expect(classifyUnknownCodepoint(0x2005)).toEqual({
			category: "spaceLike",
			action: "toSpace",
		});
	});

	it("suggests keep for named and unassigned characters", () => {
		expect(classifyUnknownCodepoint(0x03b1)).toEqual({
			category: "semantic",
			action: "keep",
		});
		expect(classifyUnknownCodepoint(0x2065)).toEqual({
			category: "semantic",
			action: "keep",
		});
	});
});

describe("isEmojiSequenceMember", () => {
	it("accepts pictographic, skin modifier, regional indicator and variation selector", () => {
		expect(isEmojiSequenceMember("👨")).toBe(true);
		expect(isEmojiSequenceMember("\u{1F3FB}")).toBe(true);
		expect(isEmojiSequenceMember("\u{1F1E6}")).toBe(true);
		expect(isEmojiSequenceMember("\uFE0F")).toBe(true);
	});

	it("rejects ordinary text characters", () => {
		expect(isEmojiSequenceMember("a")).toBe(false);
		expect(isEmojiSequenceMember("中")).toBe(false);
	});
});
