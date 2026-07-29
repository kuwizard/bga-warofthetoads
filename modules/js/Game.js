import { ReturnCard } from "./States/ReturnCard.js";
function cardRoleSlug(cardType) {
    return cardType.replace(/_/g, '-');
}
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
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);
        this.buildPlayerTables();
        this.setupNotifications();
        console.log("Ending game setup");
    }
    buildPlayerTables() {
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
    renderHands() {
        const myId = Number(this.bga.gameui.player_id);
        Object.keys(this.deckColorByPlayerId).map(Number).forEach(playerId => {
            const handElement = document.getElementById(`wott-hand-${playerId}`);
            if (!handElement)
                return;
            handElement.innerHTML = '';
            if (playerId === myId) {
                this.gamedatas.cards.hand.forEach(card => this.appendHandCard(handElement, card));
            }
            else {
                const count = this.gamedatas.cards.handCounts[playerId] ?? 0;
                const deckColor = this.deckColorByPlayerId[playerId];
                for (let i = 0; i < count; i++) {
                    handElement.insertAdjacentHTML('beforeend', `<div class="wott-card wott-card--${deckColor}-back"></div>`);
                }
            }
        });
    }
    appendHandCard(handElement, card) {
        handElement.insertAdjacentHTML('beforeend', `
            <div class="wott-card wott-card--${card.deck}-${cardRoleSlug(card.type)}" data-card-id="${card.id}" title="${card.name}"></div>
        `);
    }
    setHandSelectable(selectable, onClick) {
        const handElement = document.getElementById(`wott-hand-${this.bga.gameui.player_id}`);
        if (!handElement)
            return;
        handElement.querySelectorAll('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
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
        const handElement = document.getElementById(`wott-hand-${playerId}`);
        if (args.card_id !== undefined) {
            this.gamedatas.cards.hand = this.gamedatas.cards.hand.filter(card => card.id !== args.card_id);
            handElement?.querySelector(`[data-card-id="${args.card_id}"]`)?.remove();
        }
        else {
            handElement?.querySelector('.wott-card')?.remove();
        }
    }
}
