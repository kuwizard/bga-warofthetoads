<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\BattleContext;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * RULES.md §6 ➎➏ / §7, [H4]/[H14]/[H16]: resolves both lanes, retires ties to
 * the Shrine, and captures the rest. A player who wins only 1 lane (the other
 * lane tied, or the opponent won it) always keeps that single stack — the
 * Calm/Angry capture limit (§7) only ever bites the player who wins *both*
 * lanes, since 1 capture is already within the "max 1 Hostage per Battle
 * unless Angry" limit.
 */
class ResolveBattle extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_RESOLVE_BATTLE,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $attackerId = Globals::getAttackerId();
        $defenderId = Players::getOpponentId($attackerId);
        $context = BattleContext::fromArray(Globals::getBattleContext());

        // BattleEnd resolves them after every capture path (incl. ChooseStack) converges.
        Globals::setSiegeGuessers($this->pendingSiegeGuessers($context));

        // [H4]: Angry/Calm reads the standing totals from BEFORE this
        // Battle's captures — must be read before any Cards::capture() below.
        $isAngry = [
            $attackerId => Cards::isAngry($attackerId) || $context->isAngryOverridden($attackerId),
            $defenderId => Cards::isAngry($defenderId) || $context->isAngryOverridden($defenderId),
        ];

        // Resolve both lanes first — a single- vs double-lane win isn't known until both are.
        $laneCards = [];
        $laneResults = [];
        foreach ([LANE_OPEN, LANE_HIDDEN] as $lane) {
            [$card1, $card2]    = Cards::getLaneCards()->where('locationArg', $lane)->toArray();
            $laneCards[$lane]   = [$card1, $card2];
            $laneResults[$lane] = $this->resolveLane($context, $card1, $card2, $attackerId);
        }

        $lanesWonByPlayerId = [$attackerId => 0, $defenderId => 0];
        foreach ($laneResults as $result) {
            if ($result !== null) {
                [$winner] = $result;
                $lanesWonByPlayerId[$winner->getController()]++;
            }
        }

        // Each lane fights and its outcome animates before the next one lights up — a double win is 2 ordinary captures here, and §7's limit only applies once both are in.
        foreach ([LANE_OPEN, LANE_HIDDEN] as $lane) {
            [$card1, $card2] = $laneCards[$lane];
            Notifications::laneFighting($lane, $card1, $card2);

            $result = $laneResults[$lane];
            if ($result === null) {
                Cards::retireToShrine($card1, $card2);
                Notifications::laneTied($card1, $card2);
                continue;
            }

            [$winner, $loser] = $result;
            $stackId = Cards::capture($winner, $loser);
            Notifications::hostageCaptured(Players::get($winner->getController()), $winner, $loser, $stackId);
        }

        // Won both lanes (§7): both stacks are captured already, so these lines are text only — keep both (Angry — Leap-Frog!) or hand off to ChooseStack ([H14] — Calm).
        foreach ([$attackerId, $defenderId] as $playerId) {
            if ($lanesWonByPlayerId[$playerId] !== 2) {
                continue;
            }

            if ($isAngry[$playerId]) {
                Notifications::leapFrog(Players::get($playerId));
                continue;
            }

            Notifications::doubleWinCalm(Players::get($playerId));

            // ChooseStack pauses here before BattleEnd's own moodChanged runs — re-derive now, since these 2 captures can flip either player's Angry/Calm.
            Notifications::moodChanged(Cards::getAngryByPlayerId());

            $this->gamestate->changeActivePlayer($playerId);
            $this->game->giveExtraTime($playerId);
            return ChooseStack::class;
        }

        return BattleEnd::class;
    }

    // [H11]: read from the context, not a card's final location — the guess fires even on a tie/capture.
    private function pendingSiegeGuessers(BattleContext $context): array
    {
        $guessers = [];
        foreach ($context->getRevealedCards() as $card) {
            if ($card->getType() === CARD_TYPE_SIEGE && !$context->isBlocked($card)) {
                $guessers[] = $card->getController();
            }
        }

        return $guessers;
    }

    /**
     * @return array{0: Card, 1: Card}|null [winner, loser], or null on a tie.
     *
     * [H16]: a Siege Cannon overrides Strength entirely and a lane containing
     * one can never tie — it always loses in Defence, and in Attack it wins
     * unless facing a Saboteur. Otherwise an Assassin unconditionally beats a
     * General (either card); everything else is a plain Strength comparison.
     */
    private function resolveLane(BattleContext $context, Card $card1, Card $card2, int $attackerId): ?array
    {
        $attackerCard = $card1->getController() === $attackerId ? $card1 : $card2;
        $defenderCard = $card1->getController() === $attackerId ? $card2 : $card1;

        if ($defenderCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_SIEGE) {
            return [$attackerCard, $defenderCard];
        }
        if ($attackerCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_SIEGE) {
            return $defenderCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_BEATS_SIEGE
                ? [$defenderCard, $attackerCard]
                : [$attackerCard, $defenderCard];
        }

        if ($attackerCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_BEATS_GENERAL
            && $defenderCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_LOSES_TO_ASSASSIN) {
            return [$attackerCard, $defenderCard];
        }
        if ($defenderCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_BEATS_GENERAL
            && $attackerCard->getSpecialAttribute() === SPECIAL_ATTRIBUTE_LOSES_TO_ASSASSIN) {
            return [$defenderCard, $attackerCard];
        }

        $cmp = $context->getStrength($attackerCard) <=> $context->getStrength($defenderCard);
        if ($cmp !== 0) {
            return $cmp > 0 ? [$attackerCard, $defenderCard] : [$defenderCard, $attackerCard];
        }

        // [H18] a Saboteur on each side cancels out and the tie stands.
        $attackerBreaks = $context->hasTieBreaker($attackerCard);
        $defenderBreaks = $context->hasTieBreaker($defenderCard);
        if ($attackerBreaks === $defenderBreaks) {
            return null;
        }

        return $attackerBreaks ? [$attackerCard, $defenderCard] : [$defenderCard, $attackerCard];
    }
}
