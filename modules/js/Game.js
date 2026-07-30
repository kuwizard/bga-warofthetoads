import { PlayerTurn } from "./States/PlayerTurn.js";
import { debug, stateLogger } from "./debug.js";
export class Game {
    constructor(bga) {
        debug('warofthetoads constructor');
        this.bga = bga;
        this.bga.states.logger = stateLogger;
        this.playerTurn = new PlayerTurn(this, bga);
        this.bga.states.register('PlayerTurn', this.playerTurn);
    }
    setup(gamedatas) {
        debug('Starting game setup');
        debug('gamedatas', gamedatas);
        this.gamedatas = gamedatas;
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);
        this.setupNotifications();
        debug('Ending game setup');
    }
    setupNotifications() {
        debug('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({
            onStart: (name, msg, args) => debug(`Notif [${name}]`, { ...args, message: msg }),
        });
    }
}
