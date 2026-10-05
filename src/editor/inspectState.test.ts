import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
	frontmatterBadgeEffect,
	frontmatterBadgeField,
} from "./inspectState";

describe("frontmatterBadgeField", () => {
	it("starts false (Live Preview unknown) and stores pushed values", () => {
		const initial = EditorState.create({
			extensions: [frontmatterBadgeField],
		});
		expect(initial.field(frontmatterBadgeField)).toBe(false);

		const live = initial
			.update({ effects: frontmatterBadgeEffect.of(true) })
			.state;
		expect(live.field(frontmatterBadgeField)).toBe(true);

		const source = live
			.update({ effects: frontmatterBadgeEffect.of(false) })
			.state;
		expect(source.field(frontmatterBadgeField)).toBe(false);
	});

	it("keeps the mode across ordinary updates and document changes", () => {
		let state = EditorState.create({
			extensions: [frontmatterBadgeField],
		}).update({ effects: frontmatterBadgeEffect.of(true) }).state;
		state = state.update({}).state;
		expect(state.field(frontmatterBadgeField)).toBe(true);
		state = state.update({ changes: { from: 0, insert: "x" } }).state;
		expect(state.field(frontmatterBadgeField)).toBe(true);
	});
});
