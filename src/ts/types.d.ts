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
    role: string | null;
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
    role?: string | null;
    name?: string;
    description?: string;
    strength?: number | null;
    specialAttribute?: string | null;
    band?: string;
}

interface WarOfTheToadsGamedatas extends Gamedatas<WarOfTheToadsPlayer> {
    cards: CardsUiData;
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