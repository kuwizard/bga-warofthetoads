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
| `modules/php/` | Server-side game logic — see *PHP architecture* below |
| `bga-framework.d.ts` | Framework type definitions — re-sync from SFTP periodically, never edit |

All generated files are tracked in git and deployed to BGA — every `.js` under
`modules/js/`, not just `Game.js`.

## PHP architecture

Ported from `libertalia-winds-of-galecrest`, `bga-imperialsettlers` and
`bga-aceofspades`. The parts every one of those projects converged on:

| Path | Purpose |
|---|---|
| `Game.php` | Only what the framework demands. No constants, no game logic |
| `constants.inc.php` | Global `const` declarations, `require_once`d by `Game.php` |
| `Helpers/DB_Manager.php` | Base for table managers |
| `Helpers/CachedDB_Manager.php` | The above + per-request read cache — **extend this one** |
| `Helpers/QueryBuilder.php` | Fluent SQL. The only place that builds SQL strings |
| `Helpers/Collection.php` | Typed result set (`map`/`filter`/`reduce`/`first`) |
| `Helpers/DB_Model.php` | Typed row object with generated accessors |
| `Managers/` | One per table. All SQL for that table, and nowhere else |
| `Models/` | One typed object per table row |
| `Data/` | Static component definitions (cards, tiles) — see `Data/README.md` |
| `States/` | One class per game state |
| `Core/Globals.php` | Typed accessors over `bga->globals` |
| `Core/Stats.php` | Single registration point for statistics |
| `Core/DebugTrait.php` | `debug_*` helpers, invokable from the Studio toolbar |
| `Notifications.php` | Every notification the game sends, as a named method |

### The rules that make it work

1. **One Manager per table; all SQL goes through it.** `Game.php`, state classes
   and `Data/` classes never call `DbQuery`. The `player` table is wrapped too
   (`Managers/Players`) — it is not a special case.
2. **`Game::get()`** is the static singleton set in the constructor. It is how
   the static Managers and `Notifications` reach the framework.
3. **Reads return a `Collection`**, keyed by primary key. `QueryBuilder` aliases
   the primary column to `_pk` to build those keys.
4. **`getAllDatas()` is assembled from `getUiData()`**, on Models and Managers —
   never from raw SQL. Pass `$currentPlayerId` down so a Model can hide what
   that player must not see.
5. **Setters write themselves.** `$player->setScore(5)` updates the object and
   runs the `UPDATE`. Declare the column in `$attributes`; no getter/setter
   boilerplate. Unchanged `int`/`bool` values skip the write entirely.
6. **Notifications are named methods**, not inline `notify->all` calls. The
   message, its `clienttranslate()`, its args and the JS handler name then live
   in one greppable place. `updateArgs()` is the shared hook that expands a
   `Player` object into `player_id` + `player_name`.
7. **Constants are `const`, never `define()`.** Under a namespace `define()`
   produces a constant namespaced code cannot see.

### Adding a table

```php
// dbmodel.sql — prefix with the game name; never use a BGA-reserved name
// (moves, player, global, stats, gamelog, replaysavepoint, bga_*)
CREATE TABLE IF NOT EXISTS `wott_card` ( ... ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```php
// Models/Card.php
class Card extends DB_Model {
    protected string $table = 'wott_card';
    protected string $primary = 'card_id';
    protected array $attributes = [
        'id'       => ['card_id', 'int'],
        'location' => 'card_location',
        'playerId' => ['player_id', 'int'],
    ];
}
```

```php
// Managers/Cards.php
class Cards extends CachedDB_Manager {
    protected static string $table = 'wott_card';
    protected static string $primary = 'card_id';

    protected static function cast(array $row): Card { return new Card($row); }

    public static function get(int $id): ?Card { return parent::get($id); }
    public static function getAll(): Collection { return parent::getAll(); }

    public static function getHand(int $playerId): Collection {
        return self::getAll()->where('location', LOCATION_HAND)->where('playerId', $playerId);
    }
}
```

### Writing, and the cache

`CachedDB_Manager` loads the whole table once per request. Two write paths keep
that cache honest, one does not:

```php
// 1. Through the Models — preferred. Mutates the cached object AND persists.
$card->setLocation(LOCATION_DISCARD);
Cards::getHand($pId)->update('location', LOCATION_DISCARD)->update('state', 0);

// 2. Through create()/update()/remove() — these drop the cache themselves.
Cards::create(['card_location' => LOCATION_DECK]);

// 3. Raw QueryBuilder — writes behind the cache's back. Cannot be auto-detected.
Cards::DB()->update(['card_location' => LOCATION_DECK])->where(...)->run();
Cards::invalidate();   // ← mandatory, or reads stay stale for the rest of the request
```

Prefer (1). `Collection::update($attr, $value)` calls `set<Attr>()` on every
member, so the objects the cache holds are the objects that changed — there is
nothing to invalidate. It costs one `UPDATE` per row, which is the normal shape
of a BGA write anyway.

`Collection::where($attr, $value)` is the read counterpart: it filters on the
Model's getter, treats `null` as "no filter" so optional criteria chain without
branching, and compares **strictly** — an `int` attribute needs an int, not a
numeric string. That strictness is deliberate; `==` considers the hex color
`'4baae2'` equal to `0`.

### Deliberately not ported

- **`Helpers/Log`** (libertalia) — row-level undo log written by `QueryBuilder`.
  Powerful, but entangled with that project's action Engine; porting it
  generically is real work rather than a copy.
- **`Core/Preferences`** (imperialsettlers) — DB-backed per-player preferences.
  Needs its own table, and only pays off when preferences must be readable
  server-side.
- **`Core/Stack`, `Helpers/Pieces`, `Core/Engine`** — genuinely game-specific.

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
