export class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must play a card or pass') :
            _('${actplayer} must play a card or pass'));
        if (isCurrentPlayerActive) {
            const playableCardsIds = args.playableCardsIds;
            playableCardsIds.forEach(cardId => this.bga.statusBar.addActionButton(_('Play card with id ${card_id}').replace('${card_id}', `${cardId}`), () => this.onCardClick(cardId)));
            this.bga.statusBar.addActionButton(_('Pass'), () => this.bga.actions.performAction("actPass"), { color: 'secondary' });
        }
    }
    onLeavingState(args, isCurrentPlayerActive) {
    }
    onPlayerActivationChange(args, isCurrentPlayerActive) {
    }
    onCardClick(card_id) {
        console.log('onCardClick', card_id);
        this.bga.actions.performAction("actPlayCard", {
            card_id,
        }).then(() => {
        });
    }
}
