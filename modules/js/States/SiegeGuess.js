import { guessableCardTypes } from "../tpls.js";
export class SiegeGuess {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(_args, isCurrentPlayerActive) {
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
