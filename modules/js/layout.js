export const BOARD_LAYOUT_PREF_ID = 102;
export const HAND_POSITION_PREF_ID = 103;
export const OPPONENT_HAND_PREF_ID = 104;
const TOP_DOWN = 2;
const HAND_AT_TOP = 1;
const OPPONENT_HAND_SHOWN = 1;
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
    isOpponentHandShown() {
        return this.bga.userPreferences.get(OPPONENT_HAND_PREF_ID) === OPPONENT_HAND_SHOWN;
    }
    getHandPositions() {
        const reversed = this.viewingPlayerSitsSecond();
        const positions = {};
        this.playerIdsInTableOrder.forEach((playerId, index) => {
            positions[playerId] = (index === 0) !== reversed ? 'top' : 'bottom';
        });
        return positions;
    }
    viewingPlayerSitsSecond() {
        const myIndex = this.playerIdsInTableOrder.indexOf(Number(this.bga.gameui.player_id));
        return myIndex !== -1 && (myIndex === 0) !== (this.getHandPosition() === 'top');
    }
}
