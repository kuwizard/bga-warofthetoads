import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { PlayerPanels } from "./playerPanels.js";
import { debug, stateLogger } from "./debug.js";
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;
export class Game {
    constructor(bga) {
        this.deckColorByPlayerId = {};
        debug('warofthetoads constructor');
        this.bga = bga;
        this.bga.states.logger = stateLogger;
        this.returnCard = new ReturnCard(this, bga);
        this.bga.states.register('ReturnCard', this.returnCard);
        this.playCards = new PlayCards(this, bga);
        this.bga.states.register('AttackerPlay', this.playCards);
        this.bga.states.register('DefenderPlay', this.playCards);
        this.chooseStack = new ChooseStack(this, bga);
        this.bga.states.register('ChooseStack', this.chooseStack);
    }
    setup(gamedatas) {
        debug('Starting game setup');
        debug('gamedatas', gamedatas);
        this.gamedatas = gamedatas;
        const playerIdsInTableOrder = this.getPlayerIdsInTableOrder();
        playerIdsInTableOrder.forEach((playerId, index) => {
            this.deckColorByPlayerId[playerId] = index === 0 ? 'blue' : 'red';
        });
        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');
        this.hand = new Hand(this.bga);
        this.hand.render(gameArea, this.gamedatas.cards.hand);
        this.lanes = new Lanes(this.bga);
        this.lanes.render(gameArea, this.gamedatas.cards.lanes, this.deckColorByPlayerId, playerIdsInTableOrder);
        this.shrine = new Shrine(this.bga);
        this.shrine.render(gameArea, this.gamedatas.cards, this.deckColorByPlayerId, playerIdsInTableOrder);
        this.playerPanels = new PlayerPanels(this.bga);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry);
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
        debug('Ending game setup');
    }
    getPlayerIdsInTableOrder() {
        return Object.entries(this.gamedatas.players)
            .sort(([, a], [, b]) => a.no - b.no)
            .map(([id]) => Number(id));
    }
    buildPlayerTables() {
        const playerTables = document.getElementById('player-tables');
        const myId = Number(this.bga.gameui.player_id);
        const orderedIds = this.getPlayerIdsInTableOrder();
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
    setLaneCardsSelectable(cardIds, selectable, onClick) {
        this.lanes.setCardsSelectable(cardIds, selectable, onClick);
    }
    setStacksSelectable(stackIds, selectable, onClick) {
        this.shrine.setStacksSelectable(stackIds, selectable, onClick);
    }
    setSelectedStack(stackId) {
        this.shrine.setSelectedStack(stackId);
    }
    getMyPendingStackIds() {
        return this.shrine.getMyPendingStackIds(Number(this.bga.gameui.player_id));
    }
    async previewPlayCard(cardId, faceDown) {
        const card = this.gamedatas.cards.hand.find(c => c.id === cardId);
        const myId = Number(this.bga.gameui.player_id);
        await this.lanes.previewPlay(card, myId, faceDown, this.deckColorByPlayerId[myId]);
    }
    async previewUnplayCard(cardId, wasFaceDown) {
        await this.lanes.previewUnplay(cardId, this.hand.getElement(), wasFaceDown);
    }
    setupNotifications() {
        debug('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({
            onStart: (name, msg, args) => debug(`Notif [${name}]`, { ...args, message: msg }),
        });
    }
    async notif_battleStarted(_args) {
        this.lanes.clear();
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
    async notif_cardsPlayed(args) {
        const playerId = Number(args.player_id);
        const deckColor = this.deckColorByPlayerId[playerId];
        this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card => card.id !== args.faceUpCard.id && card.id !== args.faceDownCard.id);
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 2) - 2;
        await Promise.all([
            this.lanes.playCard(args.faceUpCard, deckColor),
            this.lanes.playCard(args.faceDownCard, deckColor),
        ]);
    }
    async notif_cardsDrawn(args) {
        const playerId = Number(args.player_id);
        this.gamedatas.cards.deckCounts[playerId] = (this.gamedatas.cards.deckCounts[playerId] ?? args.count) - args.count;
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 0) + args.count;
        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${this.gamedatas.cards.deckCounts[playerId]}`;
        }
        if (args.cards !== undefined) {
            args.cards.forEach(card => {
                this.gamedatas.cards.hand.push(card);
                this.hand.appendCard(card);
            });
        }
    }
    async notif_cardsRevealed(args) {
        await Promise.all([
            this.lanes.revealCard(args.card1),
            this.lanes.revealCard(args.card2),
        ]);
    }
    async notif_laneTied(args) {
        this.shrine.onLaneTied(args);
    }
    async notif_hostageCaptured(args) {
        this.shrine.onHostageCaptured(args);
    }
    async notif_leapFrog(args) {
        this.shrine.onLeapFrog(args);
    }
    async notif_doubleWinCalm(args) {
        this.shrine.onDoubleWinCalm(args);
    }
    async notif_stackKept(args) {
        this.shrine.onStackKept(args);
    }
    async notif_moodChanged(args) {
        this.playerPanels.onMoodChanged(args);
    }
}
