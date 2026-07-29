<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/** RULES.md §3 — SpAt: wins against Siege Cannon. Tactic: During Battle. */
class Saboteur extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name             = clienttranslate('Saboteur');
        $this->strength         = 3;
        $this->specialAttribute = SPECIAL_ATTRIBUTE_BEATS_SIEGE;
        $this->band             = TACTIC_BAND_DURING;
        $this->description      = clienttranslate('Your Ally breaks ties they are in');
    }
}
