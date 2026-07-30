<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Players;

/**
 * Exists solely to call `changeActivePlayer()` between `AttackerPlay` and
 * `DefenderPlay`. Verified against bga-imperialsettlers and bga-aceofspades
 * (every real call site sits inside a GAME-state's `onEnteringState()`, never
 * inside an ACTIVE_PLAYER action method) — a reusable pattern for any BGA
 * game with alternating asymmetric roles. No notification: silent GAME-state
 * passthrough, same convention as other auto-transitions in this game.
 */
class DefenderSetup extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_DEFENDER_SETUP,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $defenderId = Players::getOpponentId(Globals::getAttackerId());
        $this->gamestate->changeActivePlayer($defenderId);

        return DefenderPlay::class;
    }
}
