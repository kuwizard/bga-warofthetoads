<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/**
 * RULES.md §3 — the Siege Cannon has no Strength Value and cannot gain
 * Strength bonuses from Tactics ([H16]). SpAt: loses in Defence, wins in
 * Attack, except against Saboteur. Tactic: After Battle.
 */
class Siege extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name             = clienttranslate('Siege Cannon');
        $this->strength         = null;
        $this->specialAttribute = SPECIAL_ATTRIBUTE_SIEGE;
        $this->band             = TACTIC_BAND_AFTER;
        $this->description      = clienttranslate(
            'After Battle, guess a card in your opponent\'s hand. If correct, they must say yes'
        );
    }
}
