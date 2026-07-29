import { ReturnCard } from "./States/ReturnCard.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;
export class Game {
    constructor(bga) {
        this.deckColorByPlayerId = {};
        console.log('warofthetoads constructor');
        this.bga = bga;
        this.returnCard = new ReturnCard(this, bga);
        this.bga.states.register('ReturnCard', this.returnCard);
    }
    setup(gamedatas) {
        console.log("Starting game setup");
        this.gamedatas = gamedatas;
        const playerIds = gamedatas.playerorder.map(id => Number(id));
        playerIds.forEach((playerId, index) => {
            this.deckColorByPlayerId[playerId] = index === 0 ? 'blue' : 'red';
        });
        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');
        this.hand = new Hand(this.bga);
        this.hand.render(gameArea, this.gamedatas.cards.hand);
        gameArea.insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);
        this.buildPlayerTables();
        this.applyLayoutPreferences();
        this.bga.userPreferences.onChange = (prefId) => {
            if (prefId === HAND_POSITION_PREF_ID || prefId === PLAYER_BLOCKS_POSITION_PREF_ID) {
                this.applyLayoutPreferences();
            }
        };
        this.setupNotifications();
        console.log("Ending game setup");
    }
    buildPlayerTables() {
        const playerTables = document.getElementById('player-tables');
        const myId = Number(this.bga.gameui.player_id);
        const playerIds = this.gamedatas.playerorder.map(id => Number(id));
        const orderedIds = [...playerIds].sort((a, b) => (a === myId ? 1 : 0) - (b === myId ? 1 : 0));
        orderedIds.forEach(playerId => {
            const player = this.gamedatas.players[playerId];
            const deckColor = this.deckColorByPlayerId[playerId];
            const deckCount = this.gamedatas.cards.deckCounts[playerId] ?? 0;
            const sideClass = playerId === myId ? 'wott-player-table--me' : 'wott-player-table--opponent';
            playerTables.insertAdjacentHTML('beforeend', `
                <div id="player-table-${playerId}" class="wott-player-table ${sideClass}" style="--player-color: #${player.color}">
                    <h3 class="wott-player-name">${player.name}</h3>
                    <div class="wott-deck">
                        <div class="wott-card wott-card--${deckColor}-back"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${deckCount}</span>
                        <div class="wott-deck-anchor" id="wott-deck-anchor-${playerId}"></div>
                    </div>
                </div>
            `);
        });
    }
    applyLayoutPreferences() {
        const handOnTop = this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === 1;
        this.hand.setPosition(handOnTop ? 'top' : 'bottom');
        const stacked = this.bga.userPreferences.get(PLAYER_BLOCKS_POSITION_PREF_ID) === 2;
        const playerTables = document.getElementById('player-tables');
        playerTables.classList.toggle('wott-player-tables--stacked', stacked);
        playerTables.classList.toggle('wott-player-tables--hand-top', stacked && handOnTop);
        playerTables.classList.toggle('wott-player-tables--hand-bottom', stacked && !handOnTop);
    }
    setHandSelectable(selectable, onClick) {
        this.hand.setSelectable(selectable, onClick);
    }
    setSelectedHandCard(cardId) {
        this.hand.setSelectedCard(cardId);
    }
    setupNotifications() {
        console.log('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({});
    }
    async notif_cardReturned(args) {
        const playerId = Number(args.player_id);
        this.gamedatas.cards.deckCounts[playerId] = (this.gamedatas.cards.deckCounts[playerId] ?? 0) + 1;
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 1) - 1;
        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${this.gamedatas.cards.deckCounts[playerId]}`;
        }
        if (args.card_id !== undefined) {
            this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card => card.id !== args.card_id);
            const deckAnchor = document.getElementById(`wott-deck-anchor-${playerId}`);
            if (deckAnchor) {
                await this.hand.animateReturnToDeck(args.card_id, deckAnchor);
            }
            else {
                this.hand.removeCard(args.card_id);
            }
        }
    }
    async notif_cardReturnUndone(args) {
        const playerId = Number(args.player_id);
        this.gamedatas.cards.deckCounts[playerId] = (this.gamedatas.cards.deckCounts[playerId] ?? 1) - 1;
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 0) + 1;
        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${this.gamedatas.cards.deckCounts[playerId]}`;
        }
        if (args.card !== undefined) {
            this.gamedatas.cards.hand.push(args.card);
            const deckAnchor = document.getElementById(`wott-deck-anchor-${playerId}`);
            if (deckAnchor) {
                await this.hand.animateUndoReturn(args.card, deckAnchor);
            }
            else {
                this.hand.appendCard(args.card);
            }
        }
    }
}
