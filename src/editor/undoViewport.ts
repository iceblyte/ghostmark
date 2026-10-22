/**
 * Keep the viewport anchored across undo/redo (Ctrl+Z / Ctrl+Y).
 *
 * CodeMirror's history commands dispatch their transactions with
 * `scrollIntoView: true` (see @codemirror/commands history.ts pop()),
 * so undoing a clear that happened far from the cursor yanks the
 * restored selection — the original cursor position — back into view:
 * exactly the jump the clear-transaction fix removed, on the undo
 * path. The pre-update scroll is read in the update listener (plugin
 * updates run before the measure phase applies scroll effects) and
 * re-asserted on the next frame. If the restored selection is already
 * visible, nothing scrolls and the restore is a no-op.
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

export const undoViewportExtension: Extension = ViewPlugin.fromClass(
	class {
		pending = 0;

		update(update: ViewUpdate): void {
			let undoLike = false;
			for (const tr of update.transactions) {
				if (isUndoLikeTransaction(tr)) {
					undoLike = true;
					break;
				}
			}
			if (!undoLike) return;
			const scrollDOM = update.view.scrollDOM;
			const top = scrollDOM.scrollTop;
			const left = scrollDOM.scrollLeft;
			window.cancelAnimationFrame(this.pending);
			this.pending = window.requestAnimationFrame(() => {
				if (scrollDOM.scrollTop !== top) scrollDOM.scrollTop = top;
				if (scrollDOM.scrollLeft !== left) scrollDOM.scrollLeft = left;
			});
		}

		destroy(): void {
			window.cancelAnimationFrame(this.pending);
		}
	},
);
