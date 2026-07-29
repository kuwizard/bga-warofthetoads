import { tplHandCard, tplCardTooltip } from "./tpls.js";
export const HAND_POSITION_PREF_ID = 103;
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
        this.handElement.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
    }
    removeCard(cardId) {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }
    setSelectable(selectable, onClick) {
        this.handElement.querySelectorAll('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
    }
    setSelectedCard(cardId) {
        this.handElement.querySelectorAll('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardElement.dataset.cardId === String(cardId));
        });
    }
}
