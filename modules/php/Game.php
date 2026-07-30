<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * WarOfTheToads implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * Deliberately thin. Only what the framework demands lives here:
 * setupNewGame(), getAllDatas(), getGameProgression(), upgradeTableDb().
 *
 *   - game logic  → modules/php/States/
 *   - DB access   → modules/php/Managers/  (never raw SQL here)
 *   - constants   → modules/php/constants.inc.php
 *   - globals     → modules/php/Core/Globals.php
 *   - statistics  → modules/php/Core/Stats.php
 *   - log output  → modules/php/Notifications.php
 *   - debug tools → modules/php/Core/DebugTrait.php
 */
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads;

require_once dirname(__FILE__) . '/constants.inc.php';

use Bga\Games\WarOfTheToads\Core\DebugTrait;
use Bga\Games\WarOfTheToads\Core\Stats;
use Bga\Games\WarOfTheToads\Managers\Cards;
use Bga\Games\WarOfTheToads\Managers\Players;
use Bga\Games\WarOfTheToads\States\WarSetup;

class Game extends \Bga\GameFramework\Table
{
    use DebugTrait;

    /**
     * Managers and Notifications are static classes — this is how they reach
     * the framework. Set once in the constructor; every request builds exactly
     * one Game instance, so there is no lifetime to manage.
     */
    private static self $instance;

    public static function get(): self
    {
        return self::$instance;
    }

    public function __construct()
    {
        parent::__construct();
        self::$instance = $this;

        // Register decks and counters here, e.g.:
        // $this->cards = $this->bga->deckFactory->createDeck('card');
        // $this->playerGold = $this->bga->counterFactory->createPlayerCounter('gold');
    }

    /**
     * Called once when a new game is launched.
     *
     * Order matters: players must exist in the DB, and reloadPlayersBasicInfos()
     * must have run, before anything else touches player data or statistics.
     */
    protected function setupNewGame($players, $options = [])
    {
        $colors = $this->getGameinfos()['player_colors'];

        Players::setupNewGame($players, $colors);
        $this->reattributeColorsBasedOnPreferences($players, $colors);
        $this->reloadPlayersBasicInfos();

        Stats::setupNewGame();

        // Deck build/shuffle/deal and the 1st-War Attacker pick happen in
        // WarSetup::onEnteringState() — nothing is watching the table yet,
        // so there is no notification to send for it.

        return WarSetup::class;
    }

    /**
     * Everything the client needs to render the table, for this player only.
     *
     * Assemble it from Manager `getUiData()` calls — never build payloads with
     * raw SQL here. Pass $currentPlayerId down so Models can hide what this
     * player must not see.
     */
    protected function getAllDatas(int $currentPlayerId): array
    {
        return [
            'players' => Players::getUiData($currentPlayerId)->toAssoc(),
            'cards'   => Cards::getUiData($currentPlayerId),
            'angry'   => Cards::getAngryByPlayerId(),
        ];
    }

    /**
     * Progress percentage, 0-100. Called in states declaring
     * `updateGameProgression: true`.
     */
    public function getGameProgression()
    {
        // TODO: compute and return the game progression.

        return 0;
    }

    /**
     * Migrate database.
     *
     * Only relevant once the game is published on BGA: called when the system
     * detects a running game on an older database scheme.
     *
     * @param int $from_version
     * @return void
     */
    public function upgradeTableDb($from_version)
    {
//       if ($from_version <= 1404301345)
//       {
//            // ! important ! Use `DBPREFIX_<table_name>` for all tables
//
//            $sql = "ALTER TABLE `DBPREFIX_xxxxxxx` ....";
//            $this->applyDbUpgradeToAllDB( $sql );
//       }
    }
}
