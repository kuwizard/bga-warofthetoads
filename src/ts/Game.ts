// Import specifiers must end in .js — tsc emits them unchanged, and the browser
// cannot resolve an extensionless ES module path.
import { ReturnCard } from "./States/ReturnCard.js";
import { PlayCards } from "./States/PlayCards.js";
import { ChooseStack } from "./States/ChooseStack.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";
import { Lanes } from "./lanes.js";
import { Shrine } from "./shrine.js";
import { PlayerPanels } from "./playerPanels.js";

// "Player blocks position" preference — see gamepreferences.jsonc.
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;

export class Game {
    public bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>;
    private gamedatas: WarOfTheToadsGamedatas;

    private returnCard: ReturnCard;
    private playCards: PlayCards;
    private chooseStack: ChooseStack;
    private hand: Hand;
    private lanes: Lanes;
    private shrine: Shrine;
    private playerPanels: PlayerPanels;

    /** Table order index (0 or 1) → deck colour. Mirrors Managers/Cards::setupNewGame(). */
    private deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' } = {};

    constructor(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
        console.log('warofthetoads constructor');
        this.bga = bga;

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

        // Uncomment the next line to show debug informations about state changes in the console. Remove before going to production!
        // this.bga.states.logger = console.log;
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
        console.log( "Starting game setup" );
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

        this.hand = new Hand(this.bga);
        this.hand.render(gameArea, this.gamedatas.cards.hand);

        this.lanes = new Lanes(this.bga);
        this.lanes.render(gameArea, this.gamedatas.cards.lanes, this.deckColorByPlayerId, playerIdsInTableOrder);

        this.shrine = new Shrine(this.bga);
        this.shrine.render(gameArea, this.gamedatas.cards, this.deckColorByPlayerId, playerIdsInTableOrder);

        this.playerPanels = new PlayerPanels(this.bga);
        this.playerPanels.render(playerIdsInTableOrder, this.gamedatas.angry);

        // Container for the per-player zones
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

        // Setup game notifications to handle (see "setupNotifications" method below)
        this.setupNotifications();

        console.log( "Ending game setup" );
    }

    ///////////////////////////////////////////////////
    //// Utility methods

    /** Stable seat order (Managers/Players::getInTableOrder()) — see setup()'s comment on why `playerorder` can't be used for this. */
    private getPlayerIdsInTableOrder(): number[] {
        return Object.entries(this.gamedatas.players)
            .sort(([, a], [, b]) => a.no - b.no)
            .map(([id]) => Number(id));
    }

    private buildPlayerTables() {
        const playerTables = document.getElementById('player-tables')!;
        const myId = Number(this.bga.gameui.player_id);
        // Blue first, red second — fixed DOM order, always the same physical
        // side for a given colour regardless of who's viewing. The layout
        // preferences below only ever reposition via CSS `order`, never by
        // rebuilding this markup.
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

    /**
     * Applies the "Hand position" and "Player blocks position" preferences.
     * In the stacked (top/bottom) player-blocks layout, "my" block always
     * sits on the same edge as the hand, so a player's own information stays
     * grouped together and the opponent's stays on the opposite edge.
     */
    private applyLayoutPreferences() {
        const handOnTop = this.bga.userPreferences.get(HAND_POSITION_PREF_ID) === 1;
        this.hand.setPosition(handOnTop ? 'top' : 'bottom');

        const stacked = this.bga.userPreferences.get(PLAYER_BLOCKS_POSITION_PREF_ID) === 2;
        const playerTables = document.getElementById('player-tables')!;
        playerTables.classList.toggle('wott-player-tables--stacked', stacked);
        playerTables.classList.toggle('wott-player-tables--hand-top', stacked && handOnTop);
        playerTables.classList.toggle('wott-player-tables--hand-bottom', stacked && !handOnTop);
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
        const card = this.gamedatas.cards.hand.find(c => c.id === cardId)!;
        const myId = Number(this.bga.gameui.player_id);
        await this.lanes.previewPlay(card, myId, faceDown, this.deckColorByPlayerId[myId]);
    }

    public async previewUnplayCard(cardId: number, wasFaceDown: boolean): Promise<void> {
        await this.lanes.previewUnplay(cardId, this.hand.getElement(), wasFaceDown);
    }

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    /*
        setupNotifications:

        In this method, you associate each of your game notifications with your local method to handle it.

        Note: game notification names correspond to "bga->notify->all" calls in your Game.php file.

    */
    setupNotifications() {
        console.log( 'notifications subscriptions setup' );

        // automatically listen to the notifications, based on the `notif_xxx` function on this class.
        // Uncomment the logger param to see debug information in the console about notifications.
        this.bga.notifications.setupPromiseNotifications({
            // logger: console.log
        });
    }

    /**
     * `BattleStart`'s GAME-state entry (RULES.md §5) — see
     * Notifications::battleStarted(). Clears the previous battle's lane
     * cards; harmless (a no-op) on the War's first battle, when the lanes are
     * already empty. `ResolveBattle` is what actually moves the cards to a
     * stack or the Shrine server-side, so this is purely the client catching
     * up visually.
     */
    async notif_battleStarted(_args: BattleStartedNotifArgs) {
        this.lanes.clear();
    }

    /**
     * Setup's card return ([H13]) — see Notifications::cardReturned(). `args`
     * carries `card_id`/`card_type` only for the player who returned the card
     * (BGA's `_private` mechanism); everyone else gets neither.
     */
    async notif_cardReturned(args: CardReturnedNotifArgs) {
        const playerId = Number(args.player_id);

        this.gamedatas.cards.deckCounts[playerId] = (this.gamedatas.cards.deckCounts[playerId] ?? 0) + 1;
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 1) - 1;

        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${this.gamedatas.cards.deckCounts[playerId]}`;
        }

        // Only the returning player's own client carries `card_id` ([H13]) — the
        // opponent's hand is never rendered, so there is nothing to remove for them.
        if (args.card_id !== undefined) {
            this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card => card.id !== args.card_id);

            const deckAnchor = document.getElementById(`wott-deck-anchor-${playerId}`);
            if (deckAnchor) {
                await this.hand.animateReturnToDeck(args.card_id, deckAnchor);
            } else {
                this.hand.removeCard(args.card_id);
            }
        }
    }

    /**
     * Undoes a `cardReturned` while ReturnCard hasn't resolved yet — see
     * Notifications::cardReturnUndone(). `args.card` (full data) is present
     * only for the acting player ([H13]); everyone else just sees their
     * counts reversed.
     */
    async notif_cardReturnUndone(args: CardReturnUndoneNotifArgs) {
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
            } else {
                this.hand.appendCard(args.card);
            }
        }
    }

    /**
     * `AttackerPlay`/`DefenderPlay` (RULES.md §6 ➊➋) — see
     * Notifications::cardsPlayed(). Both cards are already the redacted stub
     * ([H13]) when they belong to someone else and are face-down; the acting
     * player's own client just needs its 2 played cards removed from hand.
     */
    async notif_cardsPlayed(args: CardsPlayedNotifArgs) {
        const playerId = Number(args.player_id);
        const deckColor = this.deckColorByPlayerId[playerId];

        this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card =>
            card.id !== args.faceUpCard.id && card.id !== args.faceDownCard.id
        );
        this.gamedatas.cards.handCounts[playerId] = (this.gamedatas.cards.handCounts[playerId] ?? 2) - 2;

        await Promise.all([
            this.lanes.playCard(args.faceUpCard, deckColor),
            this.lanes.playCard(args.faceDownCard, deckColor),
        ]);
    }

    /**
     * `DrawCards`'s draw step (RULES.md §6 ➌) — see Notifications::cardsDrawn().
     * `args.cards` (full data) is present only for the drawing player ([H13]);
     * everyone else just sees their deck-count reduced.
     */
    async notif_cardsDrawn(args: CardsDrawnNotifArgs) {
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

    /** `DrawCards`'s reveal step (RULES.md §6 ➍) — see Notifications::cardsRevealed(). Genuinely public at this point. */
    async notif_cardsRevealed(args: CardsRevealedNotifArgs) {
        await Promise.all([
            this.lanes.revealCard(args.card1),
            this.lanes.revealCard(args.card2),
        ]);
    }

    /** `ResolveBattle`'s tie branch (RULES.md §6 ➎, [H16]) — see Notifications::laneTied(). */
    async notif_laneTied(args: LaneTiedNotifArgs) {
        this.shrine.onLaneTied(args);
    }

    /** `ResolveBattle`'s single-lane-win branch (RULES.md §6 ➎) — see Notifications::hostageCaptured(). */
    async notif_hostageCaptured(args: HostageCapturedNotifArgs) {
        this.shrine.onHostageCaptured(args);
    }

    /** `ResolveBattle`'s double-win-while-Angry branch (§7, [H4]) — see Notifications::leapFrog(). */
    async notif_leapFrog(args: LeapFrogNotifArgs) {
        this.shrine.onLeapFrog(args);
    }

    /** `ResolveBattle`'s double-win-while-Calm branch ([H14]) — see Notifications::doubleWinCalm(). */
    async notif_doubleWinCalm(args: DoubleWinCalmNotifArgs) {
        this.shrine.onDoubleWinCalm(args);
    }

    /** `ChooseStack` ([H14]) — see Notifications::stackKept(). */
    async notif_stackKept(args: StackKeptNotifArgs) {
        this.shrine.onStackKept(args);
    }

    /** `BattleEnd` (RULES.md §7) — see Notifications::moodChanged(). */
    async notif_moodChanged(args: MoodChangedNotifArgs) {
        this.playerPanels.onMoodChanged(args);
    }
}
