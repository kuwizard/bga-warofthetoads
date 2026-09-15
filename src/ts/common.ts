const ANIMATION_SPEED_PREF_ID = 100;
const ANIMATION_SPEED_STORAGE_KEY = 'wott-animation-speed';
const ANIMATION_SPEED_MULTIPLIERS: { [preference: number]: number } = { 1: 2, 2: 1, 3: 0.5, 4: 0.08 };

// Notifications::battleSpecialEffect()'s BATTLE_EFFECT_* -> attribute-icons.scss's sprite name.
const ATTRIBUTE_ICON_BY_EFFECT: { [effect: string]: string } = {
    cannonWin: 'cannon',
    cannonLoss: 'sabotage',
    sabotage: 'sabotage',
    assassinate: 'assassinate',
};

export { ANIMATION_SPEED_PREF_ID, ATTRIBUTE_ICON_BY_EFFECT };

export function isReadOnly(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>): boolean {
    return bga.players.isCurrentPlayerSpectator() || typeof g_replayFrom != 'undefined' || g_archive_mode;
}

export function animDur(ms: number): number {
    const multiplier = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--am')) || 1;
    return Math.round(ms * multiplier);
}

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function applyAnimationSpeed(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>): void {
    // A replay or spectated table reports the table owner's preferences, not the viewer's.
    const preferenceWhileWatching = Number(localStorage.getItem(ANIMATION_SPEED_STORAGE_KEY));
    let preference = bga.userPreferences.get(ANIMATION_SPEED_PREF_ID);

    if (isReadOnly(bga) && ANIMATION_SPEED_MULTIPLIERS[preferenceWhileWatching] !== undefined) {
        preference = preferenceWhileWatching;
    } else {
        localStorage.setItem(ANIMATION_SPEED_STORAGE_KEY, String(preference));
    }

    document.documentElement.style.setProperty('--am', String(ANIMATION_SPEED_MULTIPLIERS[preference] ?? 1));
}
