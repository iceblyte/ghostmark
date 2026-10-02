# Ghostmark

**Inspect and clean invisible watermark characters in clipped notes.**

When you clip web pages into Obsidian with the Web Clipper, some sites slip
invisible watermark characters into the text — zero-width clusters inside
words, runs of exotic spaces at paragraph ends, hidden bidi marks. They
render as nothing, but they break search, linking, diffs and even code you
paste into a terminal. Ghostmark makes them visible and cleans them with
context-aware, confirmable, undoable actions.

> Built for the [obsidian-clipper #918](https://github.com/obsidianmd/obsidian-clipper/issues/918)
> scenario; see also [#625](https://github.com/obsidianmd/obsidian-clipper/issues/625)
> (why ZWNJ is protected by default) and
> [#916](https://github.com/obsidianmd/obsidian-clipper/issues/916).
> 中文说明见 [README.zh-CN](README.zh-CN.md)。

## Features

- **Inspect mode** — one toggle (command, status-bar click, hotkey) renders
  every hit as an inline glyph in both Source and Live Preview, all notes,
  remembered across restarts (optional).
- **Three-color semantics**
  - 🔴 **Red — invisible, no semantics** (U+200B, U+2060–U+2064, U+061C,
    U+180E, U+200E/F, U+FFFE/F, U+FEFF; removed by default, including code):
  - 🔵 **Blue — space-like** (U+2002, U+2009, U+2007, U+202F, U+00A0): runs
    of ≥2 are removed whole, isolated ones become plain spaces; inside code
    they convert one-to-one so indentation survives.
  - 🟡 **Yellow — protected semantics** (ZWJ is hard-locked, ZWNJ, variation
    selectors): marked only, never touched by default.
- **Two densities** — compact (one glyph per category) or detailed
  (codepoint abbreviations like `2062`, `2002 ×20`).
- **Hover details** — name, codepoint, category, contextual note and the
  suggested action for every hit.
- **Gutter badges** — per-line hit counts colored by the dominant category;
  click a badge to clear the enclosing block.
- **Status bar** — `Ghost: N` shows the active note's hit count (desktop);
  click to toggle inspect mode.
- **Clear all / Clear selection** — confirm modal with category counts, one
  transaction, single-step undo. Base64 tracking tokens are *visible*
  garbage: they are not policy characters, so remove them by hand (the
  selection modal reminds you).
- **Clear current block** — paragraph / list item / quote run / table row /
  whole code or math block / frontmatter. Confirm-free by default, therefore
  only available while inspect mode is on (visibility is the gate); optional
  confirm in settings.
- **Pick codepoint** — cursor on an unknown character, run the command, get
  its codepoint facts and a category-based suggested action, add it to the
  policy table. Unknown future watermarks stay one command away.
- **Math safety** — hits inside `$$…$$` / `$…$` are mark-only by default;
  MathML transcoding can put a meaningful U+2062 in a formula. Switch to
  *clean* in settings if you prefer.
- **English / 简体中文** UI, following Obsidian's language by default.

## Commands

| Command | Suggested hotkey |
| --- | --- |
| Ghostmark: Toggle inspect mode | `Ctrl/Cmd + Alt + I` |
| Ghostmark: Clear all marks | `Ctrl/Cmd + Alt + K` |
| Ghostmark: Clear selection | — (needs a selection) |
| Ghostmark: Clear current block | — (needs inspect mode) |
| Ghostmark: Pick codepoint | — |

## Install

Not yet in the community plugin store. Manual install:

1. Download `main.js`, `manifest.json` from a
   [release](../../releases) (or build them yourself).
2. Put them in `<vault>/.obsidian/plugins/ghostmark/`.
3. Enable **Ghostmark** in *Settings → Community plugins*.

## Development

```bash
npm install
npm run dev     # esbuild watch
npm run build   # tsc -noEmit + production bundle → main.js
npm run lint    # eslint with eslint-plugin-obsidianmd
npm test        # vitest (core engine + fixture acceptance)
```

The core engine (`src/core/`) is pure TypeScript with no Obsidian or
CodeMirror imports and is fully unit-tested against the committed synthetic
sample `src/core/fixtures/watermark-fixture.md` (801 invisible characters:
U+2062 ×108, U+061C ×216, U+2002 ×300, U+2009 ×177, plus 4 ZWJ and 1 skin
modifier — 806 hits, 798 clearable).

**Dev vault tip:** copy `main.js`, `manifest.json` and `styles.css` into
your test vault's `.obsidian/plugins/ghostmark/` after every build, or use
[pjeby/hot-reload](https://github.com/pjeby/hot-reload) with `npm run dev`
for instant reloads.

## License

[MIT](LICENSE)
