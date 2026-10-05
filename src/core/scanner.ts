/**
 * Scanner: single pass over the text producing Hit[] — codepoint, category,
 * block context and the final action after context modulation (design doc
 * §4.3/§4.4). Pure functions — no Obsidian or CodeMirror imports.
 */

import {
	blockTypeAt,
	parseBlocks,
	type BlockMap,
} from "./blocks";
import {
	formatCodepoint,
	isSkinModifier,
	type BlockType,
	type Hit,
	type HitAction,
	type ResolvedChar,
	type ScanPolicy,
} from "./categories";

export interface ScanOptions {
	/** How hits inside math are treated. Default "markOnly". */
	mathMode?: "markOnly" | "clean";
	/** Convert space-like chars to plain spaces inside code. Default true. */
	codeToSpace?: boolean;
	/** Detect base64 tracking tokens. Default false. */
	base64?: boolean;
}

const BASE64_RUN_RE = /[A-Za-z0-9+/]{20,}={1,2}/g;
const DATA_URI_RE = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
/** The known watermark token shape: [A-Za-z0-9+/]{43} + "=". */
const BASE64_TOKEN_LENGTH = 44;

/**
 * Base64 tracking tokens: runs of ≥20 token characters ending in =
 * padding. A match longer than the 44-character token (a word glued in
 * front of it) marks only the trailing 44 so the glued word survives;
 * each token of a glued chain matches on its own. Data URI payloads are
 * legitimate embedded images and are masked out before matching.
 */
function scanBase64(text: string, map: BlockMap): Hit[] {
	const masked = text.replace(DATA_URI_RE, (m) => " ".repeat(m.length));
	const hits: Hit[] = [];
	for (const match of masked.matchAll(BASE64_RUN_RE)) {
		const length = Math.min(match[0].length, BASE64_TOKEN_LENGTH);
		const index = (match.index ?? 0) + match[0].length - length;
		const block = blockTypeAt(map, index);
		hits.push({
			index,
			length,
			count: length,
			codepoint: "base64",
			category: "base64",
			block,
			action:
				block === "fencedCode" || block === "inlineCode" || block === "math"
					? "markOnly"
					: "remove",
			entryId: "base64",
		});
	}
	return hits;
}

/** Merge two ascending hit lists into one ascending list. */
function mergeByIndex(a: Hit[], b: Hit[]): Hit[] {
	const out: Hit[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const fromA = a[i];
		const fromB = b[j];
		if (!fromA || !fromB) break;
		if (fromA.index <= fromB.index) {
			out.push(fromA);
			i++;
		} else {
			out.push(fromB);
			j++;
		}
	}
	for (; i < a.length; i++) {
		const hit = a[i];
		if (hit) out.push(hit);
	}
	for (; j < b.length; j++) {
		const hit = b[j];
		if (hit) out.push(hit);
	}
	return out;
}

/**
 * Scan text → Hit[]. Space-like chars whose base action is toSpace merge
 * into one run hit per contiguous span (same block context) in prose-like
 * contexts; in code every char converts individually so indentation width
 * survives. A leading U+FEFF is a BOM and never a hit. Skin-tone modifiers
 * adjacent to a ZWJ are synthesized as protected hits (design doc §4.3
 * "the ZWJ and its whole sequence are protected").
 */
export function scan(
	text: string,
	policy: ScanPolicy,
	options: ScanOptions = {},
): Hit[] {
	const mathMode = options.mathMode ?? "markOnly";
	const codeToSpace = options.codeToSpace ?? true;
	const map = parseBlocks(text);
	const hits: Hit[] = [];

	let i = 0;
	while (i < text.length) {
		const cp = text.codePointAt(i);
		if (cp === undefined) break;
		const width = cp > 0xffff ? 2 : 1;

		// A skin modifier next to a ZWJ is protected with the sequence.
		if (isSkinModifier(cp)) {
			const prevIsZwj = i > 0 && text.charCodeAt(i - 1) === 0x200d;
			const nextIsZwj = text.charCodeAt(i + width) === 0x200d;
			if (prevIsZwj || nextIsZwj) {
				const block = blockTypeAt(map, i);
				hits.push(
					makeHit(
						i,
						width,
						1,
						cp,
						{
							category: "semantic",
							action: "keep",
							entryId: formatCodepoint(cp),
						},
						block,
						"keep",
					),
				);
				i += width;
				continue;
			}
		}

		const resolved = policy.get(cp);
		if (!resolved) {
			i += width;
			continue;
		}
		// U+FEFF at the file head is a byte-order mark, never processed.
		if (cp === 0xfeff && i === 0) {
			i += width;
			continue;
		}

		const block = blockTypeAt(map, i);

		if (
			resolved.category === "spaceLike" &&
			resolved.action === "toSpace"
		) {
			const inCode = block === "fencedCode" || block === "inlineCode";
			if (inCode && codeToSpace) {
				// Per-char conversion keeps the original indentation width.
				hits.push(makeHit(i, width, 1, cp, resolved, block, "toSpace"));
				i += width;
				continue;
			}
			// Prose-like run rule: whole run removed when ≥2, isolated → space.
			const run = collectRun(text, policy, map, i, block);
			const action: HitAction =
				block === "math" && mathMode === "markOnly"
					? "markOnly"
					: run.count >= 2
						? "remove"
						: "toSpace";
			hits.push({
				index: i,
				length: run.units,
				count: run.count,
				codepoint: formatCodepoint(cp),
				category: resolved.category,
				block,
				action,
				entryId: resolved.entryId,
			});
			i = run.end;
			continue;
		}

		if (block === "math" && mathMode === "markOnly") {
			hits.push(makeHit(i, width, 1, cp, resolved, block, "markOnly"));
			i += width;
			continue;
		}

		hits.push(makeHit(i, width, 1, cp, resolved, block, resolved.action));
		i += width;
	}
	if (options.base64) {
		return mergeByIndex(hits, scanBase64(text, map));
	}
	return hits;
}

function makeHit(
	index: number,
	length: number,
	count: number,
	cp: number,
	resolved: ResolvedChar,
	block: BlockType,
	action: HitAction,
): Hit {
	return {
		index,
		length,
		count,
		codepoint: formatCodepoint(cp),
		category: resolved.category,
		block,
		action,
		entryId: resolved.entryId,
	};
}

function collectRun(
	text: string,
	policy: ScanPolicy,
	map: BlockMap,
	start: number,
	block: BlockType,
): { end: number; units: number; count: number } {
	let j = start;
	let units = 0;
	let count = 0;
	while (j < text.length) {
		const cp = text.codePointAt(j);
		if (cp === undefined) break;
		const width = cp > 0xffff ? 2 : 1;
		const resolved = policy.get(cp);
		if (!resolved || resolved.category !== "spaceLike") break;
		if (resolved.action !== "toSpace") break;
		if (blockTypeAt(map, j) !== block) break;
		units += width;
		count++;
		j += width;
	}
	return { end: j, units, count };
}
