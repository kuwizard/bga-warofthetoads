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

class WarSetup extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_WAR_SETUP,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    public function onEnteringState()
    {
        $players = Players::getInTableOrder();

        if (Globals::getWar() === 1) {
            Cards::setupNewGame();
            $attackerId = $players[bga_rand(0, count($players) - 1)]->getId();
            Globals::setFirstAttackerWar1($attackerId);
        } else {
            Cards::reconstructDecksForSecondWar();
            $attackerId = Players::getOpponentId(Globals::getFirstAttackerWar1());
        }

        Globals::setBattle(1);
        Globals::setAttackerId($attackerId);

        // The 1st War is set up before any client has loaded the table — only the 2nd is watched live.
        if (Globals::getWar() === 2) {
            Notifications::warStarted(2, Cards::getDeckColorByPlayerId(), Cards::getDeckCountsByPlayerId());
            Notifications::moodChanged(Cards::getAngryByPlayerId());

            foreach ($players as $player) {
                Cards::shuffleDeck($player->getId());
                Notifications::cardsDrawn($player, Cards::drawCards($player->getId(), 5), arrivesFaceUp: true);
            }
        }

        return ReturnCard::class;
    }
}
