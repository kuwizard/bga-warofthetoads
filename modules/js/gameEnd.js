const winMessageByCondition = {
    secondWar: '${player_name} wins the game by winning the 2nd War',
    wonAndStalemate: '${player_name} wins the game by winning 1 War and stalemating the other',
    lowestCasualty: '${player_name} wins the game with the lowest Casualty',
};
const DRAW_MESSAGE = 'Both Casualties rank the same — the game is a draw';
export class GameEnd {
    constructor(bga) {
        this.bga = bga;
    }
    render(gameArea, players, playerIdsInTableOrder, summary) {
        this.players = players;
        this.playerIdsInTableOrder = playerIdsInTableOrder;
        gameArea.insertAdjacentHTML('afterbegin', `<div id="wott-game-end"></div>`);
        this.panelElement = document.getElementById('wott-game-end');
        if (summary) {
            this.show(summary);
        }
    }
    async notif_gameEnded(args) {
        this.show(args);
    }
    show(summary) {
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
    casualtyLabel(casualty) {
        if (!casualty) {
            return '—';
        }
        const strength = casualty.strength ?? null;
        return strength === null ? _(casualty.name) : `${_(casualty.name)} (${strength})`;
    }
    warRow(label, winnerId) {
        return this.row(label, playerId => {
            if (winnerId === null) {
                return _('Stalemate');
            }
            return Number(winnerId) === playerId ? _('Won') : '—';
        });
    }
    row(label, cellFor) {
        const cells = this.playerIdsInTableOrder.map(playerId => `<td>${cellFor(playerId)}</td>`).join('');
        return `<tr><th class="wott-game-end__label">${label}</th>${cells}</tr>`;
    }
    verdict(summary) {
        if (summary.winnerId === null) {
            return _(DRAW_MESSAGE);
        }
        return this.bga.gameui.format_string_recursive(_(winMessageByCondition[summary.condition]), {
            player_name: this.players[Number(summary.winnerId)].name,
        });
    }
}
