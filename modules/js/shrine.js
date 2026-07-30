import { tplLaneCard, tplCardTooltip } from "./tpls.js";
export class Shrine {
    constructor(bga) {
        this.bga = bga;
        this.stackColumns = {};
    }
    render(gameArea, cards, deckColorByPlayerId, playerIdsInTableOrder) {
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
        cards.shrine.forEach(card => this.placeMonk(card, deckColorByPlayerId[card.controller]));
        playerIdsInTableOrder.forEach(playerId => this.refreshStackCount(playerId, cards.stacks));
    }
    onLaneTied(args) {
        [args.card1, args.card2].forEach(card => {
            this.removeFromLanes(card.id);
            this.cards.shrine.push(card);
            this.placeMonk(card, this.deckColorByPlayerId[card.controller]);
        });
    }
    onHostageCaptured(args) {
        this.captureStacks(Number(args.winner.controller), [args.winner], [args.loser]);
    }
    onLeapFrog(args) {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }
    onDoubleWinCalm(args) {
        this.captureStacks(Number(args.player_id), args.winners, args.losers);
    }
    onStackKept(args) {
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
        this.placeCard(card, stackElement, this.deckColorByPlayerId[card.controller]);
    }
    placeMonk(card, deckColor) {
        this.placeCard(card, this.monksElement, deckColor);
    }
    retireStack(stackId, declinedCards) {
        declinedCards.forEach(card => {
            const stub = {
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
    placeCard(card, container, deckColor) {
        const existingElement = document.getElementById(`wott-card-${card.id}`);
        if (existingElement && card.facedown) {
            existingElement.remove();
        }
        else if (existingElement) {
            container.appendChild(existingElement);
            existingElement.classList.remove('wott-selectable', 'wott-card--selected');
            return existingElement;
        }
        container.insertAdjacentHTML('beforeend', tplLaneCard(card, deckColor));
        const cardElement = document.getElementById(`wott-card-${card.id}`);
        cardElement.classList.toggle('wott-card-flip--flipped', card.facedown);
        if (card.name !== undefined) {
            this.bga.gameui.addTooltipHtml(`wott-card-${card.id}`, tplCardTooltip(card));
        }
        return cardElement;
    }
}
