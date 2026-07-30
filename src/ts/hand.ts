import { tplHandCard, tplCardTooltip } from "./tpls.js";

export const HAND_POSITION_PREF_ID = 103;

// Safety net for waitForTransitionEnd() — only fires if a transitionend event
// never arrives (e.g. the element was removed mid-flight), so a stuck
// animation can never wedge the ReturnCard confirm/undo flow.
const TRANSITION_FALLBACK_MS = 2000;

/**
 * The viewing player's own hand — a single strip rendered above or below the
 * player tables (Imperial Settlers layout, position configurable via the
 * "Hand position" preference), never the opponent's: RULES.md's hidden hand
 * is the whole point, and a count of card-backs told the viewer nothing they
 * don't already see from `wott-deck-count`.
 */
export class Hand {
    private gameArea!: HTMLElement;
    private handElement!: HTMLElement;

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(gameArea: HTMLElement, cards: CardData[]): void {
        this.gameArea = gameArea;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-my-hand"></div>`);
        this.handElement = document.getElementById('wott-my-hand')!;
        cards.forEach(card => this.appendCard(card));
    }

    setPosition(position: 'top' | 'bottom'): void {
        if (position === 'top') {
            this.gameArea.prepend(this.handElement);
        } else {
            this.gameArea.append(this.handElement);
        }
    }

    /** Also used to restore a card whose return was undone — see Game.ts::notif_cardReturnUndone. */
    appendCard(card: CardData): void {
        this.createCardElement(card, this.handElement);
    }

    private createCardElement(card: CardData, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        return document.getElementById(`wott-card-${card.id}`)!;
    }

    removeCard(cardId: number): void {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }

    setSelectable(selectable: boolean, onClick?: (cardId: number) => void): void {
        this.handElement.querySelectorAll<HTMLElement>('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
    }

    /** Highlights the chosen card (or clears the highlight if `cardId` is null) — visual only, no action performed. */
    setSelectedCard(cardId: number | null): void {
        this.handElement.querySelectorAll<HTMLElement>('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardElement.dataset.cardId === String(cardId));
        });
    }

    getElement(): HTMLElement {
        return this.handElement;
    }

    /** Flips the card face-down in place, then slides it into `deckAnchor` — the ReturnCard confirm animation. */
    async animateReturnToDeck(cardId: number, deckAnchor: HTMLElement): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }

        // Selection styling sets its own `transform` on this element (hand.scss)
        // and would otherwise fight with the slide's translate below.
        cardElement.classList.remove('wott-selectable', 'wott-card--selected');

        await this.flip(cardElement, true);
        await this.slideIntoPlace(cardElement, deckAnchor);
        cardElement.remove();
    }

    /** Reverses animateReturnToDeck — slides the card out of `deckAnchor` into the hand, then flips it face-up. */
    async animateUndoReturn(card: CardData, deckAnchor: HTMLElement): Promise<void> {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.add('wott-card-flip--flipped');

        await this.slideIntoPlace(cardElement, this.handElement);
        await this.flip(cardElement, false);
    }

    /** Toggles the face-down flip (hand.scss's `.wott-card-flip--flipped`) and waits for its transition to finish. */
    private flip(cardElement: HTMLElement, faceDown: boolean): Promise<void> {
        const inner = cardElement.querySelector<HTMLElement>('.wott-card-flip__inner')!;
        const donePromise = this.waitForTransitionEnd(inner, 'transform');
        cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
        return donePromise;
    }

    /**
     * Classic FLIP technique: reparents `cardElement` into `container` — its
     * genuine final position, so stacking/z-index (see player-tables.scss's
     * `.wott-deck-anchor`) is correct for the whole move, not just the last
     * frame — then bridges the pixel offset from its old screen position
     * through the `--slide-dx`/`--slide-dy` custom properties (hand.scss's
     * `.wott-card-slide`) so removing them animates a slide into place.
     */
    private async slideIntoPlace(cardElement: HTMLElement, container: HTMLElement): Promise<void> {
        const fromRect = cardElement.getBoundingClientRect();
        container.appendChild(cardElement);
        const toRect = cardElement.getBoundingClientRect();

        cardElement.classList.add('wott-card-slide');
        cardElement.style.setProperty('--slide-dx', `${fromRect.left - toRect.left}px`);
        cardElement.style.setProperty('--slide-dy', `${fromRect.top - toRect.top}px`);
        cardElement.getBoundingClientRect(); // force layout before enabling the transition below

        const donePromise = this.waitForTransitionEnd(cardElement, 'transform');
        cardElement.classList.add('wott-card-slide--animating');
        cardElement.style.removeProperty('--slide-dx');
        cardElement.style.removeProperty('--slide-dy');
        await donePromise;

        cardElement.classList.remove('wott-card-slide', 'wott-card-slide--animating');
    }

    private waitForTransitionEnd(element: HTMLElement, propertyName: string): Promise<void> {
        return new Promise(resolve => {
            const handler = (event: TransitionEvent) => {
                // transitionend bubbles — ignore descendants' own transitions (e.g.
                // the flip's inner rotateY also ends on the "transform" property).
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
