<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\Actions\Types\StringParam;
use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

class SiegeGuess extends GameState
{
    private const GUESSABLE_TYPES = [
        CARD_TYPE_ASSASSIN,
        CARD_TYPE_SCOUT,
        CARD_TYPE_SABOTEUR,
        CARD_TYPE_TRICKSTER,
        CARD_TYPE_BERSERKER,
        CARD_TYPE_BODYGUARD,
        GUESS_TYPE_GENERAL,
        CARD_TYPE_SIEGE,
    ];

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_SIEGE_GUESS,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must guess a card in their opponent\'s hand'),
            descriptionMyTurn: clienttranslate('${you} must guess a card in your opponent\'s hand'),
        );
    }

    #[PossibleAction]
    public function actSiegeGuess(#[StringParam(enum: self::GUESSABLE_TYPES)] string $card_type)
    {
        $this->guess(Players::getCurrentId(), $card_type);

        return BattleEnd::class;
    }

    private function guess(int $playerId, string $guessedType): void
    {
        $opponentId = Players::getOpponentId($playerId);

        $matchingTypes = $guessedType === GUESS_TYPE_GENERAL
            ? [CARD_TYPE_GENERAL_A, CARD_TYPE_GENERAL_B]
            : [$guessedType];

        $hit = Cards::getHand($opponentId)
            ->filter(fn(Card $card) => in_array($card->getType(), $matchingTypes, true))
            ->count() > 0;

        $displayType = $guessedType === GUESS_TYPE_GENERAL ? CARD_TYPE_GENERAL_A : $guessedType;
        Notifications::siegeGuessed(
            Players::get($playerId),
            Players::get($opponentId),
            $guessedType,
            Cards::nameOfType($displayType),
            $hit,
        );
    }

    function zombie(int $playerId)
    {
        $this->guess($playerId, CARD_TYPE_ASSASSIN);

        return BattleEnd::class;
    }
}
