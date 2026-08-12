import { Game } from "../Game";

/**
 * ChooseStack (RULES.md §7, [H14]): having won both lanes while Calm, the
 * active player picks 1 of their 2 just-captured stacks to keep; the other's
 * 2 cards retire to the Shrine as Monks. The 2 candidate stacks are derived
 * client-side from `cards.stacks` (the 2 highest stack ids the active player
 * controls) rather than declared in `ChooseStackArgs` — same "derive, don't
 * declare" approach the server side uses (`Cards::getStacksFor()`).
 */
export class ChooseStack {
    private selectedStackId: number | null = null;
    private pendingStackIds: number[] = [];
    private isCurrentPlayerActive: boolean = false;

    constructor(private game: Game, private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    onEnteringState(args: ChooseStackArgs, isCurrentPlayerActive: boolean) {
        this.selectedStackId = null;
        this.isCurrentPlayerActive = isCurrentPlayerActive;
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

    private onStackClick(stackId: number) {
        this.selectedStackId = this.selectedStackId === stackId ? null : stackId;
        this.game.setSelectedStack(this.selectedStackId);
        this.refreshActionButtons();
    }

    private explainChoice() {
        const button = document.getElementById('btn-explain-choose-stack');
        if (!button) {
            return;
        }

        const bubbleId = 'wott-choose-stack-explain-bubble';
        document.getElementById(bubbleId)?.remove();

        const rect = button.getBoundingClientRect();
        const bubble = document.createElement('div');
        bubble.id = bubbleId;
        bubble.className = 'wott-explain-bubble';
        bubble.textContent = _('You won both lanes while Calm: pick which stack stays your visible Hostage — the other becomes an anonymous Monk. Both cards were already revealed in the log, so this does not change your score; it is mostly cosmetic.');
        bubble.style.left = `${rect.left + rect.width / 2}px`;
        bubble.style.top = `${rect.bottom + 12}px`;

        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 7000);
    }

    private refreshActionButtons() {
        this.bga.statusBar.removeActionButtons();

        if (this.isCurrentPlayerActive) {
            this.bga.statusBar.addActionButton(_('What is it?'), () => this.explainChoice(), {
                id: 'btn-explain-choose-stack',
                color: 'secondary',
            });
        }

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
