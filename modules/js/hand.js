import { tplHandCard, tplCardTooltip, tplShownCard } from "./tpls.js";
import { flipCard, slideIntoPlace } from "./animations.js";
import { animDur, delay, isReadOnly } from "./common.js";
export const HAND_POSITION_PREF_ID = 103;
const DEAL_STAGGER_MS = 144;
export class Hand {
    constructor(bga, playerPanels) {
        this.bga = bga;
        this.playerPanels = playerPanels;
    }
    render(gameArea, cards) {
        this.cards = cards;
        this.gameArea = gameArea;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-my-hand"></div>`);
        this.handElement = document.getElementById('wott-my-hand');
        cards.hand.forEach(card => this.appendCard(card));
    }
    async notif_cardReturned(args) {
        const playerId = Number(args.player_id);
        this.playerPanels.adjustDeckCount(playerId, 1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 1) - 1;
        if (args.card_id === undefined) {
            return;
        }
        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card_id);
        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateReturnToDeck(args.card_id, deckAnchor);
        }
        else {
            this.removeCard(args.card_id);
        }
    }
    async notif_cardReturnUndone(args) {
        const playerId = Number(args.player_id);
        this.playerPanels.adjustDeckCount(playerId, -1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + 1;
        if (args.card === undefined) {
            return;
        }
        this.cards.hand.push(args.card);
        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateFromDeck(args.card, deckAnchor);
        }
        else {
            this.appendCard(args.card);
        }
    }
    async notif_cardsDrawn(args) {
        const playerId = Number(args.player_id);
        this.playerPanels.adjustDeckCount(playerId, -args.count);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + args.count;
        const drawnCards = (args.cards ?? []).filter(card => !document.getElementById(`wott-card-${card.id}`));
        drawnCards.forEach(card => this.cards.hand.push(card));
        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (!deckAnchor) {
            drawnCards.forEach(card => this.appendCard(card));
            return;
        }
        await Promise.all(drawnCards.map(async (card, index) => {
            await delay(index * animDur(DEAL_STAGGER_MS));
            await this.animateFromDeck(card, deckAnchor);
        }));
    }
    async notif_casualtySet(args) {
        const playerId = Number(args.player_id);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 1) - 1;
        if (args.card.type === undefined) {
            return;
        }
        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card.id);
        const slot = document.getElementById(`wott-casualty-slot-${playerId}`);
        const cardElement = document.getElementById(`wott-card-${args.card.id}`);
        if (!slot || !cardElement) {
            return;
        }
        cardElement.classList.remove('wott-selectable', 'wott-card--selected');
        await flipCard(cardElement, true);
        await slideIntoPlace(cardElement, slot);
    }
    async notif_scoutRevealed(args) {
        if (isReadOnly(this.bga) || Number(args.player_id2) !== Number(this.bga.gameui.player_id)) {
            return;
        }
        const dialog = new ebg.popindialog();
        dialog.create('wott-shown-cards');
        dialog.setTitle(_('Cards shown to you'));
        dialog.setContent(`<div class="wott-shown-cards">${args.cards.map(tplShownCard).join('')}</div>`);
        dialog.show();
        args.cards.forEach(card => this.bga.gameui.addTooltipHtml(`wott-shown-card-${card.id}`, tplCardTooltip(card)));
    }
    onCardsPlayed(playerId, cardIds) {
        this.cards.hand = this.cards.hand.filter(card => !cardIds.includes(card.id));
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? cardIds.length) - cardIds.length;
    }
    getCard(cardId) {
        return this.cards.hand.find(card => card.id === cardId);
    }
    setPosition(position) {
        if (position === 'top') {
            this.gameArea.prepend(this.handElement);
        }
        else {
            this.gameArea.append(this.handElement);
        }
    }
    appendCard(card) {
        this.createCardElement(card, this.handElement);
    }
    createCardElement(card, container) {
        container.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        return document.getElementById(`wott-card-${card.id}`);
    }
    removeCard(cardId) {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }
    setSelectable(selectable, onClick) {
        this.handElement.querySelectorAll('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
    }
    setSelectedCard(cardId) {
        this.setSelectedCards(cardId === null ? [] : [cardId]);
    }
    setSelectedCards(cardIds) {
        this.handElement.querySelectorAll('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardIds.includes(Number(cardElement.dataset.cardId)));
        });
    }
    getCardCount() {
        return this.cards.hand.length;
    }
    getElement() {
        return this.handElement;
    }
    async animateReturnToDeck(cardId, deckAnchor) {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }
        cardElement.classList.remove('wott-selectable', 'wott-card--selected');
        await flipCard(cardElement, true);
        await slideIntoPlace(cardElement, deckAnchor);
        cardElement.remove();
    }
    async animateFromDeck(card, deckAnchor) {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.add('wott-card-flip--flipped');
        await slideIntoPlace(cardElement, this.handElement);
        await flipCard(cardElement, false);
    }
}
