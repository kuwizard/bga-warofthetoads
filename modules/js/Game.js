import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { ScoutReveal } from "./States/ScoutReveal.js";
import { SiegeGuess } from "./States/SiegeGuess.js";
import { Hand } from "./hand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { Layout, BOARD_LAYOUT_PREF_ID, HAND_POSITION_PREF_ID } from "./layout.js";
import { PlayerPanels } from "./playerPanels.js";
import { GameEnd } from "./gameEnd.js";
import { debug, stateLogger } from "./debug.js";
import { notificationOptions, textOnlyNotifHandlers } from "./notifications.js";
import { ANIMATION_SPEED_PREF_ID, applyAnimationSpeed } from "./common.js";
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
        applyAnimationSpeed(this.bga);
        const playerIdsInTableOrder = this.getPlayerIdsInTableOrder();
        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');
        this.shrine = new Shrine(this.bga);
        this.playerPanels = new PlayerPanels(this.bga, this.shrine);
        this.hand = new Hand(this.bga, this.playerPanels);
        this.lanes = new Lanes(this.bga, this.hand);
        this.layout = new Layout(this.bga);
        this.gameEnd = new GameEnd(this.bga);
        const table = this.layout.render(gameArea, playerIdsInTableOrder);
        this.hand.render(gameArea, this.gamedatas.cards);
        this.lanes.render(table, this.gamedatas.cards.lanes, playerIdsInTableOrder);
        this.shrine.render(table, this.gamedatas.cards, playerIdsInTableOrder, this.gamedatas.angry);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry, this.gamedatas.cards, this.gamedatas.deckColors);
        this.gameEnd.render(gameArea, this.gamedatas.players, playerIdsInTableOrder, this.gamedatas.gameEnd);
        this.applyLayoutPreferences();
        this.bga.userPreferences.onChange = (prefId) => {
            if (prefId === HAND_POSITION_PREF_ID || prefId === BOARD_LAYOUT_PREF_ID) {
                this.applyLayoutPreferences();
            }
            if (prefId === ANIMATION_SPEED_PREF_ID) {
                applyAnimationSpeed(this.bga);
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
        this.hand.setPosition(this.layout.getHandPosition());
        this.layout.apply();
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
    getPlayerColor(playerId) {
        return this.bga.players.getPlayerById(playerId)?.color;
    }
    setupNotifications() {
        debug('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({
            ...notificationOptions(this),
            handlers: [this.hand, this.lanes, this.shrine, this.playerPanels, this.gameEnd, textOnlyNotifHandlers],
        });
    }
}
