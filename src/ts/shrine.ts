import { tplLaneCard, tplCardTooltip, tplShrineCard, tplShrineTooltip } from "./tpls.js";
import { hideCardFace, revealCardFace, slideAllIntoPlace } from "./animations.js";

// The Shrine (RULES.md §6 ➏, §7): the tracker card itself, each player's captured stacks in their own column, and the shared Monk pile. Calm/Angry arrives server-derived ([H4]) and is never computed here.
export class Shrine {
    private cards!: CardsUiData;
    private stackColumns: { [playerId: number]: HTMLElement } = {};
    private monksElement!: HTMLElement;
    private casualtiesZoneElement!: HTMLElement;
    private shrineCardElement!: HTMLElement;
    private firstPlayerId!: number;

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(gameArea: HTMLElement, cards: CardsUiData, playerIdsInTableOrder: number[], angry: AngryByPlayerId): void {
        this.cards = cards;
        this.firstPlayerId = playerIdsInTableOrder[0];

        const columnsHtml = playerIdsInTableOrder
            .map(playerId => `
                <div class="wott-stack-column" id="wott-stack-column-${playerId}">
                    <span class="wott-stack-count" id="wott-stack-count-${playerId}">0</span>
                </div>
            `)
            .join(tplShrineCard());

        const casualtySlotsHtml = playerIdsInTableOrder
            .map(playerId => `<div class="wott-casualty-slot" id="wott-casualty-slot-${playerId}"></div>`)
            .join('');

        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-shrine">
                <div class="wott-shrine-captures">${columnsHtml}</div>
                <div class="wott-shrine-retired">
                    <div class="wott-zone">
                        <span class="wott-zone__label">${_('Monks')}</span>
                        <div class="wott-monks" id="wott-monks"></div>
                    </div>
                    <div class="wott-zone" id="wott-casualties-zone">
                        <span class="wott-zone__label">${_('Casualties')}</span>
                        <div class="wott-casualties" id="wott-casualties">${casualtySlotsHtml}</div>
                    </div>
                </div>
            </div>
        `);

        playerIdsInTableOrder.forEach(playerId => {
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`)!;
        });
        this.monksElement = document.getElementById('wott-monks')!;
        this.casualtiesZoneElement = document.getElementById('wott-casualties-zone')!;
        // No Casualty exists yet during the 1st War (RULES.md §8/§9) — the zone only makes sense from the 2nd War on.
        this.casualtiesZoneElement.classList.toggle('wott-zone--hidden', cards.casualties.length === 0);
        this.shrineCardElement = document.getElementById('wott-shrine-card')!;
        this.bga.gameui.addTooltipHtml('wott-shrine-card', tplShrineTooltip());
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
        // DOM order inside a stack *is* its z-order (shrine.scss offsets
        // `:first-child`), so the Hostage must be placed before its Captor —
        // the order captureStacks() pushes them in live. The payload itself
        // has none: Cards::getUiData()'s stacks query has no ORDER BY.
        [...cards.stacks]
            .sort((a, b) => a.locationArg - b.locationArg || Number(b.facedown) - Number(a.facedown))
            .forEach(card => this.placeStackCard(card, stackOwnerByStackId[card.locationArg]));
        cards.shrine.forEach(card => this.placeMonk(card));
        cards.casualties.forEach(card => this.placeCasualty(card));
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }

    /** `ResolveBattle`'s tie branch (RULES.md §6 ➎, [H16]) — Notifications::laneTied(). */
    async notif_laneTied(args: LaneTiedNotifArgs): Promise<void> {
        const tiedCards = [args.card1, args.card2];
        tiedCards.forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
        });

        await this.moveCards(tiedCards.map(card => ({ card, container: this.monksElement })));
    }

    /** `ResolveBattle`'s single-lane-win branch (RULES.md §6 ➎) — Notifications::hostageCaptured(). */
    async notif_hostageCaptured(args: HostageCapturedNotifArgs): Promise<void> {
        await this.captureStacks(Number(args.winner.controller), [args.winner], [args.loser]);
    }

    /** `ResolveBattle`'s double-win-while-Angry branch (§7, [H4]) — Notifications::leapFrog(). */
    async notif_leapFrog(args: LeapFrogNotifArgs): Promise<void> {
        await this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }

    async notif_doubleWinCalm(args: DoubleWinCalmNotifArgs): Promise<void> {
        await this.captureStacks(Number(args.player_id), args.winners, args.losers);
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

        await this.moveCards(retiredCards.map(card => ({ card, container: this.monksElement })));
        document.getElementById(`wott-stack-${args.declinedStackId}`)?.remove();
        this.refreshStackCount(playerId, this.cards.stacks);
    }

    // The owner's own client got the full card and hand.ts animates it into the slot — only the redacted stub appears directly here.
    notif_casualtySet(args: CasualtySetNotifArgs): void {
        if (args.card.type !== undefined) {
            return;
        }

        this.cards.casualties.push(args.card);
        this.placeCasualty(args.card);
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
        this.cards.stacks = [];
        this.cards.shrine = [];

        document.querySelectorAll('#wott-shrine .wott-stack').forEach(element => element.remove());
        this.monksElement.innerHTML = '';
        Object.keys(this.stackColumns).forEach(playerId => this.setStackCount(Number(playerId), 0));
        this.casualtiesZoneElement.classList.remove('wott-zone--hidden');
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

    /** 1 or 2 parallel [winner, loser] pairs, captured and rendered identically regardless of Angry/Calm/single-lane. */
    private async captureStacks(controller: number, winners: CardData[], losers: StackCardData[]): Promise<void> {
        const entries: { card: StackCardData, container: HTMLElement }[] = [];

        winners.forEach((winner, i) => {
            const loser = losers[i];
            this.removeFromLanes(loser.id);
            this.removeFromLanes(winner.id);
            this.cards.stacks.push(loser, winner);

            const stackElement = this.stackElementFor(winner.locationArg, controller);
            if (stackElement) {
                // Hostage before Captor: DOM order inside a stack is its z-order (shrine.scss).
                entries.push({ card: loser, container: stackElement }, { card: winner, container: stackElement });
            }
        });

        await this.moveCards(entries);
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

    /**
     * A Captor or Hostage just captured (`ResolveBattle`'s hostageCaptured/
     * leapFrog/doubleWinCalm). `stackOwnerId` is the Captor's controller (the
     * capturing player) — never `card.controller`, which for a Hostage is
     * still its original (losing) owner. Each card's own deck-back colour is
     * still its own controller's, so a Hostage shows its true owner's colour.
     */
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

    /** A tied or declined card retiring to the shared Monk pile. */
    private placeMonk(card: StackCardData): void {
        this.createCard(card, this.monksElement);
    }

    private placeCasualty(card: StackCardData): void {
        const slot = document.getElementById(`wott-casualty-slot-${card.controller}`);
        if (slot) {
            this.createCard(card, slot);
        }
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
    private createCard(card: StackCardData, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);

        // A redacted stub (no `name`) has nothing meaningful to show in a tooltip.
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card as CardData));
        }

        return cardElement;
    }
}
