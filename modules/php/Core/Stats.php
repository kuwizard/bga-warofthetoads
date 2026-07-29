<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Core;

use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Models\Player;

/**
 * Single registration point for statistics.
 *
 * Every stat name is listed once in `$stats`, `setupNewGame()` initialises the
 * whole set, and `incPlayer()` / `setTable()` reject names that were never
 * registered. That turns a typo — normally a runtime "Unknown statistic id"
 * from BGA, hours later — into an immediate exception.
 *
 * The three buckets map onto the framework's two stat stores:
 *   'common' — per-player stats that ALSO aggregate into a table stat of the
 *              same name (the framework's `$updateTableStat` flag). Both the
 *              table and player sections of `stats.jsonc` need the entry.
 *   'table'  — table-only stats.
 *   'player' — player-only stats.
 *
 * Names must match the keys in `stats.jsonc`, and the file must be reloaded
 * from the Studio manage page after any change.
 */
class Stats
{
    protected static array $stats = [
        'common' => [
            // STAT_TURNS_NUMBER,
        ],
        'table' => [
            // STAT_ROUNDS_PLAYED,
        ],
        'player' => [
            // STAT_CARDS_PLAYED,
        ],
    ];

    public static function setupNewGame(): void
    {
        // playerStats->init() takes the whole list at once — never loop over players.
        if (!empty(static::$stats['common'])) {
            Game::get()->bga->playerStats->init(static::$stats['common'], 0, true);
        }
        if (!empty(static::$stats['table'])) {
            Game::get()->bga->tableStats->init(static::$stats['table'], 0);
        }
        if (!empty(static::$stats['player'])) {
            Game::get()->bga->playerStats->init(static::$stats['player'], 0);
        }
    }

    // ── TABLE ─────────────────────────────────────────────────────────────────

    public static function setTable(string $statName, int|float|bool $value): void
    {
        static::assertRegistered($statName, 'table');
        Game::get()->bga->tableStats->set($statName, $value);
    }

    public static function incTable(string $statName, int|float $delta = 1): void
    {
        static::assertRegistered($statName, 'table');
        Game::get()->bga->tableStats->inc($statName, $delta);
    }

    // ── PLAYER ────────────────────────────────────────────────────────────────

    public static function setPlayer(int|Player $player, string $statName, int|float|bool $value): void
    {
        static::assertRegistered($statName, 'player');
        Game::get()->bga->playerStats->set($statName, $value, static::playerId($player));
    }

    public static function incPlayer(int|Player $player, string $statName, int|float $delta = 1): void
    {
        static::assertRegistered($statName, 'player');
        // 'common' stats mirror into the table stat of the same name.
        $isCommon = in_array($statName, static::$stats['common'], true);
        Game::get()->bga->playerStats->inc($statName, $delta, static::playerId($player), $isCommon);
    }

    // ── PRIVATE ───────────────────────────────────────────────────────────────

    /** @param 'table'|'player' $bucket the store this call writes to */
    private static function assertRegistered(string $statName, string $bucket): void
    {
        if (in_array($statName, static::$stats[$bucket], true)) {
            return;
        }
        if (in_array($statName, static::$stats['common'], true)) {
            return; // common stats exist in both stores
        }
        throw new \InvalidArgumentException("Unknown $bucket stat: {$statName}");
    }

    private static function playerId(int|Player $player): int
    {
        return $player instanceof Player ? $player->getId() : $player;
    }
}
