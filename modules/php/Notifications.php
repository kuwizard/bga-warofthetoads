<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads;

use Bga\Games\WarOfTheToads\Helpers\Collection;
use Bga\Games\WarOfTheToads\Models\Card;
use Bga\Games\WarOfTheToads\Models\Player;

/**
 * Every notification the game sends is a named static method on this class.
 *
 * State classes and Managers call `Notifications::somethingHappened($player, …)`
 * and never touch `bga->notify` directly. The payoff: the message string, its
 * `clienttranslate()` wrapper, its args and the JS handler name all live in one
 * place, so renaming a notification is a single edit and the full list of
 * notifications is greppable in one file.
 *
 * `updateArgs()` is the one shared hook — it expands rich objects into the flat
 * scalars BGA expects, so callers pass a `Player`, not an id/name pair.
 *
 * BGA requires at least one notification per player action, even when the
 * action has no mechanical effect — without one the client hangs on
 * "Move recorded, waiting for update".
 *
 * Everything below the EXAMPLE marker is scaffolding; replace it with the
 * game's own notifications.
 */
class Notifications
{
    // ── INFRASTRUCTURE ────────────────────────────────────────────────────────

    protected static function notifyAll(string $name, string $msg, array $data = []): void
    {
        self::updateArgs($data);
        Game::get()->bga->notify->all($name, $msg, $data);
    }

    protected static function notify(int $playerId, string $name, string $msg, array $data = []): void
    {
        self::updateArgs($data);
        Game::get()->bga->notify->player($playerId, $name, $msg, $data);
    }

    /**
     * Expands convenience args into what the client actually receives.
     *
     * Add a case here whenever a Model appears in more than one notification —
     * it keeps the `${...}` placeholder names consistent across the whole log.
     */
    protected static function updateArgs(array &$data): void
    {
        if (isset($data['player']) && $data['player'] instanceof Player) {
            $data['player_id']   = $data['player']->getId();
            $data['player_name'] = $data['player']->getName();
            unset($data['player']);
        }

        // A second player in the same message (target, victim, neighbour…).
        if (isset($data['player2']) && $data['player2'] instanceof Player) {
            $data['player_id2']   = $data['player2']->getId();
            $data['player_name2'] = $data['player2']->getName();
            unset($data['player2']);
        }
    }

    /**
     * Plain log line, no client handler. Also the recommended PHP debug channel
     * on BGA — far cheaper than digging through server logs.
     */
    public static function message(string $msg, array $data = []): void
    {
        self::notifyAll('message', $msg, $data);
    }

    // ── GAME NOTIFICATIONS ───────────────────────────────────────────────────────

    /**
     * Setup's card return ([H13]) — deliberately generic. Every other player
     * and spectator sees only that *a* card was returned; the `_private` block
     * is merged into the args only for the player who returned it, so their
     * own client can reconcile its hand without the card ever appearing in the
     * public notification payload.
     */
    public static function cardReturned(Player $player, Card $card): void
    {
        self::notifyAll('cardReturned', clienttranslate('${player_name} returns a card to the bottom of their deck'), [
            'player'          => $player,
            '_merge_private'  => true,
            '_private'        => [
                $player->getId() => [
                    'card_id'   => $card->getId(),
                    'card_type' => $card->getType(),
                ],
            ],
        ]);
    }

    /**
     * Undoes a `cardReturned` while ReturnCard hasn't fully resolved yet — see
     * States/ReturnCard.php::actUndoReturnCard(). Same public/private split:
     * everyone else just sees the return undone, only the acting player's own
     * client gets the full card back to re-add it to their hand display.
     */
    public static function cardReturnUndone(Player $player, Card $card): void
    {
        self::notifyAll('cardReturnUndone', clienttranslate('${player_name} cancels their card return'), [
            'player'         => $player,
            '_merge_private' => true,
            '_private'       => [
                $player->getId() => [
                    'card' => $card->getUiData($player->getId()),
                ],
            ],
        ]);
    }

    /** `BattleStart`'s GAME-state entry (PR3, RULES.md §5) — no privacy concerns, both know whose turn it is. */
    public static function battleStarted(int $battleNumber, Player $attacker): void
    {
        self::notifyAll('battleStarted', clienttranslate('Battle ${battleNumber}: ${player_name} attacks'), [
            'player'       => $attacker,
            'battleNumber' => $battleNumber,
        ]);
    }

    /**
     * `AttackerPlay`/`DefenderPlay` (PR3, RULES.md §6 ➊➋). No `_private` split
     * needed here — unlike `cardReturned`, there is no identity to hide from
     * one *specific* player; the face-down card is hidden from everyone but
     * its own controller, and the controller already knows what they just
     * played from their own client-side selection, so it doesn't need to be
     * echoed back to them either. `getUiData()`'s default (no current player)
     * already yields the redacted stub for the face-down card for this
     * broadcast, regardless of who ends up reading it.
     */
    public static function cardsPlayed(Player $player, Card $faceUpCard, Card $faceDownCard): void
    {
        self::notifyAll('cardsPlayed', clienttranslate('${player_name} plays 2 cards'), [
            'player'       => $player,
            'faceUpCard'   => $faceUpCard->getUiData(),
            'faceDownCard' => $faceDownCard->getUiData(),
        ]);
    }

    /**
     * `DrawCards`'s draw step (PR3, RULES.md §6 ➌) — same public/private split
     * as `cardReturnUndone`: everyone else only learns the count for their
     * deck-count display, the drawing player's own client gets the full cards.
     */
    public static function cardsDrawn(Player $player, Collection $cards): void
    {
        self::notifyAll('cardsDrawn', clienttranslate('${player_name} draws ${count} card(s)'), [
            'player'         => $player,
            'count'          => $cards->count(),
            '_merge_private' => true,
            '_private'       => [
                $player->getId() => [
                    'cards' => $cards->map(fn(Card $c) => $c->getUiData($player->getId()))->toArray(),
                ],
            ],
        ]);
    }

    /**
     * `DrawCards`'s reveal step (PR3, RULES.md §6 ➍) — both hidden cards are
     * flipped face-up server-side before this is called, so `getUiData()` no
     * longer redacts either one; genuinely public at this point.
     */
    public static function cardsRevealed(Card $card1, Card $card2): void
    {
        self::notifyAll('cardsRevealed', clienttranslate('The hidden cards are revealed'), [
            'card1' => $card1->getUiData(),
            'card2' => $card2->getUiData(),
        ]);
    }

    /**
     * `ResolveBattle` (PR4, RULES.md §6 ➎): equal Strength, no winner — both
     * cards retire to the Shrine as Monks. Called after `Cards::retireToShrine()`,
     * so both are already flipped face-down; `getUiData()` redacts them here
     * the same way it redacts a captured Hostage — a card-counting opponent
     * must recall their identity from the earlier `cardsRevealed` line rather
     * than re-reading it off this one.
     */
    public static function laneTied(Card $card1, Card $card2): void
    {
        self::notifyAll('laneTied', clienttranslate('The lane ties — both cards retire to the Shrine as Monks'), [
            'card1' => $card1->getUiData(),
            'card2' => $card2->getUiData(),
        ]);
    }

    /**
     * `ResolveBattle` (RULES.md §6 ➏): a single-lane win, capped at 1 Hostage
     * regardless of Calm/Angry (§7 only ever caps a *double*-lane win).
     * Called after `Cards::capture()`, so `$loser` is already the face-down
     * Hostage — its `getUiData()` is redacted here for the same card-counting
     * reason as `laneTied()`; `$winner` stays public, it never hides again.
     */
    public static function hostageCaptured(Player $player, Card $winner, Card $loser, int $stackId): void
    {
        self::notifyAll('hostageCaptured', clienttranslate('${player_name} captures a Hostage'), [
            'player'  => $player,
            'winner'  => $winner->getUiData(),
            'loser'   => $loser->getUiData(),
            'stackId' => $stackId,
        ]);
    }

    /**
     * [H4]/§7 — Angry, winning both lanes keeps both stacks: a Leap-Frog!
     * `$winners`/`$losers`/`$stackIds` are parallel arrays, 1 entry per lane
     * won, in the same order — same redaction split as `hostageCaptured()`.
     *
     * @param Card[] $winners
     * @param Card[] $losers
     * @param int[]  $stackIds
     */
    public static function leapFrog(Player $player, array $winners, array $losers, array $stackIds): void
    {
        self::notifyAll('leapFrog', clienttranslate('${player_name} wins both lanes while Angry — Leap-Frog! Both stacks are kept'), [
            'player'   => $player,
            'winners'  => array_map(fn(Card $c) => $c->getUiData(), $winners),
            'losers'   => array_map(fn(Card $c) => $c->getUiData(), $losers),
            'stackIds' => $stackIds,
        ]);
    }

    /**
     * [H14]/§7 — Calm, winning both lanes: both stacks are formed (already
     * captured by the time this is sent), but the winner must now choose
     * which 1 to keep — `States/ChooseStack.php` (state 75) follows. Same
     * parallel-array shape as `leapFrog()`.
     *
     * @param Card[] $winners
     * @param Card[] $losers
     * @param int[]  $stackIds
     */
    public static function doubleWinCalm(Player $player, array $winners, array $losers, array $stackIds): void
    {
        self::notifyAll('doubleWinCalm', clienttranslate('${player_name} wins both lanes while Calm and must choose which stack to keep'), [
            'player'   => $player,
            'winners'  => array_map(fn(Card $c) => $c->getUiData(), $winners),
            'losers'   => array_map(fn(Card $c) => $c->getUiData(), $losers),
            'stackIds' => $stackIds,
        ]);
    }

    /**
     * `ChooseStack`'s resolution ([H14]): the declined stack's Captor and
     * Hostage both retire to the Shrine as Monks. No card data needed here —
     * both stacks were already fully rendered client-side by `doubleWinCalm()`,
     * so the client just reparents/flips its own existing elements by id.
     */
    public static function stackKept(Player $player, int $keptStackId, int $declinedStackId): void
    {
        self::notifyAll('stackKept', clienttranslate('${player_name} keeps 1 stack; the other retires to the Shrine'), [
            'player'          => $player,
            'keptStackId'     => $keptStackId,
            'declinedStackId' => $declinedStackId,
        ]);
    }

    /**
     * RULES.md §7's Calm/Angry, for both players at once. Physically the
     * Shrine itself shows this by being flipped/rotated; until `shrine.ts`
     * renders that, the client puts the word in each player panel.
     *
     * Sent from `BattleEnd` — the one point every capture path (ResolveBattle
     * directly, or via ChooseStack on [H14]) has converged and the standing
     * hostage totals are final for the Battle. Deliberately silent: the
     * capture lines above already say *why* it moved.
     *
     * @param array<int, bool> $angry playerId => is Angry (Cards::getAngryByPlayerId())
     */
    public static function moodChanged(array $angry): void
    {
        self::notifyAll('moodChanged', '', ['angry' => $angry]);
    }
}
