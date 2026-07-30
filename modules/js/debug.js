export const isDebug = window.location.host === 'studio.boardgamearena.com' ||
    window.location.hash.indexOf('debug') > -1;
export const debug = isDebug ? console.info.bind(window.console) : () => { };
const IGNORED_STATE_EVENTS = ['onPlayerActivationChange'];
export const stateLogger = (...args) => {
    if (IGNORED_STATE_EVENTS.includes(args[0]))
        return;
    debug(...args);
};
