import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { flashEffect, flashField, type JumpFlash } from "./flash";

function stateWith(flash: JumpFlash | null) {
	const initial = EditorState.create({ extensions: [flashField] });
	return initial
		.update({ effects: flash === null ? [] : flashEffect.of(flash) })
		.state;
}

describe("flashField", () => {
	it("starts empty and stores a flash with its generation", () => {
		const initial = EditorState.create({ extensions: [flashField] });
		expect(initial.field(flashField)).toBeNull();

		const next = initial
			.update({ effects: flashEffect.of({ from: 5, to: 9, gen: 1 }) })
			.state;
		expect(next.field(flashField)).toEqual({ from: 5, to: 9, gen: 1 });
	});

	it("clears on a null effect", () => {
		let state = stateWith({ from: 5, to: 9, gen: 3 });
		state = state.update({ effects: flashEffect.of(null) }).state;
		expect(state.field(flashField)).toBeNull();
	});

	it("drops the flash when the document changes (stale offsets)", () => {
		let state = stateWith({ from: 5, to: 9, gen: 3 });
		state = state.update({ changes: { from: 0, insert: "x" } }).state;
		expect(state.field(flashField)).toBeNull();
	});

	it("keeps the flash across transactions that change nothing", () => {
		let state = stateWith({ from: 5, to: 9, gen: 3 });
		state = state.update({}).state;
		expect(state.field(flashField)).toEqual({ from: 5, to: 9, gen: 3 });
	});

	it("replaces an old flash instead of accumulating", () => {
		let state = stateWith({ from: 5, to: 9, gen: 1 });
		state = state.update({ effects: flashEffect.of({ from: 40, to: 84, gen: 2 }) })
			.state;
		expect(state.field(flashField)).toEqual({ from: 40, to: 84, gen: 2 });
	});
});
