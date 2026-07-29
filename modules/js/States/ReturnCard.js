export class ReturnCard {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedCardId = null;
        this.hasConfirmedReturn = false;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must return a card to the bottom of your deck') :
            _('${actplayer} must return a card to the bottom of their deck'));
        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }
    onLeavingState(args, isCurrentPlayerActive) {
        this.game.setHandSelectable(false);
        this.selectedCardId = null;
        this.hasConfirmedReturn = false;
        this.game.setSelectedHandCard(null);
    }
    onPlayerActivationChange(args, isCurrentPlayerActive) {
        this.selectedCardId = null;
        this.hasConfirmedReturn = !isCurrentPlayerActive;
        this.game.setSelectedHandCard(null);
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
        if (this.hasConfirmedReturn) {
            this.bga.statusBar.addActionButton(_('Undo'), () => {
                this.bga.actions.performAction('actUndoReturnCard', {}, { checkAction: false, checkPossibleActions: true });
            }, { id: 'btn-undo-return-card', color: 'secondary' });
            return;
        }
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
