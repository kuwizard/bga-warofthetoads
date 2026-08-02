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

class ResolveTactics extends GameState
{
    // TACTIC_BAND_AFTER fires past the lane resolution — States/SiegeGuess.php.
    private const BANDS_BEFORE_BATTLE = [TACTIC_BAND_BLOCK, TACTIC_BAND_START, TACTIC_BAND_DURING];

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: ST_RESOLVE_TACTICS,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $remainingBands = Globals::getTacticsRemainingBands();

        if ($remainingBands === null) {
            $context = BattleContext::forCurrentBattle();
            $this->revealHiddenCards();
            $remainingBands = self::BANDS_BEFORE_BATTLE;
        } else {
            $context = BattleContext::fromArray(Globals::getBattleContext());
            Globals::setTacticsRemainingBands(null);
        }

        foreach (array_values($remainingBands) as $index => $band) {
            $context->runBand($band);
            $this->notifyBandEvents($context);

            if ($band === TACTIC_BAND_START && $this->suspendForScoutReveal($context, array_slice($remainingBands, $index + 1))) {
                return ScoutReveal::class;
            }
        }

        Cards::applyLanes($context->getLanes());
        Globals::setBattleContext($context->toArray());

        return ResolveBattle::class;
    }

    // The Scout's "shows 3 cards" half suspends the pipeline between START and DURING ([H6]).
    private function suspendForScoutReveal(BattleContext $context, array $remainingBands): bool
    {
        $showers = [];
        foreach ($context->getRevealedCards() as $card) {
            if ($card->getType() !== CARD_TYPE_SCOUT || $context->isBlocked($card)) {
                continue;
            }

            $showerId = Players::getOpponentId($card->getController());
            if (Cards::getHandCount($showerId) === 0) {
                Notifications::scoutNothingToShow(Players::get($showerId));
                continue;
            }

            $showers[] = $showerId;
        }

        if ($showers === []) {
            return false;
        }

        Globals::setBattleContext($context->toArray());
        Globals::setTacticsRemainingBands($remainingBands);
        Globals::setScoutShowers($showers);

        return true;
    }

    private function revealHiddenCards(): void
    {
        $hiddenCards = Cards::getLaneCards()->filter(fn(Card $c) => $c->isFacedown())->toArray();
        foreach ($hiddenCards as $card) {
            $card->setFacedown(false);
        }

        Notifications::cardsRevealed($hiddenCards[0], $hiddenCards[1]);
    }

    private function notifyBandEvents(BattleContext $context): void
    {
        foreach ($context->takeEvents() as $event) {
            // Bodyguard's own tacticBlocked() already told this story; skip the redundant second line.
            if ($event['type'] === TACTIC_EVENT_NO_EFFECT && $event['reason'] === TACTIC_NO_EFFECT_BLOCKED) {
                continue;
            }

            $cards  = $context->getCards();
            $card   = $cards[$event['sourceId']];
            $target = isset($event['targetId']) ? $cards[$event['targetId']] : null;
            $player = Players::get($card->getController());

            match ($event['type']) {
                TACTIC_EVENT_BLOCKED        => Notifications::tacticBlocked($player, $card, $target),
                TACTIC_EVENT_LANES_SWITCHED => Notifications::tacticLanesSwitched($player, $card, $target, $event['lanes']),
                TACTIC_EVENT_STRENGTH       => Notifications::tacticStrength($player, $card, $target, $event['delta'], $context->getStrengths()),
                TACTIC_EVENT_TIE_BREAKER    => Notifications::tacticTieBreaker($player, $card, $target),
                TACTIC_EVENT_ANGRY          => Notifications::tacticAngry($player, $card, $this->angryIncludingOverride($context)),
                TACTIC_EVENT_NO_EFFECT      => Notifications::tacticNoEffect($player, $card, $event['reason'], $target),
            };
        }
    }

    // [H15] the Berserker's per-Battle Angry, folded over [H4]'s derived state.
    private function angryIncludingOverride(BattleContext $context): array
    {
        $angry = Cards::getAngryByPlayerId();
        foreach ($angry as $playerId => $isAngry) {
            $angry[$playerId] = $isAngry || $context->isAngryOverridden($playerId);
        }

        return $angry;
    }
}
