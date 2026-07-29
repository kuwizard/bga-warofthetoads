<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Core;

use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * Home for `debug_*` helpers, kept out of Game.php.
 *
 * Any public `debug_*` method on Game is invokable from the Debug input in the
 * Studio toolbar (right of the table). Output goes to the chat log, so these
 * are the cheapest way to inspect live state without a deploy cycle.
 *
 * Everything here is Studio-only scaffolding — it ships harmlessly, but keep it
 * out of game logic.
 */
trait DebugTrait
{
    /** Dumps the current player roster as seen through the Players manager. */
    public function debug_players(): void
    {
        $lines = [];
        foreach (Players::getAll() as $player) {
            $lines[] = sprintf(
                '  id=%d no=%d color=%s name=%s',
                $player->getId(),
                $player->getNo(),
                $player->getColor(),
                $player->getName(),
            );
        }
        Notifications::message("=== players ===\n" . implode("\n", $lines));
    }

    /** Dumps every global currently set, so key typos show up immediately. */
    public function debug_globals(): void
    {
        $lines = [];
        foreach ($this->bga->globals->getAll() as $name => $value) {
            $lines[] = "  {$name} = " . json_encode($value, JSON_UNESCAPED_SLASHES);
        }
        Notifications::message("=== globals ===\n" . implode("\n", $lines));
    }
}
