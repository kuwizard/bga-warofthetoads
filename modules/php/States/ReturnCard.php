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
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * Setup's card return (RULES.md §4 step 5, [H13]): both players simultaneously
 * and privately choose 1 of their 5 cards to return to the bottom of their
 * deck, ending with hand 4 / deck 5. Which card either player chose is never
 * revealed to the other — see `Notifications::cardReturned()`.
 */
class ReturnCard extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_RETURN_CARD,
            type: StateType::MULTIPLE_ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must return a card to their deck'),
            descriptionMyTurn: clienttranslate('${you} must return a card to your deck'),
        );
    }

    public function onEnteringState()
    {
        $this->gamestate->setAllPlayersMultiactive();
    }

    /**
     * @throws UserException the message is shown to the player, so it must be
     *                       wrapped in clienttranslate()
     */
    #[PossibleAction]
    public function actReturnCard(int $card_id)
    {
        $playerId = Players::getCurrentId();
        $card = Cards::get($card_id);

        if ($card === null || $card->getController() !== $playerId || $card->getLocation() !== LOCATION_HAND) {
            throw new UserException(clienttranslate('Invalid card choice'));
        }

        $this->returnCard($playerId, $card);

        return $this->gamestate->setPlayerNonMultiactive($playerId, EndScore::class);
    }

    private function returnCard(int $playerId, Card $card): void
    {
        Cards::returnToDeckBottom($card);
        Notifications::cardReturned(Players::get($playerId), $card);
    }

    /**
     * Called when an active player has quit. Picks an arbitrary card from
     * their hand — any of the 5 is a legal return, so there is no "better"
     * zombie choice to make.
     *
     * See https://en.doc.boardgamearena.com/Zombie_Mode
     */
    function zombie(int $playerId)
    {
        $card = Cards::getHand($playerId)->first();
        $this->returnCard($playerId, $card);

        return $this->gamestate->setPlayerNonMultiactive($playerId, EndScore::class);
    }
}
