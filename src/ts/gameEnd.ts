// RULES.md §10's outcome, fed either by Notifications::gameEnded() or — after an F5 at the finished table — by `gamedatas.gameEnd`; States/ComputeScores::summary() produces both.

const winMessageByCondition: { [condition: string]: string } = {
    secondWar: '${player_name} wins the game by winning the 2nd War',
    wonAndStalemate: '${player_name} wins the game by winning 1 War and stalemating the other',
    lowestCasualty: '${player_name} wins the game with the lowest Casualty',
};

const DRAW_MESSAGE = 'Both Casualties rank the same — the game is a draw';

export class GameEnd {
    private panelElement!: HTMLElement;
    private players!: { [playerId: number]: WarOfTheToadsPlayer };
    private playerIdsInTableOrder!: number[];

    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(
        gameArea: HTMLElement,
        players: { [playerId: number]: WarOfTheToadsPlayer },
        playerIdsInTableOrder: number[],
        summary: GameEndSummary | null,
    ): void {
        this.players = players;
        this.playerIdsInTableOrder = playerIdsInTableOrder;

        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-game-end"></div>`);
        this.panelElement = document.getElementById('wott-game-end')!;

        if (summary) {
            this.show(summary);
        }
    }

    async notif_gameEnded(args: GameEndedNotifArgs): Promise<void> {
        this.show(args);
    }

    private show(summary: GameEndSummary): void {
        const headerCells = this.playerIdsInTableOrder
            .map(playerId => `<th style="color:#${this.players[playerId].color}">${this.players[playerId].name}</th>`)
            .join('');

        const rows = [
            this.warRow(_('1st War'), summary.wars[1]),
            this.warRow(_('2nd War'), summary.wars[2]),
            this.row(_('Casualty'), playerId => this.casualtyLabel(summary.casualties[playerId])),
            this.row(_('Score'), playerId => String(summary.scores[playerId])),
        ].join('');

        this.panelElement.innerHTML = `
            <h3 class="wott-game-end__title">${_('End of the game')}</h3>
            <table class="wott-game-end__table">
                <tr><th></th>${headerCells}</tr>
                ${rows}
            </table>
            <p class="wott-game-end__verdict">${this.verdict(summary)}</p>
        `;
    }

    // The Siege Cannon prints no Strength, and showing nothing is the honest rendering — a "(0)" beside an Assassin's "(1)" would read as the lower Casualty, the exact inverse of [H3].
    private casualtyLabel(casualty: CardData | null): string {
        if (!casualty) {
            return '—';
        }

        const strength = casualty.strength ?? null;
        return strength === null ? _(casualty.name) : `${_(casualty.name)} (${strength})`;
    }

    private warRow(label: string, winnerId: number | null): string {
        return this.row(label, playerId => {
            if (winnerId === null) {
                return _('Stalemate');
            }
            return Number(winnerId) === playerId ? _('Won') : '—';
        });
    }

    private row(label: string, cellFor: (playerId: number) => string): string {
        const cells = this.playerIdsInTableOrder.map(playerId => `<td>${cellFor(playerId)}</td>`).join('');
        return `<tr><th class="wott-game-end__label">${label}</th>${cells}</tr>`;
    }

    private verdict(summary: GameEndSummary): string {
        if (summary.winnerId === null) {
            return _(DRAW_MESSAGE);
        }

        return this.bga.gameui.format_string_recursive(_(winMessageByCondition[summary.condition]), {
            player_name: this.players[Number(summary.winnerId)].name,
        });
    }
}
