<?php

/**
 * Game-wide constants.
 *
 * These are plain global `const` declarations in an un-namespaced file, pulled
 * in by `require_once` at the top of Game.php. That makes them visible from
 * every namespaced class without a `use` line, which is what keeps state
 * classes and Managers readable.
 *
 * Rules:
 *   - `const`, never `define()` — `define()` under a namespace produces a
 *     constant that namespaced code cannot see, and re-inclusion then throws
 *     "Constant X already defined".
 *   - no logic in this file, only declarations.
 *   - string constants for anything stored in a DB column (locations, types) —
 *     they survive a schema dump readably; ints do not.
 *
 * Everything below is an example. Delete what the game does not use.
 */

// ── State ids ─────────────────────────────────────────────────────────────────
// Passed to the GameState constructor. 1 (gameSetup) and 99 (gameEnd) are
// reserved by the framework. 98 is the conventional slot for score computation,
// since argGameEnd()/stGameEnd() are final and cannot be overridden.

const ST_GAME_SETUP  = 1;
const ST_PLAYER_TURN = 10;
const ST_NEXT_PLAYER = 90;
const ST_END_SCORE   = 98;
const ST_GAME_END    = 99;

// ── Card / token locations ────────────────────────────────────────────────────
// Values of a `location` column. Keep them short — the column is usually
// VARCHAR(16) — and keep them stable, they end up in saved games.

const LOCATION_DECK    = 'deck';
const LOCATION_HAND    = 'hand';
const LOCATION_BOARD   = 'board';
const LOCATION_DISCARD = 'discard';

// ── Game options ──────────────────────────────────────────────────────────────
// Ids must match the keys in gameoptions.jsonc (100-199).

// const OPT_VARIANT      = 100;
// const VARIANT_STANDARD = 1;
// const VARIANT_ADVANCED = 2;

// ── Player preferences ────────────────────────────────────────────────────────
// Ids must match the keys in gamepreferences.jsonc (100-199).

// const PREF_COLORBLIND = 100;

// ── Statistics ────────────────────────────────────────────────────────────────
// Names must match the keys in stats.jsonc, and be registered in Core\Stats.

// const STAT_TURNS_NUMBER = 'turns_number';
