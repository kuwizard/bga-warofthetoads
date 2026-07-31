import { tplHandCard, tplCardTooltip, tplShownCard } from "./tpls.js";
import { slideIntoPlace, waitForTransitionEnd } from "./animations.js";
export const HAND_POSITION_PREF_ID = 103;
export class Hand {
    constructor(bga, playerTables) {
        this.bga = bga;
        this.playerTables = playerTables;
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
        this.playerTables.adjustDeckCount(playerId, 1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 1) - 1;
        if (args.card_id === undefined) {
            return;
        }
        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card_id);
        const deckAnchor = this.playerTables.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateReturnToDeck(args.card_id, deckAnchor);
        }
        else {
            this.removeCard(args.card_id);
        }
    }
    async notif_cardReturnUndone(args) {
        const playerId = Number(args.player_id);
        this.playerTables.adjustDeckCount(playerId, -1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + 1;
        if (args.card === undefined) {
            return;
        }
        this.cards.hand.push(args.card);
        const deckAnchor = this.playerTables.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateUndoReturn(args.card, deckAnchor);
        }
        else {
            this.appendCard(args.card);
        }
    }
    async notif_cardsDrawn(args) {
        const playerId = Number(args.player_id);
        this.playerTables.adjustDeckCount(playerId, -args.count);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + args.count;
        args.cards?.forEach(card => {
            this.cards.hand.push(card);
            this.appendCard(card);
        });
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
        await this.flip(cardElement, true);
        await slideIntoPlace(cardElement, slot);
    }
    async notif_scoutRevealed(args) {
        if (this.isReadOnly() || Number(args.player_id2) !== Number(this.bga.gameui.player_id)) {
            return;
        }
        const dialog = new ebg.popindialog();
        dialog.create('wott-shown-cards');
        dialog.setTitle(_('Cards shown to you'));
        dialog.setContent(`<div class="wott-shown-cards">${args.cards.map(tplShownCard).join('')}</div>`);
        dialog.show();
        args.cards.forEach(card => this.bga.gameui.addTooltipHtml(`wott-shown-card-${card.id}`, tplCardTooltip(card)));
    }
    isReadOnly() {
        return this.bga.players.isCurrentPlayerSpectator() || typeof g_replayFrom != 'undefined' || g_archive_mode;
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
        await this.flip(cardElement, true);
        await slideIntoPlace(cardElement, deckAnchor);
        cardElement.remove();
    }
    async animateUndoReturn(card, deckAnchor) {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.add('wott-card-flip--flipped');
        await slideIntoPlace(cardElement, this.handElement);
        await this.flip(cardElement, false);
    }
    flip(cardElement, faceDown) {
        const inner = cardElement.querySelector('.wott-card-flip__inner');
        const donePromise = waitForTransitionEnd(inner, 'transform');
        cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
        return donePromise;
    }
}
