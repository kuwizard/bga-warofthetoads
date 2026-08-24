import { slideFromRects, slideIntoPlace } from "./animations.js";
import { animDur, delay } from "./common.js";

const DEAL_STAGGER_MS = 144;

function deckAnchorFor(playerId: number): HTMLElement | null {
    return document.getElementById(`wott-deck-anchor-${playerId}`);
}

// [H13] leaves only the count public, so these backs carry no card id and the server's handCounts is their only source of truth.
export class OpponentHand {
    private gameArea!: HTMLElement;
    private playerIds: number[] = [];
    private deckColorByPlayerId!: { [playerId: number]: 'blue' | 'red' };
    // Preference 104 only takes the rows off screen — the counts stay current underneath, so turning them back on mid-battle needs no catch-up.
    private shown: boolean = true;

    render(
        gameArea: HTMLElement,
        playerIds: number[],
        cards: CardsUiData,
        deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' },
    ): void {
        this.gameArea = gameArea;
        this.playerIds = playerIds;
        this.deckColorByPlayerId = deckColorByPlayerId;

        playerIds.forEach(playerId => {
            gameArea.insertAdjacentHTML('beforeend', `<div class="wott-opponent-hand" id="wott-opponent-hand-${playerId}"></div>`);
            this.setCount(playerId, Number(cards.handCounts[playerId] ?? 0));
        });
    }

    setShown(shown: boolean): void {
        this.shown = shown;
        this.playerIds.forEach(playerId => this.rowFor(playerId)?.classList.toggle('wott-opponent-hand--hidden', !shown));
    }

    setPositions(positionByPlayerId: { [playerId: number]: 'top' | 'bottom' }): void {
        this.playerIds.forEach(playerId => {
            const row = this.rowFor(playerId);
            if (!row) {
                return;
            }

            if (positionByPlayerId[playerId] === 'top') {
                this.gameArea.prepend(row);
            } else {
                this.gameArea.append(row);
            }
        });
    }

    async notif_cardsDrawn(args: CardsDrawnNotifArgs): Promise<void> {
        await this.dealFromDeck(Number(args.player_id), args.handCounts);
    }

    async notif_cardReturnUndone(args: CardReturnUndoneNotifArgs): Promise<void> {
        await this.dealFromDeck(Number(args.player_id), args.handCounts);
    }

    async notif_cardReturned(args: CardReturnedNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);
        const row = this.rowFor(playerId);
        if (!row) {
            return;
        }

        this.setCount(playerId, Number(args.handCounts[playerId]) + 1);

        const back = row.lastElementChild as HTMLElement | null;
        const deckAnchor = deckAnchorFor(playerId);
        if (!back) {
            return;
        }

        if (deckAnchor && this.shown) {
            await slideIntoPlace(back, deckAnchor);
        }
        back.remove();
    }

    // RULES.md §9's deck swap. Both hands are empty by then, but the row still has to know which back to deal next War.
    notif_warStarted(args: WarStartedNotifArgs): void {
        this.deckColorByPlayerId = args.deckColors;

        this.playerIds.forEach(playerId => this.rowFor(playerId)?.querySelectorAll<HTMLElement>('.wott-card')
            .forEach(back => back.className = this.backClass(playerId)));
    }

    // Squaring up before the lift, in one tick, keeps a page loaded mid-move (its snapshot already has the cards gone) from double-counting or flickering.
    takeCardRects(playerId: number, count: number, handCountAfter: number): (DOMRect | undefined)[] {
        const row = this.rowFor(playerId);
        if (!row) {
            return [];
        }

        this.setCount(playerId, handCountAfter + count);

        const backs = Array.from(row.children).slice(-count) as HTMLElement[];
        const rects = backs.map(back => this.liftRect(playerId, back));
        backs.forEach(back => back.remove());

        return rects;
    }

    // A hidden row gives up no spot on screen, so the card sets off from that player's deck instead.
    private liftRect(playerId: number, back: HTMLElement): DOMRect | undefined {
        return this.shown ? back.getBoundingClientRect() : deckAnchorFor(playerId)?.getBoundingClientRect();
    }

    setCount(playerId: number, count: number): void {
        const row = this.rowFor(playerId);
        if (!row || !Number.isFinite(count)) {
            return;
        }

        while (row.childElementCount > count) {
            row.lastElementChild!.remove();
        }
        while (row.childElementCount < count) {
            this.createBack(playerId, row);
        }
    }

    // The opening deal is already in the count getAllDatas() rendered — the same race hand.ts sidesteps by card id, which anonymous backs cannot do.
    private async dealFromDeck(playerId: number, handCounts: HandCountsByPlayerId): Promise<void> {
        const row = this.rowFor(playerId);
        if (!row) {
            return;
        }

        const handCount = Number(handCounts[playerId]);
        const dealtCount = handCount - row.childElementCount;
        const deckAnchor = deckAnchorFor(playerId);
        if (dealtCount <= 0 || !deckAnchor || !this.shown) {
            this.setCount(playerId, handCount);
            return;
        }

        await Promise.all(Array.from({ length: dealtCount }, async (_unused, index) => {
            await delay(index * animDur(DEAL_STAGGER_MS));
            await this.animateFromDeck(playerId, deckAnchor);
        }));
    }

    private async animateFromDeck(playerId: number, deckAnchor: HTMLElement): Promise<void> {
        const back = this.createBack(playerId, deckAnchor);
        const fromRect = back.getBoundingClientRect();

        this.rowFor(playerId)!.appendChild(back);
        await slideFromRects([{ element: back, fromRect }]);
    }

    private createBack(playerId: number, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', `<div class="${this.backClass(playerId)}"></div>`);
        return container.lastElementChild as HTMLElement;
    }

    private backClass(playerId: number): string {
        return `wott-card wott-card--${this.deckColorByPlayerId[playerId]}-back`;
    }

    private rowFor(playerId: number): HTMLElement | null {
        return document.getElementById(`wott-opponent-hand-${playerId}`);
    }
}
