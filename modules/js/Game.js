import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { ScoutReveal } from "./States/ScoutReveal.js";
import { SiegeGuess } from "./States/SiegeGuess.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { PlayerPanels } from "./playerPanels.js";
import { PlayerTables } from "./playerTables.js";
import { debug, stateLogger } from "./debug.js";
import { notificationOptions, textOnlyNotifHandlers } from "./notifications.js";
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;
export class Game {
    constructor(bga) {
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
        this.bga.states.register('ScoutReveal', new ScoutReveal(this, bga));
        this.bga.states.register('SiegeGuess', new SiegeGuess(this, bga));
    }
    setup(gamedatas) {
        debug('Starting game setup');
        debug('gamedatas', gamedatas);
        this.gamedatas = gamedatas;
        const playerIdsInTableOrder = this.getPlayerIdsInTableOrder();
        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');
        this.playerTables = new PlayerTables();
        this.hand = new Hand(this.bga, this.playerTables);
        this.lanes = new Lanes(this.bga, this.hand);
        this.shrine = new Shrine(this.bga);
        this.playerPanels = new PlayerPanels(this.bga);
        this.hand.render(gameArea, this.gamedatas.cards);
        this.lanes.render(gameArea, this.gamedatas.cards.lanes, playerIdsInTableOrder, Number(this.gamedatas.attackerId));
        this.shrine.render(gameArea, this.gamedatas.cards, playerIdsInTableOrder);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry);
        this.playerTables.render(gameArea, this.gamedatas.players, this.gamedatas.cards, this.gamedatas.deckColors, playerIdsInTableOrder, Number(this.bga.gameui.player_id));
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
    applyLayoutPreferences() {
        const handOnTop = this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === 1;
        this.hand.setPosition(handOnTop ? 'top' : 'bottom');
        this.playerTables.setLayout(this.bga.userPreferences.get(PLAYER_BLOCKS_POSITION_PREF_ID) === 2, handOnTop);
    }
    setHandSelectable(selectable, onClick) {
        this.hand.setSelectable(selectable, onClick);
    }
    setSelectedHandCard(cardId) {
        this.hand.setSelectedCard(cardId);
    }
    setSelectedHandCards(cardIds) {
        this.hand.setSelectedCards(cardIds);
    }
    getMyHandCount() {
        return this.hand.getCardCount();
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
        const myId = Number(this.bga.gameui.player_id);
        await this.lanes.previewPlay(this.hand.getCard(cardId), myId, faceDown);
    }
    async previewUnplayCard(cardId, wasFaceDown) {
        await this.lanes.previewUnplay(cardId, wasFaceDown);
    }
    setupNotifications() {
        debug('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({
            ...notificationOptions(this),
            handlers: [this.hand, this.lanes, this.shrine, this.playerPanels, this.playerTables, textOnlyNotifHandlers],
        });
    }
}
