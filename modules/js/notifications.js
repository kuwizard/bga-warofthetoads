import { debug } from "./debug.js";
import { animDur } from "./common.js";
const NOTIF_MIN_DURATION = 1440;
export const textOnlyNotifHandlers = {
    notif_scoutNothingToShow: (_args) => { },
    notif_siegeGuessFizzles: (_args) => { },
    notif_warEnded: (_args) => { },
};
let rawLog;
let formattingOwnTitle = false;
function stripSubstitutionMarkup(html) {
    return html.replace(/<!--PN[SE]-->/g, '').replace(/<[^>]*>/g, '');
}
function producedMessage(template, msg) {
    const literals = template.split(/\$\{[^}]*\}/).map(s => s.trim()).filter(s => s.length > 2);
    return literals.length > 0 && literals.every(literal => msg.includes(literal));
}
function withPlayerColor(html, color) {
    return html.startsWith('<span') ? html : `<span style="color:#${color}">${html}</span>`;
}
function colorizeLaneFightArgs(game, args) {
    if (typeof args?.card1Controller !== 'number' || typeof args?.card2Controller !== 'number') {
        return args;
    }
    const colored = { ...args };
    [1, 2].forEach(slot => {
        const color = game.getPlayerColor(args[`card${slot}Controller`]);
        if (!color) {
            return;
        }
        colored[`card${slot}Name`] = withPlayerColor(args[`card${slot}Name`], color);
        colored[`card${slot}Strength`] = withPlayerColor(args[`card${slot}Strength`], color);
    });
    return colored;
}
export function notificationOptions(game) {
    const bga = game.bga;
    let statusElement = null;
    let savedStatus;
    let savedTitle;
    game.bgaFormatText = (log, args) => {
        if (!formattingOwnTitle)
            rawLog = log;
        return { log, args: colorizeLaneFightArgs(game, args) };
    };
    return {
        minDuration: animDur(NOTIF_MIN_DURATION),
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
