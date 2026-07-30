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

// RULES.md §6 ➌ — Cards::drawCards() already draws fewer when the deck is short.
class DrawCards extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_DRAW_CARDS,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $attackerId = Globals::getAttackerId();
        $defenderId = Players::getOpponentId($attackerId);

        foreach ([$attackerId, $defenderId] as $playerId) {
            $drawn = Cards::drawCards($playerId, 2);
            if (!$drawn->isEmpty()) {
                Notifications::cardsDrawn(Players::get($playerId), $drawn);
            }
        }

        return ResolveTactics::class;
    }
}
