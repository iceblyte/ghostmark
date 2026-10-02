/**
 * Block-level parsing: splits a note into frontmatter / fenced code /
 * inline code / math / prose regions (scanner input) and resolves the
 * six-shape block range at a line (FR-13 "clear current block" input).
 * Pure functions — no Obsidian or CodeMirror imports.
 */

import type { BlockType } from "./categories";

export interface BlockSpan {
	type: BlockType;
	/** Code-unit offsets into the text; end is exclusive. */
	start: number;
	end: number;
}

/** A line-level container: frontmatter, a fenced code or a $$ math block. */
export interface LineRegion {
	type: "frontmatter" | "fencedCode" | "math";
	startLine: number;
	endLine: number;
}

export interface BlockMap {
	/** Sorted by start, non-overlapping; everything outside is prose. */
	spans: BlockSpan[];
	regions: LineRegion[];
	lineStarts: number[];
	/** Exclusive end of each line (points at the "\n" or text end). */
	lineEnds: number[];
	lineCount: number;
}

/** The six FR-13 block shapes. */
export type BlockShape =
	| "paragraph"
	| "listItem"
	| "quoteRun"
	| "tableRow"
	| "fencedCode"
	| "mathBlock"
	| "frontmatter";

export interface BlockLineRange {
	startLine: number;
	endLine: number;
	shape: BlockShape;
}

const FENCE_OPEN_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const LIST_RE = /^[ \t]{0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const QUOTE_RE = /^[ \t]{0,3}>/;
const TABLE_RE = /^[ \t]{0,3}\|/;

function fenceCloseRe(ch: string, len: number): RegExp {
	const q = ch === "`" ? "`" : "~";
	return new RegExp(`^[ \\t]{0,3}${q}{${len},}[ \\t]*$`);
}

export function parseBlocks(text: string): BlockMap {
	const lineStarts: number[] = [0];
	const lineEnds: number[] = [];
	for (let i = 0; i < text.length; i++) {
		if (text.charAt(i) === "\n") {
			lineEnds.push(i);
			lineStarts.push(i + 1);
		}
	}
	lineEnds.push(text.length);
	const lineCount = lineStarts.length;

	// Both arrays are built above with exactly lineCount entries, so the
	// fallbacks only satisfy noUncheckedIndexedAccess, never fire in practice.
	const ls = (i: number): number => lineStarts[i] ?? text.length;
	const le = (i: number): number => lineEnds[i] ?? text.length;

	const lineAt = (i: number): string => {
		let s = text.slice(ls(i), le(i));
		if (s.endsWith("\r")) s = s.slice(0, -1);
		return s;
	};

	const spans: BlockSpan[] = [];
	const regions: LineRegion[] = [];
	const lineTypes: (BlockType | null)[] = new Array<BlockType | null>(
		lineCount,
	).fill(null);

	// frontmatter: a "---" first line closed by a later "---" line
	if (lineCount > 0 && lineAt(0).trim() === "---") {
		let close = -1;
		for (let j = 1; j < lineCount; j++) {
			if (lineAt(j).trim() === "---") {
				close = j;
				break;
			}
		}
		if (close !== -1) {
			regions.push({ type: "frontmatter", startLine: 0, endLine: close });
			spans.push({ type: "frontmatter", start: 0, end: le(close) });
			for (let j = 0; j <= close; j++) lineTypes[j] = "frontmatter";
		}
	}
	const fmEnd = regions[0]?.endLine ?? -1;

	// fenced code and $$ math blocks
	let i = fmEnd + 1;
	while (i < lineCount) {
		if (lineTypes[i] !== null) {
			i++;
			continue;
		}
		const line = lineAt(i);
		const open = FENCE_OPEN_RE.exec(line);
		if (open?.[1]) {
			const isClose = fenceCloseRe(open[1].charAt(0), open[1].length);
			let close = -1;
			for (let j = i + 1; j < lineCount; j++) {
				if (isClose.test(lineAt(j))) {
					close = j;
					break;
				}
			}
			const endLine = close === -1 ? lineCount - 1 : close;
			regions.push({ type: "fencedCode", startLine: i, endLine });
			spans.push({
				type: "fencedCode",
				start: ls(i),
				end: le(endLine),
			});
			for (let j = i; j <= endLine; j++) lineTypes[j] = "fencedCode";
			i = endLine + 1;
			continue;
		}
		if (line.trim() === "$$") {
			let close = -1;
			for (let j = i + 1; j < lineCount; j++) {
				if (lineAt(j).trim() === "$$") {
					close = j;
					break;
				}
			}
			const endLine = close === -1 ? lineCount - 1 : close;
			regions.push({ type: "math", startLine: i, endLine });
			spans.push({
				type: "math",
				start: ls(i),
				end: le(endLine),
			});
			for (let j = i; j <= endLine; j++) lineTypes[j] = "math";
			i = endLine + 1;
			continue;
		}
		i++;
	}

	// inline code and math spans inside prose lines
	for (let l = 0; l < lineCount; l++) {
		if (lineTypes[l] !== null) continue;
		collectInlineSpans(text, ls(l), le(l), spans);
	}

	spans.sort((a, b) => a.start - b.start);
	return { spans, regions, lineStarts, lineEnds, lineCount };
}

/** Inline `code` and $math$ spans on one prose line, appended in order. */
function collectInlineSpans(
	text: string,
	lineStart: number,
	lineEnd: number,
	out: BlockSpan[],
): void {
	let line = text.slice(lineStart, lineEnd);
	if (line.endsWith("\r")) line = line.slice(0, -1);
	const n = line.length;
	let i = 0;
	while (i < n) {
		const ch = line.charAt(i);
		if (ch === "`") {
			const close = line.indexOf("`", i + 1);
			if (close > i + 1) {
				out.push({
					type: "inlineCode",
					start: lineStart + i,
					end: lineStart + close + 1,
				});
				i = close + 1;
				continue;
			}
			i++;
			continue;
		}
		if (ch === "$" && (i === 0 || line.charAt(i - 1) !== "\\")) {
			if (line.charAt(i + 1) === "$") {
				const close = line.indexOf("$$", i + 2);
				if (close !== -1) {
					out.push({
						type: "math",
						start: lineStart + i,
						end: lineStart + close + 2,
					});
					i = close + 2;
					continue;
				}
				i += 2;
				continue;
			}
			// inline $...$: opening $ not followed by whitespace, closing $
			// not preceded by whitespace nor followed by a digit (currency).
			if (i + 1 < n && !/\s/.test(line.charAt(i + 1))) {
				let k = i + 2;
				let closed = false;
				while (k < n) {
					if (
						line.charAt(k) === "$" &&
						line.charAt(k - 1) !== "\\" &&
						!/\s/.test(line.charAt(k - 1)) &&
						!(k + 1 < n && /\d/.test(line.charAt(k + 1)))
					) {
						out.push({
							type: "math",
							start: lineStart + i,
							end: lineStart + k + 1,
						});
						i = k + 1;
						closed = true;
						break;
					}
					k++;
				}
				if (closed) continue;
			}
			i++;
			continue;
		}
		i++;
	}
}

/** Block context of a code-unit offset (binary search over spans). */
export function blockTypeAt(map: BlockMap, index: number): BlockType {
	let lo = 0;
	let hi = map.spans.length - 1;
	let ans = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const midSpan = map.spans[mid];
		if (midSpan && midSpan.start <= index) {
			ans = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	if (ans >= 0) {
		const span = map.spans[ans];
		if (span && index < span.end) return span.type;
	}
	return "prose";
}

export function lineText(text: string, map: BlockMap, line: number): string {
	let s = text.slice(
		map.lineStarts[line] ?? text.length,
		map.lineEnds[line] ?? text.length,
	);
	if (s.endsWith("\r")) s = s.slice(0, -1);
	return s;
}

/**
 * Code-unit offsets of a block's content: the start of its first line up
 * to the end of its last line (excluding the trailing newline), ready for
 * slice-scan-clean and an editor transaction.
 */
export function blockRangeToTextRange(
	text: string,
	range: BlockLineRange,
): { start: number; end: number } {
	const map = parseBlocks(text);
	const start = map.lineStarts[range.startLine] ?? 0;
	const end = map.lineEnds[range.endLine] ?? text.length;
	return { start, end };
}

function inRegion(map: BlockMap, line: number): boolean {
	return map.regions.some(
		(r) => line >= r.startLine && line <= r.endLine,
	);
}

/**
 * Six-shape block range at a line (FR-13): frontmatter / fenced code or
 * math block whole, list item (single), quote run, table row (single),
 * blank-line-delimited paragraph. Returns null on a blank line (no block).
 */
export function blockRangeAt(
	text: string,
	lineIndex: number,
): BlockLineRange | null {
	const map = parseBlocks(text);
	if (lineIndex < 0 || lineIndex >= map.lineCount) return null;

	for (const region of map.regions) {
		if (lineIndex >= region.startLine && lineIndex <= region.endLine) {
			return {
				startLine: region.startLine,
				endLine: region.endLine,
				shape:
					region.type === "math"
						? "mathBlock"
						: region.type,
			};
		}
	}

	const line = lineText(text, map, lineIndex);
	if (line.trim() === "") return null;

	if (LIST_RE.test(line)) {
		return { startLine: lineIndex, endLine: lineIndex, shape: "listItem" };
	}

	if (QUOTE_RE.test(line)) {
		let start = lineIndex;
		let end = lineIndex;
		while (start > 0 && QUOTE_RE.test(lineText(text, map, start - 1))) start--;
		while (
			end + 1 < map.lineCount &&
			QUOTE_RE.test(lineText(text, map, end + 1))
		) {
			end++;
		}
		return { startLine: start, endLine: end, shape: "quoteRun" };
	}

	if (TABLE_RE.test(line)) {
		return { startLine: lineIndex, endLine: lineIndex, shape: "tableRow" };
	}

	const isPlainProse = (idx: number): boolean => {
		const l = lineText(text, map, idx);
		if (l.trim() === "") return false;
		if (LIST_RE.test(l) || QUOTE_RE.test(l) || TABLE_RE.test(l)) return false;
		if (inRegion(map, idx)) return false;
		return true;
	};
	let start = lineIndex;
	let end = lineIndex;
	while (start > 0 && isPlainProse(start - 1)) start--;
	while (end + 1 < map.lineCount && isPlainProse(end + 1)) end++;
	return { startLine: start, endLine: end, shape: "paragraph" };
}
