<?php

declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\WarOfTheToads\Core\Globals;
use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * RULES.md §6 (end) / §5 — alternates the Attacker and loops back to
 * `BattleStart`, or ends the War once a hand drops below 2 cards (RULES.md
 * §8). The lane is already empty by the time this runs — `ResolveBattle`
 * moved every card to a stack or the Shrine.
 */
class BattleEnd extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_BATTLE_END,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        // Refreshed before any Siege Cannon guess, clearing a Berserker's expired for-this-Battle override.
        Notifications::moodChanged(Cards::getAngryByPlayerId());

        $siegeGuessers = Globals::getSiegeGuessers();
        foreach ($siegeGuessers as $index => $guesserId) {
            $opponentId = Players::getOpponentId($guesserId);

            // [H11b]: skipped against an empty hand, still notified.
            if (Cards::getHandCount($opponentId) === 0) {
                Notifications::siegeGuessFizzles(Players::get($guesserId), Players::get($opponentId));
                continue;
            }

            Globals::setSiegeGuessers(array_slice($siegeGuessers, $index + 1));
            $this->gamestate->changeActivePlayer($guesserId);
            $this->game->giveExtraTime($guesserId);

            return SiegeGuess::class;
        }
        Globals::setSiegeGuessers([]);

        $attackerId = Globals::getAttackerId();
        $defenderId = Players::getOpponentId($attackerId);

        if (Cards::getHandCount($attackerId) < 2 || Cards::getHandCount($defenderId) < 2) {
            return WarEnd::class;
        }

        Globals::setAttackerId($defenderId);
        Globals::setBattle(Globals::getBattle() + 1);

        return BattleStart::class;
    }
}
