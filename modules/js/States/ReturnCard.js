export class ReturnCard {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must return a card to your deck') :
            _('${actplayer} must return a card to their deck'));
        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }
    onLeavingState(args, isCurrentPlayerActive) {
        this.game.setHandSelectable(false);
    }
    onPlayerActivationChange(args, isCurrentPlayerActive) {
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
    }
    onCardClick(card_id) {
        console.log('onCardClick', card_id);
        this.bga.actions.performAction("actReturnCard", {
            card_id,
        });
    }
}
