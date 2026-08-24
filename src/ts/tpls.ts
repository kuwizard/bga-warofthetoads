// HTML template strings, kept out of Game.ts / hand.ts per project convention.

/** `card_type` (DB value, underscores) → sprite role class suffix (hyphens). See src/scss/cards.scss. */
export function cardRoleSlug(cardType: string): string {
    return cardType.replace(/_/g, '-');
}

function specialAttributeLabels(): { [code: string]: string } {
    return {
        beats_general: _('Wins against General'),
        beats_siege: _('Wins against Siege Cannon'),
        loses_to_assassin: _('Loses against Assassin'),
        siege: _('Loses in Defence, wins in Attack — except against Saboteur'),
    };
}

function bandLabels(): { [code: string]: string } {
    return {
        start: _('Start of Battle'),
        during: _('During Battle'),
        after: _('After Battle'),
    };
}

// Two-sided (see src/scss/hand.scss's .wott-card-flip) so a returned card can
// flip face-down before sliding into the deck, and back when undone.
export function tplHandCard(card: CardData): string {
    return `
        <div class="wott-card-flip" id="wott-card-${card.id}" data-card-id="${card.id}">
            <div class="wott-card-flip__inner">
                <div class="wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${cardRoleSlug(card.type)}"></div>
                <div class="wott-card wott-card-flip__face wott-card-flip__face--back wott-card--${card.deck}-back"></div>
            </div>
        </div>
    `;
}

export function tplLaneCard(card: LaneCardData, deckColor: 'blue' | 'red'): string {
    // A missing colour would silently fall through to the sprite's 0% 0% cell — a blue Assassin.
    if (deckColor !== 'blue' && deckColor !== 'red') {
        console.error('wott: card has no deck colour', card);
    }

    const frontClass = card.type ? `wott-card--${deckColor}-${cardRoleSlug(card.type)}` : `wott-card--${deckColor}-back`;

    return `
        <div class="wott-card-flip" id="wott-card-${card.id}" data-card-id="${card.id}" data-controller="${card.controller}">
            <div class="wott-card-flip__inner">
                <div class="wott-card wott-card-flip__face wott-card-flip__face--front ${frontClass}"></div>
                <div class="wott-card wott-card-flip__face wott-card-flip__face--back wott-card--${deckColor}-back"></div>
            </div>
            <div class="wott-card__strength" id="wott-card-strength-${card.id}"></div>
        </div>
    `;
}

// RULES.md §7's physical tracker. Front = both Calm, back = one Calm / one Angry — shrine.ts flips and rotates it exactly as the rules say to.
export function tplShrineCard(): string {
    return `
        <div class="wott-card-flip wott-shrine-card" id="wott-shrine-card">
            <div class="wott-card-flip__inner">
                <div class="wott-card wott-card-flip__face wott-card-flip__face--front wott-card--shrine-front"></div>
                <div class="wott-card wott-card-flip__face wott-card-flip__face--back wott-card--shrine-back"></div>
            </div>
        </div>
    `;
}

export function tplShrineTooltip(): string {
    return `
        <div class="wott-card-tooltip">
            <div class="wott-card-tooltip__text">
                <strong class="wott-card-tooltip__name">${_('The Shrine')}</strong>
                <div class="wott-card-tooltip__description">${_('You are Angry if you currently have fewer Hostages than your opponent.')}</div>
                <div class="wott-card-tooltip__description">${_('Calm, winning both lanes captures 1 Hostage stack and retires the other. Angry, winning both lanes captures both.')}</div>
                <div class="wott-card-tooltip__description">${_('The end facing you states your own mood.')}</div>
            </div>
        </div>
    `;
}

// Monks and Casualties share one pile (shrine.ts), so the two labels they used to carry live here instead.
export function tplRetiredTooltip(): string {
    return `
        <div class="wott-card-tooltip">
            <div class="wott-card-tooltip__text">
                <strong class="wott-card-tooltip__name">${_('Monks/Casualties')}</strong>
                <div class="wott-card-tooltip__description">${_('Monks are cards retired from a tied lane or from a declined stack. They do not count towards scoring.')}</div>
                <div class="wott-card-tooltip__description">${_('The Casualties are the cards left in hand when the 1st War ended. They stay face-down until the game ends.')}</div>
            </div>
        </div>
    `;
}

/** Shown via `bga.gameui.addTooltipHtml` on hover — see hand.ts. */
export function tplCardTooltip(card: CardData): string {
    const specialAttributeLabel = card.specialAttribute ? specialAttributeLabels()[card.specialAttribute] : null;
    const bandLabel = bandLabels()[card.band];

    return `
        <div class="wott-card-tooltip">
            <div class="wott-card wott-card--${card.deck}-${cardRoleSlug(card.type)} wott-card-tooltip__image"></div>
            <div class="wott-card-tooltip__text">
                <strong class="wott-card-tooltip__name">${_(card.name)}</strong>
                ${card.strength !== null ? `<div class="wott-card-tooltip__strength">${_('Strength')} ${card.strength}</div>` : ''}
                ${specialAttributeLabel ? `<div class="wott-card-tooltip__special">${specialAttributeLabel}</div>` : ''}
                ${bandLabel ? `<div class="wott-card-tooltip__band">${bandLabel}</div>` : ''}
                <div class="wott-card-tooltip__description">${_(card.description)}</div>
            </div>
        </div>
    `;
}

// The 8 guessable faces for SiegeGuess, in printed-Strength order — both Generals share the printed name "General" ([H17]); Siege Cannon has no printed Strength.
export const guessableCardTypes: { [type: string]: { label: string; strength: number | null } } = {
    assassin: { label: 'Assassin', strength: 1 },
    scout: { label: 'Scout', strength: 2 },
    saboteur: { label: 'Saboteur', strength: 3 },
    trickster: { label: 'Trickster', strength: 4 },
    berserker: { label: 'Berserker', strength: 5 },
    bodyguard: { label: 'Bodyguard', strength: 6 },
    general: { label: 'General', strength: 7 },
    siege: { label: 'Siege Cannon', strength: null },
};

// hand.ts's small progress readout, pinned to whichever edge of the hand faces the board.
export function tplWarBattleIndicator(war: number, battle: number): string {
    return `${_('War')} ${war}/2, ${_('Battle')} ${battle}/4`;
}

// Its own id keeps it from clashing with the same card's element elsewhere.
export function tplShownCard(card: CardData): string {
    return `
        <div class="wott-card-flip wott-card-flip--flipped" id="wott-shown-card-${card.id}">
            <div class="wott-card-flip__inner">
                <div class="wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${cardRoleSlug(card.type)}"></div>
                <div class="wott-card wott-card-flip__face wott-card-flip__face--back wott-card--${card.deck}-back"></div>
            </div>
        </div>
    `;
}
