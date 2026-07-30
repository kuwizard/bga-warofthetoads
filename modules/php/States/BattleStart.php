<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * Opens a Battle (RULES.md §5/§6): sets the Attacker active and announces the
 * battle number. Reached from `ReturnCard` (1st Battle of the War) or
 * `BattleEnd` (every later Battle).
 */
class BattleStart extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_BATTLE_START,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $attacker = Players::get(Globals::getAttackerId());
        $this->gamestate->changeActivePlayer($attacker->getId());

        Notifications::battleStarted(Globals::getBattle(), $attacker);

        return AttackerPlay::class;
    }
}
