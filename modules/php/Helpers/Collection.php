<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Helpers;

/**
 * Typed result set returned by every Manager read.
 *
 * Keys are the table's primary key values (QueryBuilder aliases the primary
 * column to `_pk` and uses it as the array key), so `getIds()` returns real
 * row ids and `toAssoc()` is directly usable as an id => object map.
 *
 * `map()` and `filter()` preserve those keys; `toArray()` drops them.
 */
class Collection extends \ArrayObject
{
    public function __construct(array $array = [])
    {
        parent::__construct($array);
    }

    /** Keys of the collection — primary key ids when built by a Manager. */
    public function getIds(): array
    {
        return array_keys($this->getArrayCopy());
    }

    public function isEmpty(): bool
    {
        return $this->count() === 0;
    }

    public function first(): mixed
    {
        $arr = $this->getArrayCopy();
        return !empty($arr) ? reset($arr) : null;
    }

    public function last(): mixed
    {
        $arr = $this->getArrayCopy();
        return !empty($arr) ? end($arr) : null;
    }

    /**
     * Filter by a Model attribute: `where('location', LOCATION_HAND)`.
     *
     * Passing null returns the collection untouched, so optional filters can be
     * chained without branching: `->where('location', $loc)->where('state', $state)`.
     *
     * An array value matches any member. Comparison is strict — the value must
     * match the type declared in the Model's `$attributes` (an `int` column
     * needs an int, not a numeric string). That is deliberate: `==` treats
     * '4baae2' and 0 as equal, which silently mismatches hex player colors.
     */
    public function where(string $attribute, mixed $value): static
    {
        if ($value === null) {
            return $this;
        }

        $getter = 'get' . ucfirst($attribute);

        return $this->filter(function ($item) use ($getter, $value) {
            $actual = $item->$getter();
            return is_array($value) ? in_array($actual, $value, true) : $actual === $value;
        });
    }

    /**
     * Write-through bulk setter: `update('location', LOCATION_DISCARD)`.
     *
     * Calls `set<Attribute>()` on every member, which mutates the object AND
     * persists that column. Because a cached Manager hands out these same
     * object instances, the cache stays correct without an `invalidate()` —
     * this is the preferred way to write through a CachedDB_Manager.
     *
     * Chainable: `->update('location', $loc)->update('state', $state)`.
     */
    public function update(string $attribute, mixed $value): static
    {
        $setter = 'set' . ucfirst($attribute);

        foreach ($this->getArrayCopy() as $item) {
            if (!is_object($item)) {
                throw new \LogicException(
                    'Collection::update() needs Model objects — the Manager must override cast()'
                );
            }
            $item->$setter($value);
        }

        return $this;
    }

    /** Re-indexed sequential array. */
    public function toArray(): array
    {
        return array_values($this->getArrayCopy());
    }

    /** Associative array preserving original keys. */
    public function toAssoc(): array
    {
        return $this->getArrayCopy();
    }

    /** Preserves original keys. */
    public function map(callable $fn): static
    {
        return new static(array_map($fn, $this->getArrayCopy()));
    }

    /** Preserves original keys. */
    public function filter(callable $fn): static
    {
        return new static(array_filter($this->getArrayCopy(), $fn));
    }

    public function reduce(callable $fn, mixed $initial = null): mixed
    {
        return array_reduce($this->toArray(), $fn, $initial);
    }

    public function each(callable $fn): static
    {
        foreach ($this->getArrayCopy() as $key => $item) {
            $fn($item, $key);
        }
        return $this;
    }

    public function merge(Collection $other): static
    {
        return new static(array_merge($this->getArrayCopy(), $other->getArrayCopy()));
    }

    /** Note: re-indexes — the primary key mapping is lost. */
    public function sort(callable $fn): static
    {
        $arr = $this->getArrayCopy();
        usort($arr, $fn);
        return new static($arr);
    }
}
