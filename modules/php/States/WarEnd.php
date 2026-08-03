<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\Player;
use Bga\Games\WarOfTheToads\Notifications;

class WarEnd extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_WAR_END,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    public function onEnteringState()
    {
        $war = Globals::getWar();
        $players = Players::getInTableOrder();

        $hostages = [];
        foreach ($players as $player) {
            $hostages[$player->getId()] = Cards::getCaptureCount($player->getId());
        }

        [$id1, $id2] = array_map(fn(Player $p) => $p->getId(), $players);
        $winnerId = $hostages[$id1] === $hostages[$id2]
            ? null
            : ($hostages[$id1] > $hostages[$id2] ? $id1 : $id2);

        Notifications::warEnded($war, $winnerId === null ? null : Players::get($winnerId), $hostages);

        // §10 falls out of the totals: the 2nd War outranks the 1st, and only a double Stalemate leaves 0-0 — exactly when [H3] applies.
        if ($winnerId !== null) {
            $this->game->bga->playerScore->inc($winnerId, $war === 2 ? 2 : 1);
        }

        if ($war === 2) {
            return ComputeScores::class;
        }

        foreach ($players as $player) {
            $casualty = Cards::getHand($player->getId())->first();
            Cards::setAsideAsCasualty($casualty);
            Notifications::casualtySet($player, $casualty);
        }

        Globals::setWar(2);
        return WarSetup::class;
    }
}
