<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads;

use Bga\Games\WarOfTheToads\Helpers\Collection;
use Bga\Games\WarOfTheToads\Managers\Cards;
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
        self::notifyAll('cardsPlayed', clienttranslate('${player_name} plays ${cardName}${cardStrength} and a hidden card'), [
            'player'         => $player,
            'i18n'           => ['cardName'],
            'cardName'       => $faceUpCard->getName(),
            'cardStrength'   => self::strengthSuffix($faceUpCard),
            'cardController' => $faceUpCard->getController(),
            'faceUpCard'     => $faceUpCard->getUiData(),
            'faceDownCard'   => $faceDownCard->getUiData(),
            // cardController isn't in the message template, so it needs 'preserve' to survive historical_log replay on refresh.
            'preserve'       => ['cardController'],
        ]);
    }

    /**
     * `DrawCards`'s draw step (PR3, RULES.md §6 ➌) — same public/private split
     * as `cardReturnUndone`: everyone else only learns the count for their
     * deck-count display, the drawing player's own client gets the full cards.
     */
    public static function cardsDrawn(Player $player, Collection $cards, bool $arrivesFaceUp = false): void
    {
        self::notifyAll('cardsDrawn', clienttranslate('${player_name} draws ${count} card(s)'), [
            'player'         => $player,
            'count'          => $cards->count(),
            'arrivesFaceUp'  => $arrivesFaceUp,
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
        self::notifyAll('cardsRevealed', clienttranslate('The hidden cards are revealed: ${card1Name}${card1Strength} and ${card2Name}${card2Strength}'), [
            'i18n'            => ['card1Name', 'card2Name'],
            'card1'           => $card1->getUiData(),
            'card1Name'       => $card1->getName(),
            'card1Strength'   => self::strengthSuffix($card1),
            'card1Controller' => $card1->getController(),
            'card2'           => $card2->getUiData(),
            'card2Name'       => $card2->getName(),
            'card2Strength'   => self::strengthSuffix($card2),
            'card2Controller' => $card2->getController(),
            'preserve'        => ['card1Controller', 'card2Controller'],
        ]);
    }

    // ── TACTICS: one method per TACTIC_EVENT_*, sent from States/ResolveTactics ──

    public static function tacticBlocked(Player $player, Card $card, Card $target): void
    {
        self::notifyAll('tacticBlocked', clienttranslate('${player_name} plays ${cardName} and blocks the opposing ${targetName}'), [
            'player'     => $player,
            'i18n'       => ['cardName', 'targetName'],
            'cardName'   => $card->getName(),
            'targetName' => $target->getName(),
            'cardId'     => $card->getId(),
            'targetId'   => $target->getId(),
        ]);
    }

    public static function tacticLanesSwitched(Player $player, Card $card, Card $target, array $laneByCardId): void
    {
        self::notifyAll('tacticLanesSwitched', clienttranslate('${player_name} plays ${cardName} and switches lanes with ${targetName}'), [
            'player'     => $player,
            'i18n'       => ['cardName', 'targetName'],
            'cardName'   => $card->getName(),
            'targetName' => $target->getName(),
            'cardId'     => $card->getId(),
            'targetId'   => $target->getId(),
            'lanes'      => $laneByCardId,
        ]);
    }

    public static function tacticStrength(Player $player, Card $card, Card $target, float $delta, array $strengthByCardId): void
    {
        self::notifyAll('tacticStrength', clienttranslate('${player_name} plays ${cardName}: ${targetName} gains ${delta} Strength'), [
            'player'     => $player,
            'i18n'       => ['cardName', 'targetName'],
            'cardName'   => $card->getName(),
            'targetName' => $target->getName(),
            'cardId'     => $card->getId(),
            'targetId'   => $target->getId(),
            'delta'      => rtrim(rtrim(number_format($delta, 1, '.', ''), '0'), '.'),
            'strengths'  => $strengthByCardId,
        ]);
    }

    public static function tacticTieBreaker(Player $player, Card $card, Card $target): void
    {
        self::notifyAll('tacticTieBreaker', clienttranslate('${player_name} plays ${cardName}: ${targetName} now breaks ties'), [
            'player'     => $player,
            'i18n'       => ['cardName', 'targetName'],
            'cardName'   => $card->getName(),
            'targetName' => $target->getName(),
            'cardId'     => $card->getId(),
            'targetId'   => $target->getId(),
        ]);
    }

    public static function tacticAngry(Player $player, Card $card, array $angryByPlayerId): void
    {
        self::notifyAll('tacticAngry', clienttranslate('${player_name} plays ${cardName} and becomes Angry for this Battle'), [
            'player'   => $player,
            'i18n'     => ['cardName'],
            'cardName' => $card->getName(),
            'cardId'   => $card->getId(),
            'angry'    => $angryByPlayerId,
        ]);
    }

    public static function tacticNoEffect(Player $player, Card $card, string $reason, ?Card $target): void
    {
        $messageByReason = [
            TACTIC_NO_EFFECT_BLOCKED     => clienttranslate('${player_name} plays ${cardName}, but its Tactic is blocked'),
            TACTIC_NO_EFFECT_NO_TARGET   => clienttranslate('${player_name} plays ${cardName}, but its Tactic has no effect'),
            TACTIC_NO_EFFECT_NO_STRENGTH => clienttranslate('${player_name} plays ${cardName}, but ${targetName} cannot gain Strength bonuses'),
        ];

        self::notifyAll('tacticNoEffect', $messageByReason[$reason], [
            'player'     => $player,
            'i18n'       => ['cardName', 'targetName'],
            'cardName'   => $card->getName(),
            'targetName' => $target?->getName() ?? '',
            'cardId'     => $card->getId(),
            'targetId'   => $target?->getId(),
            'reason'     => $reason,
        ]);
    }

    public static function scoutRevealed(Player $player, Player $scoutController, array $cards): void
    {
        self::notifyAll('scoutRevealed', clienttranslate('${player_name} shows ${cardNames} to ${player_name2}'), [
            'player'    => $player,
            'player2'   => $scoutController,
            'cardNames' => implode(', ', array_map(fn(Card $c) => $c->getName(), $cards)),
            // Scout forces a full reveal even though these cards stay face-down in hand.
            'cards'     => array_map(fn(Card $c) => $c->getUiData($c->getController()), $cards),
        ]);
    }

    public static function scoutNothingToShow(Player $player): void
    {
        self::notifyAll('scoutNothingToShow', clienttranslate('${player_name} has no cards in hand to show'), [
            'player' => $player,
        ]);
    }

    public static function siegeGuessed(Player $player, Player $opponent, string $cardType, string $cardName, bool $hit): void
    {
        $message = $hit
            ? clienttranslate('${player_name} guesses ${cardName}. ${player_name2} says yes')
            : clienttranslate('${player_name} guesses ${cardName}. ${player_name2} says no');

        self::notifyAll('siegeGuessed', $message, [
            'player'   => $player,
            'player2'  => $opponent,
            'i18n'     => ['cardName'],
            'cardType' => $cardType,
            'cardName' => $cardName,
            'hit'      => $hit,
        ]);
    }

    public static function siegeGuessFizzles(Player $player, Player $opponent): void
    {
        self::notifyAll('siegeGuessFizzles', clienttranslate('${player_name} plays ${cardName}, but ${player_name2} has no cards in hand'), [
            'player'   => $player,
            'player2'  => $opponent,
            'i18n'     => ['cardName'],
            'cardName' => Cards::nameOfType(CARD_TYPE_SIEGE),
        ]);
    }

    public static function laneFighting(int $lane, Card $card1, Card $card2): void
    {
        self::notifyAll('laneFighting', clienttranslate('${laneName} lane fights: ${card1Name}${card1Strength} vs ${card2Name}${card2Strength}'), [
            'lane'            => $lane,
            'i18n'            => ['laneName', 'card1Name', 'card2Name'],
            'laneName'        => $lane === LANE_OPEN ? clienttranslate('Open') : clienttranslate('Hidden'),
            'card1Name'       => $card1->getName(),
            'card1Strength'   => self::strengthSuffix($card1),
            'card1Controller' => $card1->getController(),
            'card2Name'       => $card2->getName(),
            'card2Strength'   => self::strengthSuffix($card2),
            'card2Controller' => $card2->getController(),
            'preserve'        => ['card1Controller', 'card2Controller'],
        ]);
    }

    // The Siege Cannon prints no Strength (gameEnd.ts::casualtyLabel) — an empty suffix here, same honest omission.
    private static function strengthSuffix(Card $card): string
    {
        return $card->getStrength() === null ? '' : " ({$card->getStrength()})";
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

    // ── WAR TRANSITION (RULES.md §8/§9) ─────────────────────────────────────────

    public static function warEnded(int $war, ?Player $winner, array $hostages): void
    {
        if ($winner === null) {
            self::notifyAll('warEnded', clienttranslate('War ${war} ends in a Stalemate — ${count} Hostages each'), [
                'war'   => $war,
                'count' => reset($hostages),
            ]);
            return;
        }

        self::notifyAll('warEnded', clienttranslate('${player_name} wins War ${war} — ${count} Hostages to ${count2}'), [
            'player' => $winner,
            'war'    => $war,
            'count'  => $hostages[$winner->getId()],
            'count2' => min($hostages),
        ]);
    }

    // Same public/private split as cardReturned() — the redacted `card` stub still carries the back colour (physically public, [H2]).
    public static function casualtySet(Player $player, Card $card): void
    {
        self::notifyAll('casualtySet', clienttranslate('${player_name} sets their last card aside face-down — their Casualty'), [
            'player'         => $player,
            'card'           => $card->getUiData(),
            '_merge_private' => true,
            '_private'       => [
                $player->getId() => [
                    'card' => $card->getUiData($player->getId()),
                ],
            ],
        ]);
    }

    public static function warStarted(int $war, array $deckColorByPlayerId, array $deckCounts): void
    {
        self::notifyAll('warStarted', clienttranslate('The 2nd War begins — the decks are swapped'), [
            'war'        => $war,
            'deckColors' => $deckColorByPlayerId,
            'deckCounts' => $deckCounts,
        ]);
    }

    // ── END OF GAME (RULES.md §10) ──────────────────────────────────────────────

    public static function casualtyRevealed(Player $player, Card $card): void
    {
        self::notifyAll('casualtyRevealed', clienttranslate('${player_name} reveals their Casualty: ${cardName}'), [
            'player'   => $player,
            'i18n'     => ['cardName'],
            'cardName' => $card->getName(),
            'card'     => $card->getUiData(),
        ]);
    }

    // `$summary` is States/ComputeScores::summary() — the client's end-of-game panel reads it verbatim.
    public static function gameEnded(?Player $winner, array $summary): void
    {
        $messageByCondition = [
            VICTORY_SECOND_WAR        => clienttranslate('${player_name} wins the game by winning the 2nd War'),
            VICTORY_WON_AND_STALEMATE => clienttranslate('${player_name} wins the game by winning 1 War and stalemating the other'),
            VICTORY_LOWEST_CASUALTY   => clienttranslate('${player_name} wins the game with the lowest Casualty'),
        ];

        if ($winner === null) {
            self::notifyAll('gameEnded', clienttranslate('Both Casualties rank the same — the game is a draw'), $summary);
            return;
        }

        self::notifyAll('gameEnded', $messageByCondition[$summary['condition']], $summary + ['player' => $winner]);
    }
}
