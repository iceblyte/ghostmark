/**
 * Settings data model, schema migration and the effective-policy merge
 * (design doc §4.2/§7). Pure data and functions — the Obsidian-facing
 * load/save and the settings tab live in the shell (src/settings.ts).
 */

import {
	buildScanPolicy,
	DEFAULT_POLICY_ENTRIES,
	type Action,
	type CharPolicy,
	type ScanPolicy,
} from "./categories";

export type MathMode = "markOnly" | "clean";
export type Density = "compact" | "detailed";
export type LanguageSetting = "auto" | "en" | "zh";

export interface GhostmarkSettings {
	schemaVersion: number;
	/** Per-row action overrides keyed by PolicyEntry.id, e.g. "U+200B". */
	policyOverrides: Record<string, Action>;
	/** Picked codepoints (FR-9), keyed by "U+XXXX". */
	customPolicies: Record<string, CharPolicy>;
	/** Collapsed state of the policy-table category groups (settings UI). */
	collapsedGroups: {
		invisible: boolean;
		spaceLike: boolean;
		semantic: boolean;
	};
	/** Context rules. */
	mathMode: MathMode;
	/** Convenience control for the U+200C row (context rules group). */
	zwnjAction: "keep" | "remove";
	codeToSpace: boolean;
	/** Interface. */
	inspectRemember: boolean;
	/** Last inspect-mode state, honored when inspectRemember is on. */
	inspectEnabled: boolean;
	density: Density;
	confirmBeforeAll: boolean;
	confirmBeforeBlock: boolean;
	statusBar: boolean;
	language: LanguageSetting;
}

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: GhostmarkSettings = {
	schemaVersion: SCHEMA_VERSION,
	policyOverrides: {},
	customPolicies: {},
	collapsedGroups: { invisible: false, spaceLike: false, semantic: false },
	mathMode: "markOnly",
	zwnjAction: "keep",
	codeToSpace: true,
	inspectRemember: true,
	inspectEnabled: false,
	density: "compact",
	confirmBeforeAll: true,
	confirmBeforeBlock: false,
	statusBar: true,
	language: "auto",
};

const ACTIONS: readonly Action[] = ["remove", "toSpace", "keep"];
const MATH_MODES: readonly MathMode[] = ["markOnly", "clean"];
const DENSITIES: readonly Density[] = ["compact", "detailed"];
const LANGUAGES: readonly LanguageSetting[] = ["auto", "en", "zh"];

function asAction(value: unknown): Action | null {
	if (typeof value !== "string") return null;
	// case-insensitive: repairs lowercase "tospace" written by older builds
	const action = ACTIONS.find((a) => a.toLowerCase() === value.toLowerCase());
	return action ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
	return options.includes(value as T) ? (value as T) : null;
}

/**
 * Build persisted settings from unknown stored data: missing fields take
 * the defaults (design doc §3.2), unknown fields are dropped, invalid
 * enum values fall back to defaults, and schemaVersion is bumped.
 */
export function migrateSettings(raw: unknown): GhostmarkSettings {
	const settings: GhostmarkSettings = { ...DEFAULT_SETTINGS };

	const data = asRecord(raw);
	if (!data) return settings;

	const overrides: Record<string, Action> = {};
	const overrideData = asRecord(data.policyOverrides);
	if (overrideData) {
		for (const [key, value] of Object.entries(overrideData)) {
			const action = asAction(value);
			if (action) overrides[key] = action;
		}
	}
	settings.policyOverrides = overrides;

	const customs: Record<string, CharPolicy> = {};
	const customData = asRecord(data.customPolicies);
	if (customData) {
		for (const [key, value] of Object.entries(customData)) {
			const entry = asRecord(value);
			if (!entry) continue;
			const action = asAction(entry.action);
			const category = oneOf(entry.category, [
				"invisible",
				"spaceLike",
				"semantic",
			] as const);
			if (!action || !category) continue;
			customs[key] = {
				codepoint: typeof entry.codepoint === "string" ? entry.codepoint : key,
				category,
				action,
				name: typeof entry.name === "string" ? entry.name : "",
			};
		}
	}
	settings.customPolicies = customs;

	const collapsed = asRecord(data.collapsedGroups);
	if (collapsed) {
		settings.collapsedGroups = {
			invisible:
				typeof collapsed.invisible === "boolean"
					? collapsed.invisible
					: false,
			spaceLike:
				typeof collapsed.spaceLike === "boolean"
					? collapsed.spaceLike
					: false,
			semantic:
				typeof collapsed.semantic === "boolean"
					? collapsed.semantic
					: false,
		};
	}

	if (data.mathMode !== undefined) {
		settings.mathMode = oneOf(data.mathMode, MATH_MODES) ?? settings.mathMode;
	}
	if (data.zwnjAction !== undefined) {
		settings.zwnjAction =
			oneOf(data.zwnjAction, ["keep", "remove"] as const) ??
			settings.zwnjAction;
	}
	if (data.codeToSpace !== undefined) {
		settings.codeToSpace =
			typeof data.codeToSpace === "boolean"
				? data.codeToSpace
				: settings.codeToSpace;
	}
	if (data.inspectRemember !== undefined) {
		settings.inspectRemember =
			typeof data.inspectRemember === "boolean"
				? data.inspectRemember
				: settings.inspectRemember;
	}
	if (data.inspectEnabled !== undefined) {
		settings.inspectEnabled =
			typeof data.inspectEnabled === "boolean"
				? data.inspectEnabled
				: settings.inspectEnabled;
	}
	if (data.density !== undefined) {
		settings.density = oneOf(data.density, DENSITIES) ?? settings.density;
	}
	if (data.confirmBeforeAll !== undefined) {
		settings.confirmBeforeAll =
			typeof data.confirmBeforeAll === "boolean"
				? data.confirmBeforeAll
				: settings.confirmBeforeAll;
	}
	if (data.confirmBeforeBlock !== undefined) {
		settings.confirmBeforeBlock =
			typeof data.confirmBeforeBlock === "boolean"
				? data.confirmBeforeBlock
				: settings.confirmBeforeBlock;
	}
	if (data.statusBar !== undefined) {
		settings.statusBar =
			typeof data.statusBar === "boolean"
				? data.statusBar
				: settings.statusBar;
	}
	if (data.language !== undefined) {
		settings.language =
			oneOf(data.language, LANGUAGES) ?? settings.language;
	}

	settings.schemaVersion = SCHEMA_VERSION;
	return settings;
}

/** Clear table edits and picked codepoints ("reset to defaults"). */
export function resetPolicies(settings: GhostmarkSettings): GhostmarkSettings {
	return {
		...settings,
		policyOverrides: {},
		customPolicies: {},
		zwnjAction: "keep",
	};
}

/**
 * Merge the default table, per-row overrides, the ZWNJ convenience rule
 * and picked codepoints into the scanner's lookup map.
 */
export function effectivePolicy(settings: GhostmarkSettings): ScanPolicy {
	const overrides: Record<string, Action> = {
		...settings.policyOverrides,
		"U+200C": settings.zwnjAction,
	};
	return buildScanPolicy(
		DEFAULT_POLICY_ENTRIES,
		overrides,
		Object.values(settings.customPolicies),
	);
}
