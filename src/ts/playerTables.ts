export class PlayerTables {
    private cards!: CardsUiData;
    private tablesElement!: HTMLElement;

    render(
        gameArea: HTMLElement,
        players: { [playerId: number]: WarOfTheToadsPlayer },
        cards: CardsUiData,
        deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' },
        playerIdsInTableOrder: number[],
        myPlayerId: number,
    ): void {
        this.cards = cards;

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
                        <div class="wott-card wott-card--${deckColor}-back"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${deckCount}</span>
                        <div class="wott-deck-anchor" id="wott-deck-anchor-${playerId}"></div>
                    </div>
                </div>
            `);
        });
    }

    adjustDeckCount(playerId: number, delta: number): void {
        this.cards.deckCounts[playerId] = (this.cards.deckCounts[playerId] ?? 0) + delta;

        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${this.cards.deckCounts[playerId]}`;
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
