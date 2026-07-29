# War of the Toads

Board Game Arena game, built on the new BGA framework (2025+) with TypeScript and SCSS,
following [Using Typescript and Scss](https://en.doc.boardgamearena.com/Using_Typescript_and_Scss).

## Layout

| Path | Purpose |
|---|---|
| `src/ts/Game.ts` | Client entry point — BGA calls `new Game(bga)` |
| `src/ts/types.d.ts` | All game-specific interfaces / type aliases (ambient, no imports needed) |
| `src/ts/States/` | One class per PHP game state |
| `src/ts/libs.ts` | Central place to import the BGA front libs (bga-cards, bga-animations, …) |
| `src/scss/Game.scss` | SCSS hub — global setup + one `@use` per feature; the only file compiled |
| `src/scss/variables.scss` | Shared SCSS values (`@use 'variables' as v;`) |
| `src/scss/*.scss` | One SCSS file per feature area (board, hand, tokens, …) |
| `modules/js/` | **Generated** JS, mirroring `src/ts/` 1:1 — do not edit |
| `warofthetoads.css` | **Generated** stylesheet — do not edit |
| `modules/php/` | Server-side game logic |
| `bga-framework.d.ts` | Framework type definitions — re-sync from SFTP periodically, never edit |

All generated files are tracked in git and deployed to BGA — every `.js` under
`modules/js/`, not just `Game.js`.

## Build

PhpStorm compiles both on save (see below). To run a build manually:

```bash
npm run build      # TS + SCSS once
npm run watch      # both in watch mode
```

Note: `npm run build:scss` needs Node >= 20.19 (current `sass` depends on an ESM-only
`chokidar`). `tsc` works on any Node 20.

### TypeScript: per-file, no bundler

`tsc` emits one `.js` per `.ts`, mirroring the folder structure — `src/ts/Game.ts` →
`modules/js/Game.js`, `src/ts/States/PlayerTurn.ts` → `modules/js/States/PlayerTurn.js`.
This matches the other BGA projects. There is no rollup and no bundle.

**Import specifiers must end in `.js`:**

```typescript
import { PlayerTurn } from "./States/PlayerTurn.js";   // ✓
import { PlayerTurn } from "./States/PlayerTurn";      // ✗ compiles, fails in browser
```

`tsc` emits the specifier unchanged, so an extensionless path produces an ES module the
browser cannot resolve. It compiles clean and fails silently at load time on BGA.

`rootDir` is `src/ts` (not `.` as the BGA doc suggests) — root-level `bga-framework.d.ts`
is still picked up via `include`, because a `.d.ts` emits nothing and is exempt from the
`rootDir` check.

### PhpStorm setup

- **TypeScript:** Settings → Languages & Frameworks → TypeScript → ✅ *Recompile on
  changes*. It reads `tsconfig.json`; nothing else to configure.
- **SCSS:** a File Watcher — see the table below.

## SCSS conventions

Same structure as the other BGA projects (`GAMENAME.scss` hub + one file per feature),
moved under `src/` and switched from `@import` to `@use`.

- **`src/scss/Game.scss` is the hub.** It holds only global setup — `@font-face`,
  `:root` custom properties — plus one `@use './<feature>';` line per feature.
  No feature rules live in the hub.
- **One file per feature area**, flat in `src/scss/` next to the hub, no `_` prefix. The
  IDE watcher runs on root files only, so feature files are never compiled standalone.
- **Comment with `//` only, never `/* */`.** Sass copies loud `/* */` comments straight
  into the compiled CSS, and re-emits any that precede a `@use` once per loaded module —
  so they land in `warofthetoads.css`, duplicated. `//` comments are stripped at compile
  time. This keeps the deployed CSS free of source documentation entirely.
- **`@use` is not `@import`:** nothing is global any more. Every file that needs a
  variable or mixin must `@use 'variables' as v;` itself. (`@import` still works but
  Dart Sass warns on every compile and drops it in 3.0.)
- **Prefix every game class** with `wott-` so it can't collide with a BGA framework class.
- **Animation speed:** JS sets `--am` on `:root` from the player preference. Every timed
  rule must be `calc(Xs * var(--am))` — a hardcoded duration silently ignores the
  preference. The JS half (`applyAnimSpeed` / `animDur`) is not ported yet.

Adding a feature: create `src/scss/feature.scss`, add `@use './feature';` to `Game.scss`.

## SCSS file watcher (PhpStorm)

The other projects compile `GAMENAME.scss` in place, so their watcher can use
`$FileNameWithoutExtension$`. Here the hub is `src/scss/Game.scss` but the output must be
`warofthetoads.css` in the project root, so the output path is given explicitly:

| Field | Value |
|---|---|
| File type | SCSS style sheet |
| Scope | Project Files |
| Program | `sass` |
| Arguments | `--no-source-map $FileName$:$ProjectFileDir$/warofthetoads.css` |
| Working directory | `$FileDir$` |
| Output paths to refresh | `$ProjectFileDir$/warofthetoads.css` |
| Track only root files | ✅ on |
| Trigger on external changes | ✅ on |

"Track only root files" is what makes editing `src/scss/hand.scss` recompile the hub
rather than emit a stray `hand.css`. It matters more now that the feature files sit in
the same folder as the hub — leave it on.

Difference from the other projects: they omit `--no-source-map` and generate a
`.css.map`, which leaves a `sourceMappingURL` in the CSS deployed to BGA pointing at a
file that isn't uploaded. Drop the flag if you'd rather keep maps — `*.css.map` is
gitignored either way.
