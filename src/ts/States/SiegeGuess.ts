import { Game } from "../Game";
import { guessableCardTypes } from "../tpls.js";

// One button per guessable face; a click guesses immediately (information-only probe).
export class SiegeGuess {
    constructor(private game: Game, private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    onEnteringState(_args: SiegeGuessArgs, isCurrentPlayerActive: boolean) {
        if (!isCurrentPlayerActive) {
            return;
        }

        Object.entries(guessableCardTypes).forEach(([type, cardType]) => {
            const label = cardType.strength === null ? _(cardType.label) : `${_(cardType.label)} (${cardType.strength})`;
            this.bga.statusBar.addActionButton(label, () => {
                this.bga.actions.performAction('actSiegeGuess', { card_type: type });
            }, { id: `btn-siege-guess-${type}` });
        });
    }
}
