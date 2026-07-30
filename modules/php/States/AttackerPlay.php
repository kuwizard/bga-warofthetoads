<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\WarOfTheToads\Game;

/**
 * RULES.md §6 ➊ — the Attacker plays 2 cards, one face-up, one face-down.
 * Which is which fully determines lane placement (see `PlayCardsTrait`).
 */
class AttackerPlay extends GameState
{
    use PlayCardsTrait;

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_ATTACKER_PLAY,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play 2 cards, one face-up and one face-down'),
            descriptionMyTurn: clienttranslate('${you} must play 2 cards, one face-up and one face-down'),
        );
    }

    #[PossibleAction]
    public function actPlayCards(int $faceUpCardId, int $faceDownCardId): string
    {
        $this->playCards($faceUpCardId, $faceDownCardId);

        return DefenderSetup::class;
    }

    /** See https://en.doc.boardgamearena.com/Zombie_Mode */
    function zombie(int $playerId): string
    {
        $this->zombiePlayCards($playerId);

        return DefenderSetup::class;
    }
}
