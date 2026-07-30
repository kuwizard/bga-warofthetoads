import { tplHandCard, tplCardTooltip } from "./tpls.js";
export const HAND_POSITION_PREF_ID = 103;
const TRANSITION_FALLBACK_MS = 2000;
export class Hand {
    constructor(bga) {
        this.bga = bga;
    }
    render(gameArea, cards) {
        this.gameArea = gameArea;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-my-hand"></div>`);
        this.handElement = document.getElementById('wott-my-hand');
        cards.forEach(card => this.appendCard(card));
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
        this.handElement.querySelectorAll('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardElement.dataset.cardId === String(cardId));
        });
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
        await this.slideIntoPlace(cardElement, deckAnchor);
        cardElement.remove();
    }
    async animateUndoReturn(card, deckAnchor) {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.add('wott-card-flip--flipped');
        await this.slideIntoPlace(cardElement, this.handElement);
        await this.flip(cardElement, false);
    }
    flip(cardElement, faceDown) {
        const inner = cardElement.querySelector('.wott-card-flip__inner');
        const donePromise = this.waitForTransitionEnd(inner, 'transform');
        cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
        return donePromise;
    }
    async slideIntoPlace(cardElement, container) {
        const fromRect = cardElement.getBoundingClientRect();
        container.appendChild(cardElement);
        const toRect = cardElement.getBoundingClientRect();
        cardElement.classList.add('wott-card-slide');
        cardElement.style.setProperty('--slide-dx', `${fromRect.left - toRect.left}px`);
        cardElement.style.setProperty('--slide-dy', `${fromRect.top - toRect.top}px`);
        cardElement.getBoundingClientRect();
        const donePromise = this.waitForTransitionEnd(cardElement, 'transform');
        cardElement.classList.add('wott-card-slide--animating');
        cardElement.style.removeProperty('--slide-dx');
        cardElement.style.removeProperty('--slide-dy');
        await donePromise;
        cardElement.classList.remove('wott-card-slide', 'wott-card-slide--animating');
    }
    waitForTransitionEnd(element, propertyName) {
        return new Promise(resolve => {
            const handler = (event) => {
                if (event.propertyName !== propertyName || event.target !== element) {
                    return;
                }
                element.removeEventListener('transitionend', handler);
                clearTimeout(fallback);
                resolve();
            };
            const fallback = setTimeout(() => {
                element.removeEventListener('transitionend', handler);
                resolve();
            }, TRANSITION_FALLBACK_MS);
            element.addEventListener('transitionend', handler);
        });
    }
}
