import { slideFromRects } from "./animations.js";

export class PlayerTables {
    private cards!: CardsUiData;
    private tablesElement!: HTMLElement;
    private deckColorByPlayerId!: { [playerId: number]: 'blue' | 'red' };

    render(
        gameArea: HTMLElement,
        players: { [playerId: number]: WarOfTheToadsPlayer },
        cards: CardsUiData,
        deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' },
        playerIdsInTableOrder: number[],
        myPlayerId: number,
    ): void {
        this.cards = cards;
        this.deckColorByPlayerId = deckColorByPlayerId;

        gameArea.insertAdjacentHTML('beforeend', `<div id="player-tables"></div>`);
        this.tablesElement = document.getElementById('player-tables')!;

        playerIdsInTableOrder.forEach(playerId => {
            const player = players[playerId];
            const deckColor = deckColorByPlayerId[playerId];
            const deckCount = cards.deckCounts[playerId] ?? 0;
            const sideClass = playerId === myPlayerId ? 'wott-player-table--me' : 'wott-player-table--opponent';

            this.tablesElement.insertAdjacentHTML('beforeend', `
                <div id="player-table-${playerId}" class="wott-player-table ${sideClass}" style="--player-color: #${player.color}">
                    <h3 class="wott-player-name">${player.name}</h3>
                    <div class="wott-deck">
                        <div class="wott-card wott-card--${deckColor}-back" id="wott-deck-pile-${playerId}"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${deckCount}</span>
                        <div class="wott-deck-anchor" id="wott-deck-anchor-${playerId}"></div>
                    </div>
                </div>
            `);
        });
    }

    // RULES.md §9's deck swap: the piles only change colour in place, so each animates from where the *other* one stood.
    async notif_warStarted(args: WarStartedNotifArgs): Promise<void> {
        const piles = Object.keys(args.deckColors)
            .map(playerId => document.getElementById(`wott-deck-pile-${playerId}`))
            .filter((pile): pile is HTMLElement => pile !== null);
        const rects = piles.map(pile => pile.getBoundingClientRect());

        Object.entries(args.deckColors).forEach(([playerId, deckColor]) => {
            const pile = document.getElementById(`wott-deck-pile-${playerId}`);
            pile?.classList.remove(`wott-card--${this.deckColorByPlayerId[Number(playerId)]}-back`);
            pile?.classList.add(`wott-card--${deckColor}-back`);
            this.deckColorByPlayerId[Number(playerId)] = deckColor;
        });

        Object.entries(args.deckCounts).forEach(([playerId, count]) => {
            this.setDeckCount(Number(playerId), Number(count));
        });

        const decks = piles.map(pile => pile.parentElement).filter((deck): deck is HTMLElement => deck !== null);
        decks.forEach(deck => deck.classList.add('wott-deck--swapping'));

        await slideFromRects(piles.map((pile, index) => ({
            element: pile,
            fromRect: rects[piles.length - 1 - index],
        })));

        decks.forEach(deck => deck.classList.remove('wott-deck--swapping'));
    }

    adjustDeckCount(playerId: number, delta: number): void {
        this.setDeckCount(playerId, (this.cards.deckCounts[playerId] ?? 0) + delta);
    }

    private setDeckCount(playerId: number, count: number): void {
        this.cards.deckCounts[playerId] = count;

        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${count}`;
        }
    }

    getDeckAnchor(playerId: number): HTMLElement | null {
        return document.getElementById(`wott-deck-anchor-${playerId}`);
    }

    setLayout(stacked: boolean, handOnTop: boolean): void {
        this.tablesElement.classList.toggle('wott-player-tables--stacked', stacked);
        this.tablesElement.classList.toggle('wott-player-tables--hand-top', stacked && handOnTop);
        this.tablesElement.classList.toggle('wott-player-tables--hand-bottom', stacked && !handOnTop);
    }
}
