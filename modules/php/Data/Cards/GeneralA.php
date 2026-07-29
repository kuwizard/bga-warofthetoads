<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\Card;

/**
 * RULES.md §3 — "the two Generals are different cards: same Strength, same
 * Special Attribute, different Tactics. The decklist prints them as
 * 'General ×2'" — hence the identical name, distinguished only by Tactic.
 * SpAt: loses against Assassin. Tactic: Start of Battle.
 */
class GeneralA extends Card
{
    public function __construct(array $row = [])
    {
        parent::__construct($row);

        $this->name             = clienttranslate('General');
        $this->strength         = 7;
        $this->specialAttribute = SPECIAL_ATTRIBUTE_LOSES_TO_ASSASSIN;
        $this->band             = TACTIC_BAND_START;
        $this->description      = clienttranslate('+1 to your Ally for each of your Flags in the Shrine');
    }
}
