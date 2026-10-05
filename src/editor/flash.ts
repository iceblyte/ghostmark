/**
 * Transient line flash for jump navigation (find-the-cursor feedback):
 * a StateField holds the flashed range and provides a line decoration;
 * the shell dispatches the effect after a jump and clears it once the
 * CSS pulse animation has run its course. Any document change drops the
 * flash so stale offsets never linger.
 */

import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export const flashEffect = StateEffect.define<{
	from: number;
	to: number;
} | null>();

export const flashField = StateField.define<{
	from: number;
	to: number;
} | null>({
	create: () => null,
	update(value, tr) {
		if (tr.docChanged) return null;
		for (const effect of tr.effects) {
			if (effect.is(flashEffect)) return effect.value;
		}
		return value;
	},
	provide: (field) =>
		EditorView.decorations.compute([field], (state) => {
			const flash = state.field(field);
			if (!flash) return Decoration.none;
			const line = state.doc.lineAt(flash.from);
			return Decoration.set([
				Decoration.line({ class: "gm-flash-line" }).range(line.from),
			]);
		}),
});

const FLASH_MS = 1600;
const flashTimers = new WeakMap<EditorView, number>();

/**
 * Flash the line containing `from` in the editor under `containerEl`
 * (the MarkdownView's container). Re-jumping restarts the pulse; the
 * cleanup timer is tracked per view so quick switches never clear the
 * wrong editor's flash.
 */
export function flashMark(containerEl: HTMLElement, from: number): void {
	const view = EditorView.findFromDOM(containerEl);
	if (!view) return;
	view.dispatch({ effects: flashEffect.of({ from, to: from }) });
	const previous = flashTimers.get(view);
	if (previous !== undefined) window.clearTimeout(previous);
	flashTimers.set(
		view,
		window.setTimeout(() => {
			flashTimers.delete(view);
			view.dispatch({ effects: flashEffect.of(null) });
		}, FLASH_MS),
	);
}
