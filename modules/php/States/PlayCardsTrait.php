<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\UserException;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * Shared by `AttackerPlay` and `DefenderPlay` — RULES.md §6 ➊➋ describe the
 * identical physical action for both roles: play 2 cards, one face-up, one
 * face-down. Lane placement is fully derived from that choice, never a
 * separate parameter (IMPLEMENTATION_PLAN.md §2.1, "Lane symmetry").
 */
trait PlayCardsTrait
{
    /**
     * @throws UserException the message is shown to the player, so it must be
     *                       wrapped in clienttranslate()
     */
    private function playCards(int $faceUpCardId, int $faceDownCardId): void
    {
        $playerId = Players::getCurrentId();

        if ($faceUpCardId === $faceDownCardId) {
            throw new UserException(clienttranslate('Invalid card choice'));
        }

        $faceUpCard = Cards::get($faceUpCardId);
        $faceDownCard = Cards::get($faceDownCardId);

        foreach ([$faceUpCard, $faceDownCard] as $card) {
            if ($card === null || $card->getController() !== $playerId || $card->getLocation() !== LOCATION_HAND) {
                throw new UserException(clienttranslate('Invalid card choice'));
            }
        }

        Cards::playToLane($faceUpCard, $faceDownCard);
        Notifications::cardsPlayed(Players::get($playerId), $faceUpCard, $faceDownCard);
    }

    /** Any legal 2-card split is a valid zombie play — no "better" choice to make (mirrors ReturnCard::zombie). */
    private function zombiePlayCards(int $playerId): void
    {
        [$faceUpCard, $faceDownCard] = Cards::getHand($playerId)->toArray();

        Cards::playToLane($faceUpCard, $faceDownCard);
        Notifications::cardsPlayed(Players::get($playerId), $faceUpCard, $faceDownCard);
    }
}
