import { tplLaneCard, tplCardTooltip } from "./tpls.js";
import { flipCard, revealCardFace, slideAllIntoPlace, slideFromRects, slideIntoPlace } from "./animations.js";
import { animDur } from "./common.js";
const LANE_OPEN = 1;
const LANE_HIDDEN = 2;
const ANIMATION_FALLBACK_MS = 2000;
export class Lanes {
    constructor(bga, hand, opponentHand) {
        this.bga = bga;
        this.hand = hand;
        this.opponentHand = opponentHand;
        this.printedStrengthByCardId = new Map();
    }
    render(gameArea, lanes, playerIdsInTableOrder) {
        const slotsHtml = (lane) => playerIdsInTableOrder
            .map(playerId => `<div class="wott-lane-slot" id="wott-lane-slot-${lane}-${playerId}"></div>`)
            .join('<div class="wott-lane-arrow"><span class="wott-lane-arrow__right">➜</span><span class="wott-lane-arrow__left">➜</span></div>');
        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-lanes">
                <div class="wott-lane" data-lane="${LANE_OPEN}">${slotsHtml(LANE_OPEN)}</div>
                <div class="wott-lane" data-lane="${LANE_HIDDEN}">${slotsHtml(LANE_HIDDEN)}</div>
            </div>
        `);
        this.lanesElement = document.getElementById('wott-lanes');
        lanes.forEach(card => this.createCardElement(card, this.slotFor(card)));
    }
    async notif_battleStarted(_args) {
        this.clear();
    }
    notif_laneFighting(args) {
        this.lanesElement.querySelectorAll('.wott-lane').forEach(lane => {
            lane.classList.toggle('wott-lane--fighting', Number(lane.dataset.lane) === args.lane);
        });
    }
    notif_moodChanged(_args) {
        this.lanesElement.querySelectorAll('.wott-lane--fighting').forEach(lane => lane.classList.remove('wott-lane--fighting'));
    }
    async notif_cardsPlayed(args) {
        const playerId = Number(args.player_id);
        this.hand.onCardsPlayed([args.faceUpCard.id, args.faceDownCard.id]);
        const [faceUpRect, faceDownRect] = this.opponentHand.takeCardRects(playerId, 2, Number(args.handCounts[playerId]));
        await Promise.all([
            this.playCard(args.faceUpCard, faceUpRect),
            this.playCard(args.faceDownCard, faceDownRect),
        ]);
    }
    async notif_cardsRevealed(args) {
        await Promise.all([
            this.revealCard(args.card1),
            this.revealCard(args.card2),
        ]);
    }
    async notif_tacticBlocked(args) {
        document.getElementById(`wott-card-${args.targetId}`)?.classList.add('wott-card--blocked');
        await this.flashTactic(args.cardId);
    }
    async notif_tacticLanesSwitched(args) {
        await this.flashTactic(args.cardId);
        await this.applyLanes(args.lanes);
    }
    async notif_tacticStrength(args) {
        this.setStrengths({ [args.targetId]: args.strengths[args.targetId] });
        await this.flashTactic(args.cardId);
    }
    async notif_tacticTieBreaker(args) {
        document.getElementById(`wott-card-${args.targetId}`)?.classList.add('wott-card--tie-breaker');
        await this.flashTactic(args.cardId);
    }
    async notif_tacticNoEffect(args) {
        await this.flashTactic(args.cardId);
    }
    setStrengths(strengthByCardId) {
        Object.entries(strengthByCardId).forEach(([cardId, strength]) => {
            const badge = document.getElementById(`wott-card-strength-${cardId}`);
            const printed = this.printedStrengthByCardId.get(Number(cardId));
            const differsFromPrinted = strength !== null && strength !== printed;
            if (!badge) {
                return;
            }
            badge.textContent = differsFromPrinted ? String(strength) : '';
            badge.classList.toggle('wott-card__strength--shown', differsFromPrinted);
        });
    }
    async applyLanes(laneByCardId) {
        const moves = [];
        Object.entries(laneByCardId).forEach(([cardId, lane]) => {
            const element = document.getElementById(`wott-card-${cardId}`);
            const container = document.getElementById(`wott-lane-slot-${lane}-${element?.dataset.controller}`);
            if (element && container && element.parentElement !== container) {
                moves.push({ element, container });
            }
        });
        await slideAllIntoPlace(moves);
    }
    async flashTactic(cardId) {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }
        cardElement.classList.add('wott-card--tactic');
        await this.waitForAnimationEnd(cardElement);
        cardElement.classList.remove('wott-card--tactic');
    }
    async playCard(card, fromHandRect) {
        const slot = this.slotFor(card);
        const existingElement = document.getElementById(`wott-card-${card.id}`);
        if (!existingElement) {
            await this.playFromHiddenHand(card, slot, fromHandRect);
            return;
        }
        existingElement.classList.remove('wott-selectable', 'wott-card--selected');
        this.upgradeToLaneCard(card, existingElement);
        const alreadyInPlace = existingElement.parentElement === slot
            && existingElement.classList.contains('wott-card-flip--flipped') === card.facedown;
        if (alreadyInPlace) {
            return;
        }
        if (card.facedown) {
            await flipCard(existingElement, true);
        }
        await slideIntoPlace(existingElement, slot);
    }
    async playFromHiddenHand(card, slot, fromHandRect) {
        const cardElement = this.createCardElement(card, slot);
        if (!fromHandRect) {
            return;
        }
        cardElement.classList.add('wott-card-flip--flipped');
        await slideFromRects([{ element: cardElement, fromRect: fromHandRect }]);
        await flipCard(cardElement, card.facedown);
    }
    upgradeToLaneCard(card, element) {
        if (element.dataset.controller !== undefined) {
            return;
        }
        element.dataset.controller = String(card.controller);
        element.insertAdjacentHTML('beforeend', `<div class="wott-card__strength" id="wott-card-strength-${card.id}"></div>`);
        this.printedStrengthByCardId.set(card.id, card.strength ?? null);
    }
    async previewPlay(card, controller, faceDown) {
        const laneCard = {
            ...card,
            controller,
            location: 'lane',
            locationArg: faceDown ? LANE_HIDDEN : LANE_OPEN,
            facedown: faceDown,
        };
        await this.playCard(laneCard);
    }
    async previewUnplay(cardId, wasFaceDown) {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }
        const fromRect = cardElement.getBoundingClientRect();
        this.hand.getElement().insertBefore(cardElement, this.hand.getInsertionPointFor(cardId));
        await slideFromRects([{ element: cardElement, fromRect }]);
        if (wasFaceDown) {
            await flipCard(cardElement, false);
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
        this.printedStrengthByCardId.set(card.id, card.strength);
        await revealCardFace(this.bga, card);
    }
    clear() {
        this.lanesElement.querySelectorAll('.wott-lane-slot').forEach(slot => {
            slot.innerHTML = '';
        });
        this.printedStrengthByCardId.clear();
    }
    slotFor(card) {
        return document.getElementById(`wott-lane-slot-${card.locationArg}-${card.controller}`);
    }
    createCardElement(card, container) {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
            this.printedStrengthByCardId.set(card.id, card.strength ?? null);
        }
        return cardElement;
    }
    waitForAnimationEnd(element) {
        return new Promise(resolve => {
            const handler = (event) => {
                if (event.target !== element) {
                    return;
                }
                element.removeEventListener('animationend', handler);
                clearTimeout(fallback);
                resolve();
            };
            const fallback = setTimeout(() => {
                element.removeEventListener('animationend', handler);
                resolve();
            }, Math.max(300, animDur(ANIMATION_FALLBACK_MS)));
            element.addEventListener('animationend', handler);
        });
    }
}
