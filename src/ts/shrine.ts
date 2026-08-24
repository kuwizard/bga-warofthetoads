import { tplLaneCard, tplCardTooltip, tplRetiredTooltip, tplShrineCard, tplShrineTooltip } from "./tpls.js";
import { hideCardFace, revealCardFace, slideAllIntoPlace, slideFromRects } from "./animations.js";
import { OpponentHand } from "./opponentHand.js";

// DOM order inside a stack *is* its z-order (shrine.scss offsets `:first-child`), and Cards::getUiData()'s stacks query has no ORDER BY of its own — the same order captureStack() pushes them in live.
function hostageBeforeCaptor(a: StackCardData, b: StackCardData): number {
    return a.locationArg - b.locationArg || Number(b.facedown) - Number(a.facedown);
}

// Retired cards are grouped by their printed back ([H2]), and the two groups stay level: a tie and a declined stack each send one card of either deck, and each player's Casualty comes off their own deck.
const DECK_COLORS: ('blue' | 'red')[] = ['blue', 'red'];

// The retired pile is 3 cards wide, so 3 per deck is the last size that fits without opening a 3rd row (shrine.scss). Past that each deck collapses into a counted stack, however long the War runs.
const RETIRED_SHOWN_FLAT = 3;

// The Shrine (RULES.md §6 ➏, §7): the tracker card itself, each player's captured stacks in their own column, and the pile of cards retired beside it. Calm/Angry arrives server-derived ([H4]) and is never computed here.
export class Shrine {
    private cards!: CardsUiData;
    private stackColumns: { [playerId: number]: HTMLElement } = {};
    private retiredElement!: HTMLElement;
    private retiredDecks!: { [deck: string]: HTMLElement };
    private shrineCardElement!: HTMLElement;
    private firstPlayerId!: number;

    constructor(
        private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>,
        private opponentHand: OpponentHand,
    ) {
    }

    render(gameArea: HTMLElement, cards: CardsUiData, playerIdsInTableOrder: number[], angry: AngryByPlayerId): void {
        this.cards = cards;
        this.firstPlayerId = playerIdsInTableOrder[0];

        // One deck per back ([H2]: a retired card keeps its physical back), so the two never mix into a single indistinguishable stack once collapsed. That deck's Casualty (RULES.md §9) sits at the bottom of it and the Monks pile on top. The count is each deck's first child, leaving shrine.scss's `:nth-last-child` layer rules counting cards only.
        const retiredDecksHtml = DECK_COLORS
            .map(deck => `
                <div class="wott-retired-deck" id="wott-retired-deck-${deck}">
                    <span class="wott-retired-deck-count" id="wott-retired-deck-count-${deck}">0</span>
                </div>
            `)
            .join('');

        // The tracker card and everything retired beside it (Monks and Casualties alike) form one block between the two stack columns, so the columns alone decide how wide the Shrine gets — see layout.scss for what top-down does with the three.
        const centerHtml = `
            <div class="wott-shrine-center">
                ${tplShrineCard()}
                <div class="wott-zone" id="wott-retired">
                    <span class="wott-zone__label">${_('Monks/Casualties')}</span>
                    <div class="wott-retired-cards" id="wott-retired-cards">${retiredDecksHtml}</div>
                </div>
            </div>
        `;

        const columnsHtml = playerIdsInTableOrder
            .map(playerId => `
                <div class="wott-stack-column" id="wott-stack-column-${playerId}">
                    <span class="wott-stack-count" id="wott-stack-count-${playerId}">0</span>
                </div>
            `)
            .join(centerHtml);

        gameArea.insertAdjacentHTML('beforeend', `<div id="wott-shrine">${columnsHtml}</div>`);

        playerIdsInTableOrder.forEach(playerId => {
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`)!;
        });
        this.retiredElement = document.getElementById('wott-retired-cards')!;
        this.retiredDecks = Object.fromEntries(DECK_COLORS.map(deck => [deck, document.getElementById(`wott-retired-deck-${deck}`)!]));
        this.shrineCardElement = document.getElementById('wott-shrine-card')!;
        this.bga.gameui.addTooltipHtml('wott-shrine-card', tplShrineTooltip());
        this.bga.gameui.addTooltipHtml('wott-retired', tplRetiredTooltip());
        this.setMood(angry);

        // F5 mid-War: place whatever is already captured/retired, no animation.
        // A stack's column is keyed by its Captor's controller, never a card's
        // own — capture() never reassigns controller, so a Hostage's is still
        // its original (losing) owner (Card::getUiData()'s comment).
        const stackOwnerByStackId: { [stackId: number]: number } = {};
        cards.stacks.forEach(card => {
            if (!card.facedown) {
                stackOwnerByStackId[card.locationArg] = card.controller;
            }
        });
        [...cards.stacks]
            .sort(hostageBeforeCaptor)
            .forEach(card => this.placeStackCard(card, stackOwnerByStackId[card.locationArg]));
        // Casualties before Monks: set aside at the previous War's end (RULES.md §9), they are the oldest card in their deck and so its bottom one.
        cards.casualties.forEach(card => this.createCard(card, this.retiredDecks[card.deck], false));
        cards.shrine.forEach(card => this.createCard(card, this.retiredDecks[card.deck]));
        this.refreshRetiredDecks();
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }

    /** `ResolveBattle`'s tie branch (RULES.md §6 ➎, [H16]) — Notifications::laneTied(). */
    async notif_laneTied(args: LaneTiedNotifArgs): Promise<void> {
        const tiedCards = [args.card1, args.card2];
        tiedCards.forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
        });

        this.refreshRetiredDecks();
        await this.moveCards(tiedCards.map(card => ({ card, container: this.retiredDecks[card.deck] })));
        this.refreshRetiredDecks();
    }

    // Every lane win, single or half of a double (RULES.md §6 ➎, §7) — Notifications::hostageCaptured().
    async notif_hostageCaptured(args: HostageCapturedNotifArgs): Promise<void> {
        await this.captureStack(Number(args.winner.controller), args.winner, args.loser);
    }

    /**
     * `ChooseStack` ([H14]) — Notifications::stackKept(). No card data is
     * sent (nor needed): the declined stack's 2 members become Monks, purely
     * from already-rendered DOM plus `stack_id`/`controller`; the cache is
     * likewise updated to the redacted-stub shape a fresh page load would
     * produce.
     */
    async notif_stackKept(args: StackKeptNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        // The Captor hides just as completely as its Hostage once both are Monks, and each keeps its own true `controller` (see placeStackCard) so it shows its own deck-back colour.
        const retiredCards: StackCardData[] = this.cards.stacks
            .filter(card => card.locationArg === args.declinedStackId)
            .map(card => ({
                id: card.id,
                controller: card.controller,
                location: 'shrine',
                locationArg: 0,
                facedown: true,
                deck: card.deck,
            }));

        this.cards.shrine.push(...retiredCards);
        this.cards.stacks = this.cards.stacks.filter(card => card.locationArg !== args.declinedStackId);

        this.refreshRetiredDecks();
        await this.moveCards(retiredCards.map(card => ({ card, container: this.retiredDecks[card.deck] })));
        this.refreshRetiredDecks();
        document.getElementById(`wott-stack-${args.declinedStackId}`)?.remove();
        this.refreshStackCount(playerId, this.cards.stacks);
    }

    // A Casualty is retired exactly where a Monk is (Cards.php::getFlagCount), so it joins that deck's stack — the only difference is where it flies in from. The owner's own card is on screen in their hand; everyone else only ever had a redacted stub, which starts from the back it gave up in that player's row.
    async notif_casualtySet(args: CasualtySetNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);
        this.cards.casualties.push(args.card);
        this.refreshRetiredDecks();

        if (document.getElementById(`wott-card-${args.card.id}`)) {
            await this.moveCards([{ card: args.card, container: this.retiredDecks[args.card.deck] }]);
        } else {
            const [fromHandRect] = this.opponentHand.takeCardRects(playerId, 1, Number(args.handCounts[playerId]));
            await this.animateCasualtyIn(args.card, playerId, fromHandRect);
        }

        this.refreshRetiredDecks();
    }

    // RULES.md §10 — both Casualties flip face-up at game end, whichever condition decided it. The owner's element already carries the real sprite; everyone else's is still the redacted stub, and revealCardFace covers both.
    async notif_casualtyRevealed(args: CasualtyRevealedNotifArgs): Promise<void> {
        const index = this.cards.casualties.findIndex(casualty => casualty.id === args.card.id);
        if (index !== -1) {
            this.cards.casualties[index] = args.card;
        }

        await revealCardFace(this.bga, args.card);
    }

    // Only ever fired for the 2nd War (States/WarSetup.php) — the Casualties, set aside just before this, are now worth showing.
    notif_warStarted(_args: WarStartedNotifArgs): void {
        // The Casualties share the pile but were set aside moments earlier and stay — so the Monks go one by one rather than by emptying the container.
        this.cards.shrine.forEach(monk => document.getElementById(`wott-card-${monk.id}`)?.remove());
        this.cards.stacks = [];
        this.cards.shrine = [];

        document.querySelectorAll('#wott-shrine .wott-stack').forEach(element => element.remove());
        Object.keys(this.stackColumns).forEach(playerId => this.setStackCount(Number(playerId), 0));
        this.refreshRetiredDecks();
    }

    // RULES.md §7: flips to the back as soon as anyone is Angry, and rotates to point the back's baked-in Angry arrow at whichever side is actually Angry — layout.scss turns both rotations another quarter in top-down mode.
    setMood(angry: AngryByPlayerId): void {
        this.shrineCardElement.classList.toggle('wott-card-flip--flipped', Object.values(angry).some(isAngry => isAngry));
        this.shrineCardElement.classList.toggle('wott-shrine-card--rotated', this.isSoleAngry(this.firstPlayerId, angry));

        Object.entries(this.stackColumns).forEach(([playerId, column]) => {
            column.classList.toggle('wott-stack-column--angry', !!angry[Number(playerId)]);
        });
    }

    private isSoleAngry(playerId: number, angry: AngryByPlayerId): boolean {
        return !!angry[playerId] && Object.values(angry).filter(isAngry => isAngry).length === 1;
    }

    /** ChooseStack ([H14]): the given player's 2 highest-id captured stacks — mirrors Cards::getStacksFor()'s array_slice(-2). */
    getMyPendingStackIds(playerId: number): number[] {
        const stackIds = [...new Set(
            this.cards.stacks
                .filter(card => card.controller === playerId && !card.facedown)
                .map(card => card.locationArg)
        )].sort((a, b) => a - b);

        return stackIds.slice(-2);
    }

    /** ChooseStack ([H14]): toggles clickability on the 2 candidate stacks. */
    setStacksSelectable(stackIds: number[], selectable: boolean, onClick?: (stackId: number) => void): void {
        stackIds.forEach(stackId => {
            const stackElement = document.getElementById(`wott-stack-${stackId}`);
            if (!stackElement) {
                return;
            }
            stackElement.classList.toggle('wott-selectable', selectable);
            stackElement.onclick = (selectable && onClick) ? () => onClick(stackId) : null;
        });
    }

    /** Highlights (or clears) the chosen stack — ChooseStack's select-then-confirm flow. */
    setSelectedStack(stackId: number | null): void {
        document.querySelectorAll('.wott-stack.wott-card--selected').forEach(el => el.classList.remove('wott-card--selected'));
        if (stackId !== null) {
            document.getElementById(`wott-stack-${stackId}`)?.classList.add('wott-card--selected');
        }
    }

    private async captureStack(controller: number, winner: CardData, loser: StackCardData): Promise<void> {
        this.removeFromLanes(loser.id);
        this.removeFromLanes(winner.id);
        this.cards.stacks.push(loser, winner);

        const stackElement = this.stackElementFor(winner.locationArg, controller);
        if (stackElement) {
            // Hostage before Captor: DOM order inside a stack is its z-order (shrine.scss).
            await this.moveCards([
                { card: loser, container: stackElement },
                { card: winner, container: stackElement },
            ]);
        }

        this.refreshStackCount(controller, this.cards.stacks);
    }

    private async moveCards(entries: { card: StackCardData, container: HTMLElement }[]): Promise<void> {
        // Everything becoming hidden turns face-down together, then the whole battle's cards travel at once.
        await Promise.all(entries
            .filter(({ card }) => card.facedown)
            .map(({ card }) => hideCardFace(this.bga, card)));

        const moves: { element: HTMLElement, container: HTMLElement }[] = [];

        entries.forEach(({ card, container }) => {
            const cardElement = document.getElementById(`wott-card-${card.id}`);
            if (!cardElement) {
                this.createCard(card, container);
                return;
            }

            cardElement.classList.remove('wott-selectable', 'wott-card--selected', 'wott-card--blocked', 'wott-card--tie-breaker');
            cardElement.onclick = null;
            cardElement.querySelector('.wott-card__strength')?.remove();
            moves.push({ element: cardElement, container });
        });

        await slideAllIntoPlace(moves);
    }

    private removeFromLanes(cardId: number): void {
        const index = this.cards.lanes.findIndex(c => c.id === cardId);
        if (index !== -1) {
            this.cards.lanes.splice(index, 1);
        }
    }

    // `stackOwnerId` is the capturing player, never `card.controller` — a Hostage's is still its original (losing) owner, which is exactly what its deck-back colour should keep showing.
    private placeStackCard(card: StackCardData, stackOwnerId: number): void {
        const stackElement = this.stackElementFor(card.locationArg, stackOwnerId);
        if (stackElement) {
            this.createCard(card, stackElement);
        }
    }

    private stackElementFor(stackId: number, stackOwnerId: number): HTMLElement | null {
        const column = this.stackColumns[stackOwnerId];
        if (!column) {
            return null;
        }

        let stackElement = document.getElementById(`wott-stack-${stackId}`);
        if (!stackElement) {
            column.insertAdjacentHTML('beforeend', `<div class="wott-stack" id="wott-stack-${stackId}"></div>`);
            stackElement = document.getElementById(`wott-stack-${stackId}`)!;
        }

        return stackElement;
    }

    // The redacted stub arriving live (notif_casualtySet) — from the spot its back gave up in that player's row, or the deck anchor when no row is on screen.
    private async animateCasualtyIn(card: StackCardData, playerId: number, fromHandRect?: DOMRect): Promise<void> {
        const fromRect = fromHandRect ?? document.getElementById(`wott-deck-anchor-${playerId}`)?.getBoundingClientRect();
        const cardElement = this.createCard(card, this.retiredDecks[card.deck]);
        if (fromRect) {
            await slideFromRects([{ element: cardElement, fromRect }]);
        }
    }

    // Runs on both sides of an arriving pair: the collapse must precede the slide so the cards fly to the stack they are joining, while the count must not run ahead of them.
    private refreshRetiredDecks(): void {
        const collapsed = DECK_COLORS.some(deck => this.retiredCountIncludingArriving(deck) > RETIRED_SHOWN_FLAT);

        this.retiredElement.classList.toggle('wott-retired-cards--collapsed', collapsed);
        DECK_COLORS.forEach(deck => {
            const retiredDeck = this.retiredDecks[deck];
            retiredDeck.classList.toggle('wott-retired-deck--collapsed', collapsed);
            document.getElementById(`wott-retired-deck-count-${deck}`)!.textContent = `${this.cardsLandedIn(retiredDeck)}`;
        });
    }

    private cardsLandedIn(retiredDeck: HTMLElement): number {
        return retiredDeck.querySelectorAll('.wott-card-flip').length;
    }

    private retiredCountIncludingArriving(deck: 'blue' | 'red'): number {
        return [...this.cards.casualties, ...this.cards.shrine].filter(card => card.deck === deck).length;
    }

    private setStackCount(playerId: number, count: number): void {
        const el = document.getElementById(`wott-stack-count-${playerId}`);
        if (el) {
            el.textContent = `${count}`;
        }
    }

    private refreshStackCount(playerId: number, stacks: StackCardData[]): void {
        const count = new Set(
            stacks.filter(c => c.controller === playerId && !c.facedown).map(c => c.locationArg)
        ).size;
        this.setStackCount(playerId, count);
    }

    // Builds a card that has no element yet — a page load, or a capture seen by a client that never rendered the lane card. Cards that are already on the table travel via moveCards() instead.
    private createCard(card: StackCardData, container: HTMLElement, showAbilityTooltip: boolean = true): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);

        // A redacted stub (no `name`) has nothing meaningful to show in a tooltip.
        if (showAbilityTooltip && card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card as CardData));
        }

        return cardElement;
    }
}
