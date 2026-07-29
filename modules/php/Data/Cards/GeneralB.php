<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/**
 * RULES.md §3 — see GeneralA for why the two Generals share a name.
 * SpAt: loses against Assassin. Tactic: Start of Battle.
 */
class GeneralB extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name             = clienttranslate('General');
        $this->strength         = 7;
        $this->specialAttribute = SPECIAL_ATTRIBUTE_LOSES_TO_ASSASSIN;
        $this->band             = TACTIC_BAND_START;
        $this->description      = clienttranslate('+1 to your Ally per Hostage captured by your opponent');
    }
}
