<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — no Special Attribute. Tactic: Start of Battle. */
class Scout extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name        = clienttranslate('Scout');
        $this->strength    = 2;
        $this->band        = TACTIC_BAND_START;
        $this->description = clienttranslate('+1 to your Ally and opponent shows 3 cards in their hand');
    }
}
