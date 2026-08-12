import { tplHandCard, tplCardTooltip, tplShownCard } from "./tpls.js";
import { PlayerPanels } from "./playerPanels.js";
import { flipCard, slideFromRects, slideIntoPlace } from "./animations.js";
import { animDur, delay, isReadOnly } from "./common.js";

const DEAL_STAGGER_MS = 144;

// The viewing player's own hand, never the opponent's — RULES.md's hidden hand is the whole point, and card-backs would say nothing the panel's deck count doesn't already.
export class Hand {
    private cards!: CardsUiData;
    private gameArea!: HTMLElement;
    private handElement!: HTMLElement;
    // Reapplied to each card as it's created — setSelectable() only touches elements that already exist.
    private selectable: boolean = false;
    private selectableOnClick?: (cardId: number) => void;

    constructor(
        private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>,
        private playerPanels: PlayerPanels,
    ) {
    }

    render(gameArea: HTMLElement, cards: CardsUiData): void {
        this.cards = cards;
        this.gameArea = gameArea;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-my-hand"></div>`);
        this.handElement = document.getElementById('wott-my-hand')!;
        cards.hand.forEach(card => this.appendCard(card));
    }

    async notif_cardReturned(args: CardReturnedNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        this.playerPanels.adjustDeckCount(playerId, 1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 1) - 1;

        // [H13]: only the returning player's own client is sent `card_id`.
        if (args.card_id === undefined) {
            return;
        }

        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card_id);

        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateReturnToDeck(args.card_id, deckAnchor);
        } else {
            this.removeCard(args.card_id);
        }
    }

    async notif_cardReturnUndone(args: CardReturnUndoneNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        this.playerPanels.adjustDeckCount(playerId, -1);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + 1;

        if (args.card === undefined) {
            return;
        }

        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateFromDeck(args.card, deckAnchor);
        } else {
            this.insertCardSorted(args.card);
        }
    }

    async notif_cardsDrawn(args: CardsDrawnNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        this.playerPanels.adjustDeckCount(playerId, -args.count);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + args.count;

        // The War's opening deal is already in `getAllDatas()` by the time its notification arrives.
        const drawnCards = (args.cards ?? []).filter(card => !document.getElementById(`wott-card-${card.id}`));

        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (!deckAnchor) {
            drawnCards.forEach(card => this.insertCardSorted(card));
            return;
        }

        await Promise.all(drawnCards.map(async (card, index) => {
            await delay(index * animDur(DEAL_STAGGER_MS));
            await this.animateFromDeck(card, deckAnchor, args.arrivesFaceUp);
        }));
    }

    // Only the owner's client receives the full card (and has the element) — everyone else's stub is shrine.ts's job.
    async notif_casualtySet(args: CasualtySetNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 1) - 1;

        if (args.card.type === undefined) {
            return;
        }

        this.cards.hand = this.cards.hand.filter(card => card.id !== args.card.id);

        const slot = document.getElementById(`wott-casualty-slot-${playerId}`);
        const cardElement = document.getElementById(`wott-card-${args.card.id}`);
        if (!slot || !cardElement) {
            return;
        }

        cardElement.classList.remove('wott-selectable', 'wott-card--selected');
        await flipCard(cardElement, true);
        await slideIntoPlace(cardElement, slot);
    }

    async notif_scoutRevealed(args: ScoutRevealedNotifArgs): Promise<void> {
        // `cards` reaches everyone; the popin is only for the Scout's controller.
        if (isReadOnly(this.bga) || Number(args.player_id2) !== Number(this.bga.gameui.player_id)) {
            return;
        }

        const dialogId = 'wott-shown-cards-dialog';
        const dialog = new ebg.popindialog();
        dialog.create(dialogId);
        dialog.setTitle(_('Cards shown to you'));
        dialog.setContent(`<div class="wott-shown-cards">${args.cards.map(tplShownCard).join('')}</div>`);

        args.cards.forEach(card => this.bga.gameui.addTooltipHtml(`wott-shown-card-${card.id}`, tplCardTooltip(card)));

        await this.waitForDialogClose(dialog, dialogId);
    }

    private waitForDialogClose(dialog: PopinDialog, dialogId: string): Promise<void> {
        return new Promise(resolve => {
            let resolved = false;
            const close = () => {
                if (resolved) {
                    return;
                }
                resolved = true;
                underlay?.removeEventListener('click', close);
                dialog.destroy();
                resolve();
            };
            const underlay = document.getElementById(`popin_${dialogId}_underlay`);

            dialog.replaceCloseCallback(close);
            dialog.show();
            underlay?.addEventListener('click', close);
        });
    }

    onCardsPlayed(playerId: number, cardIds: number[]): void {
        this.cards.hand = this.cards.hand.filter(card => !cardIds.includes(card.id));
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? cardIds.length) - cardIds.length;
    }

    getCard(cardId: number): CardData | undefined {
        return this.cards.hand.find(card => card.id === cardId);
    }

    setPosition(position: 'top' | 'bottom'): void {
        if (position === 'top') {
            this.gameArea.prepend(this.handElement);
        } else {
            this.gameArea.append(this.handElement);
        }
    }

    private appendCard(card: CardData): void {
        this.createCardElement(card, this.handElement);
    }

    // [H1]: ascending `id` is ascending Strength for a player's cards — matches a refresh's order.
    private spliceCardSorted(card: CardData): HTMLElement | null {
        const nextCard = this.cards.hand.find(c => c.id > card.id);
        const index = nextCard ? this.cards.hand.indexOf(nextCard) : this.cards.hand.length;
        this.cards.hand.splice(index, 0, card);
        return nextCard ? document.getElementById(`wott-card-${nextCard.id}`) : null;
    }

    private insertCardSorted(card: CardData): void {
        const nextElement = this.spliceCardSorted(card);
        if (nextElement) {
            nextElement.insertAdjacentHTML('beforebegin', tplHandCard(card));
        } else {
            this.handElement.insertAdjacentHTML('beforeend', tplHandCard(card));
        }
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        this.applySelectable(document.getElementById(`wott-card-${card.id}`)!);
    }

    private createCardElement(card: CardData, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        this.applySelectable(cardElement);
        return cardElement;
    }

    private removeCard(cardId: number): void {
        document.getElementById(`wott-card-${cardId}`)?.remove();
    }

    setSelectable(selectable: boolean, onClick?: (cardId: number) => void): void {
        this.selectable = selectable;
        this.selectableOnClick = onClick;
        this.handElement.querySelectorAll<HTMLElement>('.wott-card-flip[data-card-id]').forEach(cardElement => this.applySelectable(cardElement));
    }

    private applySelectable(cardElement: HTMLElement): void {
        cardElement.classList.toggle('wott-selectable', this.selectable);
        cardElement.onclick = (this.selectable && this.selectableOnClick) ?
            () => this.selectableOnClick!(Number(cardElement.dataset.cardId)) :
            null;
    }

    /** Highlights the chosen card (or clears the highlight if `cardId` is null) — visual only, no action performed. */
    setSelectedCard(cardId: number | null): void {
        this.setSelectedCards(cardId === null ? [] : [cardId]);
    }

    setSelectedCards(cardIds: number[]): void {
        this.handElement.querySelectorAll<HTMLElement>('.wott-card-flip[data-card-id]').forEach(cardElement => {
            cardElement.classList.toggle('wott-card--selected', cardIds.includes(Number(cardElement.dataset.cardId)));
        });
    }

    getCardCount(): number {
        return this.cards.hand.length;
    }

    getElement(): HTMLElement {
        return this.handElement;
    }

    // Skips array neighbours currently sitting outside handElement (e.g. the lane-preview card of a still-selected other role) so `cardId` lands next to whichever sorted neighbour is actually present.
    getInsertionPointFor(cardId: number): HTMLElement | null {
        const index = this.cards.hand.findIndex(c => c.id === cardId);
        for (let i = index + 1; i < this.cards.hand.length; i++) {
            const element = this.handElement.querySelector<HTMLElement>(`#wott-card-${this.cards.hand[i].id}`);
            if (element) {
                return element;
            }
        }
        return null;
    }

    /** Flips the card face-down in place, then slides it into `deckAnchor` — the ReturnCard confirm animation. */
    private async animateReturnToDeck(cardId: number, deckAnchor: HTMLElement): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }

        // Selection styling sets its own `transform` on this element (hand.scss)
        // and would otherwise fight with the slide's translate below.
        cardElement.classList.remove('wott-selectable', 'wott-card--selected');

        await flipCard(cardElement, true);
        await slideIntoPlace(cardElement, deckAnchor);
        cardElement.remove();
    }

    private async animateFromDeck(card: CardData, deckAnchor: HTMLElement, arrivesFaceUp: boolean = false): Promise<void> {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.toggle('wott-card-flip--flipped', !arrivesFaceUp);

        const fromRect = cardElement.getBoundingClientRect();
        const nextElement = this.spliceCardSorted(card);
        this.handElement.insertBefore(cardElement, nextElement);
        await slideFromRects([{ element: cardElement, fromRect }]);
        if (!arrivesFaceUp) {
            await flipCard(cardElement, false);
        }
    }

}
