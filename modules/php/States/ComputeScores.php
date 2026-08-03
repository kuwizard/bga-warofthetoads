<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Notifications;

// RULES.md §10. Nothing is computed despite the name: WarEnd already scored each War (1 point for the 1st, 2 for the 2nd) and §10's three conditions fall out of those totals — see IMPLEMENTATION_PLAN.md PR7's table.
class ComputeScores extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_COMPUTE_SCORES,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    public function onEnteringState()
    {
        foreach (Cards::revealCasualties() as $casualty) {
            Notifications::casualtyRevealed(Players::get($casualty->getController()), $casualty);
        }

        $summary = static::summary();

        // BGA breaks equal scores by the aux value, so [H3] needs no score rewrite at all.
        if ($summary['condition'] === VICTORY_LOWEST_CASUALTY) {
            foreach (Cards::getCasualtyByPlayerId() as $playerId => $casualty) {
                $this->game->bga->playerScoreAux->set($playerId, static::tieBreakValue($casualty));
            }
        }

        Notifications::gameEnded(
            $summary['winnerId'] === null ? null : Players::get($summary['winnerId']),
            $summary,
        );

        return ST_GAME_END;
    }

    // Derived from the final scores and the two Casualties alone, so Game::getAllDatas() can rebuild it on an F5 at the finished table with nothing persisted for it.
    public static function summary(): array
    {
        $scoreByPlayerId = [];
        foreach (Players::getAll() as $player) {
            $scoreByPlayerId[$player->getId()] = $player->getScore();
        }

        $casualtyByPlayerId = Cards::getCasualtyByPlayerId();
        $condition = static::conditionFor($scoreByPlayerId);
        $winnerId = $condition === VICTORY_LOWEST_CASUALTY
            ? static::lowestCasualtyWinner($casualtyByPlayerId)
            : array_search(max($scoreByPlayerId), $scoreByPlayerId, true);

        return [
            'condition'  => $condition,
            'winnerId'   => $winnerId,
            'wars'       => static::warWinners($scoreByPlayerId),
            'scores'     => $scoreByPlayerId,
            'casualties' => array_map(fn(?Card $c) => $c?->getUiData(), $casualtyByPlayerId),
        ];
    }

    // [H3]: a Siege Cannon ranks +INF and so always loses; equal ranks draw, which [H17] makes reachable with two different cards (both Generals rank 7).
    public static function lowestCasualtyWinner(array $casualtyByPlayerId): ?int
    {
        $rankByPlayerId = array_map(fn(?Card $c) => $c?->getCasualtyRank() ?? PHP_INT_MAX, $casualtyByPlayerId);
        $lowestRanked = array_keys($rankByPlayerId, min($rankByPlayerId), true);

        return count($lowestRanked) === 1 ? $lowestRanked[0] : null;
    }

    private static function conditionFor(array $scoreByPlayerId): string
    {
        $bestScore = max($scoreByPlayerId);

        if ($bestScore === 0) {
            return VICTORY_LOWEST_CASUALTY;
        }

        return $bestScore >= 2 ? VICTORY_SECOND_WAR : VICTORY_WON_AND_STALEMATE;
    }

    // 1 point can only have come from the 1st War and 2 only from the 2nd, so a score is a 2-bit record of both results; `null` is a Stalemate.
    private static function warWinners(array $scoreByPlayerId): array
    {
        $winnerByWar = [1 => null, 2 => null];
        foreach ($scoreByPlayerId as $playerId => $score) {
            if ($score & 1) {
                $winnerByWar[1] = $playerId;
            }
            if ($score & 2) {
                $winnerByWar[2] = $playerId;
            }
        }

        return $winnerByWar;
    }

    // playerScoreAux ranks higher-is-better while [H3] wants the LOWEST Casualty to win, so a Siege Cannon's +INF rank must invert to the bottom, never to a raw 0 at the top.
    private static function tieBreakValue(?Card $casualty): int
    {
        $rank = $casualty?->getCasualtyRank() ?? PHP_INT_MAX;

        return $rank === PHP_INT_MAX ? 0 : CARD_STRENGTH_MAX + 1 - $rank;
    }
}
