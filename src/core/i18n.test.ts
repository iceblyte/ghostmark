import { describe, expect, it } from "vitest";
import { resolveLocale, stringKeys, t } from "./i18n";

describe("i18n key parity", () => {
	it("en and zh tables share the exact same key set", () => {
		const zh = stringKeys("zh").sort();
		const en = stringKeys("en").sort();
		expect(en).toEqual(zh);
	});

	it("has no empty strings", () => {
		for (const locale of ["zh", "en"] as const) {
			for (const key of stringKeys(locale)) {
				expect(t(locale, key).length).toBeGreaterThan(0);
			}
		}
	});
});

describe("t()", () => {
		it("returns the zh and en strings from the prototype", () => {
			expect(t("zh", "cmd.clearall")).toBe("Ghostmark: 清除全部标记");
			expect(t("en", "cmd.clearall")).toBe("Ghostmark: Clear all marks");
			expect(t("zh", "cat.invisible")).toBe("无语义不可见");
			expect(t("en", "cat.base64")).toBe("Base64 garbage");
		});

	it("interpolates variables", () => {
		expect(t("zh", "btn.clear", { n: 798 })).toBe("清除 798");
		expect(t("en", "btn.clear", { n: 798 })).toBe("Clear 798");
		expect(t("zh", "n3.ok", { n: 798, r: 321, b: 477 })).toBe(
			"已清除 798 处标记（红 321 · 蓝 477）",
		);
		expect(t("en", "n3.ok", { n: 798, r: 321, b: 477 })).toBe(
			"Cleared 798 marks (red 321 · blue 477)",
		);
	});

	it("returns the key itself when unknown", () => {
		expect(t("zh", "no.such.key")).toBe("no.such.key");
	});
});

describe("resolveLocale", () => {
	it("follows the Obsidian locale when auto", () => {
		expect(resolveLocale("auto", "zh")).toBe("zh");
		expect(resolveLocale("auto", "en")).toBe("en");
	});

	it("lets a manual choice override", () => {
		expect(resolveLocale("en", "zh")).toBe("en");
		expect(resolveLocale("zh", "en")).toBe("zh");
	});
});
