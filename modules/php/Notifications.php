<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads;

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
}
