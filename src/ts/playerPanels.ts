/**
 * Game-specific content in the BGA player panels. Currently just RULES.md
 * §7's Calm/Angry as a word under each player's name — a stand-in: physically
 * the Shrine displays this by being flipped/rotated, which `shrine.ts` does
 * not render yet.
 *
 * Never derived here. The comparison is trivial (Cards::isAngry()), but [H4]
 * pins *when* it is evaluated and [H15]'s Berserker Angry isn't a function of
 * hostage counts at all — so the value only ever comes from the server, via
 * `gamedatas.angry` and `Notifications::moodChanged()`.
 */
import { guessableCardTypes } from "./tpls.js";

export class PlayerPanels {
    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(playerIdsInTableOrder: number[], angryByPlayerId: AngryByPlayerId): void {
        playerIdsInTableOrder.forEach(playerId => {
            this.boardElement(playerId)?.classList.add('wott-player-panel');
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-mood" id="wott-mood-${playerId}"></div>
            `);
        });

        this.setMoods(angryByPlayerId);
    }

    /** Notifications::moodChanged() — both players' state, once per Battle. */
    notif_moodChanged(args: MoodChangedNotifArgs): void {
        this.setMoods(args.angry);
    }

    // [H15] BattleEnd's own moodChanged reverts this — nothing persists the override.
    notif_tacticAngry(args: TacticAngryNotifArgs): void {
        this.setMoods(args.angry);
    }

    // The answering player's panel "says" the Siege Cannon result aloud.
    notif_siegeGuessed(args: SiegeGuessedNotifArgs): void {
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

    // The framework's whole playerboard — getElement() only returns the small game-content div inside it.
    private boardElement(playerId: number): HTMLElement | null {
        return this.bga.playerPanels.getElement(playerId).closest('.player-board') as HTMLElement | null;
    }

    private setMoods(angryByPlayerId: AngryByPlayerId): void {
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
