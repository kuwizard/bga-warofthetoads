import type { Game } from "./Game.js";
import { debug } from "./debug.js";
import { animDur } from "./common.js";

const NOTIF_MIN_DURATION = 1440;

// Without a notif_* handler the framework never subscribes to a notification, so onStart below (status-bar display) would never fire for it.
export const textOnlyNotifHandlers = {
    notif_scoutNothingToShow: (_args: ScoutNothingToShowNotifArgs) => {},
    notif_siegeGuessFizzles: (_args: SiegeGuessFizzlesNotifArgs) => {},
    notif_warEnded: (_args: WarEndedNotifArgs) => {},
};

let rawLog: string | undefined;
let formattingOwnTitle = false;

function stripSubstitutionMarkup(html: string): string {
    return html.replace(/<!--PN[SE]-->/g, '').replace(/<[^>]*>/g, '');
}

function producedMessage(template: string, msg: string): boolean {
    const literals = template.split(/\$\{[^}]*\}/).map(s => s.trim()).filter(s => s.length > 2);
    return literals.length > 0 && literals.every(literal => msg.includes(literal));
}

const CONTROLLER_ARG_SUFFIX = 'Controller';

function colorizedPlaceholders(prefix: string, log: string): string {
    const namePlusStrength = `\${${prefix}Name}\${${prefix}Strength}`;
    return log.includes(namePlusStrength) ? namePlusStrength : `\${${prefix}Name}`;
}

// Colours the template, not the arg values: bgaFormatText runs before BGA translates the `i18n` args.
function colorizeCardNamesInTemplate(game: Game, log: string, args: any): string {
    if (!log || !args) {
        return log;
    }

    return Object.keys(args).reduce((colored, key) => {
        if (!key.endsWith(CONTROLLER_ARG_SUFFIX) || typeof args[key] !== 'number') {
            return colored;
        }

        const color = game.getPlayerColor(args[key]);
        if (!color) {
            return colored;
        }

        const placeholders = colorizedPlaceholders(key.slice(0, -CONTROLLER_ARG_SUFFIX.length), colored);
        return colored.replace(placeholders, `<span style="color:#${color}">${placeholders}</span>`);
    }, log);
}

export function notificationOptions(game: Game) {
    const bga = game.bga;

    let statusElement: HTMLElement | null = null;
    let savedStatus: string | undefined;
    let savedTitle: string | undefined;

    game.bgaFormatText = (log: string, args: any) => {
        if (!formattingOwnTitle) rawLog = log;
        return { log: colorizeCardNamesInTemplate(game, log, args), args };
    };

    return {
        // Read once by the framework, so a mid-game speed change only reaches this floor on the next page load.
        minDuration: animDur(NOTIF_MIN_DURATION),

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
