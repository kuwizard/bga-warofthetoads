import { slideFromRects, slideIntoPlace } from "./animations.js";
import { animDur, delay } from "./common.js";
const DEAL_STAGGER_MS = 144;
function deckAnchorFor(playerId) {
    return document.getElementById(`wott-deck-anchor-${playerId}`);
}
export class OpponentHand {
    constructor() {
        this.playerIds = [];
        this.shown = true;
    }
    render(gameArea, playerIds, cards, deckColorByPlayerId) {
        this.gameArea = gameArea;
        this.playerIds = playerIds;
        this.deckColorByPlayerId = deckColorByPlayerId;
        playerIds.forEach(playerId => {
            gameArea.insertAdjacentHTML('beforeend', `<div class="wott-opponent-hand" id="wott-opponent-hand-${playerId}"></div>`);
            this.setCount(playerId, Number(cards.handCounts[playerId] ?? 0));
        });
    }
    setShown(shown) {
        this.shown = shown;
        this.playerIds.forEach(playerId => this.rowFor(playerId)?.classList.toggle('wott-opponent-hand--hidden', !shown));
    }
    setPositions(positionByPlayerId) {
        this.playerIds.forEach(playerId => {
            const row = this.rowFor(playerId);
            if (!row) {
                return;
            }
            if (positionByPlayerId[playerId] === 'top') {
                this.gameArea.prepend(row);
            }
            else {
                this.gameArea.append(row);
            }
        });
    }
    async notif_cardsDrawn(args) {
        await this.dealFromDeck(Number(args.player_id), args.handCounts);
    }
    async notif_cardReturnUndone(args) {
        await this.dealFromDeck(Number(args.player_id), args.handCounts);
    }
    async notif_cardReturned(args) {
        const playerId = Number(args.player_id);
        const row = this.rowFor(playerId);
        if (!row) {
            return;
        }
        this.setCount(playerId, Number(args.handCounts[playerId]) + 1);
        const back = row.lastElementChild;
        const deckAnchor = deckAnchorFor(playerId);
        if (!back) {
            return;
        }
        if (deckAnchor && this.shown) {
            await slideIntoPlace(back, deckAnchor);
        }
        back.remove();
    }
    notif_warStarted(args) {
        this.deckColorByPlayerId = args.deckColors;
        this.playerIds.forEach(playerId => this.rowFor(playerId)?.querySelectorAll('.wott-card')
            .forEach(back => back.className = this.backClass(playerId)));
    }
    takeCardRects(playerId, count, handCountAfter) {
        const row = this.rowFor(playerId);
        if (!row) {
            return [];
        }
        this.setCount(playerId, handCountAfter + count);
        const backs = Array.from(row.children).slice(-count);
        const rects = backs.map(back => this.liftRect(playerId, back));
        backs.forEach(back => back.remove());
        return rects;
    }
    liftRect(playerId, back) {
        return this.shown ? back.getBoundingClientRect() : deckAnchorFor(playerId)?.getBoundingClientRect();
    }
    setCount(playerId, count) {
        const row = this.rowFor(playerId);
        if (!row || !Number.isFinite(count)) {
            return;
        }
        while (row.childElementCount > count) {
            row.lastElementChild.remove();
        }
        while (row.childElementCount < count) {
            this.createBack(playerId, row);
        }
    }
    async dealFromDeck(playerId, handCounts) {
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
    async animateFromDeck(playerId, deckAnchor) {
        const back = this.createBack(playerId, deckAnchor);
        const fromRect = back.getBoundingClientRect();
        this.rowFor(playerId).appendChild(back);
        await slideFromRects([{ element: back, fromRect }]);
    }
    createBack(playerId, container) {
        container.insertAdjacentHTML('beforeend', `<div class="${this.backClass(playerId)}"></div>`);
        return container.lastElementChild;
    }
    backClass(playerId) {
        return `wott-card wott-card--${this.deckColorByPlayerId[playerId]}-back`;
    }
    rowFor(playerId) {
        return document.getElementById(`wott-opponent-hand-${playerId}`);
    }
}
