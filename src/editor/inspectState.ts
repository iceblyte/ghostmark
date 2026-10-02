/**
 * Shared inspect-mode state: the config facet, the full-document scan
 * field and the gutter→command request facet. Kept free of decorations
 * code so hover/gutter can import it without cycles.
 */

import { Facet, StateField } from "@codemirror/state";
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
	/** Display name for a policy entry id (i18n table or a picked name). */
	nameFor: (entryId: string) => string;
}

/** Current policy/density/locale bundle, reconfigurable at runtime. */
export const inspectConfigFacet = Facet.define<
	InspectConfig,
	InspectConfig | null
>({
	combine: (values) => values.at(-1) ?? null,
});

/**
 * Full-document scan result, recomputed on doc or config changes. One scan
 * per transaction feeds decorations, hover and gutter (design doc §5:
 * full scan + viewport-filtered decoration).
 */
export const inspectHitsField = StateField.define<Hit[]>({
	create: () => [],
	update(hits, tr) {
		if (
			!tr.docChanged &&
			tr.startState.facet(inspectConfigFacet) ===
				tr.state.facet(inspectConfigFacet)
		) {
			return hits;
		}
		const config = tr.state.facet(inspectConfigFacet);
		if (!config) return [];
		return scan(tr.state.doc.toString(), config.policy, {
			mathMode: config.mathMode,
			codeToSpace: config.codeToSpace,
		});
	},
});

/**
 * Provided by the shell once the clear-current-block command exists
 * (FR-13): gutter badge clicks request a block clear for a 0-based line.
 */
export const clearBlockRequestFacet = Facet.define<
	(view: EditorView, lineIndex: number) => void
>();
