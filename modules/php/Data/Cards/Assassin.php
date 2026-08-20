<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\BattleContext;
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
        $this->description      = clienttranslate("+2.5 to the lowest card in your Ally's lane");
    }

    public function applyTactic(BattleContext $context): void
    {
        $ally = $context->getAlly($this);
        $foe  = $context->getFoe($ally);

        $allyStrength = $context->getStrength($ally);
        $foeStrength  = $context->getStrength($foe);

        // [H5] a tied pair does nothing; [H19] an uncomparable one (Siege Cannon) likewise.
        if ($allyStrength === null || $foeStrength === null || $allyStrength === $foeStrength) {
            $context->noEffect($this, TACTIC_NO_EFFECT_NO_TARGET);
            return;
        }

        $lowerOfTheTwo = $allyStrength < $foeStrength ? $ally : $foe;
        $context->addStrength($this, $lowerOfTheTwo, 2.5);
    }
}
