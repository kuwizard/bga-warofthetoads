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
    // TACTIC_BAND_AFTER fires past the lane resolution — PR6's SiegeGuess.
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
        $context = BattleContext::forCurrentBattle();

        $this->revealHiddenCards();

        foreach (self::BANDS_BEFORE_BATTLE as $band) {
            $context->runBand($band);
            $this->notifyBandEvents($context);
        }

        Cards::applyLanes($context->getLanes());
        Globals::setBattleContext($context->toArray());

        return ResolveBattle::class;
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
