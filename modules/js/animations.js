import { cardRoleSlug, tplCardTooltip } from "./tpls.js";
import { animDur } from "./common.js";
const TRANSITION_FALLBACK_MS = 2000;
export function waitForTransitionEnd(element, propertyName) {
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
        }, Math.max(300, animDur(TRANSITION_FALLBACK_MS)));
        element.addEventListener('transitionend', handler);
    });
}
export function flipCard(cardElement, faceDown) {
    if (cardElement.classList.contains('wott-card-flip--flipped') === faceDown) {
        return Promise.resolve();
    }
    const inner = cardElement.querySelector('.wott-card-flip__inner');
    const donePromise = waitForTransitionEnd(inner, 'transform');
    cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
    return donePromise;
}
export async function revealCardFace(bga, card) {
    const cardElement = document.getElementById(`wott-card-${card.id}`);
    if (!cardElement) {
        return;
    }
    const frontFace = cardElement.querySelector('.wott-card-flip__face--front');
    frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${cardRoleSlug(card.type)}`;
    bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
    await flipCard(cardElement, false);
}
export async function hideCardFace(bga, card) {
    const cardElement = document.getElementById(`wott-card-${card.id}`);
    if (!cardElement) {
        return;
    }
    await flipCard(cardElement, true);
    const frontFace = cardElement.querySelector('.wott-card-flip__face--front');
    frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-back`;
    bga.gameui.removeTooltip(`wott-card-${card.id}`);
}
export async function slideAllIntoPlace(moves) {
    const fromRects = moves.map(({ element }) => element.getBoundingClientRect());
    moves.forEach(({ element, container }) => container.appendChild(element));
    await slideFromRects(moves.map(({ element }, index) => ({ element, fromRect: fromRects[index] })));
}
export function slideIntoPlace(element, container) {
    return slideAllIntoPlace([{ element, container }]);
}
export async function slideFromRects(allMoves) {
    const moves = allMoves.filter(({ element, fromRect }) => {
        const toRect = element.getBoundingClientRect();
        return Math.abs(fromRect.left - toRect.left) >= 1 || Math.abs(fromRect.top - toRect.top) >= 1;
    });
    if (moves.length === 0) {
        return;
    }
    moves.forEach(({ element, fromRect }) => {
        const toRect = element.getBoundingClientRect();
        element.classList.add('wott-card-slide');
        element.style.setProperty('--slide-dx', `${fromRect.left - toRect.left}px`);
        element.style.setProperty('--slide-dy', `${fromRect.top - toRect.top}px`);
        element.getBoundingClientRect();
    });
    await Promise.all(moves.map(({ element }) => {
        const donePromise = waitForTransitionEnd(element, 'transform');
        element.classList.add('wott-card-slide--animating');
        element.style.removeProperty('--slide-dx');
        element.style.removeProperty('--slide-dy');
        return donePromise;
    }));
    moves.forEach(({ element }) => element.classList.remove('wott-card-slide', 'wott-card-slide--animating'));
}
