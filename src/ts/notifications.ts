import type { Game } from "./Game.js";
import { debug } from "./debug.js";

const NOTIF_MIN_DURATION = 1200;

let rawLog: string | undefined;
let formattingOwnTitle = false;

function stripSubstitutionMarkup(html: string): string {
    return html.replace(/<!--PN[SE]-->/g, '').replace(/<[^>]*>/g, '');
}

function producedMessage(template: string, msg: string): boolean {
    const literals = template.split(/\$\{[^}]*\}/).map(s => s.trim()).filter(s => s.length > 2);
    return literals.length > 0 && literals.every(literal => msg.includes(literal));
}

export function notificationOptions(game: Game) {
    const bga = game.bga;

    let statusElement: HTMLElement | null = null;
    let savedStatus: string | undefined;
    let savedTitle: string | undefined;

    game.bgaFormatText = (log: string, args: any) => {
        if (!formattingOwnTitle) rawLog = log;
        return { log, args };
    };

    return {
        minDuration: NOTIF_MIN_DURATION,

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
