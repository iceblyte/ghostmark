/**
 * Hover detail tooltip (FR-4, prototype P1): name, codepoint, category,
 * contextual note and suggested action, rendered with the prototype's
 * tooltip structure.
 */

import { hoverTooltip } from "@codemirror/view";
import {
	isSkinModifier,
	parseCodepointId,
	type Hit,
} from "../core/categories";
import { t } from "../core/i18n";
import {
	inspectHitsField,
	inspectRuntime,
	inspectRuntimeField,
	type InspectConfig,
} from "./inspectState";
import { colorClass } from "./badgeModel";

function hitAt(hits: Hit[], pos: number): Hit | null {
	let lo = 0;
	let hi = hits.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const hit = hits[mid];
		if (!hit) return null;
		if (pos < hit.index) {
			hi = mid - 1;
		} else if (pos >= hit.index + hit.length) {
			lo = mid + 1;
		} else {
			return hit;
		}
	}
	return null;
}

function noteFor(hit: Hit): string | null {
	if (hit.category === "base64") return "note.base64";
	const cp = parseCodepointId(hit.entryId);
	if (cp !== null && isSkinModifier(cp)) return "note.skin";
	if (hit.entryId === "U+200D") return "note.zwj";
	if (hit.block === "math") return null;
	if (
		hit.category === "spaceLike" &&
		(hit.block === "fencedCode" || hit.block === "inlineCode")
	) {
		return "note.codespace";
	}
	if (hit.category === "spaceLike" && hit.count >= 2) return "note.run";
	return null;
}

export function buildHoverDom(hit: Hit, config: InspectConfig): HTMLElement {
	const root = createDiv({ cls: "gm-hover" });
	root.createEl("b", { text: config.nameFor(hit.entryId) });

	const row = root.createDiv({ cls: "gm-hover-row" });
	row.append(
		hit.codepoint + (hit.count > 1 ? ` · ×${hit.count}` : "") + " ",
	);
	row.createSpan({ cls: `gm-dot ${colorClass(hit.category)}` });
	row.createSpan({ text: " " + t(config.locale, `cat.${hit.category}`) });

	const note = noteFor(hit);
	if (note) root.createDiv({ cls: "gm-hover-note", text: t(config.locale, note) });

	root.createDiv({
		cls: "gm-hover-suggest",
		text: `${t(config.locale, "tip.suggest")}: ${t(config.locale, `act.${hit.action.toLowerCase()}`)}`,
	});
	return root;
}

export const hoverExtension = hoverTooltip((view, pos) => {
	if (!inspectRuntime.enabled) return null;
	const config = inspectRuntime.config;
	if (!config) return null;
	if (view.state.field(inspectRuntimeField, false) === undefined) return null;
	const hit = hitAt(view.state.field(inspectHitsField, false) ?? [], pos);
	if (!hit) return null;
	return {
		pos: hit.index,
		end: hit.index + hit.length,
		above: true,
		create() {
			return { dom: buildHoverDom(hit, config) };
		},
	};
}, { hideOn: (tr) => tr.docChanged });
