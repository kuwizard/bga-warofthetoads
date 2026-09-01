const ANIMATION_SPEED_STORAGE_KEY = 'wott-animation-speed';
const ANIMATION_SPEED_MULTIPLIERS = { 1: 2, 2: 1, 3: 0.5, 4: 0.08 };
export const ANIMATION_SPEED_PREF_ID = 100;
export function isReadOnly(bga) {
    return bga.players.isCurrentPlayerSpectator() || typeof g_replayFrom != 'undefined' || g_archive_mode;
}
export function animDur(ms) {
    const multiplier = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--am')) || 1;
    return Math.round(ms * multiplier);
}
export function applyAnimationSpeed(bga) {
    const preferenceWhileWatching = Number(localStorage.getItem(ANIMATION_SPEED_STORAGE_KEY));
    let preference = bga.userPreferences.get(ANIMATION_SPEED_PREF_ID);
    if (isReadOnly(bga) && ANIMATION_SPEED_MULTIPLIERS[preferenceWhileWatching] !== undefined) {
        preference = preferenceWhileWatching;
    }
    else {
        localStorage.setItem(ANIMATION_SPEED_STORAGE_KEY, String(preference));
    }
    document.documentElement.style.setProperty('--am', String(ANIMATION_SPEED_MULTIPLIERS[preference] ?? 1));
}
