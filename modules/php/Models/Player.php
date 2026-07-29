<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Models;

use Bga\Games\WarOfTheToads\Game;
use Bga\Games\WarOfTheToads\Helpers\DB_Model;

/**
 * One row of the `player` table.
 *
 * The framework's own `player` table is wrapped like any other table — it is
 * not a special case. Custom per-player columns added in `dbmodel.sql` via
 * `ALTER TABLE player ADD ...` just need a line in `$attributes` and their
 * accessors exist.
 *
 * Declaring the attributes as typed properties below is optional (DB_Model is
 * `#[\AllowDynamicProperties]`) but gives the IDE something to work with.
 */
class Player extends DB_Model
{
    protected string $table   = 'player';
    protected string $primary = 'player_id';

    protected ?int    $id     = null;
    protected ?int    $no     = null;
    protected ?string $name   = null;
    protected ?string $color  = null;
    protected ?bool   $zombie = null;

    protected array $attributes = [
        'id'     => ['player_id', 'int'],
        'no'     => ['player_no', 'int'],
        'name'   => 'player_name',
        'color'  => 'player_color',
        'zombie' => ['player_zombie', 'bool'],
    ];

    /**
     * Score lives in BGA's playerScore counter, not in a column we own — so it
     * is read through the framework rather than declared as an attribute.
     */
    public function getScore(): int
    {
        return Game::get()->bga->playerScore->get((int) $this->id);
    }

    public function getUiData(?int $currentPlayerId = null): array
    {
        return array_merge(parent::getUiData($currentPlayerId), [
            'score' => $this->getScore(),
        ]);
    }
}
