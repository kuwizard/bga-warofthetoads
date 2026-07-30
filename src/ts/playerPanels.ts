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
export class PlayerPanels {
    constructor(private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>) {
    }

    render(playerIdsInTableOrder: number[], angryByPlayerId: AngryByPlayerId): void {
        playerIdsInTableOrder.forEach(playerId => {
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-mood" id="wott-mood-${playerId}"></div>
            `);
        });

        this.setMoods(angryByPlayerId);
    }

    /** Notifications::moodChanged() — both players' state, once per Battle. */
    onMoodChanged(args: MoodChangedNotifArgs): void {
        this.setMoods(args.angry);
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
