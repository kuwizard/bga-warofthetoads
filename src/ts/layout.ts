export const BOARD_LAYOUT_PREF_ID = 102;
export const HAND_POSITION_PREF_ID = 103;
export const OPPONENT_HAND_PREF_ID = 104;

const TOP_DOWN = 2;
const HAND_AT_TOP = 1;
const OPPONENT_HAND_SHOWN = 1;

// Both layouts share one DOM — src/scss/layout.scss does all the turning, so a mid-battle switch never moves a card out of its slot.
export class Layout {
    private gameArea!: HTMLElement;
    private playerIdsInTableOrder!: number[];

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    // Top-down puts the Shrine beside the lanes, which the game area's own column flow cannot do — so both render into this wrapper instead.
    render(gameArea: HTMLElement, playerIdsInTableOrder: number[]): HTMLElement {
        this.gameArea = gameArea;
        this.playerIdsInTableOrder = playerIdsInTableOrder;

        gameArea.insertAdjacentHTML('beforeend', `<div id="wott-table"></div>`);
        return document.getElementById('wott-table')!;
    }

    apply(): void {
        const topDown = this.bga.userPreferences.get(BOARD_LAYOUT_PREF_ID) === TOP_DOWN;

        this.gameArea.classList.toggle('wott-layout--top-down', topDown);
        this.gameArea.classList.toggle('wott-layout--reversed', topDown && this.viewingPlayerSitsSecond());
    }

    getHandPosition(): 'top' | 'bottom' {
        return this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === HAND_AT_TOP ? 'top' : 'bottom';
    }

    isOpponentHandShown(): boolean {
        return this.bga.userPreferences.get(OPPONENT_HAND_PREF_ID) === OPPONENT_HAND_SHOWN;
    }

    // Reuses the lanes' own ordering so a hand row always sits on the same end as its owner's lane slot.
    getHandPositions(): { [playerId: number]: 'top' | 'bottom' } {
        const reversed = this.viewingPlayerSitsSecond();
        const positions: { [playerId: number]: 'top' | 'bottom' } = {};

        this.playerIdsInTableOrder.forEach((playerId, index) => {
            positions[playerId] = (index === 0) !== reversed ? 'top' : 'bottom';
        });

        return positions;
    }

    // The viewing player takes the same end of the lanes as their own hand; anyone without a seat (spectator, replay) keeps the plain table order left-right mode always uses.
    private viewingPlayerSitsSecond(): boolean {
        const myIndex = this.playerIdsInTableOrder.indexOf(Number(this.bga.gameui.player_id));

        return myIndex !== -1 && (myIndex === 0) !== (this.getHandPosition() === 'top');
    }
}
