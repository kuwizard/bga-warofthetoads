<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Models;

use Bga\Games\WarOfTheToads\Helpers\DB_Model;

/**
 * One row of the `card` table. See doc/SCHEMA.md for the full column
 * reference and doc/ASSUMPTIONS.md [H1]/[H2] for why `deck` (printed colour)
 * and `controller` (current holder) are separate fields.
 *
 * Strength / Special Attribute / Tactic band / name / description are never
 * persisted — every `card_type` has its own subclass under Data/Cards/ that
 * sets them in its constructor (dispatch table: Managers/Cards::$map),
 * mirroring libertalia's Models/Character.php + Data/Characters/* shape.
 */
abstract class Card extends DB_Model
{
    protected string $table   = 'card';
    protected string $primary = 'card_id';

    protected ?int    $id          = null;
    protected ?string $type        = null;
    protected ?string $deck        = null;
    protected ?int    $controller  = null;
    protected ?string $location    = null;
    protected ?int    $locationArg = null;
    protected ?bool   $facedown    = null;
    protected ?string $role        = null;

    protected array $attributes = [
        'id'          => ['card_id', 'int'],
        'type'        => 'card_type',
        'deck'        => 'card_deck',
        'controller'  => ['card_controller', 'int'],
        'location'    => 'card_location',
        'locationArg' => ['card_location_arg', 'int'],
        'facedown'    => ['card_facedown', 'bool'],
        'role'        => 'card_role',
    ];

    // Set by subclass constructors — static per card type, never persisted.
    protected string  $name             = '';
    protected string  $description      = '';
    protected ?int    $strength         = null;
    protected ?string $specialAttribute = null;
    protected string  $band             = '';

    /** Included in getUiData() automatically by DB_Model's default. */
    protected array $staticAttributes = [
        'name',
        'description',
        ['strength', 'int'],
        'specialAttribute',
        'band',
    ];

    public function getName(): string
    {
        return $this->name;
    }

    /** RULES.md §3's Tactic column text, verbatim — shown as a card tooltip. */
    public function getDescription(): string
    {
        return $this->description;
    }

    /** Printed Strength Value, or `null` for the Siege Cannon (RULES.md §3). */
    public function getStrength(): ?int
    {
        return $this->strength;
    }

    public function getSpecialAttribute(): ?string
    {
        return $this->specialAttribute;
    }

    /** The Tactic priority band this card resolves in (RULES.md §6, Block/Start/During/After). */
    public function getBand(): string
    {
        return $this->band;
    }
}
