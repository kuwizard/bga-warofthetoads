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

// ── State ids ─────────────────────────────────────────────────────────────────
// Passed to the GameState constructor. 1 (gameSetup) and 99 (gameEnd) are
// reserved by the framework. 98 is the conventional slot for score computation,
// since argGameEnd()/stGameEnd() are final and cannot be overridden.
//
// PR2 renamed the template's placeholder PlayerTurn (id 10) in place into the
// real WarSetup — same numeric id, real logic — and deleted the now-dead
// NextPlayer. PR3 renamed that same slot (90) in place into the real
// BattleEnd, and added ST_DEFENDER_SETUP (35): a GAME-type state whose only
// job is to call changeActivePlayer() between AttackerPlay and DefenderPlay —
// the framework only allows that call from a GAME-state handler, never from
// inside an ACTIVE_PLAYER action (verified against bga-imperialsettlers/
// bga-aceofspades). EndScore (98) is still the template placeholder;
// BattleEnd transitions to it once a hand drops below 2 cards; PR7 renames
// EndScore in place into ComputeScores.

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
const ST_GAME_END       = 99;

// Template placeholder state, still wired until PR7 (ComputeScores).
const ST_END_SCORE   = 98;

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

// ── Card deck (printed colour) ──────────────────────────────────────────────────
// Values of the `card_deck` column. NEVER changes for a card, unlike
// `card_controller` which swaps at the 2nd War (RULES.md, [H2]).

const CARD_DECK_BLUE = 'blue';
const CARD_DECK_RED  = 'red';

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

// ── Game options ──────────────────────────────────────────────────────────────
// This game has no variants — gameoptions.jsonc stays empty, nothing to declare.

// ── Player preferences ────────────────────────────────────────────────────────
// Ids must match the keys in gamepreferences.jsonc (100-199).

const PREF_ANIMATION_SPEED = 100;

// ── Statistics ────────────────────────────────────────────────────────────────
// Names must match the keys in stats.jsonc, and be registered in Core\Stats.
// None yet — the first real statistics ship in PR9.
