import { Game } from "../Game";

/**
 * Setup's card return (RULES.md §4 step 5, [H13]): both players simultaneously
 * pick 1 of their 5 hand cards to return to the bottom of their deck. A
 * MULTIPLE_ACTIVE_PLAYER state — both players can be active at once, so all
 * hand-selectability logic funnels through onPlayerActivationChange.
 */
export class ReturnCard {
    constructor(private game: Game, private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    /**
     * This method is called each time we are entering the game state. You can use this method to perform some user interface changes at this moment.
     */
    onEnteringState(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must return a card to your deck') :
            _('${actplayer} must return a card to their deck')
        );

        this.onPlayerActivationChange(args, isCurrentPlayerActive);
    }

    /**
     * This method is called each time we are leaving the game state. You can use this method to perform some user interface changes at this moment.
     */
    onLeavingState(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.game.setHandSelectable(false);
    }

    /**
     * This method is called each time the current player becomes active or inactive in a MULTIPLE_ACTIVE_PLAYER state. You can use this method to perform some user interface changes at this moment.
     */
    onPlayerActivationChange(args: ReturnCardArgs, isCurrentPlayerActive: boolean) {
        this.game.setHandSelectable(isCurrentPlayerActive, cardId => this.onCardClick(cardId));
    }

    onCardClick(card_id: number) {
        console.log( 'onCardClick', card_id );

        this.bga.actions.performAction("actReturnCard", {
            card_id,
        });
    }

}
