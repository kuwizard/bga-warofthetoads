// Animation speed preference. Every timed CSS rule must be written as
// calc(Xs * var(--am)) (src/scss/Game.scss already declares the fallback);
// this is the JS side that drives --am from preference 100
// (gamepreferences.jsonc) and exposes animDur() for the handful of
// JS-driven (non-CSS) animations that take a duration argument instead.

const ANIMATION_SPEED_STORAGE_KEY = 'wott-animation-speed';
const ANIMATION_SPEED_MULTIPLIERS: { [preference: number]: number } = { 1: 2, 2: 1, 3: 0.5, 4: 0.08 };

export const ANIMATION_SPEED_PREF_ID = 100;

export function isReadOnly(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>): boolean {
    return bga.players.isCurrentPlayerSpectator() || typeof g_replayFrom != 'undefined' || g_archive_mode;
}

export function animDur(ms: number): number {
    const multiplier = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--am')) || 1;
    return Math.round(ms * multiplier);
}

export function applyAnimationSpeed(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>): void {
    // A replay or spectated table reports the table owner's preference, not the viewer's.
    const preferenceWhileWatching = Number(localStorage.getItem(ANIMATION_SPEED_STORAGE_KEY));
    let preference = bga.userPreferences.get(ANIMATION_SPEED_PREF_ID);

    if (isReadOnly(bga) && ANIMATION_SPEED_MULTIPLIERS[preferenceWhileWatching] !== undefined) {
        preference = preferenceWhileWatching;
    } else {
        localStorage.setItem(ANIMATION_SPEED_STORAGE_KEY, String(preference));
    }

    document.documentElement.style.setProperty('--am', String(ANIMATION_SPEED_MULTIPLIERS[preference] ?? 1));
}
