// Import specifiers must end in .js — tsc emits them unchanged, and the browser
// cannot resolve an extensionless ES module path.
import { ReturnCard } from "./States/ReturnCard.js";

/** `card_type` (DB value, underscores) → sprite role class suffix (hyphens). See src/scss/cards.scss. */
function cardRoleSlug(cardType: string): string {
    return cardType.replace(/_/g, '-');
}

export class Game {
    public bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>;
    private gamedatas: WarOfTheToadsGamedatas;

    private returnCard: ReturnCard;

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

        // Container for the per-player zones
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);

        this.buildPlayerTables();

        // Setup game notifications to handle (see "setupNotifications" method below)
        this.setupNotifications();

        console.log( "Ending game setup" );
    }

    ///////////////////////////////////////////////////
    //// Utility methods

    private buildPlayerTables() {
        const playerTables = document.getElementById('player-tables');
        const playerIds = this.gamedatas.playerorder.map(id => Number(id));

        playerIds.forEach(playerId => {
            const player = this.gamedatas.players[playerId];
            const deckColor = this.deckColorByPlayerId[playerId];
            const deckCount = this.gamedatas.cards.deckCounts[playerId] ?? 0;

            playerTables.insertAdjacentHTML('beforeend', `
                <div id="player-table-${playerId}" class="wott-player-table" style="--player-color: #${player.color}">
                    <h3 class="wott-player-name">${player.name}</h3>
                    <div class="wott-deck">
                        <div class="wott-card wott-card--${deckColor}-back"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${deckCount}</span>
                    </div>
                    <div class="wott-hand" id="wott-hand-${playerId}"></div>
                </div>
            `);
        });

        this.renderHands();
    }

    private renderHands() {
        // gameui.player_id arrives as a string at runtime despite its `number` typing —
        // same reason playerorder ids get Number()'d above.
        const myId = Number(this.bga.gameui.player_id);

        Object.keys(this.deckColorByPlayerId).map(Number).forEach(playerId => {
            const handElement = document.getElementById(`wott-hand-${playerId}`);
            if (!handElement) return;

            handElement.innerHTML = '';

            if (playerId === myId) {
                this.gamedatas.cards.hand.forEach(card => this.appendHandCard(handElement, card));
            } else {
                const count = this.gamedatas.cards.handCounts[playerId] ?? 0;
                const deckColor = this.deckColorByPlayerId[playerId];
                for (let i = 0; i < count; i++) {
                    handElement.insertAdjacentHTML('beforeend', `<div class="wott-card wott-card--${deckColor}-back"></div>`);
                }
            }
        });
    }

    private appendHandCard(handElement: HTMLElement, card: CardData) {
        handElement.insertAdjacentHTML('beforeend', `
            <div class="wott-card wott-card--${card.deck}-${cardRoleSlug(card.type)}" data-card-id="${card.id}" title="${card.name}"></div>
        `);
    }

    /**
     * Toggles clickability on the viewing player's own hand — used by
     * ReturnCard (and future states needing "pick a card from your hand").
     */
    public setHandSelectable(selectable: boolean, onClick?: (cardId: number) => void) {
        const handElement = document.getElementById(`wott-hand-${this.bga.gameui.player_id}`);
        if (!handElement) return;

        handElement.querySelectorAll<HTMLElement>('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
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

        const handElement = document.getElementById(`wott-hand-${playerId}`);
        if (args.card_id !== undefined) {
            this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card => card.id !== args.card_id);
            handElement?.querySelector(`[data-card-id="${args.card_id}"]`)?.remove();
        } else {
            handElement?.querySelector('.wott-card')?.remove();
        }
    }
}
