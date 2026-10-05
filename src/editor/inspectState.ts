/**
 * Shared inspect-mode runtime state. The plugin owns a single mutable
 * runtime (enabled + config, bumped version); a version-counter StateField
 * snapshots the version when an editor state is created, so NEW editors
 * come up in the correct state automatically, and runtime changes are
 * propagated to existing editors with a plain effect.
 */

import { Facet, StateEffect, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Hit, ScanPolicy } from "../core/categories";
import type { Locale } from "../core/i18n";
import { scan } from "../core/scanner";
import type { Density } from "./widgets";

export interface InspectConfig {
	policy: ScanPolicy;
	density: Density;
	locale: Locale;
	mathMode: "markOnly" | "clean";
	codeToSpace: boolean;
	/** Purple-mark base64 tracking tokens (settings toggle). */
	base64: boolean;
	/** Display name for a policy entry id (i18n table or a picked name). */
	nameFor: (entryId: string) => string;
}

/**
 * Global runtime, owned by the plugin shell. Mutation goes through
 * setInspectRuntime(), which also bumps the version the field snapshots.
 */
export const inspectRuntime: {
	enabled: boolean;
	config: InspectConfig | null;
	version: number;
} = { enabled: false, config: null, version: 0 };

export function setInspectRuntime(enabled: boolean, config: InspectConfig) {
	inspectRuntime.enabled = enabled;
	inspectRuntime.config = config;
	inspectRuntime.version += 1;
}

/** Dispatched to existing editors after setInspectRuntime(); carries the version. */
export const inspectRuntimeEffect = StateEffect.define<number>();

/** Version of the runtime this state was created with / last synced to. */
export const inspectRuntimeField = StateField.define<number>({
	create: () => inspectRuntime.version,
	update(value, tr) {
		for (const e of tr.effects) {
			if (e.is(inspectRuntimeEffect)) return e.value;
		}
		return value;
	},
});

function scanState(state: {
	doc: { toString(): string };
}): Hit[] {
	const config = inspectRuntime.config;
	if (!config || !inspectRuntime.enabled) return [];
	return scan(state.doc.toString(), config.policy, {
		mathMode: config.mathMode,
		codeToSpace: config.codeToSpace,
		base64: config.base64,
	});
}

/**
 * Full-document scan result, recomputed on doc or runtime changes. One
 * scan per transaction feeds decorations, hover and gutter (design doc
 * §5: full scan + viewport-filtered decoration).
 */
export const inspectHitsField = StateField.define<Hit[]>({
	create: scanState,
	update(hits, tr) {
		const versionChanged =
			tr.state.field(inspectRuntimeField, false) !==
			tr.startState.field(inspectRuntimeField, false);
		if (!tr.docChanged && !versionChanged) return hits;
		return scanState(tr.state);
	},
});

/**
 * Provided by the shell (FR-13): gutter badge clicks request a block
 * clear for a 0-based line.
 */
export const clearBlockRequestFacet = Facet.define<
	(view: EditorView, lineIndex: number) => void
>();

/**
 * Provided by the shell: base64 widget clicks request a single-segment
 * clear for that hit (explicit intent — allowed even for mark-only
 * tokens inside code).
 */
export const clearHitRequestFacet = Facet.define<
	(view: EditorView, hit: Hit) => void
>();

/**
 * Pushed by the shell on layout changes: whether this leaf is in Live
 * Preview (the properties widget covers the frontmatter, so marks
 * inside it are invisible and the summary badge applies). Read by the
 * decoration layer; the shell owns the detection.
 */
export const frontmatterBadgeEffect = StateEffect.define<boolean>();

export const frontmatterBadgeField = StateField.define<boolean>({
	create: () => false,
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(frontmatterBadgeEffect)) return effect.value;
		}
		return value;
	},
});
