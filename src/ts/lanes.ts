import { tplLaneCard, tplCardTooltip } from "./tpls.js";

// See constants.inc.php's `LANE_OPEN`/`LANE_HIDDEN` — mirrored here as plain
// numbers since `Card::getUiData()`'s `locationArg` is the only place they
// travel to the client, and no other TS file needs the PHP-side names.
const LANE_OPEN = 1;
const LANE_HIDDEN = 2;

const TRANSITION_FALLBACK_MS = 2000; // mirrors hand.ts

/**
 * The 2 shared lanes (RULES.md §6 ➊➋, IMPLEMENTATION_PLAN.md §2.1 "Lane
 * symmetry"): one open lane holding both players' face-up card, one hidden
 * lane holding both players' face-down card. Lane and slot are fully derived
 * from `locationArg`/`controller` — never an independent choice here either.
 */
export class Lanes {
    private lanesElement!: HTMLElement;

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    /** `playerIdsInTableOrder` fixes each slot's physical side (blue's slot always first/left) — see Game.ts::getPlayerIdsInTableOrder(). */
    render(gameArea: HTMLElement, lanes: LaneCardData[], deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' }, playerIdsInTableOrder: number[]): void {
        const slotsHtml = (lane: number) => playerIdsInTableOrder
            .map(playerId => `<div class="wott-lane-slot" id="wott-lane-slot-${lane}-${playerId}"></div>`)
            .join('');

        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-lanes">
                <div class="wott-lane" data-lane="${LANE_OPEN}">${slotsHtml(LANE_OPEN)}</div>
                <div class="wott-lane" data-lane="${LANE_HIDDEN}">${slotsHtml(LANE_HIDDEN)}</div>
            </div>
        `);
        this.lanesElement = document.getElementById('wott-lanes')!;

        // F5 mid-battle: place whatever is already in the lanes, no animation.
        lanes.forEach(card => this.createCardElement(card, this.slotFor(card), deckColorByPlayerId[card.controller]));
    }

    /**
     * Places a just-played card into its lane slot. If the card still has a
     * DOM element in the acting player's own hand (never true for the
     * opponent — their hand is never rendered, hand.ts), reparents and
     * slides it via the same FLIP technique as hand.ts::animateReturnToDeck;
     * otherwise the card simply appears, already face-down if `facedown`.
     */
    async playCard(card: LaneCardData, deckColor: 'blue' | 'red'): Promise<void> {
        const slot = this.slotFor(card);
        const existingElement = document.getElementById(`wott-card-${card.id}`);

        if (!existingElement) {
            this.createCardElement(card, slot, deckColor);
            return;
        }

        existingElement.classList.remove('wott-selectable', 'wott-card--selected');

        // Already previewed here pre-Confirm (States/PlayCards.ts) — a same-position
        // replay would stall on waitForTransitionEnd's fallback with no transition to fire.
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

    async previewPlay(card: CardData, controller: number, faceDown: boolean, deckColor: 'blue' | 'red'): Promise<void> {
        const laneCard: LaneCardData = {
            ...card,
            controller,
            location: 'lane',
            locationArg: faceDown ? LANE_HIDDEN : LANE_OPEN,
            facedown: faceDown,
        };
        await this.playCard(laneCard, deckColor);
    }

    async previewUnplay(cardId: number, handElement: HTMLElement, wasFaceDown: boolean): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }

        await this.slideIntoPlace(cardElement, handElement);
        if (wasFaceDown) {
            await this.flip(cardElement, false);
        }
    }

    setCardsSelectable(cardIds: number[], selectable: boolean, onClick?: (cardId: number) => void): void {
        cardIds.forEach(cardId => {
            const cardElement = document.getElementById(`wott-card-${cardId}`);
            if (!cardElement) {
                return;
            }
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ? () => onClick(cardId) : null;
        });
    }

    /** Swaps in the real front-face sprite and un-flips — Notifications::cardsRevealed(), genuinely public at this point. */
    async revealCard(card: CardData): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        if (!cardElement) {
            return;
        }

        const frontFace = cardElement.querySelector<HTMLElement>('.wott-card-flip__face--front')!;
        frontFace.className = `wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${card.type ? card.type.replace(/_/g, '-') : 'back'}`;
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));

        await this.flip(cardElement, false);
    }

    /** RULES.md §6 (end) — the lane empties between battles; PR4's real capture animation replaces this. */
    clear(): void {
        this.lanesElement.querySelectorAll('.wott-lane-slot').forEach(slot => {
            slot.innerHTML = '';
        });
    }

    private slotFor(card: LaneCardData): HTMLElement {
        return document.getElementById(`wott-lane-slot-${card.locationArg}-${card.controller}`)!;
    }

    private createCardElement(card: LaneCardData, container: HTMLElement, deckColor: 'blue' | 'red'): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, deckColor));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);

        // A redacted card (no `name`) has nothing meaningful to show in a tooltip.
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card as CardData));
        }

        return cardElement;
    }

    /** Same technique as hand.ts's private `flip` — duplicated rather than shared since the two classes own separate DOM trees. */
    private flip(cardElement: HTMLElement, faceDown: boolean): Promise<void> {
        const inner = cardElement.querySelector<HTMLElement>('.wott-card-flip__inner')!;
        const donePromise = this.waitForTransitionEnd(inner, 'transform');
        cardElement.classList.toggle('wott-card-flip--flipped', faceDown);
        return donePromise;
    }

    /** Same technique as hand.ts's private `slideIntoPlace` — see there for the full FLIP-technique explanation. */
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
