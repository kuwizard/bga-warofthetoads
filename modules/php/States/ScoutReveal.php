<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\Actions\Types\IntArrayParam;
use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

class ScoutReveal extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_SCOUT_REVEAL,
            type: StateType::MULTIPLE_ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must choose 3 cards to show you (Scout effect)'),
            descriptionMyTurn: clienttranslate('${you} must choose 3 cards to show the opponent (Scout effect)'),
        );
    }

    public function onEnteringState()
    {
        $showers = Globals::getScoutShowers() ?? [];
        Globals::setPendingScoutReveals([]);

        $this->gamestate->setPlayersMultiactive($showers, ResolveTactics::class, true);
    }

    #[PossibleAction]
    public function actScoutReveal(#[IntArrayParam] array $card_ids)
    {
        $playerId = Players::getCurrentId();
        $hand = Cards::getHand($playerId);

        // [H6] below 3 cards the whole hand is shown, so the count is never the player's choice.
        $expectedCount = min(3, $hand->count());
        $cardIds = array_map('intval', $card_ids);
        if (count($cardIds) !== $expectedCount || count(array_unique($cardIds)) !== $expectedCount) {
            throw new UserException(clienttranslate('Invalid card choice'));
        }

        $cards = [];
        foreach ($cardIds as $cardId) {
            $card = Cards::get($cardId);
            if ($card === null || $card->getController() !== $playerId || $card->getLocation() !== LOCATION_HAND) {
                throw new UserException(clienttranslate('Invalid card choice'));
            }
            $cards[] = $card;
        }

        $this->showCards($playerId, $cards);

        return $this->gamestate->setPlayerNonMultiactive($playerId, ResolveTactics::class);
    }

    private function showCards(int $playerId, array $cards): void
    {
        $pending = Globals::getPendingScoutReveals();
        $pending[$playerId] = array_map(fn(Card $c) => $c->getId(), $cards);
        Globals::setPendingScoutReveals($pending);

        // Mirrored Scouts: hold every reveal back until the last shower confirms, then fire them all at once.
        if (count($pending) < count(Globals::getScoutShowers() ?? [])) {
            return;
        }

        foreach ($pending as $showerId => $cardIds) {
            $shownCards = array_map(fn(int $cardId) => Cards::get($cardId), $cardIds);
            Notifications::scoutRevealed(Players::get($showerId), Players::get(Players::getOpponentId($showerId)), $shownCards);
        }
        Globals::setPendingScoutReveals([]);
        Globals::setScoutShowers(null);
    }

    function zombie(int $playerId)
    {
        $cards = array_slice(Cards::getHand($playerId)->toArray(), 0, 3);
        $this->showCards($playerId, $cards);

        return $this->gamestate->setPlayerNonMultiactive($playerId, ResolveTactics::class);
    }
}
