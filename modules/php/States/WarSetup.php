<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;

/**
 * Entered once, right after `Game::setupNewGame()` — before any client has
 * loaded the table, so nothing here needs a notification (RULES.md §4, §5).
 *
 * Builds both decks, shuffles them, deals 5 cards each, and picks the 1st
 * War's first Attacker at random ([H12] — the rulebook's "whoever most
 * recently drank pondwater" has no digital equivalent).
 */
class WarSetup extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_WAR_SETUP,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        Cards::setupNewGame();

        $players = Players::getInTableOrder();
        $attackerId = $players[bga_rand(0, count($players) - 1)]->getId();

        Globals::setWar(1);
        Globals::setAttackerId($attackerId);
        Globals::setFirstAttackerWar1($attackerId);

        return ReturnCard::class;
    }
}
