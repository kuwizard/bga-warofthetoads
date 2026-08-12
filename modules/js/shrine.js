import { tplLaneCard, tplCardTooltip, tplShrineCard, tplShrineTooltip } from "./tpls.js";
import { hideCardFace, revealCardFace, slideAllIntoPlace, slideFromRects } from "./animations.js";
export class Shrine {
    constructor(bga) {
        this.bga = bga;
        this.stackColumns = {};
    }
    render(gameArea, cards, playerIdsInTableOrder, angry) {
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
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`);
        });
        this.monksElement = document.getElementById('wott-monks');
        this.casualtiesZoneElement = document.getElementById('wott-casualties-zone');
        this.casualtiesZoneElement.classList.toggle('wott-zone--hidden', cards.casualties.length === 0);
        this.shrineCardElement = document.getElementById('wott-shrine-card');
        this.bga.gameui.addTooltipHtml('wott-shrine-card', tplShrineTooltip());
        this.setMood(angry);
        const stackOwnerByStackId = {};
        cards.stacks.forEach(card => {
            if (!card.facedown) {
                stackOwnerByStackId[card.locationArg] = card.controller;
            }
        });
        [...cards.stacks]
            .sort((a, b) => a.locationArg - b.locationArg || Number(b.facedown) - Number(a.facedown))
            .forEach(card => this.placeStackCard(card, stackOwnerByStackId[card.locationArg]));
        cards.shrine.forEach(card => this.placeMonk(card));
        cards.casualties.forEach(card => this.placeCasualty(card));
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }
    async notif_laneTied(args) {
        const tiedCards = [args.card1, args.card2];
        tiedCards.forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
        });
        await this.moveCards(tiedCards.map(card => ({ card, container: this.monksElement })));
    }
    async notif_hostageCaptured(args) {
        await this.captureStacks(Number(args.winner.controller), [args.winner], [args.loser]);
    }
    async notif_leapFrog(args) {
        await this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }
    async notif_doubleWinCalm(args) {
        await this.captureStacks(Number(args.player_id), args.winners, args.losers);
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
        await this.moveCards(retiredCards.map(card => ({ card, container: this.monksElement })));
        document.getElementById(`wott-stack-${args.declinedStackId}`)?.remove();
        this.refreshStackCount(playerId, this.cards.stacks);
    }
    async notif_casualtySet(args) {
        this.casualtiesZoneElement.classList.remove('wott-zone--hidden');
        if (args.card.type !== undefined) {
            return;
        }
        this.cards.casualties.push(args.card);
        await this.animateCasualtyIn(args.card, Number(args.player_id));
    }
    async notif_casualtyRevealed(args) {
        const index = this.cards.casualties.findIndex(casualty => casualty.id === args.card.id);
        if (index !== -1) {
            this.cards.casualties[index] = args.card;
        }
        await revealCardFace(this.bga, args.card);
    }
    notif_warStarted(_args) {
        this.cards.stacks = [];
        this.cards.shrine = [];
        document.querySelectorAll('#wott-shrine .wott-stack').forEach(element => element.remove());
        this.monksElement.innerHTML = '';
        Object.keys(this.stackColumns).forEach(playerId => this.setStackCount(Number(playerId), 0));
        this.casualtiesZoneElement.classList.remove('wott-zone--hidden');
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
    async captureStacks(controller, winners, losers) {
        const entries = [];
        winners.forEach((winner, i) => {
            const loser = losers[i];
            this.removeFromLanes(loser.id);
            this.removeFromLanes(winner.id);
            this.cards.stacks.push(loser, winner);
            const stackElement = this.stackElementFor(winner.locationArg, controller);
            if (stackElement) {
                entries.push({ card: loser, container: stackElement }, { card: winner, container: stackElement });
            }
        });
        await this.moveCards(entries);
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
        const column = this.stackColumns[stackOwnerId];
        if (!column) {
            return null;
        }
        let stackElement = document.getElementById(`wott-stack-${stackId}`);
        if (!stackElement) {
            column.insertAdjacentHTML('beforeend', `<div class="wott-stack" id="wott-stack-${stackId}"></div>`);
            stackElement = document.getElementById(`wott-stack-${stackId}`);
        }
        return stackElement;
    }
    placeMonk(card) {
        this.createCard(card, this.monksElement);
    }
    placeCasualty(card) {
        const slot = document.getElementById(`wott-casualty-slot-${card.controller}`);
        if (slot) {
            this.createCard(card, slot);
        }
    }
    async animateCasualtyIn(card, playerId) {
        const slot = document.getElementById(`wott-casualty-slot-${playerId}`);
        if (!slot) {
            return;
        }
        const anchor = document.getElementById(`wott-deck-anchor-${playerId}`);
        if (!anchor) {
            this.createCard(card, slot);
            return;
        }
        const cardElement = this.createCard(card, anchor);
        const fromRect = cardElement.getBoundingClientRect();
        slot.appendChild(cardElement);
        await slideFromRects([{ element: cardElement, fromRect }]);
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
    createCard(card, container) {
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        }
        return cardElement;
    }
}
