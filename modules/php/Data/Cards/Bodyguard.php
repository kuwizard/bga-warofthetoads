<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\BattleContext;
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

    public function applyTactic(BattleContext $context): void
    {
        // [H8] only the opponent's revealed Tactic; [H9] never the Trickster.
        $target = $context->getOpposingRevealedCard($this);

        if ($target === null || $target->getType() === CARD_TYPE_TRICKSTER) {
            $context->noEffect($this, TACTIC_NO_EFFECT_NO_TARGET, $target);
            return;
        }

        $context->block($this, $target);
    }
}
