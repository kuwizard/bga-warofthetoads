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
 * See doc/IMPLEMENTATION_PLAN.md §2 for the design these mirror.
 */

// ── State ids — 1/99 are framework-reserved; 98 is the score slot (argGameEnd/stGameEnd are final); rename history: doc/IMPLEMENTATION_PLAN.md §2.2 ──

const ST_GAME_SETUP  = 1;
const ST_WAR_SETUP      = 10;
const ST_RETURN_CARD    = 15;
const ST_BATTLE_START   = 20;
const ST_ATTACKER_PLAY  = 30;
const ST_DEFENDER_SETUP = 35;
const ST_DEFENDER_PLAY  = 40;
const ST_DRAW_CARDS     = 50;
const ST_RESOLVE_TACTICS = 60;
const ST_SCOUT_REVEAL   = 65;
const ST_RESOLVE_BATTLE = 70;
const ST_CHOOSE_STACK   = 75;
const ST_SIEGE_GUESS    = 80;
const ST_BATTLE_END     = 90;
const ST_WAR_END        = 95;
const ST_COMPUTE_SCORES = 98;
const ST_GAME_END       = 99;

// ── Card / token locations ────────────────────────────────────────────────────
// Values of the `card_location` column (dbmodel.sql, PR2). Keep them short —
// the column is VARCHAR(16) — and keep them stable, they end up in saved games.

const LOCATION_DECK     = 'deck';
const LOCATION_HAND     = 'hand';
const LOCATION_LANE     = 'lane';
const LOCATION_STACK    = 'stack';
const LOCATION_SHRINE   = 'shrine';
const LOCATION_CASUALTY = 'casualty';

// ── Lane numbers ──────────────────────────────────────────────────────────────
// Values of `card_location_arg` while `card_location` is LOCATION_LANE.
// Lane number is derived from a card's facedown status, never chosen
// independently (IMPLEMENTATION_PLAN.md §2.1: "the board is really one open
// lane and one hidden lane" until PR5's Trickster swaps them).

const LANE_OPEN   = 1; // face-up card
const LANE_HIDDEN = 2; // face-down card

// ── Card type ──────────────────────────────────────────────────────────────────
// Values of the `card_type` column. The 9 card definitions (material.inc.php,
// PR2) — one of each per deck colour, 18 cards total.

const CARD_TYPE_ASSASSIN  = 'assassin';
const CARD_TYPE_SCOUT     = 'scout';
const CARD_TYPE_SABOTEUR  = 'saboteur';
const CARD_TYPE_TRICKSTER = 'trickster';
const CARD_TYPE_BERSERKER = 'berserker';
const CARD_TYPE_BODYGUARD = 'bodyguard';
const CARD_TYPE_GENERAL_A = 'general_a';
const CARD_TYPE_GENERAL_B = 'general_b';
const CARD_TYPE_SIEGE     = 'siege';

// Both Generals are printed "General", so SiegeGuess's protocol has 8 values, not 9 ([H17]).
const GUESS_TYPE_GENERAL = 'general';

// The highest printed Strength (both Generals) — the span [H3]'s Casualty rank is inverted over.
const CARD_STRENGTH_MAX = 7;

// ── Victory conditions (RULES.md §10, in order — States/ComputeScores) ────────

const VICTORY_SECOND_WAR        = 'secondWar';
const VICTORY_WON_AND_STALEMATE = 'wonAndStalemate';
const VICTORY_LOWEST_CASUALTY   = 'lowestCasualty';

// ── Card deck (printed colour) ──────────────────────────────────────────────────
// Values of the `card_deck` column. NEVER changes for a card, unlike
// `card_controller` which swaps at the 2nd War (RULES.md, [H2]).

const CARD_DECK_BLUE = 'blue';
const CARD_DECK_RED  = 'red';

// Mirrors `player_colors` in gameinfos.jsonc and $deck-colors in src/scss/variables.scss.
const PLAYER_COLOR_BY_DECK = [
    CARD_DECK_BLUE => '1a3ec1',
    CARD_DECK_RED  => 'c0392b',
];

// ── Special Attributes ───────────────────────────────────────────────────────
// Not a DB column — looked up from `material.inc.php` by `card_type`, same as
// Strength and the Tactic band. `null` in material.inc.php means "no Special
// Attribute" (Scout, Trickster, Berserker, Bodyguard). The Siege Cannon's
// value covers both halves of its printed text (wins in Attack, loses in
// Defence, except against a Saboteur) — RULES.md §3, [H16].

const SPECIAL_ATTRIBUTE_BEATS_GENERAL    = 'beats_general';    // Assassin
const SPECIAL_ATTRIBUTE_BEATS_SIEGE      = 'beats_siege';      // Saboteur
const SPECIAL_ATTRIBUTE_LOSES_TO_ASSASSIN = 'loses_to_assassin'; // General A, General B
const SPECIAL_ATTRIBUTE_SIEGE             = 'siege';            // Siege Cannon, [H16]

// ── Tactic priority bands ────────────────────────────────────────────────────────
// The order the Tactic pipeline resolves in (IMPLEMENTATION_PLAN.md §2.3).

const TACTIC_BAND_BLOCK  = 'block';
const TACTIC_BAND_START  = 'start';
const TACTIC_BAND_DURING = 'during';
const TACTIC_BAND_AFTER  = 'after';

// ── Tactic events: Models/BattleContext's event log, notified by ResolveTactics ──

const TACTIC_EVENT_BLOCKED        = 'blocked';        // Bodyguard
const TACTIC_EVENT_LANES_SWITCHED = 'lanesSwitched';  // Trickster
const TACTIC_EVENT_STRENGTH       = 'strength';       // Scout, both Generals, Assassin
const TACTIC_EVENT_TIE_BREAKER    = 'tieBreaker';     // Saboteur
const TACTIC_EVENT_ANGRY          = 'angry';          // Berserker, [H15]
const TACTIC_EVENT_NO_EFFECT      = 'noEffect';       // reason below

const TACTIC_NO_EFFECT_BLOCKED     = 'blocked';     // blocked by a Bodyguard
const TACTIC_NO_EFFECT_NO_TARGET   = 'noTarget';    // [H5]'s tie, [H9]'s Trickster
const TACTIC_NO_EFFECT_NO_STRENGTH = 'noStrength';  // [H16] the Siege Cannon

// ── Game options ──────────────────────────────────────────────────────────────
// This game has no variants — gameoptions.jsonc stays empty, nothing to declare.

// ── Player preferences ────────────────────────────────────────────────────────
// Ids must match the keys in gamepreferences.jsonc (100-199).

const PREF_ANIMATION_SPEED = 100;

// ── Statistics ────────────────────────────────────────────────────────────────
// Names must match the keys in stats.jsonc, and be registered in Core\Stats.
// None yet — the first real statistics ship in PR9.
