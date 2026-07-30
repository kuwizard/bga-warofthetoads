<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Core;

use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\Models\BattleContext;
use Bga\Games\WarOfTheToads\Notifications;

/**
 * Home for `debug_*` helpers, kept out of Game.php.
 *
 * Any public `debug_*` method on Game is invokable from the Debug input in the
 * Studio toolbar (right of the table). Output goes to the chat log, so these
 * are the cheapest way to inspect live state without a deploy cycle.
 *
 * Everything here is Studio-only scaffolding — it ships harmlessly, but keep it
 * out of game logic.
 */
trait DebugTrait
{
    /** Dumps the current player roster as seen through the Players manager. */
    public function debug_players(): void
    {
        $lines = [];
        foreach (Players::getAll() as $player) {
            $lines[] = sprintf(
                '  id=%d no=%d color=%s name=%s',
                $player->getId(),
                $player->getNo(),
                $player->getColor(),
                $player->getName(),
            );
        }
        Notifications::message("=== players ===\n" . implode("\n", $lines));
    }

    /** Dumps every global currently set, so key typos show up immediately. */
    public function debug_globals(): void
    {
        $lines = [];
        foreach ($this->bga->globals->getAll() as $name => $value) {
            $lines[] = "  {$name} = " . json_encode($value, JSON_UNESCAPED_SLASHES);
        }
        Notifications::message("=== globals ===\n" . implode("\n", $lines));
    }

    // RULES.md §11's FAQ and the [Hx] rulings, run through the real pipeline. Touches no table.
    public function debug_tacticCases(): void
    {
        $lines = [];
        $failed = 0;

        foreach ($this->tacticCases() as $name => $case) {
            $context = $this->runTacticScenario($case['cards'], $case['flags'] ?? [], $case['hostages'] ?? []);

            foreach (($case['expect'])($context) as $label => [$expected, $actual]) {
                $ok = $expected === $actual;
                $failed += $ok ? 0 : 1;
                $lines[] = sprintf(
                    '  %s  %s / %s: expected %s, got %s',
                    $ok ? 'pass' : 'FAIL',
                    $name,
                    $label,
                    json_encode($expected),
                    json_encode($actual),
                );
            }
        }

        Notifications::message(
            sprintf("=== tactic cases — %d assertion(s) failed ===\n", $failed) . implode("\n", $lines)
        );
    }

    private function tacticCases(): array
    {
        return [
            'FAQ: mirrored assassins put +5 on the lower ally' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,     'p1Hidden' => CARD_TYPE_ASSASSIN,
                    'p2Open' => CARD_TYPE_BODYGUARD, 'p2Hidden' => CARD_TYPE_ASSASSIN,
                ],
                'expect' => fn(BattleContext $c) => [
                    'Scout 2 + 5' => [7.0, $this->tacticStrength($c, self::P1_OPEN)],
                    'Bodyguard 6' => [6.0, $this->tacticStrength($c, self::P2_OPEN)],
                ],
            ],

            'FAQ: assassin on a tied ally does nothing, even behind a saboteur' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_BERSERKER, 'p1Hidden' => CARD_TYPE_ASSASSIN,
                    'p2Open' => CARD_TYPE_BERSERKER, 'p2Hidden' => CARD_TYPE_SABOTEUR,
                ],
                'expect' => fn(BattleContext $c) => [
                    'p1 Berserker unchanged'   => [5.0, $this->tacticStrength($c, self::P1_OPEN)],
                    'p2 Berserker unchanged'   => [5.0, $this->tacticStrength($c, self::P2_OPEN)],
                    'p2 Berserker breaks ties' => [true, $c->hasTieBreaker($c->getCards()[self::P2_OPEN])],
                ],
            ],

            '[H9] trickster ignores a bodyguard' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,    'p1Hidden' => CARD_TYPE_TRICKSTER,
                    'p2Open' => CARD_TYPE_ASSASSIN, 'p2Hidden' => CARD_TYPE_BODYGUARD,
                ],
                'expect' => fn(BattleContext $c) => [
                    'trickster not blocked' => [false, $c->isBlocked($c->getCards()[self::P1_HIDDEN])],
                    'trickster now open'    => [LANE_OPEN, $c->getLanes()[self::P1_HIDDEN]],
                    'ally now hidden'       => [LANE_HIDDEN, $c->getLanes()[self::P1_OPEN]],
                ],
            ],

            'RULES §6 4: a face-up berserker and saboteur never fire' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_BERSERKER, 'p1Hidden' => CARD_TYPE_BODYGUARD,
                    'p2Open' => CARD_TYPE_SABOTEUR,  'p2Hidden' => CARD_TYPE_SCOUT,
                ],
                'expect' => fn(BattleContext $c) => [
                    'no angry override'        => [false, $c->isAngryOverridden(self::PLAYER_1)],
                    'no tie-breaker'           => [false, $c->hasTieBreaker($c->getCards()[self::P2_HIDDEN])],
                    'blocked scout gave no +1' => [3.0, $this->tacticStrength($c, self::P2_OPEN)],
                ],
            ],

            '[H16] siege cannon refuses a strength bonus' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SIEGE,     'p1Hidden' => CARD_TYPE_SCOUT,
                    'p2Open' => CARD_TYPE_BODYGUARD, 'p2Hidden' => CARD_TYPE_BERSERKER,
                ],
                'expect' => fn(BattleContext $c) => [
                    'siege has no strength' => [null, $this->tacticStrength($c, self::P1_OPEN)],
                ],
            ],

            '[H1] general A scales with flags' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,     'p1Hidden' => CARD_TYPE_GENERAL_A,
                    'p2Open' => CARD_TYPE_BODYGUARD, 'p2Hidden' => CARD_TYPE_BERSERKER,
                ],
                'flags'  => [self::PLAYER_1 => 3],
                'expect' => fn(BattleContext $c) => [
                    'Scout 2 + 3' => [5.0, $this->tacticStrength($c, self::P1_OPEN)],
                ],
            ],

            'general B scales with the OPPONENT hostages' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,     'p1Hidden' => CARD_TYPE_GENERAL_B,
                    'p2Open' => CARD_TYPE_BODYGUARD, 'p2Hidden' => CARD_TYPE_BERSERKER,
                ],
                'hostages' => [self::PLAYER_1 => 5, self::PLAYER_2 => 2],
                'expect'   => fn(BattleContext $c) => [
                    'Scout 2 + 2' => [4.0, $this->tacticStrength($c, self::P1_OPEN)],
                ],
            ],

            '[H8] a blocked general grants nothing at all' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_BERSERKER, 'p1Hidden' => CARD_TYPE_BODYGUARD,
                    'p2Open' => CARD_TYPE_ASSASSIN,  'p2Hidden' => CARD_TYPE_GENERAL_A,
                ],
                'flags'  => [self::PLAYER_2 => 4],
                'expect' => fn(BattleContext $c) => [
                    'general blocked'    => [true, $c->isBlocked($c->getCards()[self::P2_HIDDEN])],
                    'assassin unchanged' => [1.0, $this->tacticStrength($c, self::P2_OPEN)],
                ],
            ],

            '[H7] mirrored bodyguards block each other' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,    'p1Hidden' => CARD_TYPE_BODYGUARD,
                    'p2Open' => CARD_TYPE_ASSASSIN, 'p2Hidden' => CARD_TYPE_BODYGUARD,
                ],
                'expect' => fn(BattleContext $c) => [
                    'p1 blocked' => [true, $c->isBlocked($c->getCards()[self::P1_HIDDEN])],
                    'p2 blocked' => [true, $c->isBlocked($c->getCards()[self::P2_HIDDEN])],
                ],
            ],

            '[H15] berserker angers its controller alone' => [
                'cards' => [
                    'p1Open' => CARD_TYPE_SCOUT,     'p1Hidden' => CARD_TYPE_BERSERKER,
                    'p2Open' => CARD_TYPE_BODYGUARD, 'p2Hidden' => CARD_TYPE_SABOTEUR,
                ],
                'expect' => fn(BattleContext $c) => [
                    'p1 angry'     => [true, $c->isAngryOverridden(self::PLAYER_1)],
                    'p2 not angry' => [false, $c->isAngryOverridden(self::PLAYER_2)],
                ],
            ],
        ];
    }

    private const PLAYER_1 = 1;
    private const PLAYER_2 = 2;

    // Far outside the real card_id range (1-18), so a stray write cannot hit a live row.
    private const P1_OPEN   = 9011;
    private const P1_HIDDEN = 9012;
    private const P2_OPEN   = 9021;
    private const P2_HIDDEN = 9022;

    private function runTacticScenario(array $typeBySlot, array $flagsByPlayerId, array $hostagesByPlayerId): BattleContext
    {
        $layoutBySlot = [
            'p1Open'   => [self::P1_OPEN,   self::PLAYER_1, LANE_OPEN,   CARD_DECK_BLUE],
            'p1Hidden' => [self::P1_HIDDEN, self::PLAYER_1, LANE_HIDDEN, CARD_DECK_BLUE],
            'p2Open'   => [self::P2_OPEN,   self::PLAYER_2, LANE_OPEN,   CARD_DECK_RED],
            'p2Hidden' => [self::P2_HIDDEN, self::PLAYER_2, LANE_HIDDEN, CARD_DECK_RED],
        ];

        $cardsById = [];
        $laneByCardId = [];
        $revealedCardIds = [];
        foreach ($layoutBySlot as $slot => [$cardId, $controller, $lane, $deck]) {
            $cardsById[$cardId] = Cards::detachedFromTable([
                'card_id'           => $cardId,
                'card_type'         => $typeBySlot[$slot],
                'card_deck'         => $deck,
                'card_controller'   => $controller,
                'card_location'     => LOCATION_LANE,
                'card_location_arg' => $lane,
                'card_facedown'     => $lane === LANE_HIDDEN ? 1 : 0,
            ]);
            $laneByCardId[$cardId] = $lane;

            if ($lane === LANE_HIDDEN) {
                $revealedCardIds[] = $cardId;
            }
        }

        $zeroForBoth = [self::PLAYER_1 => 0, self::PLAYER_2 => 0];
        $context = new BattleContext(
            $cardsById,
            $laneByCardId,
            $revealedCardIds,
            $flagsByPlayerId + $zeroForBoth,
            $hostagesByPlayerId + $zeroForBoth,
        );

        foreach ([TACTIC_BAND_BLOCK, TACTIC_BAND_START, TACTIC_BAND_DURING] as $band) {
            $context->runBand($band);
        }

        return $context;
    }

    private function tacticStrength(BattleContext $context, int $cardId): ?float
    {
        return $context->getStrength($context->getCards()[$cardId]);
    }
}
