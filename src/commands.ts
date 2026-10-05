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
import { filterNavigable, pickJumpTarget } from "./core/navigation";
import { scan } from "./core/scanner";
import type { InspectConfig } from "./editor/inspectState";
import { applyJumpAndFlash } from "./editor/flash";

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

function activeMarkdownView(host: CommandsHost): MarkdownView | null {
	return host.app.workspace.getActiveViewOfType(MarkdownView);
}

/**
 * Live Preview ("source" mode with source: false) covers the
 * frontmatter with Obsidian's properties widget — marks inside it
 * render nowhere and the cursor cannot land there visibly, so
 * navigation skips them. Source mode shows the raw frontmatter and
 * keeps those marks navigable.
 */
function frontmatterHidden(view: MarkdownView): boolean {
	if (view.getMode() !== "source") return false;
	// markdown leaf state: { mode: "source", source: boolean } —
	// source: false is Live Preview, source: true is plain Source mode
	return view.getState()["source"] === false;
}

function scanEditor(editor: Editor, config: InspectConfig): Hit[] {
	return scan(editor.getValue(), config.policy, {
		mathMode: config.mathMode,
		codeToSpace: config.codeToSpace,
		base64: config.base64,
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

/** Prototype P3/P4 confirm modal: category counts, math split. */
export class ConfirmClearModal extends Modal {
	constructor(
		app: App,
		private opts: {
			locale: Locale;
			title: string;
			desc: string;
			summary: HitSummary;
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
		if (summary.byCategory.base64 > 0) {
			rows.push({
				color: "purple",
				label: t(locale, "r.base64"),
				sub: sub("base64"),
				num: summary.byCategory.base64,
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

		if (summary.markOnly > 0) {
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
			const sync = (): void => {
				if (box.checked) checked.add(candidate.cp);
				else checked.delete(candidate.cp);
				row.toggleClass("is-off", !box.checked);
				updateLabel();
			};
			// the whole row toggles; the checkbox handles its own click
			box.addEventListener("change", () => sync());
			row.addEventListener("click", (event) => {
				if (event.target === box) return;
				box.checked = !box.checked;
				sync();
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
			row.toggleClass("is-off", !box.checked);
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

/** " · 紫 N" suffix appended to clear notices when base64 segments went. */
function purpleSuffix(locale: Locale, count: number): string {
	return count > 0 ? t(locale, "n.suffix.purple", { p: count }) : "";
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
		base64: host.config.base64,
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
			}) + purpleSuffix(localeNow, report.byCategory.base64),
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

/**
 * Jump to the next / previous mark relative to the cursor: select the
 * hit, flash its line (the selection alone is easy to lose in a dense
 * document), scroll it into view, and wrap around the document ends
 * with a notice. Includes keep and mark-only hits — the user is
 * reviewing what is there, not only what would be cleaned.
 */
function jumpToMark(
	host: CommandsHost,
	view: MarkdownView,
	direction: "next" | "prev",
): void {
	const localeNow = host.config.locale;
	const editor = view.editor;
	const allHits = scanEditor(editor, host.config);
	// Live Preview hides the frontmatter behind the properties widget:
	// hits inside it can never be seen or selected, so they are not
	// navigable there (Source mode keeps them).
	const hits = filterNavigable(allHits, frontmatterHidden(view));
	if (hits.length === 0) {
		new Notice(
			t(
				localeNow,
				allHits.length > 0 ? "n.jump.hidden" : "n.jump.none",
			),
		);
		return;
	}
	const cursor = editor.posToOffset(editor.getCursor("head"));
	let target = pickJumpTarget(hits, cursor, direction);
	let wrapped = false;
	if (!target) {
		wrapped = true;
		target =
			direction === "next"
				? (hits[0] ?? null)
				: (hits[hits.length - 1] ?? null);
	}
	if (!target) return;
	// One CM transaction: select the hit, center it (native effect — the
	// file-start wrap crosses the whole document and must never rely on
	// the editor wrapper's scrolling) and flash the exact mark range.
	if (
		!applyJumpAndFlash(view.containerEl, target.index, target.index + target.length)
	) {
		const fromPos = editor.offsetToPos(target.index);
		const toPos = editor.offsetToPos(target.index + target.length);
		editor.setSelection(fromPos, toPos);
		editor.scrollIntoView({ from: fromPos, to: toPos }, true);
	}
	if (wrapped) {
		new Notice(
			t(
				localeNow,
				direction === "next" ? "n.jump.wrap.next" : "n.jump.wrap.prev",
			),
		);
	}
}

/**
 * Clear one base64 segment (widget click): an explicit single-segment
 * action, so it is allowed even for mark-only tokens inside code and
 * never gated by the confirm settings. One transaction → single-step
 * undo; scroll and cursor stay put.
 */
export function clearBase64Segment(
	host: CommandsHost,
	editor: Editor,
	hit: Hit,
): void {
	applyCleanedChanges(editor, [
		{
			from: editorOffset(editor, hit.index),
			to: editorOffset(editor, hit.index + hit.length),
			text: "",
		},
	]);
	undoNotice(t(host.config.locale, "n7.ok", { n: hit.length }), host.config.locale);
}

export function registerCommands(host: CommandsHost): void {
	// No default hotkeys: they can conflict with the user's own bindings
	// (official review guideline). Suggested bindings are documented in the
	// README and can be set in Settings → Hotkeys.
	host.addCommand({
		id: "toggle-inspect",
		name: t(host.config.locale, "cmd.toggle"),
		callback: () => host.setInspectEnabled(!host.inspectEnabled),
	});

	host.addCommand({
		id: "clear-all",
		name: t(host.config.locale, "cmd.clearall"),
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
					}) + purpleSuffix(localeNow, report.byCategory.base64),
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

	host.addCommand({
		id: "jump-next-mark",
		name: t(host.config.locale, "cmd.jumpnext"),
		// Visibility gate (design doc §6): jumping to marks the user
		// cannot see is meaningless, so gray out while inspect is off.
		checkCallback: (checking) => {
			const view = activeMarkdownView(host);
			if (!view) return false;
			if (!host.inspectEnabled) return false;
			if (!checking) {
				jumpToMark(host, view, "next");
			}
			return true;
		},
	});

	host.addCommand({
		id: "jump-previous-mark",
		name: t(host.config.locale, "cmd.jumpprev"),
		checkCallback: (checking) => {
			const view = activeMarkdownView(host);
			if (!view) return false;
			if (!host.inspectEnabled) return false;
			if (!checking) {
				jumpToMark(host, view, "prev");
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
		let purple = 0;
		const changes = ranges.map((range) => {
			const slice = text.slice(range.from, range.to);
			const sliceHits = hits.filter(
				(hit) => hit.index >= range.from && hit.index < range.to,
			);
			const { text: cleaned, report } = clean(slice, sliceHits);
			total += report.total;
			red += report.byCategory.invisible;
			blue += report.byCategory.spaceLike;
			purple += report.byCategory.base64;
			return {
				from: editor.offsetToPos(range.from),
				to: editor.offsetToPos(range.to),
				text: cleaned,
			};
		});
		applyCleanedChanges(editor, changes);
		undoNotice(
			t(localeNow, "n4.ok", { n: total, r: red, b: blue }) +
				purpleSuffix(localeNow, purple),
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
		confirmLabel: t(localeNow, "btn.clear", { n: summary.actionable }),
		onConfirm: run,
	}).open();
}
