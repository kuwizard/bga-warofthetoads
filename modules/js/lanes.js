import { tplLaneCard, tplCardTooltip } from "./tpls.js";
const LANE_OPEN = 1;
const LANE_HIDDEN = 2;
const TRANSITION_FALLBACK_MS = 2000;
export class Lanes {
    constructor(bga) {
        this.bga = bga;
    }
    render(gameArea, lanes, deckColorByPlayerId, playerIdsInTableOrder) {
        const slotsHtml = (lane) => playerIdsInTableOrder
            .map(playerId => `<div class="wott-lane-slot" id="wott-lane-slot-${lane}-${playerId}"></div>`)
            .join('');
        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-lanes">
                <div class="wott-lane" data-lane="${LANE_OPEN}">${slotsHtml(LANE_OPEN)}</div>
                <div class="wott-lane" data-lane="${LANE_HIDDEN}">${slotsHtml(LANE_HIDDEN)}</div>
            </div>
        `);
        this.lanesElement = document.getElementById('wott-lanes');
        lanes.forEach(card => this.createCardElement(card, this.slotFor(card), deckColorByPlayerId[card.controller]));
    }
    async playCard(card, deckColor) {
        const slot = this.slotFor(card);
        const existingElement = document.getElementById(`wott-card-${card.id}`);
        if (!existingElement) {
            this.createCardElement(card, slot, deckColor);
            return;
        }
        existingElement.classList.remove('wott-selectable', 'wott-card--selected');
        const alreadyInPlace = existingElement.parentElement === slot
            && existingElement.classList.contains('wott-card-flip--flipped') === card.facedown;
        if (alreadyInPlace) {
            return;
        }
        if (card.facedown) {
            await this.flip(existingElement, true);
        }
        await this.slideIntoPlace(existingElement, slot);
    }
    async previewPlay(card, controller, faceDown, deckColor) {
        const laneCard = {
            ...card,
            controller,
            location: 'lane',
            locationArg: faceDown ? LANE_HIDDEN : LANE_OPEN,
            facedown: faceDown,
        };
        await this.playCard(laneCard, deckColor);
    }
    async previewUnplay(cardId, handElement, wasFaceDown) {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }
        await this.slideIntoPlace(cardElement, handElement);
        if (wasFaceDown) {
            await this.flip(cardElement, false);
        }
    }
    setCardsSelectable(cardIds, selectable, onClick) {
        cardIds.forEach(cardId => {
            const cardElement = document.getElementById(`wott-card-${cardId}`);
            if (!cardElement) {
                return;
            }
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ? () => onClick(cardId) : null;
        });
    }
    async revealCard(card) {
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        if (!cardElement) {
            return;
        }
        const frontFace = cardElement.querySelector('.wott-card-flip__face--front');
        frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${card.type ? card.type.replace(/_/g, '-') : 'back'}`;
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        await this.flip(cardElement, false);
    }
    clear() {
        this.lanesElement.querySelectorAll('.wott-lane-slot').forEach(slot => {
            slot.innerHTML = '';
        });
    }
    slotFor(card) {
        return document.getElementById(`wott-lane-slot-${card.locationArg}-${card.controller}`);
    }
    createCardElement(card, container, deckColor) {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, deckColor));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        }
        return cardElement;
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
