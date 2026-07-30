<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Managers;

use Bga\GameFramework\VisibleSystemException;
use Bga\Games\WarOfTheToads\Data\Cards\Assassin;
use Bga\Games\WarOfTheToads\Data\Cards\Berserker;
use Bga\Games\WarOfTheToads\Data\Cards\Bodyguard;
use Bga\Games\WarOfTheToads\Data\Cards\GeneralA;
use Bga\Games\WarOfTheToads\Data\Cards\GeneralB;
use Bga\Games\WarOfTheToads\Data\Cards\Saboteur;
use Bga\Games\WarOfTheToads\Data\Cards\Scout;
use Bga\Games\WarOfTheToads\Data\Cards\Siege;
use Bga\Games\WarOfTheToads\Data\Cards\Trickster;
use Bga\Games\WarOfTheToads\Helpers\CachedDB_Manager;
use Bga\Games\WarOfTheToads\Helpers\Collection;
use Bga\Games\WarOfTheToads\Models\Card;

/**
 * Manager for the `card` table. See doc/SCHEMA.md for the column reference.
 */
class Cards extends CachedDB_Manager
{
    protected static string $table   = 'card';
    protected static string $primary = 'card_id';

    /** `card_type` → its Data/Cards class. The one true list of the 9 card types. */
    private static array $map = [
        CARD_TYPE_ASSASSIN  => Assassin::class,
        CARD_TYPE_SCOUT     => Scout::class,
        CARD_TYPE_SABOTEUR  => Saboteur::class,
        CARD_TYPE_TRICKSTER => Trickster::class,
        CARD_TYPE_BERSERKER => Berserker::class,
        CARD_TYPE_BODYGUARD => Bodyguard::class,
        CARD_TYPE_GENERAL_A => GeneralA::class,
        CARD_TYPE_GENERAL_B => GeneralB::class,
        CARD_TYPE_SIEGE     => Siege::class,
    ];

    protected static function cast(array $row): Card
    {
        $type = $row['card_type'];
        $class = self::$map[$type] ?? null;
        if ($class === null) {
            throw new VisibleSystemException("Unknown card type: $type");
        }
        return new $class($row);
    }

    // ── SETUP ─────────────────────────────────────────────────────────────────

    /**
     * Builds both colour decks (9 cards each, one of every `CARD_MATERIAL`
     * type), assigns one to each player in table order — `player_colors` in
     * gameinfos.jsonc already documents Blue Hills going to player 1 — then
     * shuffles and deals 5 into each hand.
     *
     * `card_controller` starts equal to the dealt `card_deck`; they only
     * diverge after the 2nd-War deck swap (PR7).
     *
     * Call after `Players::setupNewGame()` — this reads `Players::getInTableOrder()`.
     */
    public static function setupNewGame(): void
    {
        $decks = [CARD_DECK_BLUE, CARD_DECK_RED];
        $players = Players::getInTableOrder();

        $rows = [];
        foreach ($players as $i => $player) {
            $deck = $decks[$i];
            foreach (array_keys(self::$map) as $order => $type) {
                $rows[] = [$type, $deck, $player->getId(), LOCATION_DECK, $order, 0];
            }
        }

        self::DB()->multipleInsert([
            'card_type',
            'card_deck',
            'card_controller',
            'card_location',
            'card_location_arg',
            'card_facedown',
        ])->values($rows);

        static::invalidate();

        foreach ($players as $player) {
            static::shuffleDeck($player->getId());
            static::drawCards($player->getId(), 5);
        }
    }

    /** Re-numbers a player's deck into a fresh random draw order. */
    public static function shuffleDeck(int $playerId): void
    {
        $deck = static::getAll()->where('controller', $playerId)->where('location', LOCATION_DECK)->toArray();

        $order = range(0, count($deck) - 1);
        for ($i = count($order) - 1; $i > 0; $i--) {
            $j = bga_rand(0, $i);
            [$order[$i], $order[$j]] = [$order[$j], $order[$i]];
        }

        foreach ($deck as $index => $card) {
            $card->setLocationArg($order[$index]);
        }
    }

    /**
     * Draws the top `$n` cards of `$playerId`'s deck into their hand (fewer if
     * the deck is short). @return Collection<Card> the cards drawn.
     */
    public static function drawCards(int $playerId, int $n): Collection
    {
        $deck = static::getAll()
            ->where('controller', $playerId)
            ->where('location', LOCATION_DECK)
            ->sort(fn(Card $a, Card $b) => $a->getLocationArg() <=> $b->getLocationArg())
            ->toArray();

        $drawn = array_slice($deck, 0, $n);
        foreach ($drawn as $card) {
            $card->setLocation(LOCATION_HAND);
        }

        return new Collection($drawn);
    }

    /**
     * Returns a card from hand to the bottom of its controller's deck — the
     * setup step ([H13]) and, later, the general "return a card" shape reused
     * nowhere else yet.
     */
    public static function returnToDeckBottom(Card $card): void
    {
        $bottom = static::getAll()
            ->where('controller', $card->getController())
            ->where('location', LOCATION_DECK)
            ->reduce(fn(int $max, Card $c) => max($max, $c->getLocationArg()), -1);

        $card->setLocation(LOCATION_DECK);
        $card->setLocationArg($bottom + 1);
    }

    /**
     * The card most recently returned by `$playerId` via `returnToDeckBottom()` —
     * that's the only call site appending to a deck's bottom, so the max
     * `locationArg` among their deck cards is unambiguously it. Used to undo a
     * confirmed-but-not-yet-resolved ReturnCard choice.
     */
    public static function getLastReturnedCard(int $playerId): ?Card
    {
        return static::getAll()
            ->where('controller', $playerId)
            ->where('location', LOCATION_DECK)
            ->sort(fn(Card $a, Card $b) => $b->getLocationArg() <=> $a->getLocationArg())
            ->first();
    }

    // ── BATTLE ────────────────────────────────────────────────────────────────

    /**
     * Plays the Attacker's or Defender's 2 cards into the lane — lane number
     * is derived from facedown status, never chosen independently
     * (IMPLEMENTATION_PLAN.md §2.1).
     */
    public static function playToLane(Card $faceUpCard, Card $faceDownCard): void
    {
        $faceUpCard->setLocation(LOCATION_LANE);
        $faceUpCard->setLocationArg(LANE_OPEN);
        $faceUpCard->setFacedown(false);

        $faceDownCard->setLocation(LOCATION_LANE);
        $faceDownCard->setLocationArg(LANE_HIDDEN);
        $faceDownCard->setFacedown(true);
    }

    /** @return Collection<Card> */
    public static function getLaneCards(): Collection
    {
        return static::getAll()->where('location', LOCATION_LANE);
    }

    /**
     * Forms a stack: the winner's card on top (face-up Captor), the loser's
     * card beneath (face-down Hostage) — RULES.md §6 ➏. Within a stack,
     * `facedown` alone distinguishes the two (a Captor is never face-down, a
     * Hostage always is — RULES.md §6 ➏ is a hard rule, not an implementation
     * detail, so there is no separate "role" column to keep in sync).
     * `card_location_arg` under `LOCATION_STACK` is a stack id, monotonically
     * increasing across the whole game (never reused, never scoped to a lane
     * number — a player can hold several stacks at once). See doc/SCHEMA.md.
     *
     * @return int the new stack's id, e.g. for `ChooseStack` (PR4, [H14]) to
     *             identify which 2 stacks a Calm double-win just created.
     */
    public static function capture(Card $captorCard, Card $hostageCard): int
    {
        $stackId = static::getAll()
            ->where('location', LOCATION_STACK)
            ->reduce(fn(int $max, Card $c) => max($max, $c->getLocationArg()), 0) + 1;

        $captorCard->setLocation(LOCATION_STACK);
        $captorCard->setLocationArg($stackId);
        $captorCard->setFacedown(false);

        $hostageCard->setLocation(LOCATION_STACK);
        $hostageCard->setLocationArg($stackId);
        $hostageCard->setFacedown(true);

        return $stackId;
    }

    /**
     * Retires cards to the Shrine as Monks (RULES.md §6 ➎ ties, §7, [H14]'s
     * declined stack) — each card individually, never paired. Monks don't
     * count towards scoring; only their controller (hence deck-back colour)
     * remains visible, per `Card::getUiData()`'s redaction.
     */
    public static function retireToShrine(Card ...$cards): void
    {
        foreach ($cards as $card) {
            $card->setLocation(LOCATION_SHRINE);
            $card->setLocationArg(0);
            $card->setFacedown(true);
        }
    }

    /**
     * Hostages captured by `$playerId` — one stack = one Hostage = 1 Point
     * (RULES.md §6 ➏, §7). Identified by the stack's Captor (not Hostage) row
     * — `facedown = false` — so the count is unambiguous even mid-capture,
     * when a stack briefly has a Captor but no linked Hostage query needed.
     */
    public static function getCaptureCount(int $playerId): int
    {
        return static::getAll()
            ->where('controller', $playerId)
            ->where('location', LOCATION_STACK)
            ->where('facedown', false)
            ->count();
    }

    /**
     * [H4] Angry is evaluated from the hostage counts *before* the current
     * Battle's captures — callers must call this before any `capture()` this
     * Battle, never after. RULES.md §7: "Angry if you have fewer Hostages
     * than your opponent."
     */
    public static function isAngry(int $playerId): bool
    {
        return static::getCaptureCount($playerId) < static::getCaptureCount(Players::getOpponentId($playerId));
    }

    /**
     * Every player's Calm/Angry at once, for the client's player panels —
     * `Game::getAllDatas()` and `Notifications::moodChanged()`. Nothing
     * persists it (no column, no Global): it is re-derived on every read, so
     * the same [H4] timing rule as `isAngry()` applies to when it's called.
     *
     * @return array<int, bool> playerId => is Angry
     */
    public static function getAngryByPlayerId(): array
    {
        $angry = [];
        foreach (Players::getAll() as $player) {
            $angry[$player->getId()] = static::isAngry($player->getId());
        }

        return $angry;
    }

    /**
     * `$playerId`'s captured stacks, oldest first (ascending stack id). Used
     * by `ChooseStack` ([H14]) to find "the 2 stacks a Calm double-win just
     * created" — the 2 highest ids, since nothing else creates a stack for
     * this player between `ResolveBattle` and `ChooseStack` resolving.
     *
     * @return Collection<Card> the Captor row of each stack (`facedown = false`).
     */
    public static function getStacksFor(int $playerId): Collection
    {
        return static::getAll()
            ->where('controller', $playerId)
            ->where('location', LOCATION_STACK)
            ->where('facedown', false)
            ->sort(fn(Card $a, Card $b) => $a->getLocationArg() <=> $b->getLocationArg());
    }

    /** @return Collection<Card> both members (Captor + Hostage) of stack `$stackId`. */
    public static function getStackCards(int $stackId): Collection
    {
        return static::getAll()->where('location', LOCATION_STACK)->where('locationArg', $stackId);
    }

    // ── READS ─────────────────────────────────────────────────────────────────

    public static function get(int $id): ?Card
    {
        /** @var ?Card */
        return parent::get($id);
    }

    /** @return Collection<Card> */
    public static function getAll(): Collection
    {
        return parent::getAll();
    }

    /** @return Collection<Card> */
    public static function getHand(int $playerId): Collection
    {
        return static::getAll()->where('controller', $playerId)->where('location', LOCATION_HAND);
    }

    public static function getHandCount(int $playerId): int
    {
        return static::getHand($playerId)->count();
    }

    public static function getDeckCount(int $playerId): int
    {
        return static::getAll()->where('controller', $playerId)->where('location', LOCATION_DECK)->count();
    }

    // ── UI DATA ───────────────────────────────────────────────────────────────

    /**
     * Payload for `Game::getAllDatas()` — the hidden-information contract:
     * `$currentPlayerId`'s own hand in full, every player's hand and deck
     * exposed only as counts. Even the owner's own deck is a count — RULES.md
     * §4: "you are not allowed to look at any face-down cards", and a
     * shuffled deck's contents are exactly that.
     */
    public static function getUiData(int $currentPlayerId): array
    {
        $handCounts = [];
        $deckCounts = [];
        foreach (Players::getAll() as $player) {
            $pid = $player->getId();
            $handCounts[$pid] = static::getHandCount($pid);
            $deckCounts[$pid] = static::getDeckCount($pid);
        }

        return [
            'hand'       => static::getHand($currentPlayerId)->map(fn(Card $c) => $c->getUiData($currentPlayerId))->toArray(),
            'handCounts' => $handCounts,
            'deckCounts' => $deckCounts,
            'lanes'      => static::getLaneCards()->map(fn(Card $c) => $c->getUiData($currentPlayerId))->toArray(),
            'stacks'     => static::getAll()->where('location', LOCATION_STACK)->map(fn(Card $c) => $c->getUiData($currentPlayerId))->toArray(),
            'shrine'     => static::getAll()->where('location', LOCATION_SHRINE)->map(fn(Card $c) => $c->getUiData($currentPlayerId))->toArray(),
        ];
    }
}
