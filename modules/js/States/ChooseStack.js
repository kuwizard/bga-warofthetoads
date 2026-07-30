export class ChooseStack {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedStackId = null;
        this.pendingStackIds = [];
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must choose which stack to keep') :
            _('${actplayer} must choose which stack to keep'));
        this.selectedStackId = null;
        this.pendingStackIds = isCurrentPlayerActive ? this.game.getMyPendingStackIds() : [];
        this.game.setSelectedStack(null);
        this.game.setStacksSelectable(this.pendingStackIds, isCurrentPlayerActive, stackId => this.onStackClick(stackId));
        this.refreshActionButtons();
    }
    onLeavingState() {
        this.game.setStacksSelectable(this.pendingStackIds, false);
        this.selectedStackId = null;
        this.pendingStackIds = [];
        this.game.setSelectedStack(null);
    }
    onStackClick(stackId) {
        this.selectedStackId = this.selectedStackId === stackId ? null : stackId;
        this.game.setSelectedStack(this.selectedStackId);
        this.refreshActionButtons();
    }
    refreshActionButtons() {
        this.bga.statusBar.removeActionButtons();
        if (this.selectedStackId === null) {
            return;
        }
        const stackId = this.selectedStackId;
        this.bga.statusBar.addActionButton(_('Confirm'), () => {
            this.bga.actions.performAction('actChooseStack', { stack_id: stackId });
        }, { id: 'btn-confirm-choose-stack' });
        this.bga.statusBar.addActionButton(_('Cancel'), () => {
            this.selectedStackId = null;
            this.game.setSelectedStack(null);
            this.refreshActionButtons();
        }, { id: 'btn-cancel-choose-stack', color: 'secondary' });
    }
}
