<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — no Special Attribute. Tactic: Start of Battle, cannot be blocked. */
class Trickster extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name        = clienttranslate('Trickster');
        $this->strength    = 4;
        $this->band        = TACTIC_BAND_START;
        $this->description = clienttranslate('Switch lanes with your Ally. Cannot be blocked!');
    }
}
