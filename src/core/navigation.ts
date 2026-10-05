/**
 * Jump-target selection for mark navigation (mark-navigation spec).
 * Pure functions over Hit[] — no Obsidian or CodeMirror imports — so
 * the skip/wrap rules stay unit-testable (NFR-5).
 */

import type { Hit } from "./categories";

export type JumpDirection = "next" | "prev";

/**
 * The hit to jump to, or null when none qualifies (the caller wraps to
 * the first/last hit). Hits are disjoint and ascending.
 *
 * A hit the cursor sits ON — at either edge, which is the normal state
 * right after a jump (head rests on the hit's end) — is skipped:
 * "next" requires index > cursor and "previous" requires the hit to end
 * strictly before the cursor. Otherwise "previous" from the end of hit
 * K would re-select K forever and appear dead.
 */
export function pickJumpTarget(
	hits: Hit[],
	cursor: number,
	direction: JumpDirection,
): Hit | null {
	if (direction === "next") {
		for (const hit of hits) {
			if (hit.index > cursor) return hit;
		}
		return null;
	}
	let target: Hit | null = null;
	for (const hit of hits) {
		if (hit.index + hit.length < cursor) {
			target = hit;
		} else {
			break;
		}
	}
	return target;
}

/**
 * Live Preview replaces the frontmatter with Obsidian's properties
 * widget — decorations, selections and scroll targets inside it are
 * invisible, so navigation must skip frontmatter hits there or the
 * jump appears dead. Source mode renders them normally and keeps them
 * navigable. Clearing is unaffected either way (the scan stays whole).
 */
export function filterNavigable(
	hits: Hit[],
	hideFrontmatter: boolean,
): Hit[] {
	if (!hideFrontmatter) return hits;
	return hits.filter((hit) => hit.block !== "frontmatter");
}
