// Shared FLIP helpers, used by hand.ts, lanes.ts and playerTables.ts.

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
        }, TRANSITION_FALLBACK_MS);
        element.addEventListener('transitionend', handler);
    });
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
export async function slideFromRects(moves: { element: HTMLElement, fromRect: DOMRect }[]): Promise<void> {
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
