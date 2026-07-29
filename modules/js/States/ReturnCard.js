export class ReturnCard {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedCardId = null;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must return a card to your deck') :
            _('${actplayer} must return a card to their deck'));
        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }
    onLeavingState(args, isCurrentPlayerActive) {
        this.game.setHandSelectable(false);
        this.selectedCardId = null;
        this.game.setSelectedHandCard(null);
    }
    onPlayerActivationChange(args, isCurrentPlayerActive) {
        this.selectedCardId = null;
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
        this.refreshActionButtons();
    }
    onCardClick(cardId) {
        this.selectedCardId = this.selectedCardId === cardId ? null : cardId;
        this.game.setSelectedHandCard(this.selectedCardId);
        this.refreshActionButtons();
    }
    refreshActionButtons() {
        this.bga.statusBar.removeActionButtons();
        if (this.selectedCardId === null) {
            return;
        }
        const cardId = this.selectedCardId;
        this.bga.statusBar.addActionButton(_('Confirm'), () => {
            this.bga.actions.performAction('actReturnCard', { card_id: cardId });
        }, { id: 'btn-confirm-return-card' });
        this.bga.statusBar.addActionButton(_('Cancel'), () => {
            this.selectedCardId = null;
            this.game.setSelectedHandCard(null);
            this.refreshActionButtons();
        }, { id: 'btn-cancel-return-card', color: 'secondary' });
    }
}
