<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * [H14]: having won both lanes while Calm, the winner keeps 1 of the 2 stacks
 * `ResolveBattle` just captured; the other's Captor and Hostage both retire
 * to the Shrine as Monks. The 2 candidates are simply the winner's 2
 * highest-id stacks — nothing else creates a stack for this player between
 * `ResolveBattle` and here, so this is fully re-derivable on reload/zombie
 * with no extra Globals entry.
 */
class ChooseStack extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_CHOOSE_STACK,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must choose which stack to keep'),
            descriptionMyTurn: clienttranslate('${you} must choose which stack to keep'),
        );
    }

    #[PossibleAction]
    public function actChooseStack(int $stack_id)
    {
        $this->chooseStack(Players::getCurrentId(), $stack_id);

        return BattleEnd::class;
    }

    private function chooseStack(int $playerId, int $keptStackId): void
    {
        $pendingIds = array_map(
            fn($c) => $c->getLocationArg(),
            array_slice(Cards::getStacksFor($playerId)->toArray(), -2)
        );

        if (!in_array($keptStackId, $pendingIds, true)) {
            throw new UserException(clienttranslate('Invalid stack choice'));
        }

        $declinedId = $pendingIds[0] === $keptStackId ? $pendingIds[1] : $pendingIds[0];
        Cards::retireToShrine(...Cards::getStackCards($declinedId)->toArray());

        Notifications::stackKept(Players::get($playerId), $keptStackId, $declinedId);
    }

    /**
     * Arbitrary but legal: keeps the more recently formed of the 2 stacks.
     * See https://en.doc.boardgamearena.com/Zombie_Mode
     */
    function zombie(int $playerId)
    {
        $keptStackId = Cards::getStacksFor($playerId)->last()->getLocationArg();
        $this->chooseStack($playerId, $keptStackId);

        return BattleEnd::class;
    }
}
