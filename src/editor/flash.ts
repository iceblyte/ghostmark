/**
 * Jump application + transient mark flash (find-the-cursor feedback,
 * Word/飞书-search style: only the mark's exact range lights up).
 *
 * The jump is applied as ONE CodeMirror transaction — selection, native
 * centered scrollIntoView and the flash effect — so nothing can split
 * selection from scroll (the file-start wrap jump crosses the whole
 * document and is exactly where wrapper quirks showed). The flash value
 * carries a monotonically increasing generation; the decoration layer
 * compares it in widget eq(), so the matching widget is rebuilt on every
 * jump and the CSS pulse restarts even within the same paragraph.
 */

import { StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export interface JumpFlash {
	from: number;
	to: number;
	/** Increments on every flash so the widget's eq() always differs. */
	gen: number;
}

export const flashEffect = StateEffect.define<JumpFlash | null>();

export const flashField = StateField.define<JumpFlash | null>({
	create: () => null,
	update(value, tr) {
		if (tr.docChanged) return null;
		for (const effect of tr.effects) {
			if (effect.is(flashEffect)) return effect.value;
		}
		return value;
	},
});

const FLASH_MS = 1600;
const flashTimers = new WeakMap<EditorView, number>();
let flashGen = 0;

/**
 * Select from–to, center it in the view and flash the mark — in one
 * transaction. Returns false when no CodeMirror view lives under
 * `containerEl` (the caller then falls back to the editor wrapper).
 */
export function applyJumpAndFlash(
	containerEl: HTMLElement,
	from: number,
	to: number,
): boolean {
	const view = EditorView.findFromDOM(containerEl);
	if (!view) return false;
	const gen = ++flashGen;
	view.dispatch({
		selection: { anchor: from, head: to },
		effects: [
			EditorView.scrollIntoView(from, { y: "center" }),
			flashEffect.of({ from, to, gen }),
		],
	});
	const previous = flashTimers.get(view);
	if (previous !== undefined) window.clearTimeout(previous);
	flashTimers.set(
		view,
		window.setTimeout(() => {
			flashTimers.delete(view);
			view.dispatch({ effects: flashEffect.of(null) });
		}, FLASH_MS),
	);
	return true;
}
