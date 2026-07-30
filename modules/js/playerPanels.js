export class PlayerPanels {
    constructor(bga) {
        this.bga = bga;
    }
    render(playerIdsInTableOrder, angryByPlayerId) {
        playerIdsInTableOrder.forEach(playerId => {
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-mood" id="wott-mood-${playerId}"></div>
            `);
        });
        this.setMoods(angryByPlayerId);
    }
    onMoodChanged(args) {
        this.setMoods(args.angry);
    }
    setMoods(angryByPlayerId) {
        Object.entries(angryByPlayerId).forEach(([playerId, angry]) => {
            const element = document.getElementById(`wott-mood-${playerId}`);
            if (!element) {
                return;
            }
            element.textContent = angry ? _('Angry') : _('Calm');
            element.classList.toggle('wott-mood--angry', angry);
        });
    }
}
