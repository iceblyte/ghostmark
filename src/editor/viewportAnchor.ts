/**
 * Keep the viewport anchored across transactions that would otherwise
 * scroll it: undo/redo, and the plugin's own clear transactions.
 *
 * - Undo/redo: CodeMirror's history commands dispatch with
 *   `scrollIntoView: true` (see @codemirror/commands history.ts
 *   pop()), so undoing a clear far from the cursor yanks the restored
 *   selection — the original cursor position — back into view.
 * - Clear transactions: the host reveals the caret after the update on
 *   its own schedule. Restoring via editor.scrollTo lands on the
 *   host's schedule too — one paint after the caret reveal it is
 *   meant to cancel — so the user saw a single frame flash at the
 *   cursor whenever the cursor sat outside the viewport.
 *
 * Why a scroll listener and not rAF: within one frame the browser
 * runs the rAF callbacks first and the "scroll the focused editable's
 * caret into view" step afterwards — still before that frame's paint.
 * A revert written in rAF therefore always paints one frame late (the
 * flash), while a scroll event fired by that reveal step is
 * dispatched before the paint, so reverting inside the listener beats
 * it. The rAF loop stays as a backstop for scrolls that fire no event
 * before paint, and the anchor releases once nothing has fought back
 * for a few frames.
 *
 * Always-on: undo works with inspect mode off.
 */

import { Transaction, type Extension } from "@codemirror/state";
import { ViewPlugin, type ViewUpdate } from "@codemirror/view";

/** undo, redo and the selection-only variants (userEvent values). */
const UNDO_EVENT_RE = /^(?:undo|redo|select\.undo|select\.redo)$/;

/** CM6's history transactions mark themselves via userEvent. */
export function isUndoLikeTransaction(tr: Transaction): boolean {
	const event = tr.annotation(Transaction.userEvent);
	return event !== undefined && UNDO_EVENT_RE.test(event);
}

/**
 * Pending clear guards: applyCleanedChanges sets one right before
 * editor.transaction and the same synchronous dispatch consumes it —
 * no await in between, so no other document change can slip in.
 */
let pendingPins = 0;

/** Pin the viewport across the next document-changing transaction. */
export function pinViewportAcrossNextTransaction(): void {
	pendingPins += 1;
}

/** Release the anchor after this many frames without a fight. */
const CALM_FRAMES = 4;
/** Hard cap: never fight the user's scrolling for more than ~0.5s. */
const MAX_FRAMES = 30;

export const viewportAnchorExtension: Extension = ViewPlugin.fromClass(
	class {
		private pending = 0;
		private detach: (() => void) | null = null;

		update(update: ViewUpdate): void {
			let anchor = false;
			for (const tr of update.transactions) {
				if (isUndoLikeTransaction(tr)) anchor = true;
				if (tr.docChanged && pendingPins > 0) {
					pendingPins -= 1;
					anchor = true;
				}
			}
			if (!anchor) return;
			this.startAnchor(update.view.scrollDOM);
		}

		/**
		 * Revert any scroll away from the captured position — from the
		 * scroll listener (pre-paint, kills the flash frame) and from
		 * rAF (backstop) — until the caret reveal has settled.
		 */
		private startAnchor(scrollDOM: HTMLElement): void {
			this.stopAnchor();
			const top = scrollDOM.scrollTop;
			const left = scrollDOM.scrollLeft;

			const revert = (): boolean => {
				let moved = false;
				if (scrollDOM.scrollTop !== top) {
					scrollDOM.scrollTop = top;
					moved = true;
				}
				if (scrollDOM.scrollLeft !== left) {
					scrollDOM.scrollLeft = left;
					moved = true;
				}
				return moved;
			};

			let calm = 0;
			const onScroll = (): void => {
				// only a real fight resets the calm counter — the echo
				// event fired by our own revert write finds nothing to do
				if (revert()) calm = 0;
			};
			scrollDOM.addEventListener("scroll", onScroll, { passive: true });

			let frames = 0;
			const tick = (): void => {
				frames += 1;
				if (revert()) calm = 0;
				else calm += 1;
				if (calm >= CALM_FRAMES || frames >= MAX_FRAMES) {
					this.stopAnchor();
					return;
				}
				this.pending = window.requestAnimationFrame(tick);
			};
			this.pending = window.requestAnimationFrame(tick);

			this.detach = (): void => {
				scrollDOM.removeEventListener("scroll", onScroll);
				window.cancelAnimationFrame(this.pending);
			};
		}

		private stopAnchor(): void {
			this.detach?.();
			this.detach = null;
		}

		destroy(): void {
			this.stopAnchor();
		}
	},
);
