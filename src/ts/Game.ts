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
import { PlayerTables } from "./playerTables.js";
import { debug, stateLogger } from "./debug.js";
import { notificationOptions, textOnlyNotifHandlers } from "./notifications.js";

// "Player blocks position" preference — see gamepreferences.jsonc.
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;

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
    private playerTables: PlayerTables;

    /** Table order index (0 or 1) → deck colour. Mirrors Managers/Cards::setupNewGame(). */
    private deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' } = {};

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

        // `no` (Managers/Players::getInTableOrder()) is the stable seat order
        // decks are dealt in. `playerorder` is NOT safe for this: BGA rotates
        // it to reflect whose turn is next, so deriving colour from it flips
        // blue/red the moment the active player changes.
        const playerIdsInTableOrder = this.getPlayerIdsInTableOrder();
        playerIdsInTableOrder.forEach((playerId, index) => {
            this.deckColorByPlayerId[playerId] = index === 0 ? 'blue' : 'red';
        });

        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');

        this.playerTables = new PlayerTables();
        this.hand = new Hand(this.bga, this.playerTables);
        this.lanes = new Lanes(this.bga, this.hand);
        this.shrine = new Shrine(this.bga);
        this.playerPanels = new PlayerPanels(this.bga);

        this.hand.render(gameArea, this.gamedatas.cards);
        this.lanes.render(gameArea, this.gamedatas.cards.lanes, this.deckColorByPlayerId, playerIdsInTableOrder, Number(this.gamedatas.attackerId));
        this.shrine.render(gameArea, this.gamedatas.cards, this.deckColorByPlayerId, playerIdsInTableOrder);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry);
        this.playerTables.render(
            gameArea,
            this.gamedatas.players,
            this.gamedatas.cards,
            this.deckColorByPlayerId,
            playerIdsInTableOrder,
            Number(this.bga.gameui.player_id),
        );

        this.applyLayoutPreferences();
        this.bga.userPreferences.onChange = (prefId) => {
            if (prefId === HAND_POSITION_PREF_ID || prefId === PLAYER_BLOCKS_POSITION_PREF_ID) {
                this.applyLayoutPreferences();
            }
        };

        this.setupNotifications();

        debug('Ending game setup');
    }

    ///////////////////////////////////////////////////
    //// Utility methods

    /** Stable seat order (Managers/Players::getInTableOrder()) — see setup()'s comment on why `playerorder` can't be used for this. */
    private getPlayerIdsInTableOrder(): number[] {
        return Object.entries(this.gamedatas.players)
            .sort(([, a], [, b]) => a.no - b.no)
            .map(([id]) => Number(id));
    }

    private applyLayoutPreferences() {
        const handOnTop = this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === 1;
        this.hand.setPosition(handOnTop ? 'top' : 'bottom');
        this.playerTables.setLayout(this.bga.userPreferences.get(PLAYER_BLOCKS_POSITION_PREF_ID) === 2, handOnTop);
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
        await this.lanes.previewPlay(this.hand.getCard(cardId)!, myId, faceDown, this.deckColorByPlayerId[myId]);
    }

    public async previewUnplayCard(cardId: number, wasFaceDown: boolean): Promise<void> {
        await this.lanes.previewUnplay(cardId, wasFaceDown);
    }

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    setupNotifications() {
        debug('notifications subscriptions setup');

        this.bga.notifications.setupPromiseNotifications({
            ...notificationOptions(this),
            handlers: [this.hand, this.lanes, this.shrine, this.playerPanels, textOnlyNotifHandlers],
        });
    }
}
