<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — no Special Attribute. Tactic: During Battle. */
class Berserker extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name        = clienttranslate('Berserker');
        $this->strength    = 5;
        $this->band        = TACTIC_BAND_DURING;
        $this->description = clienttranslate('You become Angry: if you win both lanes, capture both');
    }
}
