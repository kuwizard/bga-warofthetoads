import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { ScoutReveal } from "./States/ScoutReveal.js";
import { SiegeGuess } from "./States/SiegeGuess.js";
import { Hand } from "./hand.js";
import { OpponentHand } from "./opponentHand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { Layout, BOARD_LAYOUT_PREF_ID, HAND_POSITION_PREF_ID, OPPONENT_HAND_PREF_ID } from "./layout.js";
import { PlayerPanels } from "./playerPanels.js";
import { GameEnd } from "./gameEnd.js";
import { debug, stateLogger } from "./debug.js";
import { notificationOptions } from "./notifications.js";
import { ANIMATION_SPEED_PREF_ID, applyAnimationSpeed } from "./common.js";
export class Game {
    constructor(bga) {
        debug('warofthetoads constructor');
        this.bga = bga;
        this.bga.states.logger = stateLogger;
        this.returnCard = new ReturnCard(this, bga);
        this.bga.states.register('ReturnCard', this.returnCard);
        this.attackerPlayCards = new PlayCards(this, bga, 'attacking');
        this.bga.states.register('AttackerPlay', this.attackerPlayCards);
        this.defenderPlayCards = new PlayCards(this, bga, 'defending');
        this.bga.states.register('DefenderPlay', this.defenderPlayCards);
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
        this.opponentHand = new OpponentHand();
        this.shrine = new Shrine(this.bga, this.opponentHand);
        this.playerPanels = new PlayerPanels(this.bga, this.shrine);
        this.hand = new Hand(this.bga, this.playerPanels);
        this.lanes = new Lanes(this.bga, this.hand, this.opponentHand);
        this.layout = new Layout(this.bga);
        this.gameEnd = new GameEnd(this.bga);
        const myPlayerId = Number(this.bga.gameui.player_id);
        const hiddenHandPlayerIds = playerIdsInTableOrder.filter(playerId => playerId !== myPlayerId);
        const table = this.layout.render(gameArea, playerIdsInTableOrder);
        this.hand.render(gameArea, this.gamedatas.cards, playerIdsInTableOrder.includes(myPlayerId), this.gamedatas.war, this.gamedatas.battle, this.gamedatas.attackerId);
        this.opponentHand.render(gameArea, hiddenHandPlayerIds, this.gamedatas.cards, this.gamedatas.deckColors);
        this.lanes.render(table, this.gamedatas.cards.lanes, playerIdsInTableOrder);
        this.shrine.render(table, this.gamedatas.cards, playerIdsInTableOrder, this.gamedatas.angry);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry, this.gamedatas.cards, this.gamedatas.deckColors);
        this.gameEnd.render(gameArea, this.gamedatas.players, playerIdsInTableOrder, this.gamedatas.gameEnd);
        this.applyLayoutPreferences();
        this.bga.userPreferences.onChange = (prefId) => {
            if (prefId === HAND_POSITION_PREF_ID || prefId === BOARD_LAYOUT_PREF_ID || prefId === OPPONENT_HAND_PREF_ID) {
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
        this.opponentHand.setPositions(this.layout.getHandPositions());
        this.opponentHand.setShown(this.layout.isOpponentHandShown());
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
    setupNotifications() {
        debug('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications(notificationOptions(this, [this.hand, this.opponentHand, this.lanes, this.shrine, this.playerPanels, this.gameEnd]));
    }
}
