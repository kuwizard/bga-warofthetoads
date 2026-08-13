import type { Game } from "./Game.js";
import { debug } from "./debug.js";
import { animDur, delay } from "./common.js";

const NOTIF_MIN_DURATION = 1440;
const FRAMEWORK_MIN_DURATION = 1;

// A class, not an object literal: the framework only finds notif_* methods on a handler's prototype, and an undiscovered notification never subscribes at all.
class TextOnlyNotifs {
    notif_scoutNothingToShow(_args: ScoutNothingToShowNotifArgs): void {}
    notif_siegeGuessFizzles(_args: SiegeGuessFizzlesNotifArgs): void {}
    notif_warEnded(_args: WarEndedNotifArgs): void {}
}

let rawLog: string | undefined;
let formattingOwnTitle = false;

function stripSubstitutionMarkup(html: string): string {
    return html.replace(/<!--PN[SE]-->/g, '').replace(/<[^>]*>/g, '');
}

function producedMessage(template: string, msg: string): boolean {
    const literals = template.split(/\$\{[^}]*\}/).map(s => s.trim()).filter(s => s.length > 2);
    return literals.length > 0 && literals.every(literal => msg.includes(literal));
}

const DECK_ARG_PATTERN = /^(.*)Deck(\d?)$/;

// `playerDeck`/`playerDeck2` name BGA's own ${player_name}/${player_name2}; every other `xxxDeck` names a card.
function colorizedPlaceholders(deckArg: string, log: string): string | null {
    const [, prefix, suffix] = deckArg.match(DECK_ARG_PATTERN)!;

    const candidates = prefix === 'player'
        ? [`\${player_name${suffix}}`]
        : [`\${${prefix}${suffix}Name}\${${prefix}${suffix}Strength}`, `\${${prefix}${suffix}Name}`];

    return candidates.find(candidate => log.includes(candidate)) ?? null;
}

// Colours the template, not the arg values: bgaFormatText runs before BGA translates the `i18n` args.
function colorizeDecksInTemplate(log: string, args: any): string {
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

function notifMethodNames(handler: object): string[] {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(handler)).filter(name => name.startsWith('notif_'));
}

// The framework copies its own minDuration once at setup; re-reading the floor per notification is what makes a mid-game speed change take effect.
function holdNotifsForCurrentAnimationSpeed(bga: Bga<WarOfTheToadsPlayer, WarOfTheToadsGamedatas>, handlers: object[]): void {
    handlers.forEach(handler => notifMethodNames(handler)
        .filter(name => !Object.prototype.hasOwnProperty.call(handler, name))
        .forEach(name => {
            const handle = (handler as any)[name].bind(handler);

            Object.defineProperty(handler, name, {
                configurable: true,
                value: (args: any, notif?: { log?: string }) => {
                    const silent = !notif?.log || !bga.gameui.bgaAnimationsActive();
                    return Promise.all([handle(args, notif), delay(silent ? 0 : animDur(NOTIF_MIN_DURATION))]);
                },
            });
        }));
}

export function notificationOptions(game: Game, handlers: object[]) {
    const bga = game.bga;

    const allHandlers = [...handlers, new TextOnlyNotifs()];
    holdNotifsForCurrentAnimationSpeed(bga, allHandlers);

    let statusElement: HTMLElement | null = null;
    let savedStatus: string | undefined;
    let savedTitle: string | undefined;

    game.bgaFormatText = (log: string, args: any) => {
        if (!formattingOwnTitle) rawLog = log;
        return { log: colorizeDecksInTemplate(log, args), args };
    };

    return {
        handlers: allHandlers,
        minDuration: FRAMEWORK_MIN_DURATION,

        onStart: (name: string, msg: string, args: any): void => {
            const template = rawLog !== undefined && producedMessage(rawLog, msg) ? rawLog : stripSubstitutionMarkup(msg);
            debug(`Notif [${name}]`, { ...args, message: template });

            if (!msg) return;

            statusElement = document.getElementById('gameaction_status');
            const titleElement = document.getElementById('pagemaintitletext');
            if (!statusElement || !titleElement) return;

            if (savedTitle === undefined) {
                savedStatus = statusElement.innerHTML;
                savedTitle = titleElement.innerHTML;
            }

            formattingOwnTitle = true;
            bga.statusBar.setTitle(msg, args);
            formattingOwnTitle = false;

            // setTitle() renders into #pagemaintitletext, which BGA covers with
            // #gameaction_status while notifications play — so it must be copied across.
            statusElement.innerHTML = titleElement.innerHTML;
        },

        onEnd: (): void => {
            const titleElement = document.getElementById('pagemaintitletext');
            if (statusElement && savedStatus !== undefined) statusElement.innerHTML = savedStatus;
            if (titleElement && savedTitle !== undefined) titleElement.innerHTML = savedTitle;
            statusElement = null;
            savedStatus = undefined;
            savedTitle = undefined;
        },
    };
}
