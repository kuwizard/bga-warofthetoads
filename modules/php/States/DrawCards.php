<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * RULES.md §6 ➌➍ — both players draw back up to hand size (2, or 1 if only 1
 * remains — already handled by `Cards::drawCards()`'s "draw fewer if the deck
 * is short" behaviour), then the 2 face-down lane cards are revealed
 * simultaneously. No Tactic activates on this reveal yet — that pipeline is
 * PR5's `ResolveTactics`; here the identity just becomes public.
 */
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

        [$card1, $card2] = Cards::getLaneCards()->filter(fn(Card $c) => $c->isFacedown())->toArray();
        $card1->setFacedown(false);
        $card2->setFacedown(false);
        Notifications::cardsRevealed($card1, $card2);

        return ResolveBattle::class;
    }
}
