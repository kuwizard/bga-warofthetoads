import { tplLaneCard, tplCardTooltip } from "./tpls.js";

/**
 * The Shrine (RULES.md §6 ➏, §7): each player's captured stacks — a face-up
 * Captor over a face-down Hostage — kept in their own column so the opponent
 * can see how many stacks (Hostages) they hold, plus a shared pile for tied
 * and declined cards (Monks). Calm/Angry is never computed here — it's fully
 * server-derived ([H4]) — the visible stack count already conveys the same
 * "who's ahead" information the physical Shrine's flip/rotate does.
 *
 * Owns the `lanes`/`stacks`/`shrine` slices of `Game`'s `gamedatas.cards` (the
 * `cards` object is shared by reference, set once in `render()`) — every
 * `ResolveBattle`/`ChooseStack` notification is handled entirely here, cache
 * mutation and DOM update together, so `Game.ts`'s `notif_xxx` methods stay
 * 1-line delegates.
 */
export class Shrine {
    private cards!: CardsUiData;
    private deckColorByPlayerId!: { [playerId: number]: 'blue' | 'red' };
    private stackColumns: { [playerId: number]: HTMLElement } = {};
    private monksElement!: HTMLElement;

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(gameArea: HTMLElement, cards: CardsUiData, deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' }, playerIdsInTableOrder: number[]): void {
        this.cards = cards;
        this.deckColorByPlayerId = deckColorByPlayerId;

        const columnsHtml = playerIdsInTableOrder
            .map(playerId => `
                <div class="wott-stack-column" id="wott-stack-column-${playerId}">
                    <span class="wott-stack-count" id="wott-stack-count-${playerId}">0</span>
                </div>
            `)
            .join('');

        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-shrine">
                ${columnsHtml}
                <div class="wott-monks" id="wott-monks"></div>
            </div>
        `);

        playerIdsInTableOrder.forEach(playerId => {
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`)!;
        });
        this.monksElement = document.getElementById('wott-monks')!;

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
        cards.shrine.forEach(card => this.placeMonk(card, deckColorByPlayerId[card.controller]));
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }

    /** `ResolveBattle`'s tie branch (RULES.md §6 ➎, [H16]) — Notifications::laneTied(). */
    onLaneTied(args: LaneTiedNotifArgs): void {
        [args.card1, args.card2].forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
            this.placeMonk(card, this.deckColorByPlayerId[card.controller]);
        });
    }

    /** `ResolveBattle`'s single-lane-win branch (RULES.md §6 ➎) — Notifications::hostageCaptured(). */
    onHostageCaptured(args: HostageCapturedNotifArgs): void {
        this.captureStacks(Number(args.winner.controller), [args.winner], [args.loser]);
    }

    /** `ResolveBattle`'s double-win-while-Angry branch (§7, [H4]) — Notifications::leapFrog(). */
    onLeapFrog(args: LeapFrogNotifArgs): void {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }

    /** `ResolveBattle`'s double-win-while-Calm branch ([H14]) — Notifications::doubleWinCalm(); see onStackKept() for the other stack. */
    onDoubleWinCalm(args: DoubleWinCalmNotifArgs): void {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }

    /**
     * `ChooseStack` ([H14]) — Notifications::stackKept(). No card data is
     * sent (nor needed): the declined stack's 2 members become Monks, purely
     * from already-rendered DOM plus `stack_id`/`controller`; the cache is
     * likewise updated to the redacted-stub shape a fresh page load would
     * produce.
     */
    onStackKept(args: StackKeptNotifArgs): void {
        const playerId = Number(args.player_id);

        const declinedCards = this.cards.stacks.filter(card => card.locationArg === args.declinedStackId);
        declinedCards.forEach(card => {
            this.cards.shrine.push({
                id: card.id,
                controller: card.controller,
                location: 'shrine',
                locationArg: 0,
                facedown: true,
            });
        });
        this.cards.stacks = this.cards.stacks.filter(card => card.locationArg !== args.declinedStackId);

        this.retireStack(args.declinedStackId, declinedCards);
        this.refreshStackCount(playerId, this.cards.stacks);
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
    private captureStacks(controller: number, winners: CardData[], losers: StackCardData[]): void {
        winners.forEach((winner, i) => {
            const loser = losers[i];
            this.removeFromLanes(loser.id);
            this.removeFromLanes(winner.id);
            this.cards.stacks.push(loser, winner);
            this.placeStackCard(loser, controller);
            this.placeStackCard(winner, controller);
        });

        this.refreshStackCount(controller, this.cards.stacks);
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
        const column = this.stackColumns[stackOwnerId];
        if (!column) {
            return;
        }

        let stackElement = document.getElementById(`wott-stack-${card.locationArg}`);
        if (!stackElement) {
            column.insertAdjacentHTML('beforeend', `<div class="wott-stack" id="wott-stack-${card.locationArg}"></div>`);
            stackElement = document.getElementById(`wott-stack-${card.locationArg}`)!;
        }

        this.placeCard(card, stackElement, this.deckColorByPlayerId[card.controller]);
    }

    /** A tied or declined card retiring to the shared Monk pile. */
    private placeMonk(card: StackCardData, deckColor: 'blue' | 'red'): void {
        this.placeCard(card, this.monksElement, deckColor);
    }

    /**
     * [H14]: the declined stack's 2 members (its Captor included — a Monk
     * hides just as completely as a Hostage) move into the Monk pile. Each
     * card keeps its own true `controller` (the Hostage's is still its
     * original, losing owner — see placeStackCard()'s comment) so it shows
     * its own deck-back colour, not the stack owner's.
     */
    private retireStack(stackId: number, declinedCards: StackCardData[]): void {
        declinedCards.forEach(card => {
            const stub: StackCardData = {
                id: card.id,
                controller: card.controller,
                location: 'shrine',
                locationArg: 0,
                facedown: true,
            };
            this.placeMonk(stub, this.deckColorByPlayerId[card.controller]);
        });
        document.getElementById(`wott-stack-${stackId}`)?.remove();
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

    /**
     * A card becoming hidden (`facedown`) must never keep its revealing DOM
     * node around — a CSS-only flip would still leave the true sprite class
     * inspectable. Only a card staying public (a Captor) is safe to reparent
     * as-is; anything facedown is destroyed and rebuilt from the (already
     * redacted, per `Card::getUiData()`) stub — mirrors `Lanes::playCard()`'s
     * reparent-don't-recreate approach for the one case where recreating
     * really is required.
     */
    private placeCard(card: StackCardData, container: HTMLElement, deckColor: 'blue' | 'red'): HTMLElement {
        const existingElement = document.getElementById(`wott-card-${card.id}`);

        if (existingElement && card.facedown) {
            existingElement.remove();
        } else if (existingElement) {
            container.appendChild(existingElement);
            existingElement.classList.remove('wott-selectable', 'wott-card--selected');
            return existingElement;
        }

        container.insertAdjacentHTML('beforeend', tplLaneCard(card, deckColor));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);

        // A redacted stub (no `name`) has nothing meaningful to show in a tooltip.
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card as CardData));
        }

        return cardElement;
    }
}
