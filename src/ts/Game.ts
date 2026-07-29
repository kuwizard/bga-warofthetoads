// Import specifiers must end in .js — tsc emits them unchanged, and the browser
// cannot resolve an extensionless ES module path.
import { ReturnCard } from "./States/ReturnCard.js";
import { Hand, HAND_POSITION_PREF_ID } from "./hand.js";

// "Player blocks position" preference — see gamepreferences.jsonc.
const PLAYER_BLOCKS_POSITION_PREF_ID = 102;

export class Game {
    public bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>;
    private gamedatas: WarOfTheToadsGamedatas;

    private returnCard: ReturnCard;
    private hand: Hand;

    /** Table order index (0 or 1) → deck colour. Mirrors Managers/Cards::setupNewGame(). */
    private deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' } = {};

    constructor(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
        console.log('warofthetoads constructor');
        this.bga = bga;

        // Declare the State classes
        this.returnCard = new ReturnCard(this, bga);
        this.bga.states.register('ReturnCard', this.returnCard);

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

        const playerIds = gamedatas.playerorder.map(id => Number(id));
        playerIds.forEach((playerId, index) => {
            this.deckColorByPlayerId[playerId] = index === 0 ? 'blue' : 'red';
        });

        const gameArea = this.bga.gameArea.getElement();
        gameArea.classList.add('wott-game-area');

        this.hand = new Hand(this.bga);
        this.hand.render(gameArea, this.gamedatas.cards.hand);

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

    private buildPlayerTables() {
        const playerTables = document.getElementById('player-tables')!;
        const myId = Number(this.bga.gameui.player_id);
        const playerIds = this.gamedatas.playerorder.map(id => Number(id));
        // Opponent(s) first, "me" last — fixed DOM order the layout preferences
        // below reposition via CSS, never by rebuilding this markup. Falls back
        // to plain playerorder for a spectator (no id matches myId).
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
}
