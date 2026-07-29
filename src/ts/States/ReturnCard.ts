import { Game } from "../Game";

/**
 * Setup's card return (RULES.md §4 step 5, [H13]): both players simultaneously
 * pick 1 of their 5 hand cards to return to the bottom of their deck. A
 * MULTIPLE_ACTIVE_PLAYER state — both players can be active at once, so all
 * hand-selectability logic funnels through onPlayerActivationChange.
 *
 * Clicking a card only selects it (Confirm/Cancel buttons appear) — nothing
 * is sent to the server until Confirm, so the player can change their mind
 * freely beforehand (mirrors libertalia's select-then-confirm hand flow).
 */
export class ReturnCard {
    private selectedCardId: number | null = null;
    // Only way to go inactive here is by confirming (entry activates everyone at once).
    private hasConfirmedReturn: boolean = false;

    constructor(private game: Game, private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    /**
     * This method is called each time we are entering the game state. You can use this method to perform some user interface changes at this moment.
     */
    onEnteringState(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must return a card to the bottom of your deck') :
            _('${actplayer} must return a card to the bottom of their deck')
        );

        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }

    /**
     * This method is called each time we are leaving the game state. You can use this method to perform some user interface changes at this moment.
     */
    onLeavingState(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.game.setHandSelectable(false);
        this.selectedCardId = null;
        this.hasConfirmedReturn = false;
        this.game.setSelectedHandCard(null);
    }

    /**
     * This method is called each time the current player becomes active or inactive in a MULTIPLE_ACTIVE_PLAYER state. You can use this method to perform some user interface changes at this moment.
     */
    onPlayerActivationChange(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.selectedCardId = null;
        this.hasConfirmedReturn = !isCurrentPlayerActive;
        this.game.setSelectedHandCard(null);
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
        this.refreshActionButtons();
    }

    private onCardClick(cardId: number) {
        this.selectedCardId = this.selectedCardId === cardId ? null : cardId;
        this.game.setSelectedHandCard(this.selectedCardId);
        this.refreshActionButtons();
    }

    private refreshActionButtons() {
        this.bga.statusBar.removeActionButtons();

        if (this.hasConfirmedReturn) {
            this.bga.statusBar.addActionButton(_('Undo'), () => {
                // checkAction: false — this player is inactive, mirrors server-side #[CheckAction(false)].
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
