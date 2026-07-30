interface WarOfTheToadsPlayer extends Player {
    no: number; // table order — matches Managers/Players::getUiData()
}

// Mirrors Models/Card::getUiData() — see modules/php/Models/Card.php.
interface CardData {
    id: number;
    type: string;
    deck: string;
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
}

// Mirrors Models/Card::getUiData() for a lane card. Every field past
// `facedown` is absent when the card is a hidden card belonging to another
// player — the redaction that protects the project's top risk (a face-down
// card's identity leaking into the network payload). See Card::getUiData().
interface LaneCardData {
    id: number;
    controller: number;
    location: string;
    locationArg: number;
    facedown: boolean;
    type?: string;
    deck?: string;
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

interface WarOfTheToadsGamedatas extends Gamedatas<WarOfTheToadsPlayer> {
    cards: CardsUiData;
    angry: AngryByPlayerId;
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