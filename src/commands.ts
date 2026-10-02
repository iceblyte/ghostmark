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
	Editor,
	type EditorPosition,
	MarkdownView,
	Modal,
	Notice,
} from "obsidian";
import type { Category, Hit } from "./core/categories";
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

function replaceWholeDocument(editor: Editor, text: string): void {
	const lastLine = editor.lineCount() - 1;
	const end: EditorPosition = {
		line: lastLine,
		ch: editor.getLine(lastLine)?.length ?? 0,
	};
	editor.transaction({
		changes: [{ from: { line: 0, ch: 0 }, to: end, text }],
	});
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

function undoNotice(main: string, locale: Locale): void {
	new Notice(
		createFragment((frag) => {
			frag.createDiv({ text: main });
			const row = frag.createDiv({ cls: "gm-notice-undo" });
			row.createEl("kbd", { text: "Ctrl" });
			row.createSpan({ text: "+" });
			row.createEl("kbd", { text: "Z" });
			row.createSpan({ text: " " + t(locale, "n3.undo") });
		}),
	);
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
		editor.transaction({
			changes: [
				{
					from: editorOffset(editor, startOffset),
					to: editorOffset(editor, endOffset),
					text: cleaned,
				},
			],
		});
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
		editor.transaction({ changes });
		undoNotice(
			t(localeNow, "n4.ok", { n: total, r: red, b: blue }),
			localeNow,
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
