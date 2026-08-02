import { guessableCardTypes } from "./tpls.js";
import { slideFromRects } from "./animations.js";
export class PlayerPanels {
    constructor(bga, shrine) {
        this.bga = bga;
        this.shrine = shrine;
    }
    render(playerIdsInTableOrder, angryByPlayerId, cards, deckColorByPlayerId) {
        this.cards = cards;
        this.deckColorByPlayerId = deckColorByPlayerId;
        playerIdsInTableOrder.forEach(playerId => {
            this.boardElement(playerId)?.classList.add('wott-player-panel');
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-panel-row">
                    <div class="wott-deck">
                        <div class="wott-card wott-card--${deckColorByPlayerId[playerId]}-back" id="wott-deck-pile-${playerId}"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${cards.deckCounts[playerId] ?? 0}</span>
                        <div class="wott-deck-anchor" id="wott-deck-anchor-${playerId}"></div>
                    </div>
                    <div class="wott-mood" id="wott-mood-${playerId}"></div>
                </div>
            `);
        });
        this.setMoods(angryByPlayerId);
    }
    notif_moodChanged(args) {
        this.setMoods(args.angry);
    }
    notif_tacticAngry(args) {
        this.setMoods(args.angry);
    }
    async notif_warStarted(args) {
        const piles = Object.keys(args.deckColors)
            .map(playerId => document.getElementById(`wott-deck-pile-${playerId}`))
            .filter((pile) => pile !== null);
        const rects = piles.map(pile => pile.getBoundingClientRect());
        Object.entries(args.deckColors).forEach(([playerId, deckColor]) => {
            const pile = document.getElementById(`wott-deck-pile-${playerId}`);
            pile?.classList.remove(`wott-card--${this.deckColorByPlayerId[Number(playerId)]}-back`);
            pile?.classList.add(`wott-card--${deckColor}-back`);
            this.deckColorByPlayerId[Number(playerId)] = deckColor;
        });
        Object.entries(args.deckCounts).forEach(([playerId, count]) => {
            this.setDeckCount(Number(playerId), Number(count));
        });
        const decks = piles.map(pile => pile.parentElement).filter((deck) => deck !== null);
        decks.forEach(deck => deck.classList.add('wott-deck--swapping'));
        await slideFromRects(piles.map((pile, index) => ({
            element: pile,
            fromRect: rects[piles.length - 1 - index],
        })));
        decks.forEach(deck => deck.classList.remove('wott-deck--swapping'));
    }
    notif_siegeGuessed(args) {
        const strength = guessableCardTypes[args.cardType].strength;
        const cardLabel = strength === null ? _(args.cardName) : `${_(args.cardName)} (${strength})`;
        const text = args.hit
            ? _('Yes, I have ${card_name} in my hand').replace('${card_name}', cardLabel)
            : _('No, I don\'t have ${card_name} in my hand').replace('${card_name}', cardLabel);
        const bubbleId = `wott-speech-bubble-${args.player_id2}`;
        document.getElementById(bubbleId)?.remove();
        this.boardElement(args.player_id2)?.insertAdjacentHTML('beforeend', `
            <div class="wott-speech-bubble" id="${bubbleId}">${text}</div>
        `);
        setTimeout(() => document.getElementById(bubbleId)?.remove(), 4000);
    }
    adjustDeckCount(playerId, delta) {
        this.setDeckCount(playerId, (this.cards.deckCounts[playerId] ?? 0) + delta);
    }
    getDeckAnchor(playerId) {
        return document.getElementById(`wott-deck-anchor-${playerId}`);
    }
    setDeckCount(playerId, count) {
        this.cards.deckCounts[playerId] = count;
        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${count}`;
        }
    }
    boardElement(playerId) {
        return this.bga.playerPanels.getElement(playerId).closest('.player-board');
    }
    setMoods(angryByPlayerId) {
        this.shrine.setMood(angryByPlayerId);
        Object.entries(angryByPlayerId).forEach(([playerId, angry]) => {
            const element = document.getElementById(`wott-mood-${playerId}`);
            if (!element) {
                return;
            }
            element.textContent = angry ? _('Angry') : _('Calm');
            element.classList.toggle('wott-mood--angry', angry);
        });
    }
}
