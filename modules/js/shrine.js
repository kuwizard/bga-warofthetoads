import { tplLaneCard, tplCardTooltip, tplRetiredTooltip, tplShrineCard, tplShrineTooltip } from "./tpls.js";
import { hideCardFace, revealCardFace, slideAllIntoPlace, slideFromRects } from "./animations.js";
function hostageBeforeCaptor(a, b) {
    return a.locationArg - b.locationArg || Number(b.facedown) - Number(a.facedown);
}
const DECK_COLORS = ['blue', 'red'];
const RETIRED_SHOWN_FLAT = 3;
export class Shrine {
    constructor(bga, opponentHand) {
        this.bga = bga;
        this.opponentHand = opponentHand;
        this.stackColumns = {};
        this.stackRows = {};
    }
    render(gameArea, cards, playerIdsInTableOrder, angry) {
        this.cards = cards;
        this.firstPlayerId = playerIdsInTableOrder[0];
        const retiredDecksHtml = DECK_COLORS
            .map(deck => `
                <div class="wott-retired-deck" id="wott-retired-deck-${deck}">
                    <span class="wott-retired-deck-count" id="wott-retired-deck-count-${deck}">0</span>
                </div>
            `)
            .join('');
        const centerHtml = `
            <div class="wott-shrine-center">
                ${tplShrineCard()}
                <div class="wott-zone" id="wott-retired">
                    <span class="wott-zone__label">${_('Monks/Casualties')}</span>
                    <div class="wott-retired-cards" id="wott-retired-cards">${retiredDecksHtml}</div>
                </div>
            </div>
        `;
        const myIndex = playerIdsInTableOrder.indexOf(Number(this.bga.gameui.player_id));
        const myPlayerId = myIndex !== -1 ? playerIdsInTableOrder[myIndex] : playerIdsInTableOrder[0];
        const columnsHtml = playerIdsInTableOrder
            .map(playerId => `
                <div class="wott-stack-column" id="wott-stack-column-${playerId}">
                    <span class="wott-zone__label">${playerId === myPlayerId ? _('Hostages') : _("Opponent's Hostages")}</span>
                    <div class="wott-stack-row" id="wott-stack-row-${playerId}">
                        <span class="wott-stack-count" id="wott-stack-count-${playerId}">0</span>
                    </div>
                </div>
            `)
            .join(centerHtml);
        gameArea.insertAdjacentHTML('beforeend', `<div id="wott-shrine">${columnsHtml}</div>`);
        playerIdsInTableOrder.forEach(playerId => {
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`);
            this.stackRows[playerId] = document.getElementById(`wott-stack-row-${playerId}`);
        });
        this.retiredElement = document.getElementById('wott-retired-cards');
        this.retiredDecks = Object.fromEntries(DECK_COLORS.map(deck => [deck, document.getElementById(`wott-retired-deck-${deck}`)]));
        this.shrineCardElement = document.getElementById('wott-shrine-card');
        this.bga.gameui.addTooltipHtml('wott-shrine-card', tplShrineTooltip());
        this.bga.gameui.addTooltipHtml('wott-retired', tplRetiredTooltip());
        this.setMood(angry);
        const stackOwnerByStackId = {};
        cards.stacks.forEach(card => {
            if (!card.facedown) {
                stackOwnerByStackId[card.locationArg] = card.controller;
            }
        });
        [...cards.stacks]
            .sort(hostageBeforeCaptor)
            .forEach(card => this.placeStackCard(card, stackOwnerByStackId[card.locationArg]));
        cards.casualties.forEach(card => this.createCard(card, this.retiredDecks[card.deck], false));
        cards.shrine.forEach(card => this.createCard(card, this.retiredDecks[card.deck]));
        this.refreshRetiredDecks();
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }
    async notif_laneTied(args) {
        const tiedCards = [args.card1, args.card2];
        tiedCards.forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
        });
        this.refreshRetiredDecks();
        await this.moveCards(tiedCards.map(card => ({ card, container: this.retiredDecks[card.deck] })));
        this.refreshRetiredDecks();
    }
    async notif_hostageCaptured(args) {
        await this.captureStack(Number(args.winner.controller), args.winner, args.loser);
    }
    async notif_stackKept(args) {
        const playerId = Number(args.player_id);
        const retiredCards = this.cards.stacks
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
    async notif_casualtySet(args) {
        const playerId = Number(args.player_id);
        this.cards.casualties.push(args.card);
        this.refreshRetiredDecks();
        if (document.getElementById(`wott-card-${args.card.id}`)) {
            await this.moveCards([{ card: args.card, container: this.retiredDecks[args.card.deck] }]);
        }
        else {
            const [fromHandRect] = this.opponentHand.takeCardRects(playerId, 1, Number(args.handCounts[playerId]));
            await this.animateCasualtyIn(args.card, playerId, fromHandRect);
        }
        this.refreshRetiredDecks();
    }
    async notif_casualtyRevealed(args) {
        const index = this.cards.casualties.findIndex(casualty => casualty.id === args.card.id);
        if (index !== -1) {
            this.cards.casualties[index] = args.card;
        }
        await revealCardFace(this.bga, args.card);
    }
    notif_warStarted(_args) {
        this.cards.shrine.forEach(monk => document.getElementById(`wott-card-${monk.id}`)?.remove());
        this.cards.stacks = [];
        this.cards.shrine = [];
        document.querySelectorAll('#wott-shrine .wott-stack').forEach(element => element.remove());
        Object.keys(this.stackColumns).forEach(playerId => this.setStackCount(Number(playerId), 0));
        this.refreshRetiredDecks();
    }
    setMood(angry) {
        this.shrineCardElement.classList.toggle('wott-card-flip--flipped', Object.values(angry).some(isAngry => isAngry));
        this.shrineCardElement.classList.toggle('wott-shrine-card--rotated', this.isSoleAngry(this.firstPlayerId, angry));
        Object.entries(this.stackColumns).forEach(([playerId, column]) => {
            column.classList.toggle('wott-stack-column--angry', !!angry[Number(playerId)]);
        });
    }
    isSoleAngry(playerId, angry) {
        return !!angry[playerId] && Object.values(angry).filter(isAngry => isAngry).length === 1;
    }
    getMyPendingStackIds(playerId) {
        const stackIds = [...new Set(this.cards.stacks
                .filter(card => card.controller === playerId && !card.facedown)
                .map(card => card.locationArg))].sort((a, b) => a - b);
        return stackIds.slice(-2);
    }
    setStacksSelectable(stackIds, selectable, onClick) {
        stackIds.forEach(stackId => {
            const stackElement = document.getElementById(`wott-stack-${stackId}`);
            if (!stackElement) {
                return;
            }
            stackElement.classList.toggle('wott-selectable', selectable);
            stackElement.onclick = (selectable && onClick) ? () => onClick(stackId) : null;
        });
    }
    setSelectedStack(stackId) {
        document.querySelectorAll('.wott-stack.wott-card--selected').forEach(el => el.classList.remove('wott-card--selected'));
        if (stackId !== null) {
            document.getElementById(`wott-stack-${stackId}`)?.classList.add('wott-card--selected');
        }
    }
    async captureStack(controller, winner, loser) {
        this.removeFromLanes(loser.id);
        this.removeFromLanes(winner.id);
        this.cards.stacks.push(loser, winner);
        const stackElement = this.stackElementFor(winner.locationArg, controller);
        if (stackElement) {
            await this.moveCards([
                { card: loser, container: stackElement },
                { card: winner, container: stackElement },
            ]);
        }
        this.refreshStackCount(controller, this.cards.stacks);
    }
    async moveCards(entries) {
        await Promise.all(entries
            .filter(({ card }) => card.facedown)
            .map(({ card }) => hideCardFace(this.bga, card)));
        const moves = [];
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
    removeFromLanes(cardId) {
        const index = this.cards.lanes.findIndex(c => c.id === cardId);
        if (index !== -1) {
            this.cards.lanes.splice(index, 1);
        }
    }
    placeStackCard(card, stackOwnerId) {
        const stackElement = this.stackElementFor(card.locationArg, stackOwnerId);
        if (stackElement) {
            this.createCard(card, stackElement);
        }
    }
    stackElementFor(stackId, stackOwnerId) {
        const row = this.stackRows[stackOwnerId];
        if (!row) {
            return null;
        }
        let stackElement = document.getElementById(`wott-stack-${stackId}`);
        if (!stackElement) {
            row.insertAdjacentHTML('beforeend', `<div class="wott-stack" id="wott-stack-${stackId}"></div>`);
            stackElement = document.getElementById(`wott-stack-${stackId}`);
        }
        return stackElement;
    }
    async animateCasualtyIn(card, playerId, fromHandRect) {
        const fromRect = fromHandRect ?? document.getElementById(`wott-deck-anchor-${playerId}`)?.getBoundingClientRect();
        const cardElement = this.createCard(card, this.retiredDecks[card.deck]);
        if (fromRect) {
            await slideFromRects([{ element: cardElement, fromRect }]);
        }
    }
    refreshRetiredDecks() {
        const collapsed = DECK_COLORS.some(deck => this.retiredCountIncludingArriving(deck) > RETIRED_SHOWN_FLAT);
        this.retiredElement.classList.toggle('wott-retired-cards--collapsed', collapsed);
        DECK_COLORS.forEach(deck => {
            const retiredDeck = this.retiredDecks[deck];
            retiredDeck.classList.toggle('wott-retired-deck--collapsed', collapsed);
            document.getElementById(`wott-retired-deck-count-${deck}`).textContent = `${this.cardsLandedIn(retiredDeck)}`;
        });
    }
    cardsLandedIn(retiredDeck) {
        return retiredDeck.querySelectorAll('.wott-card-flip').length;
    }
    retiredCountIncludingArriving(deck) {
        return [...this.cards.casualties, ...this.cards.shrine].filter(card => card.deck === deck).length;
    }
    setStackCount(playerId, count) {
        const el = document.getElementById(`wott-stack-count-${playerId}`);
        if (el) {
            el.textContent = `${count}`;
        }
    }
    refreshStackCount(playerId, stacks) {
        const count = new Set(stacks.filter(c => c.controller === playerId && !c.facedown).map(c => c.locationArg)).size;
        this.setStackCount(playerId, count);
    }
    createCard(card, container, showAbilityTooltip = true) {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (showAbilityTooltip && card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        }
        return cardElement;
    }
}
