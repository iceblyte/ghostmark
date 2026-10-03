import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrateSettings, effectivePolicy, resetPolicies, SCHEMA_VERSION } from "./policy";

describe("DEFAULT_SETTINGS", () => {
	it("matches the design doc's defaults", () => {
		expect(DEFAULT_SETTINGS).toEqual({
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
		});
	});
});

describe("migrateSettings", () => {
	it("returns defaults for null and non-objects", () => {
		expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(migrateSettings("junk")).toEqual(DEFAULT_SETTINGS);
	});

	it("fills missing fields with defaults and bumps schemaVersion", () => {
		const migrated = migrateSettings({ schemaVersion: 0, density: "detailed" });
		expect(migrated.density).toBe("detailed");
		expect(migrated.confirmBeforeAll).toBe(true);
		expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
	});

	it("upgrades v1 inspectRemember=false to the new on default", () => {
		const migrated = migrateSettings({
			schemaVersion: 1,
			inspectRemember: false,
		});
		expect(migrated.inspectRemember).toBe(true);
	});

	it("respects inspectRemember=false saved under the current schema", () => {
		const migrated = migrateSettings({
			schemaVersion: 2,
			inspectRemember: false,
		});
		expect(migrated.inspectRemember).toBe(false);
	});

	it("keeps valid overrides and customs, drops invalid ones", () => {
		const migrated = migrateSettings({
			policyOverrides: { "U+200B": "keep", "U+2062": "explode" },
			customPolicies: {
				"U+2065": { codepoint: "U+2065", category: "invisible", action: "remove", name: "x" },
				bad: { category: "invisible" },
			},
		});
		expect(migrated.policyOverrides).toEqual({ "U+200B": "keep" });
		expect(migrated.customPolicies["U+2065"]?.action).toBe("remove");
		expect(migrated.customPolicies.bad).toBeUndefined();
	});

	it("falls back to defaults on invalid enum values", () => {
		const migrated = migrateSettings({
			mathMode: "nuke",
			language: "fr",
			density: "huge",
		});
		expect(migrated.mathMode).toBe("markOnly");
		expect(migrated.language).toBe("auto");
		expect(migrated.density).toBe("compact");
	});

	it("normalizes lowercase action values written by older builds", () => {
		const migrated = migrateSettings({
			policyOverrides: { "U+200B": "tospace" },
			customPolicies: {
				"U+2065": { codepoint: "U+2065", category: "invisible", action: "tospace", name: "x" },
			},
		});
		expect(migrated.policyOverrides["U+200B"]).toBe("toSpace");
		expect(migrated.customPolicies["U+2065"]?.action).toBe("toSpace");
	});
});

describe("resetPolicies", () => {
	it("clears overrides, customs and the ZWNJ rule, keeping the rest", () => {
		const settings = migrateSettings({
			policyOverrides: { "U+200B": "keep" },
			customPolicies: { "U+2065": { codepoint: "U+2065", category: "invisible", action: "remove", name: "x" } },
			zwnjAction: "remove",
			density: "detailed",
		});
		const reset = resetPolicies(settings);
		expect(reset.policyOverrides).toEqual({});
		expect(reset.customPolicies).toEqual({});
		expect(reset.zwnjAction).toBe("keep");
		expect(reset.density).toBe("detailed");
	});
});

describe("effectivePolicy", () => {
	it("applies the ZWNJ convenience rule over the table", () => {
		const policy = effectivePolicy(
			migrateSettings({ zwnjAction: "remove" }),
		);
		expect(policy.get(0x200c)?.action).toBe("remove");
		expect(policy.get(0x200d)?.action).toBe("keep");
	});

	it("includes picked custom codepoints", () => {
		const policy = effectivePolicy(
			migrateSettings({
				customPolicies: {
					"U+2065": { codepoint: "U+2065", category: "invisible", action: "remove", name: "x" },
				},
			}),
		);
		expect(policy.get(0x2065)?.action).toBe("remove");
	});

	it("never overrides the locked ZWJ row", () => {
		const policy = effectivePolicy(
			migrateSettings({ policyOverrides: { "U+200D": "remove" } }),
		);
		expect(policy.get(0x200d)?.action).toBe("keep");
	});
});
