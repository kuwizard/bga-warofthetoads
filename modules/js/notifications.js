import { debug } from "./debug.js";
import { animDur, delay } from "./common.js";
const NOTIF_MIN_DURATION = 1440;
const FRAMEWORK_MIN_DURATION = 1;
class TextOnlyNotifs {
    notif_scoutNothingToShow(_args) { }
    notif_siegeGuessFizzles(_args) { }
    notif_warEnded(_args) { }
}
let rawLog;
let formattingOwnTitle = false;
function stripSubstitutionMarkup(html) {
    return html.replace(/<!--PN[SE]-->/g, '').replace(/<[^>]*>/g, '');
}
function producedMessage(template, msg) {
    const literals = template.split(/\$\{[^}]*\}/).map(s => s.trim()).filter(s => s.length > 2);
    return literals.length > 0 && literals.every(literal => msg.includes(literal));
}
const DECK_ARG_PATTERN = /^(.*)Deck(\d?)$/;
function colorizedPlaceholders(deckArg, log) {
    const [, prefix, suffix] = deckArg.match(DECK_ARG_PATTERN);
    const candidates = prefix === 'player'
        ? [`\${player_name${suffix}}`]
        : [`\${${prefix}${suffix}Name}\${${prefix}${suffix}Strength}`, `\${${prefix}${suffix}Name}`];
    return candidates.find(candidate => log.includes(candidate)) ?? null;
}
function colorizeDecksInTemplate(log, args) {
    if (!log || !args) {
        return log;
    }
    return Object.keys(args).reduce((colored, key) => {
        const deck = args[key];
        if (!DECK_ARG_PATTERN.test(key) || (deck !== 'blue' && deck !== 'red')) {
            return colored;
        }
        const placeholders = colorizedPlaceholders(key, colored);
        if (!placeholders) {
            return colored;
        }
        return colored.replace(placeholders, `<span class="wott-log-deck wott-log-deck--${deck}">${placeholders}</span>`);
    }, log);
}
function notifMethodNames(handler) {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(handler)).filter(name => name.startsWith('notif_'));
}
function mergeHandlers(handlers) {
    const reactions = {};
    handlers.forEach(handler => notifMethodNames(handler).forEach(name => {
        const react = handler[name].bind(handler);
        const reactSoFar = reactions[name];
        reactions[name] = reactSoFar
            ? (...args) => Promise.all([reactSoFar(...args), react(...args)])
            : react;
    }));
    return Object.create(reactions);
}
function holdNotifsForCurrentAnimationSpeed(bga, handler) {
    notifMethodNames(handler).forEach(name => {
        const handle = handler[name];
        Object.defineProperty(handler, name, {
            configurable: true,
            value: (args, notif) => {
                const silent = !notif?.log || !bga.gameui.bgaAnimationsActive();
                return Promise.all([handle(args, notif), delay(silent ? 0 : animDur(NOTIF_MIN_DURATION))]);
            },
        });
    });
}
export function notificationOptions(game, handlers) {
    const bga = game.bga;
    const handler = mergeHandlers([...handlers, new TextOnlyNotifs()]);
    holdNotifsForCurrentAnimationSpeed(bga, handler);
    let statusElement = null;
    let savedStatus;
    let savedTitle;
    game.bgaFormatText = (log, args) => {
        if (!formattingOwnTitle)
            rawLog = log;
        return { log: colorizeDecksInTemplate(log, args), args };
    };
    return {
        handlers: [handler],
        minDuration: FRAMEWORK_MIN_DURATION,
        onStart: (name, msg, args) => {
            const template = rawLog !== undefined && producedMessage(rawLog, msg) ? rawLog : stripSubstitutionMarkup(msg);
            debug(`Notif [${name}]`, { ...args, message: template });
            if (!msg)
                return;
            statusElement = document.getElementById('gameaction_status');
            const titleElement = document.getElementById('pagemaintitletext');
            if (!statusElement || !titleElement)
                return;
            if (savedTitle === undefined) {
                savedStatus = statusElement.innerHTML;
                savedTitle = titleElement.innerHTML;
            }
            formattingOwnTitle = true;
            bga.statusBar.setTitle(msg, args);
            formattingOwnTitle = false;
            statusElement.innerHTML = titleElement.innerHTML;
        },
        onEnd: () => {
            const titleElement = document.getElementById('pagemaintitletext');
            if (statusElement && savedStatus !== undefined)
                statusElement.innerHTML = savedStatus;
            if (titleElement && savedTitle !== undefined)
                titleElement.innerHTML = savedTitle;
            statusElement = null;
            savedStatus = undefined;
            savedTitle = undefined;
        },
    };
}
