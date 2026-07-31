export class ScoutReveal {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedCardIds = [];
        this.requiredCount = 0;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }
    onLeavingState() {
        this.game.setHandSelectable(false);
        this.selectedCardIds = [];
        this.game.setSelectedHandCards([]);
    }
    onPlayerActivationChange(_args, isCurrentPlayerActive) {
        this.selectedCardIds = [];
        this.requiredCount = Math.min(3, this.game.getMyHandCount());
        this.game.setSelectedHandCards([]);
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
        this.refreshActionButtons(isCurrentPlayerActive);
    }
    onCardClick(cardId) {
        const index = this.selectedCardIds.indexOf(cardId);
        if (index >= 0) {
            this.selectedCardIds.splice(index, 1);
        }
        else if (this.selectedCardIds.length < this.requiredCount) {
            this.selectedCardIds.push(cardId);
        }
        this.game.setSelectedHandCards(this.selectedCardIds);
        this.refreshActionButtons(true);
    }
    refreshActionButtons(isCurrentPlayerActive) {
        this.bga.statusBar.removeActionButtons();
        if (!isCurrentPlayerActive || this.selectedCardIds.length !== this.requiredCount) {
            return;
        }
        const cardIds = [...this.selectedCardIds];
        this.bga.statusBar.addActionButton(_('Confirm'), () => {
            this.bga.actions.performAction('actScoutReveal', { card_ids: cardIds });
        }, { id: 'btn-confirm-scout-reveal' });
    }
}
