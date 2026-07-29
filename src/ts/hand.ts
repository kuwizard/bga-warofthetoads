import { tplHandCard, tplCardTooltip } from "./tpls.js";

export const HAND_POSITION_PREF_ID = 103;

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

    private appendCard(card: CardData): void {
        this.handElement.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
    }

    removeCard(cardId: number): void {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }

    setSelectable(selectable: boolean, onClick?: (cardId: number) => void): void {
        this.handElement.querySelectorAll<HTMLElement>('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-selectable', selectable);
            cardElement.onclick = (selectable && onClick) ?
                () => onClick(Number(cardElement.dataset.cardId)) :
                null;
        });
    }

    /** Highlights the chosen card (or clears the highlight if `cardId` is null) — visual only, no action performed. */
    setSelectedCard(cardId: number | null): void {
        this.handElement.querySelectorAll<HTMLElement>('.wott-card[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardElement.dataset.cardId === String(cardId));
        });
    }
}
