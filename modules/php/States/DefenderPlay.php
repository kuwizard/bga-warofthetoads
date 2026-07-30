<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\WarOfTheToads\Game;

/**
 * RULES.md §6 ➋ — the Defender plays 2 cards in line with the Attacker's:
 * face-up matched to face-up, face-down matched to face-down. The client is
 * responsible for guiding that pairing; server-side the action shape is
 * identical to `AttackerPlay` (see `PlayCardsTrait`).
 */
class DefenderPlay extends GameState
{
    use PlayCardsTrait;

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_DEFENDER_PLAY,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play 2 cards in line with the Attacker\'s'),
            descriptionMyTurn: clienttranslate('${you} must play 2 cards in line with the Attacker\'s'),
        );
    }

    #[PossibleAction]
    public function actPlayCards(int $faceUpCardId, int $faceDownCardId): string
    {
        $this->playCards($faceUpCardId, $faceDownCardId);

        return DrawCards::class;
    }

    /** See https://en.doc.boardgamearena.com/Zombie_Mode */
    function zombie(int $playerId): string
    {
        $this->zombiePlayCards($playerId);

        return DrawCards::class;
    }
}
