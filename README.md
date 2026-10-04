<div align="center">
  <img src="docs/images/banner.svg" alt="Ghostmark — inspect and clean invisible watermark characters in clipped notes" width="100%">

  [![Release](https://img.shields.io/github/v/release/iceblyte/ghostmark)](https://github.com/iceblyte/ghostmark/releases)
  [![CI](https://img.shields.io/github/actions/workflow/status/iceblyte/ghostmark/ci.yml?branch=main&label=CI)](https://github.com/iceblyte/ghostmark/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  ![min app version](https://img.shields.io/badge/min%20app%20version-1.13.0-blue)

  *English · [简体中文](README.zh-CN.md)*
</div>

---

When you clip web pages into Obsidian with the Web Clipper, some sites slip
**invisible watermark characters** into the text — zero-width clusters inside
words, runs of exotic spaces at paragraph ends, hidden bidi marks. They render
as nothing, but they silently break:

- 🔍 **Search** — a word with a hidden character never matches;
- 🔗 **Links & wikilinks** — polluted titles fail to link;
- 📝 **Diffs & git history** — lines look unchanged but are not;
- 💥 **Code you paste into terminals** — `pyt⟪2062⟫hon` simply doesn't run.

Ghostmark makes them **visible**, and cleans them with context-aware,
confirmable, undoable actions.

## Inspect mode

One toggle (command, status-bar click, or a hotkey you assign) renders every
hit as an inline glyph — in Source mode and Live Preview, across all notes.

<img src="docs/images/editor-inspect.png" alt="Inspect mode: three-color glyphs, gutter badges, hover details and the status bar" width="100%">

| Color | Meaning | Default action |
| --- | --- | --- |
| 🔴 red `⌷` | invisible, no semantics (U+200B, U+2060–2064, U+061C, U+180E, U+200E/F, U+FFFE/F, U+FEFF) | removed — including inside code |
| 🔵 blue `␣` | space-like (U+2002, U+2009, U+2007, U+202F, U+00A0) | runs of ≥2 removed whole, isolated → plain space; one-to-one in code |
| 🟡 yellow `⌦` | protected semantics (ZWJ is hard-locked, ZWNJ, variation selectors) | marked only, never touched |

Gutter badges are **segmented** — one colored segment per category with its own
count — and clicking one clears the enclosing block. Hovering any glyph shows
the character's name, codepoint, category and suggested action. The status bar
keeps a live `Ghost: N` count for the active note.

## Clear with confidence

Clearing always shows a confirm modal with the category breakdown, applies as
**one transaction** (Obsidian's native single-step undo works out of the box),
and reports what it did — including what it deliberately left behind.

<img src="docs/images/clear-all.png" alt="Clear-all confirm modal with category counts" width="80%">

<div>
  <img src="docs/images/clear-selection.png" alt="Clear selection" width="49%">
  <img src="docs/images/clear-block.png" alt="Clear current block" width="49%">
</div>

- **Clear all** — the whole note, gated by the modal above.
- **Clear selection** — grayed out until you select something; reminds you that
  base64 tracking tokens are *visible* garbage to delete by hand.
- **Clear current block** — paragraph / list item / quote run / table row /
  whole code or math block / frontmatter. Confirm-free by default, therefore
  only available while inspect mode is on (visibility is the gate); the gutter
  badge is a second entry point.

## Pick unknown watermarks

A new site invents a new watermark character? Park the cursor on it (or select
a stretch of text), run **Pick codepoint** — the modal shows the codepoint
facts and a category-based suggested action. Multiple characters open a
check-list; you can also add codepoints by hand in settings.

<img src="docs/images/pick-codepoint.png" alt="Pick codepoint modal" width="70%">

## Commands & settings

<img src="docs/images/command-palette.png" alt="Command palette with the five Ghostmark commands" width="80%">

| Command | Suggested hotkey (not set by default — bind it in Settings → Hotkeys) |
| --- | --- |
| Ghostmark: Toggle inspect mode | `Ctrl/Cmd + Alt + I` |
| Ghostmark: Clear all marks | `Ctrl/Cmd + Alt + K` |
| Ghostmark: Clear selection | — (needs a selection) |
| Ghostmark: Clear current block | — (needs inspect mode) |
| Ghostmark: Pick codepoint | — |

Settings group the 21 default policy rows (editable per codepoint, with the
picked additions section), context rules (math blocks are **mark-only** by
default — MathML transcoding can put a meaningful U+2062 in a formula),
interface options and a bilingual UI (English / 简体中文, following Obsidian's
language by default).

<img src="docs/images/settings.png" alt="Ghostmark settings" width="80%">

## On mobile

Decorations and all five commands work on mobile; only the status bar is
desktop-specific — the command palette is the mobile entry.

<img src="docs/images/mobile.png" alt="Mobile: inspect mode without a status bar, palette as the entry" width="70%">

## Install

Not yet in the community plugin store. Manual install:

1. Download `main.js`, `manifest.json` (and `styles.css`) from the
   [latest release](https://github.com/iceblyte/ghostmark/releases/latest);
2. Put them in `<vault>/.obsidian/plugins/ghostmark/`;
3. Enable **Ghostmark** in *Settings → Community plugins*.

## Development

```bash
npm install
npm run dev     # esbuild watch
npm run build   # tsc -noEmit + production bundle → main.js
npm run lint    # eslint with eslint-plugin-obsidianmd
npm test        # vitest (core engine + fixture acceptance)
```

The core engine (`src/core/`) is pure TypeScript with no Obsidian or CodeMirror
imports, fully unit-tested against the committed synthetic sample
`src/core/fixtures/watermark-fixture.md` — 801 invisible characters (U+2062
×108, U+061C ×216, U+2002 ×300, U+2009 ×177) plus 4 ZWJ and 1 skin modifier:
806 hits, 798 clearable, zero residue after clear-all.

**Dev vault tip:** copy `main.js`, `manifest.json` and `styles.css` into your
test vault's `.obsidian/plugins/ghostmark/` after every build, or use
[pjeby/hot-reload](https://github.com/pjeby/hot-reload) with `npm run dev` for
instant reloads.

## License

[MIT](LICENSE)

---

<sub>Screenshots are rendered from the plugin's UI design prototypes; the real
UI follows them with a segmented gutter badge, sub-page settings and a pick
check-list on top.</sub>
