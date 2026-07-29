// HTML template strings, kept out of Game.ts / hand.ts per project convention.

/** `card_type` (DB value, underscores) → sprite role class suffix (hyphens). See src/scss/cards.scss. */
export function cardRoleSlug(cardType: string): string {
    return cardType.replace(/_/g, '-');
}

/** `card.specialAttribute` (raw code from constants.inc.php) → RULES.md §3's exact column text. */
const specialAttributeLabels: { [code: string]: string } = {
    beats_general: 'Wins against General',
    beats_siege: 'Wins against Siege Cannon',
    loses_to_assassin: 'Loses against Assassin',
    siege: 'Loses in Defence, wins in Attack — except against Saboteur',
};

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

/** Shown via `bga.gameui.addTooltipHtml` on hover — see hand.ts. */
export function tplCardTooltip(card: CardData): string {
    const specialAttributeLabel = card.specialAttribute ? specialAttributeLabels[card.specialAttribute] : null;

    return `
        <div class="wott-card-tooltip">
            <div class="wott-card wott-card--${card.deck}-${cardRoleSlug(card.type)} wott-card-tooltip__image"></div>
            <div class="wott-card-tooltip__text">
                <strong class="wott-card-tooltip__name">${_(card.name)}</strong>
                ${card.strength !== null ? `<div class="wott-card-tooltip__strength">${_('Strength')} ${card.strength}</div>` : ''}
                ${specialAttributeLabel ? `<div class="wott-card-tooltip__special">${_(specialAttributeLabel)}</div>` : ''}
                <div class="wott-card-tooltip__description">${_(card.description)}</div>
            </div>
        </div>
    `;
}
