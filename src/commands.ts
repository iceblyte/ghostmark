/**
 * Commands (FR-7/8/10, prototypes P3/P4/P7): toggle inspect mode,
 * clear all marks and clear selection. Every clear applies as one
 * editor.transaction so Obsidian's native single-step undo holds, gated
 * by the confirm modal (category counts) per the design doc §6 gate
 * rules. Clear-current-block and pick-codepoint join in later commits.
 */

import {
	type App,
	type Command,
	type Component,
	type EditorChange,
	Editor,
	type EditorPosition,
	MarkdownView,
	Modal,
	Notice,
} from "obsidian";
import {
	classifyUnknownCodepoint,
	formatCodepoint,
	type Action,
	type Category,
	type Hit,
} from "./core/categories";
import { blockRangeAt, blockRangeToTextRange } from "./core/blocks";
import { clean, summarizeHits, type HitSummary } from "./core/cleaner";
import type { GhostmarkSettings } from "./core/policy";
import { t, type Locale } from "./core/i18n";
import { scan } from "./core/scanner";
import type { InspectConfig } from "./editor/inspectState";

export interface CommandsHost extends Component {
	app: App;
	config: InspectConfig;
	settings: GhostmarkSettings;
	inspectEnabled: boolean;
	setInspectEnabled(on: boolean): void;
	saveSettings(): Promise<void>;
	addCommand(command: Command): Command;
}

function activeEditor(host: CommandsHost): Editor | null {
	return host.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
}

function scanEditor(editor: Editor, config: InspectConfig): Hit[] {
	return scan(editor.getValue(), config.policy, {
		mathMode: config.mathMode,
		codeToSpace: config.codeToSpace,
	});
}

/**
 * Apply changes as one transaction while keeping the viewport where it
 * was: the cursor is mapped through the changes explicitly (changes are
 * given in original-document coordinates, sorted, non-overlapping) and
 * the scroll position is restored if the editor moved it (Fix for the
 * jump-to-top after gutter-badge clears).
 */
function applyCleanedChanges(editor: Editor, changes: EditorChange[]): void {
	const scroll = editor.getScrollInfo();
	const cursor = editor.posToOffset(editor.getCursor("from"));
	let newCursor = cursor;
	for (const change of changes) {
		const fromPos = change.from ?? { line: 0, ch: 0 };
		const from = editor.posToOffset(fromPos);
		const toPos = change.to ?? editor.offsetToPos(editor.getValue().length);
		const to = editor.posToOffset(toPos);
		if (cursor < from) break;
		if (cursor >= to) {
			newCursor += change.text.length - (to - from);
		} else {
			newCursor = from + Math.min(cursor - from, change.text.length);
			break;
		}
	}
	const cursorPos = editor.offsetToPos(newCursor);
	editor.transaction({
		changes,
		selection: { from: cursorPos },
	});
	const after = editor.getScrollInfo();
	if (
		Math.abs(after.top - scroll.top) > 1 ||
		Math.abs(after.left - scroll.left) > 1
	) {
		editor.scrollTo(scroll.left, scroll.top);
	}
}

function replaceWholeDocument(editor: Editor, text: string): void {
	const lastLine = editor.lineCount() - 1;
	const end: EditorPosition = {
		line: lastLine,
		ch: editor.getLine(lastLine)?.length ?? 0,
	};
	applyCleanedChanges(editor, [
		{ from: { line: 0, ch: 0 }, to: end, text },
	]);
}

/** Prototype P3/P4 confirm modal: category counts, math split, warning. */
export class ConfirmClearModal extends Modal {
	constructor(
		app: App,
		private opts: {
			locale: Locale;
			title: string;
			desc: string;
			summary: HitSummary;
			warn?: string;
			confirmLabel: string;
			onConfirm: () => void;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { locale } = this.opts;
		this.setTitle(this.opts.title);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", {
			cls: "gm-modal-desc",
			text: this.opts.desc,
		});

		const table = contentEl.createDiv({ cls: "gm-cnt-table" });
		const rows: Array<{
			color: string;
			label: string;
			sub: string;
			num: number;
			pill: string;
		}> = [];
		const summary = this.opts.summary;
		const sub = (category: Category): string => {
			const parts: string[] = [];
			for (const [cp, n] of Object.entries(
				summary.byCategoryCodepoint[category],
			)) {
				const short =
					cp === "U+200D"
						? t(locale, "short.zwj")
						: /^U\+1F3F[BCDEF]$/.test(cp)
							? t(locale, "short.skin")
							: cp;
				parts.push(`${short} ×${n}`);
			}
			return parts.join(" · ");
		};
		if (summary.byCategory.invisible > 0) {
			rows.push({
				color: "red",
				label: t(locale, "r.red"),
				sub: sub("invisible"),
				num: summary.byCategory.invisible,
				pill: t(locale, "pill.remove"),
			});
		}
		if (summary.byCategory.spaceLike > 0) {
			rows.push({
				color: "blue",
				label: t(locale, "r.blue"),
				sub: sub("spaceLike"),
				num: summary.byCategory.spaceLike,
				pill: t(locale, "pill.tospace"),
			});
		}
		if (summary.byCategory.semantic > 0) {
			rows.push({
				color: "yellow",
				label: t(locale, "r.yellow"),
				sub: sub("semantic"),
				num: summary.byCategory.semantic,
				pill: t(locale, "pill.keep"),
			});
		}
		if (summary.markOnly > 0) {
			rows.push({
				color: "",
				label: t(locale, "r.math"),
				sub: "",
				num: summary.markOnly,
				pill: t(locale, "pill.markonly"),
			});
		}
		for (const row of rows) {
			const el = table.createDiv({ cls: "gm-cnt-row" });
			const label = el.createDiv({ cls: "gm-cnt-label" });
			if (row.color) label.createSpan({ cls: `gm-dot ${row.color}` });
			const text = label.createDiv();
			text.createSpan({ text: row.label });
			if (row.sub) {
				text.createDiv({ cls: "gm-cnt-sub", text: row.sub });
			}
			el.createSpan({ cls: "gm-cnt-num", text: String(row.num) });
			el.createSpan({
				cls: `gm-cnt-pill ${row.color || "markonly"}`,
				text: row.pill,
			});
		}

		if (this.opts.warn) {
			contentEl.createDiv({
				cls: "gm-modal-note warn",
				text: this.opts.warn,
			});
		} else if (summary.markOnly > 0) {
			contentEl.createDiv({
				cls: "gm-modal-note",
				text: t(locale, "m3.math", { n: summary.markOnly }),
			});
		}

		const foot = contentEl.createDiv({ cls: "modal-button-container" });
		foot
			.createEl("button", { text: t(locale, "btn.cancel") })
			.addEventListener("click", () => this.close());
		foot
			.createEl("button", {
				text: this.opts.confirmLabel,
				cls: "mod-warning",
			})
			.addEventListener("click", () => {
				this.close();
				this.opts.onConfirm();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Prototype P6 pick list: check the selection's codepoints to add. */
class PickListModal extends Modal {
	constructor(
		app: App,
		private opts: {
			locale: Locale;
			candidates: PickCandidate[];
			onConfirm: (picked: PickCandidate[]) => void;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { locale } = this.opts;
		this.setTitle(t(locale, "m6.title"));
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", {
			cls: "gm-modal-desc",
			text: t(locale, "m6.list.desc", { n: this.opts.candidates.length }),
		});

		const checked = new Set<number>(
			this.opts.candidates.map((c) => c.cp),
		);
		const list = contentEl.createDiv({ cls: "gm-pick-list" });
		for (const candidate of this.opts.candidates) {
			const row = list.createDiv({ cls: "gm-pick-item" });
			const box = row.createEl("input", { type: "checkbox" });
			box.checked = true;
			box.addEventListener("change", () => {
				if (box.checked) checked.add(candidate.cp);
				else checked.delete(candidate.cp);
				updateLabel();
			});
			row.createSpan({
				cls: "gm-pick-char",
				text: String.fromCodePoint(candidate.cp),
			});
			row.createSpan({ cls: "gm-pick-id", text: candidate.id });
			row.createSpan({ cls: `gm-dot ${colorClassOf(candidate.category)}` });
			row.createSpan({ text: " " + t(locale, `cat.${candidate.category}`) });
			row.createSpan({
				cls: "gm-pick-suggest",
				text: t(locale, "tip.suggest") + ": " + t(locale, `act.${candidate.action.toLowerCase()}`),
			});
		}

		const foot = contentEl.createDiv({ cls: "modal-button-container" });
		foot
			.createEl("button", { text: t(locale, "btn.cancel") })
			.addEventListener("click", () => this.close());
		const confirm = foot.createEl("button", { cls: "mod-cta" });
		const updateLabel = (): void => {
			confirm.textContent = t(locale, "btn.add.n", { n: checked.size });
			confirm.disabled = checked.size === 0;
		};
		updateLabel();
		confirm.addEventListener("click", () => {
			this.close();
			this.opts.onConfirm(
				this.opts.candidates.filter((c) => checked.has(c.cp)),
			);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function colorClassOf(category: Category): string {
	if (category === "invisible") return "red";
	if (category === "spaceLike") return "blue";
	return "yellow";
}

function undoNotice(
	main: string,
	locale: Locale,
	kept?: { markOnly: number; protectedCount: number },
): void {
	new Notice(
		createFragment((frag) => {
			frag.createDiv({ text: main });
			if (kept && kept.markOnly + kept.protectedCount > 0) {
				frag.createDiv({
					cls: "gm-notice-undo",
					text: t(locale, "n3.keep", {
						a: kept.markOnly,
						b: kept.protectedCount,
					}),
				});
			}
			const row = frag.createDiv({ cls: "gm-notice-undo" });
			row.createEl("kbd", { text: "Ctrl" });
			row.createSpan({ text: "+" });
			row.createEl("kbd", { text: "Z" });
			row.createSpan({ text: " " + t(locale, "n3.undo") });
		}),
	);
}

/** Prototype P6 pick modal: char preview, codepoint facts, action select. */
class PickCodepointModal extends Modal {
	constructor(
		app: App,
		private opts: {
			locale: Locale;
			id: string;
			name: string;
			category: Category;
			suggested: Action;
			onPick: (action: Action) => void;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { locale } = this.opts;
		this.setTitle(t(locale, "m6.title"));
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", {
			cls: "gm-modal-desc",
			text: t(locale, "m6.desc"),
		});
		contentEl.createDiv({
			cls: "gm-pick-char",
			text: String.fromCodePoint(Number.parseInt(this.opts.id.slice(2), 16)),
		});

		const grid = contentEl.createDiv({ cls: "gm-pick-grid" });
		const rows: Array<[string, string]> = [
			[t(locale, "m6.cp"), this.opts.id],
			[t(locale, "m6.name"), this.opts.name],
		];
		for (const [key, value] of rows) {
			const row = grid.createDiv({ cls: "gm-pick-row" });
			row.createSpan({ cls: "gm-pick-k", text: key });
			row.createSpan({ cls: "gm-pick-v", text: value });
		}
		const catRow = grid.createDiv({ cls: "gm-pick-row" });
		catRow.createSpan({ cls: "gm-pick-k", text: t(locale, "m6.cat") });
		const cat = catRow.createSpan({ cls: "gm-pick-v" });
		cat.createSpan({
			cls: `gm-dot ${this.opts.category === "invisible" ? "red" : this.opts.category === "spaceLike" ? "blue" : "yellow"}`,
		});
		cat.createSpan({
			text: " " + t(locale, `cat.${this.opts.category}`),
		});
		const actRow = grid.createDiv({ cls: "gm-pick-row" });
		actRow.createSpan({ cls: "gm-pick-k", text: t(locale, "m6.act") });
		let selected = this.opts.suggested;
		const sel = actRow.createEl("select", { cls: "dropdown" });
		for (const action of ["remove", "toSpace", "keep"] as const) {
			const option = sel.createEl("option", {
				text: t(locale, `opt.${action.toLowerCase()}`),
			});
			option.value = action;
		}
		sel.value = selected;
		sel.addEventListener("change", () => {
			selected = sel.value as Action;
		});

		const foot = contentEl.createDiv({ cls: "modal-button-container" });
		foot
			.createEl("button", { text: t(locale, "btn.cancel") })
			.addEventListener("click", () => this.close());
		foot
			.createEl("button", { text: t(locale, "btn.pick"), cls: "mod-cta" })
			.addEventListener("click", () => {
				this.close();
				this.opts.onPick(selected);
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Pick the codepoint under the cursor, or — when the editor has a
 * selection — the unknown watermark/space-like codepoints in it: exactly
 * one opens the confirm modal, several are batch-added with the
 * category-based suggested actions, and none falls back to the character
 * at the selection head so the flow never dead-ends.
 */
export function runPickCodepoint(host: CommandsHost, editor: Editor): void {
	const localeNow = host.config.locale;
	const text = editor.getValue();
	if (text.length === 0) return;

	const selection = editor.getSelection();
	if (selection.length > 0) {
		const found = collectPickables(host, selection);
		if (found.length > 1) {
			// confirm-before-add: the user checks which codepoints to take
			new PickListModal(host.app, {
				locale: localeNow,
				candidates: found,
				onConfirm: (picked) => {
					if (picked.length > 0) addBatchPicks(host, localeNow, picked);
				},
			}).open();
			return;
		}
		if (found.length === 1 && found[0]) {
			openPickModal(host, localeNow, found[0].cp);
			return;
		}
		// no new pickables in the selection: offer the character the
		// selection ends on instead of a dead-end notice
		const anchor = editor.posToOffset(editor.getCursor("anchor"));
		const head = editor.posToOffset(editor.getCursor("head"));
		const cp = codepointAt(text, head > anchor ? head - 1 : head);
		if (cp !== null) openPickModal(host, localeNow, cp);
		return;
	}

	const cursor = editor.posToOffset(editor.getCursor("from"));
	const cp = codepointAt(text, cursor);
	if (cp !== null) openPickModal(host, localeNow, cp);
}

function codepointAt(text: string, offset: number): number | null {
	let start = Math.min(Math.max(offset, 0), text.length - 1);
	if (start < 0) return null;
	let cp = text.codePointAt(start);
	// a boundary between surrogate halves reads the low one; step back
	if (cp !== undefined && cp >= 0xdc00 && cp <= 0xdfff && start > 0) {
		start -= 1;
		cp = text.codePointAt(start);
	}
	return cp === undefined ? null : cp;
}

interface PickedCodepoint {
	id: string;
	action: Action;
}

function pickNotice(locale: Locale, picks: PickedCodepoint[]): DocumentFragment {
	return createFragment((frag) => {
		frag.createDiv({
			text:
				picks.length === 1
					? t(locale, "n6.ok", {
							cp: picks[0]?.id ?? "",
							act: t(locale, `act.${(picks[0]?.action ?? "remove").toLowerCase()}`),
						})
					: t(locale, "n.pick.batch", {
							n: picks.length,
							list: picks.map((p) => p.id).join("、"),
						}),
		});
		frag.createDiv({
			cls: "gm-notice-undo",
			text: t(locale, "n6.more"),
		});
	});
}

interface PickCandidate {
	cp: number;
	id: string;
	category: Category;
	action: Action;
}

/**
 * Unknown codepoints in the selection — every distinct codepoint not yet
 * covered by the policy table, exactly as the user selected them (no
 * classification filter: an explicit selection IS the intent).
 */
function collectPickables(
	host: CommandsHost,
	selection: string,
): PickCandidate[] {
	const seen = new Set<number>();
	const picks: PickCandidate[] = [];
	for (let i = 0; i < selection.length; ) {
		const cp = selection.codePointAt(i) ?? 0;
		i += cp > 0xffff ? 2 : 1;
		if (host.config.policy.has(cp) || seen.has(cp)) continue;
		const suggestion = classifyUnknownCodepoint(cp);
		seen.add(cp);
		picks.push({
			cp,
			id: formatCodepoint(cp),
			category: suggestion.category,
			action: suggestion.action,
		});
	}
	return picks;
}

function addBatchPicks(
	host: CommandsHost,
	localeNow: Locale,
	candidates: PickCandidate[],
): void {
	for (const pick of candidates) {
		host.settings.customPolicies[pick.id] = {
			codepoint: pick.id,
			category: pick.category,
			action: pick.action,
			name: "",
		};
	}
	void host.saveSettings();
	new Notice(pickNotice(localeNow, candidates));
}

function openPickModal(
	host: CommandsHost,
	localeNow: Locale,
	cp: number,
): void {
	const id = formatCodepoint(cp);
	if (host.config.policy.has(cp)) {
		new Notice(t(localeNow, "n.pick.known"));
		return;
	}
	const suggestion = classifyUnknownCodepoint(cp);
	const rawName = host.config.nameFor(id);
	new PickCodepointModal(host.app, {
		locale: localeNow,
		id,
		name: rawName === id ? t(localeNow, "pick.name.unknown") : rawName,
		category: suggestion.category,
		suggested: suggestion.action,
		onPick: (action) => {
			host.settings.customPolicies[id] = {
				codepoint: id,
				category: suggestion.category,
				action,
				name: "",
			};
			void host.saveSettings();
			new Notice(
				pickNotice(localeNow, [
					{ id, action },
				]),
			);
		},
	}).open();
}

function editorOffset(editor: Editor, offset: number): EditorPosition {
	return editor.offsetToPos(offset);
}

/**
 * Clear the block containing the cursor (or an explicit line, for the
 * gutter badge entry). Default confirm-free — gated by inspect-mode
 * visibility per the design doc §6 complementary rule.
 */
export function clearCurrentBlock(
	host: CommandsHost,
	editor: Editor,
	lineIndex?: number,
): void {
	const localeNow = host.config.locale;
	const text = editor.getValue();
	const cursorLine = lineIndex ?? editor.getCursor("from").line;
	const range = blockRangeAt(text, cursorLine);
	if (!range) {
		new Notice(t(localeNow, "n5.zero"));
		return;
	}

	const { start: startOffset, end: endOffset } = blockRangeToTextRange(
		text,
		range,
	);

	const slice = text.slice(startOffset, endOffset);
	const hits = scan(slice, host.config.policy, {
		mathMode: host.config.mathMode,
		codeToSpace: host.config.codeToSpace,
	});
	const summary = summarizeHits(slice, hits);
	if (summary.actionable === 0) {
		new Notice(t(localeNow, "n5.zero"));
		return;
	}

	const run = (): void => {
		const { text: cleaned, report } = clean(slice, hits);
		applyCleanedChanges(editor, [
			{
				from: editorOffset(editor, startOffset),
				to: editorOffset(editor, endOffset),
				text: cleaned,
			},
		]);
		undoNotice(
			t(localeNow, "n5.ok", {
				n: report.total,
				r: report.byCategory.invisible,
				b: report.byCategory.spaceLike,
			}),
			localeNow,
		);
	};

	if (!host.settings.confirmBeforeBlock) {
		run();
		return;
	}
	new ConfirmClearModal(host.app, {
		locale: localeNow,
		title: t(localeNow, "m5.title"),
		desc: t(localeNow, "m5.desc", {
			block: t(localeNow, `block.${range.shape}`),
			lines: range.endLine - range.startLine + 1,
		}),
		summary,
		confirmLabel: t(localeNow, "btn.clear", { n: summary.actionable }),
		onConfirm: run,
	}).open();
}

export function registerCommands(host: CommandsHost): void {
	host.addCommand({
		id: "toggle-inspect",
		name: t(host.config.locale, "cmd.toggle"),
		hotkeys: [{ modifiers: ["Mod", "Alt"], key: "i" }],
		callback: () => host.setInspectEnabled(!host.inspectEnabled),
	});

	host.addCommand({
		id: "clear-all",
		name: t(host.config.locale, "cmd.clearall"),
		hotkeys: [{ modifiers: ["Mod", "Alt"], key: "k" }],
		editorCallback: (editor) => {
			const localeNow = host.config.locale;
			const text = editor.getValue();
			const hits = scanEditor(editor, host.config);
			const summary = summarizeHits(text, hits);
			if (summary.actionable === 0) {
				new Notice(t(localeNow, "n.zero.all"));
				return;
			}
			const run = (): void => {
				const { text: cleaned, report } = clean(text, hits);
				replaceWholeDocument(editor, cleaned);
				undoNotice(
					t(localeNow, "n3.ok", {
						n: report.total,
						r: report.byCategory.invisible,
						b: report.byCategory.spaceLike,
					}),
					localeNow,
					{
						markOnly: summary.markOnly,
						protectedCount: summary.byCategory.semantic,
					},
				);
			};
			if (!host.settings.confirmBeforeAll) {
				run();
				return;
			}
			new ConfirmClearModal(host.app, {
				locale: localeNow,
				title: t(localeNow, "m3.title"),
				desc: t(localeNow, "m3.desc"),
				summary,
				confirmLabel: t(localeNow, "btn.clear", { n: summary.actionable }),
				onConfirm: run,
			}).open();
		},
	});

	host.addCommand({
		id: "clear-selection",
		name: t(host.config.locale, "cmd.clearsel"),
		checkCallback: (checking) => {
			const editor = activeEditor(host);
			if (!editor) return false;
			if (editor.getSelection().length === 0) return false;
			if (!checking) {
				runClearSelection(host, editor);
			}
			return true;
		},
	});

	host.addCommand({
		id: "clear-block",
		name: t(host.config.locale, "cmd.clearblock"),
		// Confirm-free clearing requires visibility (design doc §6):
		// the command is grayed out while inspect mode is off.
		checkCallback: (checking) => {
			const editor = activeEditor(host);
			if (!editor) return false;
			if (!host.inspectEnabled) return false;
			if (!checking) {
				clearCurrentBlock(host, editor);
			}
			return true;
		},
	});

	host.addCommand({
		id: "pick-codepoint",
		name: t(host.config.locale, "cmd.pick"),
		editorCallback: (editor) => runPickCodepoint(host, editor),
	});
}

function runClearSelection(host: CommandsHost, editor: Editor): void {
	const localeNow = host.config.locale;
	const text = editor.getValue();
	const hits = scanEditor(editor, host.config);

	// selected ranges, sorted and non-overlapping
	const ranges: Array<{ from: number; to: number }> = [];
	for (const sel of editor.listSelections()) {
		const a = editor.posToOffset(sel.anchor);
		const b = editor.posToOffset(sel.head);
		if (a !== b) ranges.push({ from: Math.min(a, b), to: Math.max(a, b) });
	}
	ranges.sort((x, y) => x.from - y.from);

	const selectedHits = hits.filter((hit) =>
		ranges.some((r) => hit.index >= r.from && hit.index < r.to),
	);
	const summary = summarizeHits(text, selectedHits);
	if (summary.actionable === 0) {
		new Notice(t(localeNow, "n.zero.sel"));
		return;
	}

	const run = (): void => {
		let total = 0;
		let red = 0;
		let blue = 0;
		const changes = ranges.map((range) => {
			const slice = text.slice(range.from, range.to);
			const sliceHits = hits.filter(
				(hit) => hit.index >= range.from && hit.index < range.to,
			);
			const { text: cleaned, report } = clean(slice, sliceHits);
			total += report.total;
			red += report.byCategory.invisible;
			blue += report.byCategory.spaceLike;
			return {
				from: editor.offsetToPos(range.from),
				to: editor.offsetToPos(range.to),
				text: cleaned,
			};
		});
		applyCleanedChanges(editor, changes);
		undoNotice(
			t(localeNow, "n4.ok", { n: total, r: red, b: blue }),
			localeNow,
			{
				markOnly: summary.markOnly,
				protectedCount: summary.byCategory.semantic,
			},
		);
	};

	if (!host.settings.confirmBeforeAll) {
		run();
		return;
	}
	new ConfirmClearModal(host.app, {
		locale: localeNow,
		title: t(localeNow, "m4.title"),
		desc: t(localeNow, "m4.desc"),
		summary,
		warn: t(localeNow, "m4.warn"),
		confirmLabel: t(localeNow, "btn.clear", { n: summary.actionable }),
		onConfirm: run,
	}).open();
}
