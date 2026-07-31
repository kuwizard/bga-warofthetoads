import { tplLaneCard, tplCardTooltip } from "./tpls.js";
import { Hand } from "./hand.js";
import { flipCard, revealCardFace, slideAllIntoPlace, slideIntoPlace } from "./animations.js";

// See constants.inc.php's `LANE_OPEN`/`LANE_HIDDEN` — mirrored here as plain
// numbers since `Card::getUiData()`'s `locationArg` is the only place they
// travel to the client, and no other TS file needs the PHP-side names.
const LANE_OPEN = 1;
const LANE_HIDDEN = 2;

const ANIMATION_FALLBACK_MS = 2000;

/**
 * The 2 shared lanes (RULES.md §6 ➊➋, IMPLEMENTATION_PLAN.md §2.1 "Lane
 * symmetry"): one open lane holding both players' face-up card, one hidden
 * lane holding both players' face-down card. Lane and slot are fully derived
 * from `locationArg`/`controller` — never an independent choice here either.
 */
export class Lanes {
    private lanesElement!: HTMLElement;
    private playerIdsInTableOrder!: number[];

    private printedStrengthByCardId = new Map<number, number | null>();

    constructor(
        private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>,
        private hand: Hand,
    ) {
    }

    /** `playerIdsInTableOrder` fixes each slot's physical side (blue's slot always first/left) — see Game.ts::getPlayerIdsInTableOrder(). */
    render(gameArea: HTMLElement, lanes: LaneCardData[], playerIdsInTableOrder: number[], attackerId: number): void {
        this.playerIdsInTableOrder = playerIdsInTableOrder;

        const slotsHtml = (lane: number) => playerIdsInTableOrder
            .map(playerId => `<div class="wott-lane-slot" id="wott-lane-slot-${lane}-${playerId}"></div>`)
            .join('<div class="wott-lane-arrow"><span class="wott-lane-arrow__right">➜</span><span class="wott-lane-arrow__left">➜</span></div>');

        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-lanes">
                <div class="wott-lane" data-lane="${LANE_OPEN}">${slotsHtml(LANE_OPEN)}</div>
                <div class="wott-lane" data-lane="${LANE_HIDDEN}">${slotsHtml(LANE_HIDDEN)}</div>
            </div>
        `);
        this.lanesElement = document.getElementById('wott-lanes')!;
        this.setAttacker(attackerId);

        // F5 mid-battle: place whatever is already in the lanes, no animation.
        lanes.forEach(card => this.createCardElement(card, this.slotFor(card)));
    }

    async notif_battleStarted(args: BattleStartedNotifArgs): Promise<void> {
        this.setAttacker(Number(args.player_id));
        this.clear();
    }

    private setAttacker(attackerId: number): void {
        const attacksLeft = attackerId !== this.playerIdsInTableOrder[0];
        this.lanesElement.querySelectorAll('.wott-lane-arrow').forEach(arrow => {
            arrow.classList.toggle('wott-lane-arrow--left', attacksLeft);
        });
    }

    async notif_cardsPlayed(args: CardsPlayedNotifArgs): Promise<void> {
        const playerId = Number(args.player_id);

        this.hand.onCardsPlayed(playerId, [args.faceUpCard.id, args.faceDownCard.id]);

        await Promise.all([
            this.playCard(args.faceUpCard),
            this.playCard(args.faceDownCard),
        ]);
    }

    async notif_cardsRevealed(args: CardsRevealedNotifArgs): Promise<void> {
        await Promise.all([
            this.revealCard(args.card1),
            this.revealCard(args.card2),
        ]);
    }

    // ── Tactics (PR5, RULES.md §6 ➍) ──────────────────────────────────────────

    async notif_tacticBlocked(args: TacticBlockedNotifArgs): Promise<void> {
        document.getElementById(`wott-card-${args.targetId}`)?.classList.add('wott-card--blocked');
        await this.flashTactic(args.cardId);
    }

    async notif_tacticLanesSwitched(args: TacticLanesSwitchedNotifArgs): Promise<void> {
        await this.flashTactic(args.cardId);
        await this.applyLanes(args.lanes);
    }

    async notif_tacticStrength(args: TacticStrengthNotifArgs): Promise<void> {
        this.setStrengths(args.strengths);
        await this.flashTactic(args.cardId);
    }

    async notif_tacticTieBreaker(args: TacticTieBreakerNotifArgs): Promise<void> {
        document.getElementById(`wott-card-${args.targetId}`)?.classList.add('wott-card--tie-breaker');
        await this.flashTactic(args.cardId);
    }

    async notif_tacticNoEffect(args: TacticNoEffectNotifArgs): Promise<void> {
        await this.flashTactic(args.cardId);
    }

    private setStrengths(strengthByCardId: { [cardId: number]: number | null }): void {
        Object.entries(strengthByCardId).forEach(([cardId, strength]) => {
            const badge = document.getElementById(`wott-card-strength-${cardId}`);
            if (!badge) {
                return;
            }

            const differsFromPrinted = strength !== null && strength !== this.printedStrengthByCardId.get(Number(cardId));
            badge.textContent = differsFromPrinted ? String(strength) : '';
            badge.classList.toggle('wott-card__strength--shown', differsFromPrinted);
        });
    }

    private async applyLanes(laneByCardId: { [cardId: number]: number }): Promise<void> {
        const moves: { element: HTMLElement, container: HTMLElement }[] = [];

        Object.entries(laneByCardId).forEach(([cardId, lane]) => {
            const element = document.getElementById(`wott-card-${cardId}`);
            const container = document.getElementById(`wott-lane-slot-${lane}-${element?.dataset.controller}`);
            if (element && container && element.parentElement !== container) {
                moves.push({ element, container });
            }
        });

        await slideAllIntoPlace(moves);
    }

    private async flashTactic(cardId: number): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }

        cardElement.classList.add('wott-card--tactic');
        await this.waitForAnimationEnd(cardElement);
        cardElement.classList.remove('wott-card--tactic');
    }

    /**
     * Places a just-played card into its lane slot. If the card still has a
     * DOM element in the acting player's own hand (never true for the
     * opponent — their hand is never rendered, hand.ts), reparents and
     * slides it via the same FLIP technique as hand.ts::animateReturnToDeck;
     * otherwise the card simply appears, already face-down if `facedown`.
     */
    private async playCard(card: LaneCardData): Promise<void> {
        const slot = this.slotFor(card);
        const existingElement = document.getElementById(`wott-card-${card.id}`);

        if (!existingElement) {
            this.createCardElement(card, slot);
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
            await flipCard(existingElement, true);
        }
        await slideIntoPlace(existingElement, slot);
    }

    async previewPlay(card: CardData, controller: number, faceDown: boolean): Promise<void> {
        const laneCard: LaneCardData = {
            ...card,
            controller,
            location: 'lane',
            locationArg: faceDown ? LANE_HIDDEN : LANE_OPEN,
            facedown: faceDown,
        };
        await this.playCard(laneCard);
    }

    async previewUnplay(cardId: number, wasFaceDown: boolean): Promise<void> {
        const cardElement = document.getElementById(`wott-card-${cardId}`);
        if (!cardElement) {
            return;
        }

        await slideIntoPlace(cardElement, this.hand.getElement());
        if (wasFaceDown) {
            await flipCard(cardElement, false);
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

    // Notifications::cardsRevealed() — the card is genuinely public now, so the strength badge finally gets its printed baseline.
    private async revealCard(card: CardData): Promise<void> {
        this.printedStrengthByCardId.set(card.id, card.strength);
        await revealCardFace(this.bga, card);
    }

    /** RULES.md §6 (end) — the lane empties between battles; PR4's real capture animation replaces this. */
    private clear(): void {
        this.lanesElement.querySelectorAll('.wott-lane-slot').forEach(slot => {
            slot.innerHTML = '';
        });
        this.printedStrengthByCardId.clear();
    }

    private slotFor(card: LaneCardData): HTMLElement {
        return document.getElementById(`wott-lane-slot-${card.locationArg}-${card.controller}`)!;
    }

    private createCardElement(card: LaneCardData, container: HTMLElement): HTMLElement {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`)!;
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);

        // A redacted card (no `name`) has nothing to show; revealCard fills it in later.
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card as CardData));
            this.printedStrengthByCardId.set(card.id, card.strength ?? null);
        }

        return cardElement;
    }

    private waitForAnimationEnd(element: HTMLElement): Promise<void> {
        return new Promise(resolve => {
            const handler = (event: AnimationEvent) => {
                if (event.target !== element) {
                    return;
                }
                element.removeEventListener('animationend', handler);
                clearTimeout(fallback);
                resolve();
            };
            const fallback = setTimeout(() => {
                element.removeEventListener('animationend', handler);
                resolve();
            }, ANIMATION_FALLBACK_MS);
            element.addEventListener('animationend', handler);
        });
    }
}
