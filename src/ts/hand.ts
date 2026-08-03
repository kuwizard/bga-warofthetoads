import { tplHandCard, tplCardTooltip, tplShownCard } from "./tpls.js";
import { PlayerPanels } from "./playerPanels.js";
import { flipCard, slideIntoPlace } from "./animations.js";
import { animDur, delay, isReadOnly } from "./common.js";

const DEAL_STAGGER_MS = 144;

// The viewing player's own hand, never the opponent's — RULES.md's hidden hand is the whole point, and card-backs would say nothing the panel's deck count doesn't already.
export class Hand {
    private cards!: CardsUiData;
    private gameArea!: HTMLElement;
    private handElement!: HTMLElement;

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

        this.cards.hand.push(args.card);

        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (deckAnchor) {
            await this.animateFromDeck(args.card, deckAnchor);
        } else {
            this.appendCard(args.card);
        }
    }

    async notif_cardsDrawn(args: CardsDrawnNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        this.playerPanels.adjustDeckCount(playerId, -args.count);
        this.cards.handCounts[playerId] = (this.cards.handCounts[playerId] ?? 0) + args.count;

        // The War's opening deal is already in `getAllDatas()` by the time its notification arrives.
        const drawnCards = (args.cards ?? []).filter(card => !document.getElementById(`wott-card-${card.id}`));
        drawnCards.forEach(card => this.cards.hand.push(card));

        const deckAnchor = this.playerPanels.getDeckAnchor(playerId);
        if (!deckAnchor) {
            drawnCards.forEach(card => this.appendCard(card));
            return;
        }

        await Promise.all(drawnCards.map(async (card, index) => {
            await delay(index * animDur(DEAL_STAGGER_MS));
            await this.animateFromDeck(card, deckAnchor);
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

        const dialog = new ebg.popindialog();
        dialog.create('wott-shown-cards');
        dialog.setTitle(_('Cards shown to you'));
        dialog.setContent(`<div class="wott-shown-cards">${args.cards.map(tplShownCard).join('')}</div>`);
        dialog.show();

        args.cards.forEach(card => this.bga.gameui.addTooltipHtml(`wott-shown-card-${card.id}`, tplCardTooltip(card)));
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

    private createCardElement(card: CardData, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplHandCard(card));
        this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        return document.getElementById(`wott-card-${card.id}`)!;
    }

    private removeCard(cardId: number): void {
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

    private async animateFromDeck(card: CardData, deckAnchor: HTMLElement): Promise<void> {
        const cardElement = this.createCardElement(card, deckAnchor);
        cardElement.classList.add('wott-card-flip--flipped');

        await slideIntoPlace(cardElement, this.handElement);
        await flipCard(cardElement, false);
    }

}
