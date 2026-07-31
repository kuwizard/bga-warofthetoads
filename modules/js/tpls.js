export function cardRoleSlug(cardType) {
    return cardType.replace(/_/g, '-');
}
const specialAttributeLabels = {
    beats_general: 'Wins against General',
    beats_siege: 'Wins against Siege Cannon',
    loses_to_assassin: 'Loses against Assassin',
    siege: 'Loses in Defence, wins in Attack — except against Saboteur',
};
export function tplHandCard(card) {
    return `
        <div class="wott-card-flip" id="wott-card-${card.id}" data-card-id="${card.id}">
            <div class="wott-card-flip__inner">
                <div class="wott-card wott-card-flip__face wott-card-flip__face--front wott-card--${card.deck}-${cardRoleSlug(card.type)}"></div>
                <div class="wott-card wott-card-flip__face wott-card-flip__face--back wott-card--${card.deck}-back"></div>
            </div>
        </div>
    `;
}
export function tplLaneCard(card, deckColor) {
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
export function tplCardTooltip(card) {
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
export const guessableCardTypes = {
    assassin: { label: 'Assassin', strength: 1 },
    scout: { label: 'Scout', strength: 2 },
    saboteur: { label: 'Saboteur', strength: 3 },
    trickster: { label: 'Trickster', strength: 4 },
    berserker: { label: 'Berserker', strength: 5 },
    bodyguard: { label: 'Bodyguard', strength: 6 },
    general: { label: 'General', strength: 7 },
    siege: { label: 'Siege Cannon', strength: null },
};
export function tplShownCard(card) {
    return `<div class="wott-card wott-card--${card.deck}-${cardRoleSlug(card.type)}" id="wott-shown-card-${card.id}"></div>`;
}
