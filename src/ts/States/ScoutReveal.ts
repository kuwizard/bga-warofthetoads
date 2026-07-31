import { Game } from "../Game";

// Mirrored Scouts choose simultaneously — MULTIPLE_ACTIVE_PLAYER, mirroring ReturnCard.ts's shape.
export class ScoutReveal {
    private selectedCardIds: number[] = [];
    private requiredCount: number = 0;

    constructor(private game: Game, private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    onEnteringState(args: ScoutRevealArgs, isCurrentPlayerActive: boolean) {
        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }

    onLeavingState() {
        this.game.setHandSelectable(false);
        this.selectedCardIds = [];
        this.game.setSelectedHandCards([]);
    }

    onPlayerActivationChange(_args: ScoutRevealArgs, isCurrentPlayerActive: boolean) {
        this.selectedCardIds = [];
        this.requiredCount = Math.min(3, this.game.getMyHandCount());
        this.game.setSelectedHandCards([]);
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
        this.refreshActionButtons(isCurrentPlayerActive);
    }

    private onCardClick(cardId: number) {
        const index = this.selectedCardIds.indexOf(cardId);
        if (index >= 0) {
            this.selectedCardIds.splice(index, 1);
        } else if (this.selectedCardIds.length < this.requiredCount) {
            this.selectedCardIds.push(cardId);
        }

        this.game.setSelectedHandCards(this.selectedCardIds);
        this.refreshActionButtons(true);
    }

    private refreshActionButtons(isCurrentPlayerActive: boolean) {
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
