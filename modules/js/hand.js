import { tplHandCard, tplCardTooltip, tplShownCard } from "./tpls.js";
import { flipCard, slideFromRects, slideIntoPlace } from "./animations.js";
import { animDur, delay, isReadOnly } from "./common.js";
const DEAL_STAGGER_MS = 144;
export class Hand {
    constructor(bga, playerPanels) {
        this.bga = bga;
        this.playerPanels = playerPanels;
        this.selectable = false;
    }
    render(gameArea, cards, viewerHasSeat) {
        this.cards = cards;
        this.gameArea = gameArea;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-my-hand"></div>`);
        this.handElement = document.getElementById('wott-my-hand');
        this.handElement.classList.toggle('wott-my-hand--hidden', !viewerHasSeat);
        cards.hand.forEach(card => this.appendCard(card));
    }
    async notif_cardReturned(args) {
        const playerId = Number(args.player_id);
        this.playerPanels.adjustDeckCount(playerId, 1);
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
        if (args.card === undefined) {
            return;
        }
        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateFromDeck(args.card, deckAnchor);
        }
        else {
            this.insertCardSorted(args.card);
        }
    }
    async notif_cardsDrawn(args) {
        const playerId = Number(args.player_id);
        this.playerPanels.adjustDeckCount(playerId, -args.count);
        const drawnCards = (args.cards ?? []).filter(card => !document.getElementById(`wott-card-${card.id}`));
        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (!deckAnchor) {
            drawnCards.forEach(card => this.insertCardSorted(card));
            return;
        }
        await Promise.all(drawnCards.map(async (card, index) => {
            await delay(index * animDur(DEAL_STAGGER_MS));
            await this.animateFromDeck(card, deckAnchor, args.arrivesFaceUp);
        }));
    }
    notif_casualtySet(args) {
        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card.id);
    }
    async notif_scoutRevealed(args) {
        if (isReadOnly(this.bga) || Number(args.player_id2) !== Number(this.bga.gameui.player_id)) {
            return;
        }
        const dialogId = 'wott-shown-cards-dialog';
        const dialog = new ebg.popindialog();
        dialog.create(dialogId);
        dialog.setTitle(_('Cards shown to you'));
        dialog.setContent(`<div class="wott-shown-cards">${args.cards.map(tplShownCard).join('')}</div>`);
        args.cards.forEach(card => this.bga.gameui.addTooltipHtml(`wott-shown-card-${card.id}`, tplCardTooltip(card)));
        await this.waitForDialogClose(dialog, dialogId);
    }
    waitForDialogClose(dialog, dialogId) {
        return new Promise(resolve => {
            let resolved = false;
            const close = () => {
                if (resolved) {
                    return;
                }
                resolved = true;
                underlay?.removeEventListener('click', close);
                dialog.destroy();
                resolve();
            };
            const underlay = document.getElementById(`popin_${dialogId}_underlay`);
            dialog.replaceCloseCallback(close);
            dialog.show();
            underlay?.addEventListener('click', close);
        });
    }
    onCardsPlayed(cardIds) {
        this.cards.hand = this.cards.hand.filter(card => !cardIds.includes(card.id));
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
    spliceCardSorted(card) {
        const nextCard = this.cards.hand.find(c => c.id > card.id);
        const index = nextCard ? this.cards.hand.indexOf(nextCard) : this.cards.hand.length;
        this.cards.hand.splice(index, 0, card);
        return nextCard ? document.getElementById(`wott-card-${nextCard.id}`) : null;
    }
    insertCardSorted(card) {
        const nextElement = this.spliceCardSorted(card);
        if (nextElement) {
            nextElement.insertAdjacentHTML('beforebegin', tplHandCard(card));
        }
        else {
            this.handElement.insertAdjacentHTML('beforeend', tplHandCard(card));
        }
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        this.applySelectable(document.getElementById(`wott-card-${card.id}`));
    }
    createCardElement(card, container) {
        container.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        this.applySelectable(cardElement);
        return cardElement;
    }
    removeCard(cardId) {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }
    setSelectable(selectable, onClick) {
        this.selectable = selectable;
        this.selectableOnClick = onClick;
        this.handElement.querySelectorAll('.wott-card-flip[data-card-id]').forEach(cardElement => this.applySelectable(cardElement));
    }
    applySelectable(cardElement) {
        cardElement.classList.toggle('wott-selectable', this.selectable);
        cardElement.onclick = (this.selectable && this.selectableOnClick) ?
            () => this.selectableOnClick(Number(cardElement.dataset.cardId)) :
            null;
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
    getInsertionPointFor(cardId) {
        const index = this.cards.hand.findIndex(c => c.id === cardId);
        for (let i = index + 1; i < this.cards.hand.length; i++) {
            const element = this.handElement.querySelector(`#wott-card-${this.cards.hand[i].id}`);
            if (element) {
                return element;
            }
        }
        return null;
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
    async animateFromDeck(card, deckAnchor, arrivesFaceUp = false) {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.toggle('wott-card-flip--flipped', !arrivesFaceUp);
        const fromRect = cardElement.getBoundingClientRect();
        const nextElement = this.spliceCardSorted(card);
        this.handElement.insertBefore(cardElement, nextElement);
        await slideFromRects([{ element: cardElement, fromRect }]);
        if (!arrivesFaceUp) {
            await flipCard(cardElement, false);
        }
    }
}
