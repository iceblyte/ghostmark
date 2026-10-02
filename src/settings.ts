/**
 * Settings plumbing: Obsidian UI locale detection and the bridge from
 * GhostmarkSettings to the editor-layer InspectConfig. The settings tab
 * UI is added in the next commit.
 */

import { resolveLocale, t, type Locale } from "./core/i18n";
import { effectivePolicy, type GhostmarkSettings } from "./core/policy";
import type { InspectConfig } from "./editor/inspectState";

/**
 * Obsidian's UI locale. Read from localStorage("language") — the official
 * getLanguage() would force minAppVersion 1.8.7, which the design doc
 * keeps at 1.0.0. zh / zh-TW … map to "zh", everything else to "en".
 */
export function obsidianLocale(): Locale {
	const lang = window.localStorage.getItem("language") ?? "en";
	return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function buildInspectConfig(
	settings: GhostmarkSettings,
	hostLocale: Locale,
): InspectConfig {
	const locale = resolveLocale(settings.language, hostLocale);
	return {
		policy: effectivePolicy(settings),
		density: settings.density,
		locale,
		mathMode: settings.mathMode,
		codeToSpace: settings.codeToSpace,
		nameFor: (entryId) => {
			const custom = settings.customPolicies[entryId];
			if (custom) return custom.name || entryId;
			const localized = t(locale, `cp.${entryId}`);
			return localized === `cp.${entryId}` ? entryId : localized;
		},
	};
}
