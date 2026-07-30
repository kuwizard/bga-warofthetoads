<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Data\Cards;

use Bga\Games\WarOfTheToads\Models\BattleContext;
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

    public function applyTactic(BattleContext $context): void
    {
        $opponentId = $context->getFoe($this)->getController();
        $hostagesCapturedByOpponent = $context->getHostageCount($opponentId);

        if ($hostagesCapturedByOpponent === 0) {
            $context->noEffect($this, TACTIC_NO_EFFECT_NO_TARGET);
            return;
        }

        $context->addStrength($this, $context->getAlly($this), (float) $hostagesCapturedByOpponent);
    }
}
