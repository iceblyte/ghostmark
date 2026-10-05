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
import {
	badgeSegments,
	badgeWidthPx,
	MIN_BADGE_GUTTER,
} from "./badgeModel";
import { hoverExtension } from "./hover";
import { flashField } from "./flash";
import {
	clearHitRequestFacet,
	inspectHitsField,
	inspectRuntime,
	inspectRuntimeField,
} from "./inspectState";
import { gutterExtension } from "./gutter";
import { GhostWidget } from "./widgets";

/**
 * Size the badge gutter for the widest badge in the whole document (not
 * just the viewport) so widths never change while scrolling; applied as
 * a CSS variable on the editor root.
 */
function updateGutterWidth(view: EditorView): void {
	const hits = view.state.field(inspectHitsField, false) ?? [];
	const doc = view.state.doc;
	const perLine = new Map<number, Hit[]>();
	for (const hit of hits) {
		const from = doc.lineAt(hit.index).from;
		const list = perLine.get(from);
		if (list) list.push(hit);
		else perLine.set(from, [hit]);
	}
	let max = MIN_BADGE_GUTTER;
	for (const list of perLine.values()) {
		max = Math.max(max, badgeWidthPx(badgeSegments(list)));
	}
	view.dom.setCssProps({ "--gm-gutter-width": `${max}px` });
}

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
	const flash = view.state.field(flashField, false);

	const ranges: Array<{ from: number; to: number; deco: Decoration }> = [];
	for (const { from, to } of view.visibleRanges) {
		for (const hit of hitsInRange(hits, from, to)) {
			// base64 glyphs clear their own segment on click; the facet is
			// read at click time so the shell wiring stays fresh
			const onClear =
				hit.category === "base64"
					? () => {
							for (const request of view.state.facet(clearHitRequestFacet)) {
								request(view, hit);
							}
						}
					: undefined;
			// the flashed mark pulses: its generation rides into the widget
			// so eq() differs and the CSS animation restarts every time
			const flashGen =
				flash && flash.from === hit.index && flash.to === hit.index + hit.length
					? flash.gen
					: 0;
			const widget = new GhostWidget(
				hit.category,
				hit.codepoint,
				hit.count,
				hit.action === "markOnly",
				config.density,
				config.locale,
				flashGen,
				onClear,
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

function flashChanged(update: ViewUpdate): boolean {
	return (
		update.state.field(flashField, false) !==
		update.startState.field(flashField, false)
	);
}

const decorationsPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			updateGutterWidth(view);
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (
				update.docChanged ||
				runtimeChanged(update)
			) {
				updateGutterWidth(update.view);
			}
			if (
				update.docChanged ||
				update.viewportChanged ||
				runtimeChanged(update) ||
				flashChanged(update)
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
	// jump-navigation line flash; renders only when the shell dispatches it
	flashField,
];
