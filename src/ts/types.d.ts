interface WarOfTheToadsPlayer extends Player {
    no: number; // table order — matches Managers/Players::getUiData()
}

// Mirrors Models/Card::getUiData() — see modules/php/Models/Card.php.
interface CardData {
    id: number;
    type: string;
    deck: 'blue' | 'red';
    controller: number;
    location: string;
    locationArg: number;
    facedown: boolean;
    name: string;
    description: string;
    strength: number | null;
    specialAttribute: string | null;
    band: string;
}

// Mirrors Managers/Cards::getUiData() — [H13]: only `hand` ever carries full
// card data, and only for the requesting player's own hand.
interface CardsUiData {
    hand: CardData[];
    handCounts: { [playerId: number]: number };
    deckCounts: { [playerId: number]: number };
    lanes: LaneCardData[];
    stacks: StackCardData[];
    shrine: StackCardData[];
    casualties: StackCardData[];
}

// Mirrors Models/Card::getUiData()'s redacted lane/stack shape: `deck` survives redaction (a card's physical back, [H2]); every other field past `facedown` is absent for another player's hidden card.
interface LaneCardData {
    id: number;
    controller: number;
    location: string;
    locationArg: number;
    facedown: boolean;
    deck: 'blue' | 'red';
    type?: string;
    name?: string;
    description?: string;
    strength?: number | null;
    specialAttribute?: string | null;
    band?: string;
}

// Same redaction contract as LaneCardData — a stack/Shrine card is either
// fully public (a Captor, or anything not facedown) or a redacted stub (a
// Hostage/Monk hidden from everyone but its own controller). `locationArg`
// is the stack id under `stacks`, always 0 under `shrine`.
type StackCardData = LaneCardData;

// RULES.md §7's Calm/Angry for every player. Derived server-side on every
// read (Managers/Cards::getAngryByPlayerId()) — no column, no Global.
type AngryByPlayerId = { [playerId: number]: boolean };

// Mirrors States/ComputeScores::summary() — a null `wars` entry is a Stalemate, and a null `winnerId` the [H3] draw only `lowestCasualty` can reach.
interface GameEndSummary {
    condition: 'secondWar' | 'wonAndStalemate' | 'lowestCasualty';
    winnerId: number | null;
    wars: { [war: number]: number | null };
    scores: { [playerId: number]: number };
    casualties: { [playerId: number]: CardData | null };
}

interface WarOfTheToadsGamedatas extends Gamedatas<WarOfTheToadsPlayer> {
    cards: CardsUiData;
    angry: AngryByPlayerId;
    // Current-war deck colour per player (Globals::getDeckColorByPlayerId()) — diverges from table order after the 2nd-War swap.
    deckColors: { [playerId: number]: 'blue' | 'red' };
    // Null until the game is over; re-derived server-side on every load, never replayed from the log.
    gameEnd: GameEndSummary | null;
}

/*
 * Describe here the types for your state args
 */
interface ReturnCardArgs {
}

// AttackerPlay/DefenderPlay (States/PlayCards.ts) — the physical action takes
// no server-declared args, same shape as ReturnCardArgs.
interface AttackerPlayArgs {
}

interface DefenderPlayArgs {
}

// ChooseStack (States/ChooseStack.ts) — [H14]'s stack choice takes a
// `stack_id` action arg, but the 2 candidate stacks themselves come from
// `cards.stacks` (the 2 highest-id stacks controlled by the active player),
// same "derive, don't declare" approach as the server side.
interface ChooseStackArgs {
}

// Each shower picks min(3, own hand size) cards, derived client-side from the hand ([H6]).
interface ScoutRevealArgs {
}

// The 8 guessable faces are a fixed client-side list (tpls.ts's guessableCardTypeLabels, [H17]).
interface SiegeGuessArgs {
}

/*
 * Describe here the types for your notif args
 */
interface BattleStartedNotifArgs {
    battleNumber: number;
    player_id: number;
    player_name: string;
}

interface CardsPlayedNotifArgs {
    player_id: number;
    player_name: string;
    faceUpCard: LaneCardData;
    faceDownCard: LaneCardData;
}

interface CardsDrawnNotifArgs {
    player_id: number;
    player_name: string;
    count: number;
    // Present only in the `_private` block delivered to the drawing player
    // (Notifications::cardsDrawn()) — absent for everyone else, [H13].
    cards?: CardData[];
}

interface CardsRevealedNotifArgs {
    card1: CardData;
    card2: CardData;
}

interface CardReturnedNotifArgs {
    player_id: number;
    player_name: string;
    // Present only in the `_private` block delivered to the returning player
    // (Notifications::cardReturned()) — absent for everyone else, [H13].
    card_id?: number;
    card_type?: string;
}

interface CardReturnUndoneNotifArgs {
    player_id: number;
    player_name: string;
    // Present only in the `_private` block delivered to the acting player
    // (Notifications::cardReturnUndone()) — absent for everyone else, [H13].
    card?: CardData;
}

// ResolveBattle / ChooseStack (PR4, RULES.md §6 ➎➏ / §7, [H4]/[H14]/[H16]) —
// see Notifications.php for why the loser/declined cards are StackCardData
// (possibly-redacted) while the winner stays full CardData.

interface LaneFightingNotifArgs {
    lane: number;
}

interface LaneTiedNotifArgs {
    card1: StackCardData;
    card2: StackCardData;
}

interface HostageCapturedNotifArgs {
    player_id: number;
    player_name: string;
    winner: CardData;
    loser: StackCardData;
    stackId: number;
}

// `winners`/`losers`/`stackIds` are parallel arrays, 1 entry per lane won, in
// the same order — see Notifications::leapFrog()/doubleWinCalm().
interface LeapFrogNotifArgs {
    player_id: number;
    player_name: string;
    winners: CardData[];
    losers: StackCardData[];
    stackIds: number[];
}

interface DoubleWinCalmNotifArgs {
    player_id: number;
    player_name: string;
    winners: CardData[];
    losers: StackCardData[];
    stackIds: number[];
}

interface StackKeptNotifArgs {
    player_id: number;
    player_name: string;
    keptStackId: number;
    declinedStackId: number;
}

// Sent once per Battle from `BattleEnd`, whether or not it changed — see
// Notifications::moodChanged().
interface MoodChangedNotifArgs {
    angry: AngryByPlayerId;
}

// ResolveTactics (PR5, RULES.md §6 ➍) — one per TACTIC_EVENT_* in constants.inc.php.

interface TacticBlockedNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    targetId: number;
}

interface TacticLanesSwitchedNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    targetId: number;
    lanes: { [cardId: number]: number };
}

// `strengths` covers all 4 lane cards — `null` is a Siege Cannon, [H16].
interface TacticStrengthNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    targetId: number;
    delta: string;
    strengths: { [cardId: number]: number | null };
}

interface TacticTieBreakerNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    targetId: number;
}

interface TacticAngryNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    angry: AngryByPlayerId;
}

interface TacticNoEffectNotifArgs {
    player_id: number;
    player_name: string;
    cardId: number;
    targetId: number | null;
    reason: string;
}

// The shown cards are public — `cardNames`/`cards` reach everyone; the popin in hand.ts filters to the Scout's controller.
interface ScoutRevealedNotifArgs {
    player_id: number;
    player_name: string;
    player_id2: number;
    player_name2: string;
    cardNames: string;
    cards: CardData[];
}

// Log-only notifications — the no-op handlers in notifications.ts exist purely so the framework subscribes to them.
interface ScoutNothingToShowNotifArgs {
    player_id: number;
    player_name: string;
}

interface SiegeGuessedNotifArgs {
    player_id: number;
    player_name: string;
    player_id2: number;
    player_name2: string;
    cardType: string;
    cardName: string;
    hit: boolean;
}

interface SiegeGuessFizzlesNotifArgs {
    player_id: number;
    player_name: string;
    player_id2: number;
    player_name2: string;
    cardName: string;
}

// War transition (PR 7a, RULES.md §8/§9) — see Notifications.php.

// A win carries player_id/player_name/count/count2; a Stalemate carries only war/count.
interface WarEndedNotifArgs {
    war: number;
    count: number;
    count2?: number;
    player_id?: number;
    player_name?: string;
}

// `card` is the redacted stub for everyone; _merge_private upgrades it to full CardData on the owner's client only.
interface CasualtySetNotifArgs {
    player_id: number;
    player_name: string;
    card: StackCardData;
}

interface WarStartedNotifArgs {
    war: number;
    deckColors: { [playerId: number]: 'blue' | 'red' };
    deckCounts: { [playerId: number]: number };
}

// End of game (PR 7b, RULES.md §10) — see Notifications.php.

interface CasualtyRevealedNotifArgs {
    player_id: number;
    player_name: string;
    cardName: string;
    card: CardData;
}

// The summary is sent whole; `player_id`/`player_name` name the winner and are absent on a draw.
interface GameEndedNotifArgs extends GameEndSummary {
    player_id?: number;
    player_name?: string;
}