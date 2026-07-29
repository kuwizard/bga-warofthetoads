# War of the Toads

Board Game Arena game, built on the new BGA framework (2025+) with TypeScript and SCSS,
following [Using Typescript and Scss](https://en.doc.boardgamearena.com/Using_Typescript_and_Scss).

## Layout

| Path | Purpose |
|---|---|
| `src/ts/` | TypeScript sources — `Game.ts` is the rollup entry point |
| `src/ts/types.d.ts` | All game-specific interfaces / type aliases (ambient, no imports needed) |
| `src/ts/States/` | One class per PHP game state |
| `src/ts/libs.ts` | Central place to import the BGA front libs (bga-cards, bga-animations, …) |
| `src/scss/` | SCSS sources — `Game.scss` is the entry point, partials are `_name.scss` |
| `modules/js/Game.js` | **Generated** bundle (deployed to BGA) — do not edit |
| `warofthetoads.css` | **Generated** stylesheet (deployed to BGA) — do not edit |
| `modules/php/` | Server-side game logic |
| `bga-framework.d.ts` | Framework type definitions — re-sync from SFTP periodically, never edit |

Both generated files are tracked in git because BGA deploys them.

## Build

The IDE compiles both TS and SCSS on save. To run the build manually:

```bash
npm run build      # TS + SCSS once
npm run watch      # both in watch mode
```

Note: `npm run build:scss` needs Node >= 20.19 (current `sass` depends on an ESM-only
`chokidar`). The TypeScript build works on any Node 20.

## SCSS conventions

Keep every `@use` at the very top of a file, above any loud `/* */` comment. Sass re-emits
loud comments that precede a `@use` once per loaded module, duplicating them in the
compiled CSS. Use `//` comments above the `@use` block instead.

Add a feature partial as `src/scss/_feature.scss` plus one `@use './feature';` line in
`Game.scss`.
