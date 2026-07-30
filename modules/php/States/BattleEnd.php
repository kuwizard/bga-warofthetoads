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
 * RULES.md §6 (end) / §5 — alternates the Attacker and loops back to
 * `BattleStart`, or ends the War once a hand drops below 2 cards (RULES.md
 * §8). No capture/scoring yet (PR4's `ResolveBattle`); every battle in PR3
 * "resolves to nothing".
 */
class BattleEnd extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_BATTLE_END,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        // PR3 placeholder — PR4's ResolveBattle empties the lane via real
        // capture logic before BattleEnd ever runs, making this call dead
        // code; delete it once that lands.
        Cards::clearLane();

        $attackerId = Globals::getAttackerId();
        $defenderId = Players::getOpponentId($attackerId);

        if (Cards::getHandCount($attackerId) < 2 || Cards::getHandCount($defenderId) < 2) {
            return EndScore::class;
        }

        Globals::setAttackerId($defenderId);
        Globals::setBattle(Globals::getBattle() + 1);

        return BattleStart::class;
    }
}
