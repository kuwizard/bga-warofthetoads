<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
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

        // [H4]: Angry/Calm reads the standing totals from BEFORE this
        // Battle's captures — must be read before any Cards::capture() below.
        $isAngry = [
            $attackerId => Cards::isAngry($attackerId),
            $defenderId => Cards::isAngry($defenderId),
        ];

        /** @var array<int, array{0: Card, 1: Card}[]> playerId => its lane wins as [winner, loser] pairs */
        $wins = [$attackerId => [], $defenderId => []];

        foreach ([LANE_OPEN, LANE_HIDDEN] as $lane) {
            [$card1, $card2] = Cards::getLaneCards()->where('locationArg', $lane)->toArray();
            $result = static::resolveLane($card1, $card2, $attackerId);

            if ($result === null) {
                Cards::retireToShrine($card1, $card2);
                Notifications::laneTied($card1, $card2);
                continue;
            }

            [$winner, $loser] = $result;
            $wins[$winner->getController()][] = [$winner, $loser];
        }

        foreach ([$attackerId, $defenderId] as $playerId) {
            $laneWins = $wins[$playerId];

            if (count($laneWins) === 0) {
                continue;
            }

            if (count($laneWins) === 1) {
                [$winner, $loser] = $laneWins[0];
                $stackId = Cards::capture($winner, $loser);
                Notifications::hostageCaptured(Players::get($playerId), $winner, $loser, $stackId);
                continue;
            }

            // Won both lanes (§7): capture both stacks, then either keep both
            // (Angry — Leap-Frog!) or hand off to ChooseStack ([H14] — Calm).
            $winners = [];
            $losers = [];
            $stackIds = [];
            foreach ($laneWins as [$winner, $loser]) {
                $stackIds[] = Cards::capture($winner, $loser);
                $winners[] = $winner;
                $losers[] = $loser;
            }

            if ($isAngry[$playerId]) {
                Notifications::leapFrog(Players::get($playerId), $winners, $losers, $stackIds);
                continue;
            }

            Notifications::doubleWinCalm(Players::get($playerId), $winners, $losers, $stackIds);
            $this->gamestate->changeActivePlayer($playerId);
            return ChooseStack::class;
        }

        return BattleEnd::class;
    }

    /**
     * @return array{0: Card, 1: Card}|null [winner, loser], or null on a tie.
     *
     * [H16]: a Siege Cannon overrides Strength entirely and a lane containing
     * one can never tie — it always loses in Defence, and in Attack it wins
     * unless facing a Saboteur. Otherwise an Assassin unconditionally beats a
     * General (either card); everything else is a plain Strength comparison.
     */
    private static function resolveLane(Card $card1, Card $card2, int $attackerId): ?array
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

        $cmp = $attackerCard->getStrength() <=> $defenderCard->getStrength();
        if ($cmp === 0) {
            return null;
        }
        return $cmp > 0 ? [$attackerCard, $defenderCard] : [$defenderCard, $attackerCard];
    }
}
