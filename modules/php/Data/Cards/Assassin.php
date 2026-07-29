<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — SpAt: wins against General. Tactic: During Battle. */
class Assassin extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name             = clienttranslate('Assassin');
        $this->strength         = 1;
        $this->specialAttribute = SPECIAL_ATTRIBUTE_BEATS_GENERAL;
        $this->band             = TACTIC_BAND_DURING;
        $this->description      = clienttranslate('+2.5 to your Ally or their Foe, whoever is lower');
    }
}
