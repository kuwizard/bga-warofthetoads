/**
 * Console tracing for development. Active on BGA Studio, and on production
 * only when `#debug` is present in the URL — so a released game stays silent
 * unless someone deliberately asks for the trace.
 */
export const isDebug: boolean =
    window.location.host === 'studio.boardgamearena.com' ||
    window.location.hash.indexOf('debug') > -1;

export const debug: (...args: unknown[]) => void =
    isDebug ? console.info.bind(window.console) : () => {};

/**
 * State lifecycle events that add noise without adding information.
 * `onPlayerActivationChange` always fires right after `onEnteringState` with
 * the same state and the same args, so it only ever duplicates the line above it.
 */
const IGNORED_STATE_EVENTS = ['onPlayerActivationChange'];

/**
 * `bga.states.logger` receives every state lifecycle event as
 * (eventName, stateName, args). Assign this instead of `debug` directly to
 * drop the events listed above. An unrecognised call shape simply won't match
 * and gets logged as-is, so this can never silence something unexpected.
 */
export const stateLogger = (...args: unknown[]): void => {
    if (IGNORED_STATE_EVENTS.includes(args[0] as string)) return;
    debug(...args);
};
