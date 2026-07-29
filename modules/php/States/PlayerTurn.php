<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * One class per PHP game state — this is the example ACTIVE_PLAYER state.
 *
 * The shape to copy:
 *   - `getArgs()` returns everything the client needs to render the state, and
 *     must be sufficient to restore it after an F5 mid-state.
 *   - `#[PossibleAction]` methods validate, mutate through Managers, send at
 *     least one notification, and return the next state class.
 *   - `zombie()` must exist on every ACTIVE_PLAYER / MULTIPLE_ACTIVE_PLAYER
 *     state, even if empty — BGA throws a fatal error when it is missing.
 */
class PlayerTurn extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_PLAYER_TURN,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play a card or pass'),
            descriptionMyTurn: clienttranslate('${you} must play a card or pass'),
        );
    }

    /**
     * State-specific data sent to the client, both on entering the state and on
     * a page reload. Read it through Managers; never query directly here.
     */
    public function getArgs(): array
    {
        return [
            'playableCardsIds' => [1, 2],
        ];
    }

    /**
     * @throws UserException the message is shown to the player, so it must be
     *                       wrapped in clienttranslate()
     */
    #[PossibleAction]
    public function actPlayCard(int $card_id, array $args)
    {
        if (!in_array($card_id, $args['playableCardsIds'], true)) {
            throw new UserException(clienttranslate('Invalid card choice'));
        }

        $player = Players::getActive();

        // TODO: mutate game state through a Manager here.

        Notifications::cardPlayed($player, $card_id);

        $this->game->bga->playerScore->inc($player->getId(), 1);

        return NextPlayer::class;
    }

    #[PossibleAction]
    public function actPass()
    {
        Notifications::playerPassed(Players::getActive());

        return NextPlayer::class;
    }

    /**
     * Called when the active player has quit. Must end the player's turn — it
     * cannot end the game, and it must never call getCurrentPlayerId(); use the
     * $playerId parameter.
     *
     * See https://en.doc.boardgamearena.com/Zombie_Mode
     */
    function zombie(int $playerId)
    {
        return $this->actPass();
    }
}
