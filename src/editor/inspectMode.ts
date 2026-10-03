/**
 * Inspect-mode CM6 assembly (design doc §5): a ViewPlugin that renders
 * replace-glyph decorations from the shared scan field whenever the
 * global runtime is enabled. On/off is read from the runtime version
 * field, so every editor state (new or existing) reflects the global
 * switch without per-editor compartments.
 */

import type { Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { Hit } from "../core/categories";
import { hoverExtension } from "./hover";
import {
	inspectHitsField,
	inspectRuntime,
	inspectRuntimeField,
} from "./inspectState";
import { gutterExtension } from "./gutter";
import { GhostWidget } from "./widgets";

function hitsInRange(hits: Hit[], from: number, to: number): Hit[] {
	let lo = 0;
	let hi = hits.length - 1;
	let start = hits.length;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const hit = hits[mid];
		if (hit && hit.index >= from) {
			start = mid;
			hi = mid - 1;
		} else {
			lo = mid + 1;
		}
	}
	const out: Hit[] = [];
	for (let i = start; i < hits.length; i++) {
		const hit = hits[i];
		if (!hit || hit.index >= to) break;
		out.push(hit);
	}
	return out;
}

export function buildDecorations(view: EditorView): DecorationSet {
	if (!inspectRuntime.enabled) return Decoration.none;
	const hits = view.state.field(inspectHitsField, false) ?? [];
	if (hits.length === 0) return Decoration.none;
	const config = inspectRuntime.config;
	if (!config) return Decoration.none;

	const ranges: Array<{ from: number; to: number; deco: Decoration }> = [];
	for (const { from, to } of view.visibleRanges) {
		for (const hit of hitsInRange(hits, from, to)) {
			const widget = new GhostWidget(
				hit.category,
				hit.codepoint,
				hit.count,
				hit.action === "markOnly",
				config.density,
				config.locale,
			);
			ranges.push({
				from: hit.index,
				to: hit.index + hit.length,
				deco: Decoration.replace({ widget, side: 1 }),
			});
		}
	}
	if (ranges.length === 0) return Decoration.none;
	return Decoration.set(
		ranges.map((r) => r.deco.range(r.from, r.to)),
		true,
	);
}

function runtimeChanged(update: ViewUpdate): boolean {
	return (
		update.state.field(inspectRuntimeField, false) !==
		update.startState.field(inspectRuntimeField, false)
	);
}

const decorationsPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (
				update.docChanged ||
				update.viewportChanged ||
				runtimeChanged(update)
			) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
		// replaced zero-width glyphs must be atomic for the cursor
		provide: (plugin) =>
			EditorView.atomicRanges.of(
				(view) => view.plugin(plugin)?.decorations ?? Decoration.none,
			),
	},
);

/** Always-on extension set; gating happens through the runtime field. */
export const INSPECT_EXTENSIONS: Extension[] = [
	inspectRuntimeField,
	inspectHitsField,
	decorationsPlugin,
	hoverExtension,
	gutterExtension,
];
