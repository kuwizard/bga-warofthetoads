<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — no Special Attribute. Tactic: Block. */
class Bodyguard extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name        = clienttranslate('Bodyguard');
        $this->strength    = 6;
        $this->band        = TACTIC_BAND_BLOCK;
        $this->description = clienttranslate("Block your opponent's Tactic");
    }
}
