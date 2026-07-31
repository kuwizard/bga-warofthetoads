<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Models;

use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;

class BattleContext
{
    private array $cardsById;
    private array $laneByCardId;
    private array $revealedCardIds;
    private array $flagsByPlayerId;
    private array $hostagesByPlayerId;

    private array $strengthByCardId = [];
    private array $strengthAddedThisBandByCardId = [];
    private array $blockedCardIds = [];
    private array $tieBreakerCardIds = [];
    private array $angryOverrideByPlayerId = [];
    private array $events = [];

    public function __construct(
        array $cardsById,
        array $laneByCardId,
        array $revealedCardIds,
        array $flagsByPlayerId,
        array $hostagesByPlayerId,
    ) {
        $this->cardsById          = $cardsById;
        $this->laneByCardId       = $laneByCardId;
        $this->revealedCardIds    = $revealedCardIds;
        $this->flagsByPlayerId    = $flagsByPlayerId;
        $this->hostagesByPlayerId = $hostagesByPlayerId;

        foreach ($cardsById as $cardId => $card) {
            $printed = $card->getStrength();
            $this->strengthByCardId[$cardId] = $printed === null ? null : (float) $printed;
        }
    }

    // Must run before the reveal: flipping the cards erases which were face-down.
    public static function forCurrentBattle(): self
    {
        $cardsById = [];
        $laneByCardId = [];
        $revealedCardIds = [];
        foreach (Cards::getLaneCards() as $card) {
            $cardsById[$card->getId()] = $card;
            $laneByCardId[$card->getId()] = $card->getLocationArg();
            if ($card->isFacedown()) {
                $revealedCardIds[] = $card->getId();
            }
        }

        $flagsByPlayerId = [];
        $hostagesByPlayerId = [];
        foreach (Players::getAll() as $player) {
            $flagsByPlayerId[$player->getId()]    = Cards::flagsFor($player->getId());
            $hostagesByPlayerId[$player->getId()] = Cards::getCaptureCount($player->getId());
        }

        return new self($cardsById, $laneByCardId, $revealedCardIds, $flagsByPlayerId, $hostagesByPlayerId);
    }

    // ── PIPELINE ──────────────────────────────────────────────────────────────

    public function runBand(string $band): void
    {
        // [H7] mirrored Bodyguards each have to see an unblocked opponent.
        $blockedEnteringBand = $this->blockedCardIds;

        foreach ($this->revealedCardIds as $cardId) {
            $card = $this->cardsById[$cardId];
            if ($card->getBand() !== $band) {
                continue;
            }

            if ($blockedEnteringBand[$cardId] ?? false) {
                $this->noEffect($card, TACTIC_NO_EFFECT_BLOCKED);
                continue;
            }

            $card->applyTactic($this);
        }

        foreach ($this->strengthAddedThisBandByCardId as $cardId => $added) {
            $this->strengthByCardId[$cardId] += $added;
        }
        $this->strengthAddedThisBandByCardId = [];
    }

    // ── BOARD READS ───────────────────────────────────────────────────────────

    public function getAlly(Card $card): Card
    {
        foreach ($this->cardsById as $other) {
            if ($other->getId() !== $card->getId() && $other->getController() === $card->getController()) {
                return $other;
            }
        }

        throw new \LogicException("No Ally for card {$card->getId()}");
    }

    public function getFoe(Card $card): Card
    {
        foreach ($this->cardsById as $other) {
            if ($other->getController() !== $card->getController()
                && $this->laneByCardId[$other->getId()] === $this->laneByCardId[$card->getId()]) {
                return $other;
            }
        }

        throw new \LogicException("No Foe for card {$card->getId()}");
    }

    public function getOpposingRevealedCard(Card $card): ?Card
    {
        foreach ($this->revealedCardIds as $cardId) {
            if ($this->cardsById[$cardId]->getController() !== $card->getController()) {
                return $this->cardsById[$cardId];
            }
        }

        return null;
    }

    public function getFlagCount(int $playerId): int
    {
        return $this->flagsByPlayerId[$playerId] ?? 0;
    }

    public function getHostageCount(int $playerId): int
    {
        return $this->hostagesByPlayerId[$playerId] ?? 0;
    }

    // Strength as of entering the current band, so same-band Tactics resolve simultaneously.
    public function getStrength(Card $card): ?float
    {
        return $this->strengthByCardId[$card->getId()];
    }

    // ── BOARD WRITES ──────────────────────────────────────────────────────────

    public function addStrength(Card $source, Card $target, float $delta): void
    {
        // [H16] the Siege Cannon has no Strength Value and cannot gain bonuses.
        if ($this->strengthByCardId[$target->getId()] === null) {
            $this->noEffect($source, TACTIC_NO_EFFECT_NO_STRENGTH, $target);
            return;
        }

        $added = $this->strengthAddedThisBandByCardId[$target->getId()] ?? 0.0;
        $this->strengthAddedThisBandByCardId[$target->getId()] = $added + $delta;
        $this->addEvent(TACTIC_EVENT_STRENGTH, $source, ['targetId' => $target->getId(), 'delta' => $delta]);
    }

    public function switchLanes(Card $source): void
    {
        $ally = $this->getAlly($source);
        [$this->laneByCardId[$source->getId()], $this->laneByCardId[$ally->getId()]] =
            [$this->laneByCardId[$ally->getId()], $this->laneByCardId[$source->getId()]];

        $this->addEvent(TACTIC_EVENT_LANES_SWITCHED, $source, [
            'targetId' => $ally->getId(),
            'lanes'    => $this->laneByCardId,
        ]);
    }

    public function block(Card $source, Card $target): void
    {
        $this->blockedCardIds[$target->getId()] = true;
        $this->addEvent(TACTIC_EVENT_BLOCKED, $source, ['targetId' => $target->getId()]);
    }

    public function setTieBreaker(Card $source, Card $target): void
    {
        $this->tieBreakerCardIds[$target->getId()] = true;
        $this->addEvent(TACTIC_EVENT_TIE_BREAKER, $source, ['targetId' => $target->getId()]);
    }

    public function setAngry(Card $source, int $playerId): void
    {
        $this->angryOverrideByPlayerId[$playerId] = true;
        $this->addEvent(TACTIC_EVENT_ANGRY, $source, ['targetPlayerId' => $playerId]);
    }

    public function noEffect(Card $source, string $reason, ?Card $target = null): void
    {
        $this->addEvent(TACTIC_EVENT_NO_EFFECT, $source, [
            'reason'   => $reason,
            'targetId' => $target?->getId(),
        ]);
    }

    // ── RESULTS ───────────────────────────────────────────────────────────────

    public function getCards(): array
    {
        return $this->cardsById;
    }

    public function getRevealedCards(): array
    {
        return array_map(fn(int $cardId) => $this->cardsById[$cardId], $this->revealedCardIds);
    }

    public function getLanes(): array
    {
        return $this->laneByCardId;
    }

    public function getStrengths(): array
    {
        return $this->strengthByCardId;
    }

    public function isBlocked(Card $card): bool
    {
        return $this->blockedCardIds[$card->getId()] ?? false;
    }

    public function hasTieBreaker(Card $card): bool
    {
        return $this->tieBreakerCardIds[$card->getId()] ?? false;
    }

    public function isAngryOverridden(int $playerId): bool
    {
        return $this->angryOverrideByPlayerId[$playerId] ?? false;
    }

    public function takeEvents(): array
    {
        $events = $this->events;
        $this->events = [];
        return $events;
    }

    // ── SERIALISATION ─────────────────────────────────────────────────────────

    public function toArray(): array
    {
        return [
            'cardIds'         => array_keys($this->cardsById),
            'lanes'           => $this->laneByCardId,
            'revealedCardIds' => $this->revealedCardIds,
            'flags'           => $this->flagsByPlayerId,
            'hostages'        => $this->hostagesByPlayerId,
            'strength'        => $this->strengthByCardId,
            'blocked'         => $this->blockedCardIds,
            'tieBreakers'     => $this->tieBreakerCardIds,
            'angryOverride'   => $this->angryOverrideByPlayerId,
        ];
    }

    public static function fromArray(?array $data): self
    {
        if ($data === null) {
            throw new \LogicException('No BattleContext — this state was reached without ResolveTactics running');
        }

        $cardsById = [];
        foreach ($data['cardIds'] as $cardId) {
            $cardsById[(int) $cardId] = Cards::get((int) $cardId);
        }

        $context = new self(
            $cardsById,
            self::withIntKeys($data['lanes']),
            array_map('intval', $data['revealedCardIds']),
            self::withIntKeys($data['flags']),
            self::withIntKeys($data['hostages']),
        );
        $context->strengthByCardId = array_map(
            fn($strength) => $strength === null ? null : (float) $strength,
            self::withIntKeys($data['strength']),
        );
        $context->blockedCardIds          = self::withIntKeys($data['blocked']);
        $context->tieBreakerCardIds       = self::withIntKeys($data['tieBreakers']);
        $context->angryOverrideByPlayerId = self::withIntKeys($data['angryOverride']);

        return $context;
    }

    private static function withIntKeys(array $jsonDecodedMap): array
    {
        $result = [];
        foreach ($jsonDecodedMap as $key => $value) {
            $result[(int) $key] = $value;
        }
        return $result;
    }

    private function addEvent(string $type, Card $source, array $data = []): void
    {
        $this->events[] = ['type' => $type, 'sourceId' => $source->getId()] + $data;
    }
}
