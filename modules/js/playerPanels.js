import { guessableCardTypes } from "./tpls.js";
export class PlayerPanels {
    constructor(bga) {
        this.bga = bga;
    }
    render(playerIdsInTableOrder, angryByPlayerId) {
        playerIdsInTableOrder.forEach(playerId => {
            this.boardElement(playerId)?.classList.add('wott-player-panel');
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-mood" id="wott-mood-${playerId}"></div>
            `);
        });
        this.setMoods(angryByPlayerId);
    }
    notif_moodChanged(args) {
        this.setMoods(args.angry);
    }
    notif_tacticAngry(args) {
        this.setMoods(args.angry);
    }
    notif_siegeGuessed(args) {
        const strength = guessableCardTypes[args.cardType].strength;
        const cardLabel = strength === null ? _(args.cardName) : `${_(args.cardName)} (${strength})`;
        const text = args.hit
            ? _('Yes, I have ${card_name} in my hand').replace('${card_name}', cardLabel)
            : _('No, I don\'t have ${card_name} in my hand').replace('${card_name}', cardLabel);
        const bubbleId = `wott-speech-bubble-${args.player_id2}`;
        document.getElementById(bubbleId)?.remove();
        this.boardElement(args.player_id2)?.insertAdjacentHTML('beforeend', `
            <div class="wott-speech-bubble" id="${bubbleId}">${text}</div>
        `);
        setTimeout(() => document.getElementById(bubbleId)?.remove(), 4000);
    }
    boardElement(playerId) {
        return this.bga.playerPanels.getElement(playerId).closest('.player-board');
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
