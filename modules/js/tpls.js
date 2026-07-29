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
