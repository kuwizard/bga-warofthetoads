// Calm/Angry (RULES.md §7) is never derived here: [H4] pins when it is evaluated and [H15]'s Berserker Angry is not a function of hostage counts at all, so the value only ever arrives from the server.
import { guessableCardTypes } from "./tpls.js";
import { Shrine } from "./shrine.js";
import { slideFromRects } from "./animations.js";
import { animDur } from "./common.js";

const SPEECH_BUBBLE_MS = 4000;
const SPEECH_BUBBLE_MIN_MS = 1200;

export class PlayerPanels {
    private cards!: CardsUiData;
    private deckColorByPlayerId!: { [playerId: number]: 'blue' | 'red' };

    constructor(
        private bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>,
        private shrine: Shrine,
    ) {
    }

    render(
        playerIdsInTableOrder: number[],
        angryByPlayerId: AngryByPlayerId,
        cards: CardsUiData,
        deckColorByPlayerId: { [playerId: number]: 'blue' | 'red' },
    ): void {
        this.cards = cards;
        this.deckColorByPlayerId = deckColorByPlayerId;

        playerIdsInTableOrder.forEach(playerId => {
            this.boardElement(playerId)?.classList.add('wott-player-panel');
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <div class="wott-panel-row">
                    <div class="wott-deck">
                        <div class="wott-card wott-card--${deckColorByPlayerId[playerId]}-back" id="wott-deck-pile-${playerId}"></div>
                        <span class="wott-deck-count" id="wott-deck-count-${playerId}">${cards.deckCounts[playerId] ?? 0}</span>
                        <div class="wott-deck-anchor" id="wott-deck-anchor-${playerId}"></div>
                    </div>
                    <div class="wott-mood" id="wott-mood-${playerId}"></div>
                </div>
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

    // RULES.md §9's deck swap: the piles only change colour in place, so each animates from where the *other* one stood.
    async notif_warStarted(args: WarStartedNotifArgs): Promise<void> {
        this.applyPlayerColors(args.playerColors);

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
        setTimeout(() => document.getElementById(bubbleId)?.remove(), Math.max(SPEECH_BUBBLE_MIN_MS, animDur(SPEECH_BUBBLE_MS)));
    }

    // PHP swapped player_color with the decks (Players::applyDeckColors); this is the same swap on the loaded page.
    private applyPlayerColors(colorByPlayerId: { [playerId: number]: string }): void {
        Object.entries(colorByPlayerId).forEach(([id, color]) => {
            const player = this.bga.players.getPlayerById(Number(id));
            const previousColor = player?.color;
            if (!previousColor || previousColor === color) {
                return;
            }

            player.color = color;
            this.repaintPanel(Number(id), previousColor, color);
        });
    }

    // BGA writes the colour into inline styles all over its own panel and never re-reads it, so the old hex is swapped wherever it sits.
    private repaintPanel(playerId: number, previousColor: string, color: string): void {
        const panel = this.boardElement(playerId);
        if (!panel) {
            return;
        }

        const previousHex = new RegExp(previousColor, 'gi');
        [panel, ...Array.from(panel.querySelectorAll<HTMLElement>('[style]'))].forEach(element => {
            const style = element.getAttribute('style');
            if (style?.match(previousHex)) {
                element.setAttribute('style', style.replace(previousHex, color));
            }
        });
    }

    adjustDeckCount(playerId: number, delta: number): void {
        this.setDeckCount(playerId, (this.cards.deckCounts[playerId] ?? 0) + delta);
    }

    getDeckAnchor(playerId: number): HTMLElement | null {
        return document.getElementById(`wott-deck-anchor-${playerId}`);
    }

    private setDeckCount(playerId: number, count: number): void {
        this.cards.deckCounts[playerId] = count;

        const deckCountElement = document.getElementById(`wott-deck-count-${playerId}`);
        if (deckCountElement) {
            deckCountElement.textContent = `${count}`;
        }
    }

    // The framework's whole playerboard — getElement() only returns the small game-content div inside it.
    private boardElement(playerId: number): HTMLElement | null {
        return this.bga.playerPanels.getElement(playerId).closest('.player-board') as HTMLElement | null;
    }

    private setMoods(angryByPlayerId: AngryByPlayerId): void {
        this.shrine.setMood(angryByPlayerId);

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
