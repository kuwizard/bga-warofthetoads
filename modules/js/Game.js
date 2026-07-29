import { PlayerTurn } from "./States/PlayerTurn.js";
export class Game {
    constructor(bga) {
        console.log('warofthetoads constructor');
        this.bga = bga;
        this.playerTurn = new PlayerTurn(this, bga);
        this.bga.states.register('PlayerTurn', this.playerTurn);
    }
    setup(gamedatas) {
        console.log("Starting game setup");
        this.gamedatas = gamedatas;
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);
        this.setupNotifications();
        console.log("Ending game setup");
    }
    setupNotifications() {
        console.log('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({});
    }
}
