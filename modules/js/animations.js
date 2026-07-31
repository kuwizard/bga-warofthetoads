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
        }, TRANSITION_FALLBACK_MS);
        element.addEventListener('transitionend', handler);
    });
}
export async function slideFromRects(moves) {
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
