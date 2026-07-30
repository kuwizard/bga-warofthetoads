<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * RULES.md §6 (end) / §5 — alternates the Attacker and loops back to
 * `BattleStart`, or ends the War once a hand drops below 2 cards (RULES.md
 * §8). The lane is already empty by the time this runs — `ResolveBattle`
 * moved every card to a stack or the Shrine.
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
        $attackerId = Globals::getAttackerId();
        $defenderId = Players::getOpponentId($attackerId);

        // Every capture path converges here, so this is where §7's Calm/Angry
        // has finished moving for the Battle — sent even when unchanged, it's
        // 2 booleans and saves diffing derived state the server doesn't store.
        Notifications::moodChanged(Cards::getAngryByPlayerId());

        if (Cards::getHandCount($attackerId) < 2 || Cards::getHandCount($defenderId) < 2) {
            return EndScore::class;
        }

        Globals::setAttackerId($defenderId);
        Globals::setBattle(Globals::getBattle() + 1);

        return BattleStart::class;
    }
}
