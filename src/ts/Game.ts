// Import specifiers must end in .js — tsc emits them unchanged, and the browser
// cannot resolve an extensionless ES module path.
import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { ScoutReveal } from "./States/ScoutReveal.js";
import { SiegeGuess } from "./States/SiegeGuess.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { PlayerPanels } from "./playerPanels.js";
import { GameEnd } from "./gameEnd.js";
import { debug, stateLogger } from "./debug.js";
import { notificationOptions, textOnlyNotifHandlers } from "./notifications.js";
import { ANIMATION_SPEED_PREF_ID, applyAnimationSpeed } from "./common.js";

export class Game {
    public bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>;
    private gamedatas: WarOfTheToadsGamedatas;

    public bgaFormatText?: (log: string, args: any) => { log: string; args: any };

    private returnCard: ReturnCard;
    private playCards: PlayCards;
    private chooseStack: ChooseStack;
    private hand: Hand;
    private lanes: Lanes;
    private shrine: Shrine;
    private playerPanels: PlayerPanels;
    private gameEnd: GameEnd;

    constructor(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
        debug('warofthetoads constructor');
        this.bga = bga;

        // Framework hook that traces every state entry/exit.
        this.bga.states.logger = stateLogger;

        // Declare the State classes
        this.returnCard = new ReturnCard(this, bga);
        this.bga.states.register('ReturnCard', this.returnCard);

        // AttackerPlay/DefenderPlay share one handler — RULES.md §6 ➊➋ is the
        // same physical action for both roles (mirrors PHP's PlayCardsTrait).
        this.playCards = new PlayCards(this, bga);
        this.bga.states.register('AttackerPlay', this.playCards);
        this.bga.states.register('DefenderPlay', this.playCards);

        this.chooseStack = new ChooseStack(this, bga);
        this.bga.states.register('ChooseStack', this.chooseStack);

        this.bga.states.register('ScoutReveal', new ScoutReveal(this, bga));
        this.bga.states.register('SiegeGuess', new SiegeGuess(this, bga));
    }

    /*
        setup:

        This method must set up the game user interface according to current game situation specified
        in parameters.

        The method is called each time the game interface is displayed to a player, ie:
        _ when the game starts
        _ when a player refreshes the game page (F5)

        "gamedatas" argument contains all datas retrieved by your "getAllDatas" PHP method.
    */

    setup(gamedatas: WarOfTheToadsGamedatas) {
        debug('Starting game setup');
        debug('gamedatas', gamedatas);
        this.gamedatas = gamedatas;

        // Before anything renders: --am scales every CSS duration and every animDur() below it.
        applyAnimationSpeed(this.bga);

        // BGA rotates `playerorder` to reflect whose turn is next — only `no` is a stable seat order.
        const playerIdsInTableOrder = this.getPlayerIdsInTableOrder();

        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');

        this.shrine = new Shrine(this.bga);
        this.playerPanels = new PlayerPanels(this.bga, this.shrine);
        this.hand = new Hand(this.bga, this.playerPanels);
        this.lanes = new Lanes(this.bga, this.hand);
        this.gameEnd = new GameEnd(this.bga);

        this.hand.render(gameArea, this.gamedatas.cards);
        this.lanes.render(gameArea, this.gamedatas.cards.lanes, playerIdsInTableOrder, Number(this.gamedatas.attackerId));
        this.shrine.render(gameArea, this.gamedatas.cards, playerIdsInTableOrder, this.gamedatas.angry);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry, this.gamedatas.cards, this.gamedatas.deckColors);
        this.gameEnd.render(gameArea, this.gamedatas.players, playerIdsInTableOrder, this.gamedatas.gameEnd);

        this.applyLayoutPreferences();
        this.bga.userPreferences.onChange = (prefId) => {
            if (prefId === HAND_POSITION_PREF_ID) {
                this.applyLayoutPreferences();
            }
            if (prefId === ANIMATION_SPEED_PREF_ID) {
                applyAnimationSpeed(this.bga);
            }
        };

        this.setupNotifications();

        debug('Ending game setup');
    }

    ///////////////////////////////////////////////////
    //// Utility methods

    private getPlayerIdsInTableOrder(): number[] {
        return Object.entries(this.gamedatas.players)
            .sort(([, a], [, b]) => a.no - b.no)
            .map(([id]) => Number(id));
    }

    private applyLayoutPreferences() {
        this.hand.setPosition(this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === 1 ? 'top' : 'bottom');
    }

    /**
     * Toggles clickability on the viewing player's own hand — used by
     * ReturnCard (and future states needing "pick a card from your hand").
     */
    public setHandSelectable(selectable: boolean, onClick?: (cardId: number) => void) {
        this.hand.setSelectable(selectable, onClick);
    }

    /** Highlights (or clears) the chosen hand card — used by states with a select-then-confirm flow (e.g. ReturnCard). */
    public setSelectedHandCard(cardId: number | null) {
        this.hand.setSelectedCard(cardId);
    }

    public setSelectedHandCards(cardIds: number[]) {
        this.hand.setSelectedCards(cardIds);
    }

    public getMyHandCount(): number {
        return this.hand.getCardCount();
    }

    public setLaneCardsSelectable(cardIds: number[], selectable: boolean, onClick?: (cardId: number) => void) {
        this.lanes.setCardsSelectable(cardIds, selectable, onClick);
    }

    public setStacksSelectable(stackIds: number[], selectable: boolean, onClick?: (stackId: number) => void) {
        this.shrine.setStacksSelectable(stackIds, selectable, onClick);
    }

    public setSelectedStack(stackId: number | null) {
        this.shrine.setSelectedStack(stackId);
    }

    public getMyPendingStackIds(): number[] {
        return this.shrine.getMyPendingStackIds(Number(this.bga.gameui.player_id));
    }

    public async previewPlayCard(cardId: number, faceDown: boolean): Promise<void> {
        const myId = Number(this.bga.gameui.player_id);
        await this.lanes.previewPlay(this.hand.getCard(cardId)!, myId, faceDown);
    }

    public async previewUnplayCard(cardId: number, wasFaceDown: boolean): Promise<void> {
        await this.lanes.previewUnplay(cardId, wasFaceDown);
    }

    public getPlayerColor(playerId: number): string | undefined {
        return this.bga.players.getPlayerById(playerId)?.color;
    }

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    setupNotifications() {
        debug('notifications subscriptions setup');

        this.bga.notifications.setupPromiseNotifications({
            ...notificationOptions(this),
            handlers: [this.hand, this.lanes, this.shrine, this.playerPanels, this.gameEnd, textOnlyNotifHandlers],
        });
    }
}
