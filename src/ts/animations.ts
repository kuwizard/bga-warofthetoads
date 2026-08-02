// Shared FLIP helpers, used by hand.ts, lanes.ts, shrine.ts and playerPanels.ts.

import { cardRoleSlug, tplCardTooltip } from "./tpls.js";
import { animDur } from "./common.js";

const TRANSITION_FALLBACK_MS = 2000;

export function waitForTransitionEnd(element: HTMLElement, propertyName: string): Promise<void> {
    return new Promise(resolve => {
        const handler = (event: TransitionEvent) => {
            // transitionend bubbles — ignore descendants' own transitions.
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

export function flipCard(cardElement: HTMLElement, faceDown: boolean): Promise<void> {
    // Re-asserting the side a card already shows fires no transition, so the wait below would stall to its fallback.
    if (cardElement.classList.contains('wott-card-flip--flipped') === faceDown) {
        return Promise.resolve();
    }

    const inner = cardElement.querySelector<HTMLElement>('.wott-card-flip__inner')!;
    const donePromise = waitForTransitionEnd(inner, 'transform');
    cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
    return donePromise;
}

// Swaps a redacted card's placeholder front for its real sprite, then un-flips — the one "a hidden card becomes public" move, shared by the lane reveal and the end-of-game Casualty reveal.
export async function revealCardFace(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>, card: CardData): Promise<void> {
    const cardElement = document.getElementById(`wott-card-${card.id}`);
    if (!cardElement) {
        return;
    }

    const frontFace = cardElement.querySelector<HTMLElement>('.wott-card-flip__face--front')!;
    frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${cardRoleSlug(card.type)}`;
    bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));

    await flipCard(cardElement, false);
}

// The inverse move — a public card becoming a Hostage or a Monk. Scrubbing the sprite class matters as much as the flip: a CSS-only hide would leave the card's identity readable in the DOM.
export async function hideCardFace(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>, card: StackCardData): Promise<void> {
    const cardElement = document.getElementById(`wott-card-${card.id}`);
    if (!cardElement) {
        return;
    }

    await flipCard(cardElement, true);

    const frontFace = cardElement.querySelector<HTMLElement>('.wott-card-flip__face--front')!;
    frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-back`;
    bga.gameui.removeTooltip(`wott-card-${card.id}`);
}

// Reparents first so stacking/z-index is right for the whole move, not just the last frame.
export async function slideAllIntoPlace(moves: { element: HTMLElement, container: HTMLElement }[]): Promise<void> {
    const fromRects = moves.map(({ element }) => element.getBoundingClientRect());
    moves.forEach(({ element, container }) => container.appendChild(element));

    await slideFromRects(moves.map(({ element }, index) => ({ element, fromRect: fromRects[index] })));
}

export function slideIntoPlace(element: HTMLElement, container: HTMLElement): Promise<void> {
    return slideAllIntoPlace([{ element, container }]);
}

// Animates each element from `fromRect` to where it already sits — no DOM move, and all starting together so two can cross over.
export async function slideFromRects(allMoves: { element: HTMLElement, fromRect: DOMRect }[]): Promise<void> {
    // A card that ends up where it started transitions nothing, so waiting on it would only burn the fallback timeout.
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
        element.getBoundingClientRect(); // force layout before enabling the transition below
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
