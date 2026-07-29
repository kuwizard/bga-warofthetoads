<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Managers;

use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Helpers\CachedDB_Manager;
use Bga\Games\WarOfTheToads\Helpers\Collection;
use Bga\Games\WarOfTheToads\Models\Player;

/**
 * Manager for the `player` table — and the reference implementation of the
 * Manager pattern. Copy its shape for every new table:
 *
 *   1. extend CachedDB_Manager
 *   2. set $table / $primary
 *   3. override cast() to build the Model
 *   4. re-declare get()/getAll() purely to narrow the return type
 *   5. put every query for this table here, and nowhere else
 *
 * Prefer `Players::getActive()` over `$this->getActivePlayerId()` in state
 * classes — it keeps player resolution in one place and hands back a Model.
 */
class Players extends CachedDB_Manager
{
    protected static string $table   = 'player';
    protected static string $primary = 'player_id';

    protected static function cast(array $row): Player
    {
        return new Player($row);
    }

    // ── SETUP ─────────────────────────────────────────────────────────────────

    /**
     * Seeds the `player` table. Call from `Game::setupNewGame()` BEFORE
     * `reloadPlayersBasicInfos()` and before any stat init.
     *
     * @param array $players the framework's $players array
     * @param array $colors  from `getGameinfos()['player_colors']`
     */
    public static function setupNewGame(array $players, array $colors): void
    {
        $rows = [];
        foreach ($players as $playerId => $player) {
            $rows[] = [
                $playerId,
                array_shift($colors),
                $player['player_canal'],
                $player['player_name'],
                $player['player_avatar'],
            ];
        }

        self::DB()->multipleInsert([
            'player_id',
            'player_color',
            'player_canal',
            'player_name',
            'player_avatar',
        ])->values($rows);
    }

    // ── READS ─────────────────────────────────────────────────────────────────

    public static function get(int $id): ?Player
    {
        /** @var ?Player */
        return parent::get($id);
    }

    /** @return Collection<Player> */
    public static function getAll(): Collection
    {
        return parent::getAll();
    }

    public static function getCount(): int
    {
        return static::getAll()->count();
    }

    /** The player whose turn it is. Safe in GAME and ACTIVE_PLAYER states. */
    public static function getActiveId(): int
    {
        return (int) Game::get()->getActivePlayerId();
    }

    public static function getActive(): ?Player
    {
        return static::get(static::getActiveId());
    }

    /**
     * The player who sent the current request — this is the one to use in
     * MULTIPLE_ACTIVE_PLAYER actions. Never call it from `setupNewGame()` or
     * from an args method; BGA raises "Not logged" there.
     */
    public static function getCurrentId(): int
    {
        return (int) Game::get()->getCurrentPlayerId();
    }

    public static function getCurrent(): ?Player
    {
        return static::get(static::getCurrentId());
    }

    public static function getByColor(string $color): ?Player
    {
        // Hex colors must be compared with === — '4baae2' == 0 is true under ==.
        return static::getAll()->filter(fn(Player $p) => $p->getColor() === $color)->first();
    }

    /** Table order, starting from `player_no` 1. @return Player[] */
    public static function getInTableOrder(): array
    {
        return static::getAll()->sort(fn(Player $a, Player $b) => $a->getNo() <=> $b->getNo())->toArray();
    }

    /** Payload for `Game::getAllDatas()`, keyed by player id. */
    public static function getUiData(?int $currentPlayerId = null): Collection
    {
        return static::getAll()->map(fn(Player $p) => $p->getUiData($currentPlayerId));
    }
}
