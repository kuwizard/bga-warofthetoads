import { tplLaneCard, tplCardTooltip } from "./tpls.js";
import { revealCardFace } from "./animations.js";
export class Shrine {
    constructor(bga) {
        this.bga = bga;
        this.stackColumns = {};
    }
    render(gameArea, cards, playerIdsInTableOrder) {
        this.cards = cards;
        const columnsHtml = playerIdsInTableOrder
            .map(playerId => `
                <div class="wott-stack-column" id="wott-stack-column-${playerId}">
                    <span class="wott-stack-count" id="wott-stack-count-${playerId}">0</span>
                </div>
            `)
            .join('');
        const casualtySlotsHtml = playerIdsInTableOrder
            .map(playerId => `<div class="wott-casualty-slot" id="wott-casualty-slot-${playerId}"></div>`)
            .join('');
        gameArea.insertAdjacentHTML('beforeend', `
            <div id="wott-shrine">
                ${columnsHtml}
                <div class="wott-monks" id="wott-monks"></div>
                <div class="wott-casualties" id="wott-casualties">${casualtySlotsHtml}</div>
            </div>
        `);
        playerIdsInTableOrder.forEach(playerId => {
            this.stackColumns[playerId] = document.getElementById(`wott-stack-column-${playerId}`);
        });
        this.monksElement = document.getElementById('wott-monks');
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
    notif_laneTied(args) {
        [args.card1, args.card2].forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
            this.placeMonk(card);
        });
    }
    notif_hostageCaptured(args) {
        this.captureStacks(Number(args.winner.controller), [args.winner], [args.loser]);
    }
    notif_leapFrog(args) {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }
    notif_doubleWinCalm(args) {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }
    notif_stackKept(args) {
        const playerId = Number(args.player_id);
        const declinedCards = this.cards.stacks.filter(card => card.locationArg === args.declinedStackId);
        declinedCards.forEach(card => {
            this.cards.shrine.push({
                id: card.id,
                controller: card.controller,
                location: 'shrine',
                locationArg: 0,
                facedown: true,
                deck: card.deck,
            });
        });
        this.cards.stacks = this.cards.stacks.filter(card => card.locationArg !== args.declinedStackId);
        this.retireStack(args.declinedStackId, declinedCards);
        this.refreshStackCount(playerId, this.cards.stacks);
    }
    notif_casualtySet(args) {
        if (args.card.type !== undefined) {
            return;
        }
        this.cards.casualties.push(args.card);
        this.placeCasualty(args.card);
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
    captureStacks(controller, winners, losers) {
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
    removeFromLanes(cardId) {
        const index = this.cards.lanes.findIndex(c => c.id === cardId);
        if (index !== -1) {
            this.cards.lanes.splice(index, 1);
        }
    }
    placeStackCard(card, stackOwnerId) {
        const column = this.stackColumns[stackOwnerId];
        if (!column) {
            return;
        }
        let stackElement = document.getElementById(`wott-stack-${card.locationArg}`);
        if (!stackElement) {
            column.insertAdjacentHTML('beforeend', `<div class="wott-stack" id="wott-stack-${card.locationArg}"></div>`);
            stackElement = document.getElementById(`wott-stack-${card.locationArg}`);
        }
        this.placeCard(card, stackElement);
    }
    placeMonk(card) {
        this.placeCard(card, this.monksElement);
    }
    placeCasualty(card) {
        const slot = document.getElementById(`wott-casualty-slot-${card.controller}`);
        if (slot) {
            this.placeCard(card, slot);
        }
    }
    retireStack(stackId, declinedCards) {
        declinedCards.forEach(card => {
            const stub = {
                id: card.id,
                controller: card.controller,
                location: 'shrine',
                locationArg: 0,
                facedown: true,
                deck: card.deck,
            };
            this.placeMonk(stub);
        });
        document.getElementById(`wott-stack-${stackId}`)?.remove();
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
    placeCard(card, container) {
        const existingElement = document.getElementById(`wott-card-${card.id}`);
        if (existingElement && card.facedown) {
            existingElement.remove();
        }
        else if (existingElement) {
            container.appendChild(existingElement);
            existingElement.classList.remove('wott-selectable', 'wott-card--selected', 'wott-card--blocked', 'wott-card--tie-breaker');
            existingElement.querySelector('.wott-card__strength')?.remove();
            return existingElement;
        }
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, card.deck));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        }
        return cardElement;
    }
}
