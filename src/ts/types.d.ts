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
}

interface WarOfTheToadsGamedatas extends Gamedatas<WarOfTheToadsPlayer> {
    cards: CardsUiData;
}

/*
 * Describe here the types for your state args
 */
interface ReturnCardArgs {
}

/*
 * Describe here the types for your notif args
 */
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