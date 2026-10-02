/**
 * Character classification, the default policy table and codepoint metadata.
 * Pure data and functions — no Obsidian or CodeMirror imports (design doc §2).
 */

/** What the cleaner may do with a hit. */
export type Action = "remove" | "toSpace" | "keep";

/** Final action after context rules may downgrade a hit to mark-only. */
export type HitAction = Action | "markOnly";

/** Red / blue / yellow in the UI color system. */
export type Category = "invisible" | "spaceLike" | "semantic";

/** Context a hit occurs in, produced by blocks.ts. */
export type BlockType =
	| "frontmatter"
	| "fencedCode"
	| "inlineCode"
	| "math"
	| "prose";

/** One row of the default policy table (a codepoint or a closed range). */
export interface PolicyEntry {
	/** Display id: "U+2062" for singles, "U+FE00-FE0F" for ranges. */
	id: string;
	lo: number;
	hi: number;
	category: Category;
	/** Base action before context modulation. */
	action: Action;
	/** Official English Unicode name (or a range label). */
	name: string;
	/** Actions offered for this row in settings; a single option is locked. */
	options: Action[];
}

/** A user-added codepoint (FR-9 pick), serializable into settings. */
export interface CharPolicy {
	codepoint: string;
	category: Category;
	action: Action;
	name: string;
}

/** A hit of the scanner: one suspicious span with its final action. */
export interface Hit {
	/** Code-unit offset in the scanned text. */
	index: number;
	/** Length in code units (space runs are >1). */
	length: number;
	/** Number of codepoints covered (differs from length for astral chars). */
	count: number;
	/** "U+XXXX" of the first codepoint. */
	codepoint: string;
	category: Category;
	block: BlockType;
	/** Final action after context modulation. */
	action: HitAction;
	/** Policy row this hit resolved to. */
	entryId: string;
}

/** Counts of actually applied changes (removed or converted codepoints). */
export interface ChangeReport {
	total: number;
	byCodepoint: Record<string, number>;
	byCategory: Record<Category, number>;
}

/** A codepoint resolved against the policy table. */
export interface ResolvedChar {
	category: Category;
	action: Action;
	entryId: string;
}

/** Codepoint → resolution, the scanner's lookup input. */
export type ScanPolicy = Map<number, ResolvedChar>;

const RED_OPTIONS: Action[] = ["remove", "toSpace", "keep"];
const BLUE_OPTIONS: Action[] = ["toSpace", "remove", "keep"];
const KEEP_REMOVE_OPTIONS: Action[] = ["keep", "remove"];

function single(
	cp: number,
	category: Category,
	action: Action,
	name: string,
	options: Action[],
): PolicyEntry {
	return {
		id: formatCodepoint(cp),
		lo: cp,
		hi: cp,
		category,
		action,
		name,
		options,
	};
}

/**
 * The default policy table (design doc §4.2), ordered as in the settings
 * prototype P8: 13 red, 5 blue, 3 yellow rows = 21 default rows.
 */
export const DEFAULT_POLICY_ENTRIES: PolicyEntry[] = [
	single(0x200b, "invisible", "remove", "ZERO WIDTH SPACE", RED_OPTIONS),
	single(0x2060, "invisible", "remove", "WORD JOINER", RED_OPTIONS),
	single(0x2061, "invisible", "remove", "FUNCTION APPLICATION", RED_OPTIONS),
	single(0x2062, "invisible", "remove", "INVISIBLE TIMES", RED_OPTIONS),
	single(0x2063, "invisible", "remove", "INVISIBLE SEPARATOR", RED_OPTIONS),
	single(0x2064, "invisible", "remove", "INVISIBLE PLUS", RED_OPTIONS),
	single(0x061c, "invisible", "remove", "ARABIC LETTER MARK", RED_OPTIONS),
	single(
		0x180e,
		"invisible",
		"remove",
		"MONGOLIAN VOWEL SEPARATOR",
		RED_OPTIONS,
	),
	single(0x200e, "invisible", "remove", "LEFT-TO-RIGHT MARK", RED_OPTIONS),
	single(0x200f, "invisible", "remove", "RIGHT-TO-LEFT MARK", RED_OPTIONS),
	single(0xfffe, "invisible", "remove", "NOT A CHARACTER", RED_OPTIONS),
	single(0xffff, "invisible", "remove", "NOT A CHARACTER", RED_OPTIONS),
	single(
		0xfeff,
		"invisible",
		"remove",
		"ZERO WIDTH NO-BREAK SPACE",
		RED_OPTIONS,
	),
	single(0x2002, "spaceLike", "toSpace", "EN SPACE", BLUE_OPTIONS),
	single(0x2009, "spaceLike", "toSpace", "THIN SPACE", BLUE_OPTIONS),
	single(0x2007, "spaceLike", "toSpace", "FIGURE SPACE", BLUE_OPTIONS),
	single(
		0x202f,
		"spaceLike",
		"toSpace",
		"NARROW NO-BREAK SPACE",
		BLUE_OPTIONS,
	),
	single(0x00a0, "spaceLike", "toSpace", "NO-BREAK SPACE", BLUE_OPTIONS),
	// ZWJ is hard-locked to keep: emoji semantics must never be cleaned.
	single(0x200d, "semantic", "keep", "ZERO WIDTH JOINER", ["keep"]),
	single(0x200c, "semantic", "keep", "ZERO WIDTH NON-JOINER", KEEP_REMOVE_OPTIONS),
	{
		id: "U+FE00-FE0F",
		lo: 0xfe00,
		hi: 0xfe0f,
		category: "semantic",
		action: "keep",
		name: "VARIATION SELECTORS",
		options: KEEP_REMOVE_OPTIONS,
	},
];

/** "U+XXXX" (minimum four hex digits, uppercase). */
export function formatCodepoint(cp: number): string {
	return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function parseCodepointId(id: string): number | null {
	if (!id.startsWith("U+")) return null;
	const hex = id.slice(2);
	if (!/^[0-9A-Fa-f]+$/.test(hex)) return null;
	const value = Number.parseInt(hex, 16);
	return Number.isNaN(value) ? null : value;
}

/**
 * Expand the default table, per-row overrides and picked codepoints into
 * the flat codepoint → resolution map the scanner consumes.
 *
 * @param overrides keyed by PolicyEntry.id, e.g. { "U+200C": "remove" }.
 */
export function buildScanPolicy(
	entries: PolicyEntry[] = DEFAULT_POLICY_ENTRIES,
	overrides: Record<string, Action> = {},
	customs: CharPolicy[] = [],
): ScanPolicy {
	const policy: ScanPolicy = new Map();
	for (const entry of entries) {
		// Locked rows (ZWJ) ignore overrides — protection is hard-wired.
		const override = overrides[entry.id];
		const action =
			override && entry.options.length > 1 ? override : entry.action;
		const resolved: ResolvedChar = {
			category: entry.category,
			action,
			entryId: entry.id,
		};
		for (let cp = entry.lo; cp <= entry.hi; cp++) {
			policy.set(cp, resolved);
		}
	}
	for (const custom of customs) {
		const cp = parseCodepointId(custom.codepoint);
		if (cp === null) continue;
		policy.set(cp, {
			category: custom.category,
			action: custom.action,
			entryId: custom.codepoint,
		});
	}
	return policy;
}

/**
 * Category-based suggested action for a codepoint that is not in the policy
 * table (FR-9): invisible → remove, space-like → toSpace, else keep.
 * "Else" includes unassigned codepoints — never delete what we cannot name.
 */
export function classifyUnknownCodepoint(cp: number): {
	category: Category;
	action: Action;
} {
	const ch = String.fromCodePoint(cp);
	if (/\p{Zs}/u.test(ch)) return { category: "spaceLike", action: "toSpace" };
	if (/\p{Cf}/u.test(ch)) return { category: "invisible", action: "remove" };
	return { category: "semantic", action: "keep" };
}

const EMOJI_MEMBER_RE =
	/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\p{Regional_Indicator}\u{FE00}-\u{FE0F}]/u;

/** Whether ch can take part in an emoji ZWJ sequence (design doc §4.3). */
export function isEmojiSequenceMember(ch: string): boolean {
	return EMOJI_MEMBER_RE.test(ch);
}

/** Official names for skin-tone modifiers, which have no policy row. */
export const SKIN_MODIFIER_NAMES: Record<number, string> = {
	0x1f3fb: "EMOJI MODIFIER FITZPATRICK TYPE-1-2",
	0x1f3fc: "EMOJI MODIFIER FITZPATRICK TYPE-3",
	0x1f3fd: "EMOJI MODIFIER FITZPATRICK TYPE-4",
	0x1f3fe: "EMOJI MODIFIER FITZPATRICK TYPE-5",
	0x1f3ff: "EMOJI MODIFIER FITZPATRICK TYPE-6",
};

export function isSkinModifier(cp: number): boolean {
	return cp >= 0x1f3fb && cp <= 0x1f3ff;
}
