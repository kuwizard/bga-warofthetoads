export class PlayCards {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.faceUpCardId = null;
        this.faceDownCardId = null;
        this.filledOrder = [];
        this.busy = false;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.faceUpCardId = null;
        this.faceDownCardId = null;
        this.filledOrder = [];
        this.busy = false;
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must play 2 cards, 1 face-up and 1 face-down'));
            this.game.setHandSelectable(false);
            return;
        }
        this.refresh();
    }
    onLeavingState() {
        this.game.setHandSelectable(false);
        this.game.setLaneCardsSelectable(this.playedCardIds(), false);
        this.faceUpCardId = null;
        this.faceDownCardId = null;
        this.filledOrder = [];
        this.busy = false;
    }
    playedCardIds() {
        return [this.faceUpCardId, this.faceDownCardId].filter((id) => id !== null);
    }
    async onHandCardClick(cardId) {
        if (this.busy) {
            return;
        }
        const role = this.faceUpCardId === null ? 'faceUp' : 'faceDown';
        this.busy = true;
        this.refresh();
        this.setRole(role, cardId);
        this.filledOrder.push(role);
        await this.game.previewPlayCard(cardId, role === 'faceDown');
        this.busy = false;
        this.refresh();
    }
    async onLaneCardClick(cardId) {
        if (this.busy) {
            return;
        }
        const role = cardId === this.faceUpCardId ? 'faceUp' : 'faceDown';
        this.busy = true;
        this.refresh();
        this.setRole(role, null);
        this.filledOrder = this.filledOrder.filter(r => r !== role);
        await this.game.previewUnplayCard(cardId, role === 'faceDown');
        this.busy = false;
        this.refresh();
    }
    async onCancel() {
        const role = this.filledOrder[this.filledOrder.length - 1];
        if (role === undefined || this.busy) {
            return;
        }
        const cardId = role === 'faceUp' ? this.faceUpCardId : this.faceDownCardId;
        this.busy = true;
        this.refresh();
        this.setRole(role, null);
        this.filledOrder.pop();
        await this.game.previewUnplayCard(cardId, role === 'faceDown');
        this.busy = false;
        this.refresh();
    }
    setRole(role, cardId) {
        if (role === 'faceUp') {
            this.faceUpCardId = cardId;
        }
        else {
            this.faceDownCardId = cardId;
        }
    }
    refresh() {
        const bothFilled = this.faceUpCardId !== null && this.faceDownCardId !== null;
        this.bga.statusBar.setTitle(this.faceUpCardId === null ? _('${you} must select a face-up card') :
            this.faceDownCardId === null ? _('${you} must select a face-down card') :
                _('${you} may confirm your turn, or click on a card to change it'));
        this.game.setHandSelectable(!this.busy && !bothFilled, cardId => this.onHandCardClick(cardId));
        this.game.setLaneCardsSelectable(this.playedCardIds(), !this.busy && bothFilled, cardId => this.onLaneCardClick(cardId));
        this.bga.statusBar.removeActionButtons();
        if (this.busy) {
            return;
        }
        if (this.filledOrder.length > 0) {
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { id: 'btn-cancel-play-cards', color: 'secondary' });
        }
        if (bothFilled) {
            const faceUpCardId = this.faceUpCardId;
            const faceDownCardId = this.faceDownCardId;
            this.bga.statusBar.addActionButton(_('Confirm'), () => {
                this.bga.actions.performAction('actPlayCards', { faceUpCardId, faceDownCardId });
            }, { id: 'btn-confirm-play-cards' });
        }
    }
}
