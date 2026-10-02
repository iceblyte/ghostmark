/**
 * Inspect-mode CM6 assembly (design doc §5): a ViewPlugin that scans the
 * document and renders replace-glyph decorations, toggled per editor via a
 * shared Compartment. Global on/off state lives in the plugin shell, which
 * keeps every markdown editor in sync (layout-change).
 */

import { Compartment, Facet, type Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { Hit, ScanPolicy } from "../core/categories";
import type { Locale } from "../core/i18n";
import { scan } from "../core/scanner";
import { GhostWidget, type Density } from "./widgets";

export interface InspectConfig {
	policy: ScanPolicy;
	density: Density;
	locale: Locale;
	mathMode: "markOnly" | "clean";
	codeToSpace: boolean;
}

/** Current policy/density/locale bundle, reconfigurable at runtime. */
export const inspectConfigFacet = Facet.define<
	InspectConfig,
	InspectConfig | null
>({
	combine: (values) => values.at(-1) ?? null,
});

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
	const config = view.state.facet(inspectConfigFacet);
	if (!config) return Decoration.none;
	const text = view.state.doc.toString();
	const hits = scan(text, config.policy, {
		mathMode: config.mathMode,
		codeToSpace: config.codeToSpace,
	});
	if (hits.length === 0) return Decoration.none;

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
				update.startState.facet(inspectConfigFacet) !==
					update.state.facet(inspectConfigFacet)
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

/** Extension set applied while inspect mode is on (hover/gutter join later). */
export const INSPECT_ON_EXTENSIONS: Extension[] = [decorationsPlugin];
export const INSPECT_OFF_EXTENSIONS: Extension[] = [];

/** Shared compartment so the shell can toggle every editor at once. */
export const inspectCompartment = new Compartment();

/** Compartment carrying the facet input, so settings updates propagate. */
export const inspectConfigCompartment = new Compartment();

export function configureInspect(view: EditorView, on: boolean): void {
	const next = on ? INSPECT_ON_EXTENSIONS : INSPECT_OFF_EXTENSIONS;
	if (inspectCompartment.get(view.state) === next) return;
	view.dispatch({ effects: inspectCompartment.reconfigure(next) });
}
