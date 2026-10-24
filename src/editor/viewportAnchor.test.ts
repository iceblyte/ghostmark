import { EditorState, Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
	isUndoLikeTransaction,
	pinViewportAcrossNextTransaction,
} from "./viewportAnchor";

function transaction(userEvent?: string): Transaction {
	const state = EditorState.create();
	return state.update({
		changes: { from: 0, insert: "x" },
		...(userEvent === undefined ? {} : { userEvent }),
	});
}

describe("isUndoLikeTransaction", () => {
	it("matches the CM6 history userEvent values", () => {
		expect(isUndoLikeTransaction(transaction("undo"))).toBe(true);
		expect(isUndoLikeTransaction(transaction("redo"))).toBe(true);
		expect(isUndoLikeTransaction(transaction("select.undo"))).toBe(true);
		expect(isUndoLikeTransaction(transaction("select.redo"))).toBe(true);
	});

	it("does not match editing or selection events", () => {
		expect(isUndoLikeTransaction(transaction("input.type"))).toBe(false);
		expect(isUndoLikeTransaction(transaction("delete"))).toBe(false);
		expect(isUndoLikeTransaction(transaction("select"))).toBe(false);
		expect(isUndoLikeTransaction(transaction("input.draw"))).toBe(false);
	});

	it("does not match transactions without a userEvent", () => {
		expect(isUndoLikeTransaction(transaction())).toBe(false);
	});
});

describe("pinViewportAcrossNextTransaction", () => {
	it("is callable and does not throw", () => {
		expect(() => pinViewportAcrossNextTransaction()).not.toThrow();
	});
});
