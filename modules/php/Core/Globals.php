<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Core;

use Bga\Games\WarOfTheToads\Game;

/**
 * Typed accessors over `$this->bga->globals`.
 *
 * The framework's globals store is untyped and stringly-keyed. Funnelling every
 * global through a named getter/setter pair here means the key is written once,
 * the default lives next to it, and the cast is not repeated at every call site.
 *
 * Rules:
 *   - one getter + one setter per global, nothing else
 *   - never call `Game::get()->bga->globals` from anywhere but this file
 *   - `bga->globals` JSON-serialises, so any type works (int, string, array, bool)
 *   - do NOT mix with `initGameStateLabels` — that is a separate, int-only,
 *     legacy system
 *
 * Everything below the marker is an example; delete it when the game has its own.
 */
class Globals
{
    public static function isStudio(): bool
    {
        return Game::get()->getBgaEnvironment() === 'studio';
    }

    // ── WAR ───────────────────────────────────────────────────────────────────

    public static function getWar(): int
    {
        return (int) Game::get()->bga->globals->get('war', 1);
    }

    public static function setWar(int $war): void
    {
        Game::get()->bga->globals->set('war', $war);
    }

    // ── ATTACKER ──────────────────────────────────────────────────────────────

    public static function getAttackerId(): int
    {
        return (int) Game::get()->bga->globals->get('attackerId', 0);
    }

    public static function setAttackerId(int $playerId): void
    {
        Game::get()->bga->globals->set('attackerId', $playerId);
    }

    /**
     * Whoever attacked first in the 1st War, set once by `WarSetup` and never
     * touched again. The 2nd War's Attacker is the *other* player — whoever
     * defended first in the 1st War (RULES.md §9, [H12]) — so this is the one
     * value `attackerId` itself cannot answer once it starts alternating
     * battle to battle (PR3).
     */
    public static function getFirstAttackerWar1(): int
    {
        return (int) Game::get()->bga->globals->get('firstAttackerWar1', 0);
    }

    public static function setFirstAttackerWar1(int $playerId): void
    {
        Game::get()->bga->globals->set('firstAttackerWar1', $playerId);
    }

    // ── BATTLE ────────────────────────────────────────────────────────────────

    public static function getBattle(): int
    {
        return (int) Game::get()->bga->globals->get('battle', 1);
    }

    public static function setBattle(int $battle): void
    {
        Game::get()->bga->globals->set('battle', $battle);
    }
}
