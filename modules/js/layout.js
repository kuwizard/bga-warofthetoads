export const BOARD_LAYOUT_PREF_ID = 102;
export const HAND_POSITION_PREF_ID = 103;
const TOP_DOWN = 2;
const HAND_AT_TOP = 1;
export class Layout {
    constructor(bga) {
        this.bga = bga;
    }
    render(gameArea, playerIdsInTableOrder) {
        this.gameArea = gameArea;
        this.playerIdsInTableOrder = playerIdsInTableOrder;
        gameArea.insertAdjacentHTML('beforeend', `<div id="wott-table"></div>`);
        return document.getElementById('wott-table');
    }
    apply() {
        const topDown = this.bga.userPreferences.get(BOARD_LAYOUT_PREF_ID) === TOP_DOWN;
        this.gameArea.classList.toggle('wott-layout--top-down', topDown);
        this.gameArea.classList.toggle('wott-layout--reversed', topDown && this.viewingPlayerSitsSecond());
    }
    getHandPosition() {
        return this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === HAND_AT_TOP ? 'top' : 'bottom';
    }
    viewingPlayerSitsSecond() {
        const myIndex = this.playerIdsInTableOrder.indexOf(Number(this.bga.gameui.player_id));
        return myIndex !== -1 && (myIndex === 0) !== (this.getHandPosition() === 'top');
    }
}
