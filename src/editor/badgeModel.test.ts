import { describe, expect, it } from "vitest";
import type { Hit } from "../core/categories";
import {
	badgeSegments,
	badgeVariant,
	badgeWidthPx,
	MIN_BADGE_GUTTER,
} from "./badgeModel";

function hit(
	category: Hit["category"],
	count: number,
	action: Hit["action"] = "remove",
): Hit {
	return {
		index: 0,
		length: count,
		count,
		codepoint: "U+0000",
		category,
		block: "prose",
		action,
		entryId: "U+0000",
	};
}

describe("badgeSegments", () => {
	it("splits three colors into ordered segments with their counts", () => {
		const segments = badgeSegments([
			hit("invisible", 4),
			hit("spaceLike", 22),
			hit("semantic", 1, "keep"),
		]);
		expect(segments).toEqual([
			{ color: "red", count: 4 },
			{ color: "blue", count: 22 },
			{ color: "yellow", count: 1 },
		]);
	});

	it("renders only the colors present (one or two)", () => {
		expect(badgeSegments([hit("semantic", 5, "keep")])).toEqual([
			{ color: "yellow", count: 5 },
		]);
		expect(
			badgeSegments([hit("invisible", 2), hit("semantic", 3, "keep")]),
		).toEqual([
			{ color: "red", count: 2 },
			{ color: "yellow", count: 3 },
		]);
	});

	it("merges same-color hits of different codepoints", () => {
		const segments = badgeSegments([
			hit("invisible", 1),
			hit("invisible", 2),
		]);
		expect(segments).toEqual([{ color: "red", count: 3 }]);
	});
});

describe("badgeWidthPx", () => {
	it("never goes below the gutter floor", () => {
		expect(badgeWidthPx([])).toBe(MIN_BADGE_GUTTER);
		expect(badgeWidthPx([{ color: "red", count: 1 }])).toBe(
			MIN_BADGE_GUTTER,
		);
	});

	it("grows for multi-digit and multi-segment badges", () => {
		const twoSegments = badgeWidthPx([
			{ color: "red", count: 10 },
			{ color: "blue", count: 32 },
		]);
		const threeSegments = badgeWidthPx([
			{ color: "red", count: 10 },
			{ color: "blue", count: 32 },
			{ color: "yellow", count: 4 },
		]);
		expect(twoSegments).toBeGreaterThan(MIN_BADGE_GUTTER);
		expect(threeSegments).toBeGreaterThan(twoSegments);
	});

	it("keeps per-line segment widths bounded by the doc maximum", () => {
		const widest = [
			{ color: "red", count: 100 },
			{ color: "blue", count: 32 },
		];
		expect(badgeWidthPx(widest)).toBeGreaterThan(
			badgeWidthPx([{ color: "red", count: 1 }]),
		);
	});
});

describe("badgeVariant", () => {
	it("prefers clear when any removal exists", () => {
		const info = badgeVariant([
			hit("invisible", 3),
			hit("spaceLike", 8, "remove"),
			hit("semantic", 2, "keep"),
		]);
		expect(info.variant).toBe("clear");
		expect(info.actionedCount).toBe(11);
		expect(info.totalCount).toBe(13);
	});

	it("reports space when only conversions exist", () => {
		const info = badgeVariant([hit("spaceLike", 1, "toSpace")]);
		expect(info.variant).toBe("space");
		expect(info.actionedCount).toBe(1);
	});

	it("reports passive for keep and mark-only lines", () => {
		const info = badgeVariant([
			hit("semantic", 2, "keep"),
			hit("invisible", 3, "markOnly"),
		]);
		expect(info.variant).toBe("passive");
		expect(info.actionedCount).toBe(0);
		expect(info.totalCount).toBe(5);
	});
});
