<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\Actions\CheckAction;
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
            description: clienttranslate('${actplayer} must return a card to the bottom of their deck'),
            descriptionMyTurn: clienttranslate('${you} must return a card to the bottom of your deck'),
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
     * Lets a player who already confirmed take it back, as long as
     * ReturnCard hasn't fully resolved yet. `#[CheckAction(false)]` disables
     * the framework's default "must be currently active" gate (this player
     * just made themselves inactive via actReturnCard); `checkPossibleAction`
     * re-validates it manually instead — which naturally fails once every
     * player has confirmed and the state has moved on to EndScore, so "only
     * if the other player hasn't decided yet" needs no extra guard.
     */
    #[PossibleAction]
    #[CheckAction(false)]
    public function actUndoReturnCard(): void
    {
        $this->gamestate->checkPossibleAction('actUndoReturnCard');
        $playerId = Players::getCurrentId();
        $card = Cards::getLastReturnedCard($playerId);

        $card->setLocation(LOCATION_HAND);
        Notifications::cardReturnUndone(Players::get($playerId), $card);

        $this->gamestate->setPlayersMultiactive([$playerId], EndScore::class);
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
