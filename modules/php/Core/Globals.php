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

    // ── EXAMPLE — replace with the game's own globals ──────────────────────────

    public static function getRound(): int
    {
        return (int) Game::get()->bga->globals->get('round', 0);
    }

    public static function setRound(int $round): void
    {
        Game::get()->bga->globals->set('round', $round);
    }
}
