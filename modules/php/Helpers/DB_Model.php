<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Helpers;

/**
 * Base for typed row objects. Declare `$attributes` and the accessors come for
 * free — no hand-written getters, and setters persist to the DB themselves.
 *
 *   getXxx()        read the local attribute (no DB hit)
 *   isXxx()         same, cast to bool
 *   setXxx($v)      write local + `UPDATE tbl SET col = $v WHERE primary = ...`
 *   incXxx($n = 1)  getter + setter (one DB write)
 *
 * `setXxx()` is a no-op for `int` and `bool` fields when the value is unchanged,
 * so idempotent writes cost nothing.
 *
 * Subclasses may declare the attributes as real typed properties for IDE
 * support; `#[\AllowDynamicProperties]` means they don't have to.
 */
#[\AllowDynamicProperties]
abstract class DB_Model implements \JsonSerializable
{
    protected string $table = '';
    protected string $primary = '';

    /**
     * Maps PHP attribute name → DB column name, with optional type cast.
     * 'attr' => 'db_col'  OR  'attr' => ['db_col', 'int'|'float'|'bool'|'obj']
     *
     * 'obj' columns are stored as JSON strings and decoded to arrays on load.
     */
    protected array $attributes = [];

    /**
     * Read-only computed attributes (not persisted to DB).
     * Only get/is accessors work on these — set/inc are not allowed.
     * 'attr'  OR  ['attr', 'int']
     */
    protected array $staticAttributes = [];

    public function __construct(array $row)
    {
        foreach ($this->attributes as $attr => $field) {
            $col = is_array($field) ? $field[0] : $field;
            $raw = $row[$col] ?? null;

            if (is_array($field) && $raw !== null) {
                $raw = match ($field[1]) {
                    'int'   => (int) $raw,
                    'float' => (float) $raw,
                    'bool'  => (bool) $raw,
                    'obj'   => json_decode((string) $raw, true),
                    default => $raw,
                };
            }

            $this->$attr = $raw;
        }
    }

    /**
     * Magic dispatch for getXxx / setXxx / incXxx / isXxx.
     *
     * For 'obj' fields, get/set take an optional key:
     *   getData('key')        → $this->data['key']
     *   setData('key', $val)  → sets the nested key and re-encodes the column
     */
    public function __call(string $method, array $args): mixed
    {
        if (!preg_match('/^(get|set|inc|is)([A-Z].*)$/', $method, $m)) {
            throw new \BadMethodCallException("Undefined method: $method");
        }

        $name = lcfirst($m[2]);
        $op   = $m[1];

        if (!array_key_exists($name, $this->attributes)) {
            if ($op === 'get' || $op === 'is') {
                foreach ($this->staticAttributes as $staticAttr) {
                    $attrName = is_array($staticAttr) ? $staticAttr[0] : $staticAttr;
                    if ($attrName === $name) {
                        return $op === 'is' ? (bool) $this->$name : ($this->$name ?? null);
                    }
                }
            }
            throw new \InvalidArgumentException("Attribute '$name' not declared in \$attributes");
        }

        $field = $this->attributes[$name];
        $col   = is_array($field) ? $field[0] : $field;
        $type  = is_array($field) ? $field[1] : null;

        if ($op === 'get') {
            if ($args !== [] && $type === 'obj') {
                return $this->$name[$args[0]] ?? null;
            }
            return $this->$name;
        }

        if ($op === 'is') {
            return (bool) $this->$name;
        }

        if ($op === 'set') {
            $value = $args[0];

            if ($type === 'int') {
                $value = (int) $value;
                if ($value === $this->$name) return $value; // no-op
            } elseif ($type === 'bool') {
                $value = (bool) $value;
                if ($value === $this->$name) return $value; // no-op
            } elseif ($type === 'obj') {
                if (count($args) > 1) {
                    $this->$name[$args[0]] = $args[1];
                } else {
                    $this->$name = $value;
                }
                $this->saveField($col, json_encode($this->$name));
                return $args[count($args) - 1];
            }

            $this->$name = $value;
            $this->saveField($col, $value);
            return $value;
        }

        if ($op === 'inc') {
            $getter = 'get' . $m[2];
            $setter = 'set' . $m[2];
            return $this->$setter($this->$getter() + ($args[0] ?? 1));
        }

        return null;
    }

    public function jsonSerialize(): array
    {
        $data = [];
        foreach ($this->attributes as $attr => $_) {
            $data[$attr] = $this->$attr;
        }
        return $data;
    }

    /**
     * Payload for getAllDatas() and notifications. Override to add computed
     * fields or to hide data the given player must not see.
     */
    public function getUiData(?int $currentPlayerId = null): array
    {
        $data = $this->jsonSerialize();
        foreach ($this->staticAttributes as $staticAttr) {
            $attrName = is_array($staticAttr) ? $staticAttr[0] : $staticAttr;
            $data[$attrName] = $this->{'get' . ucfirst($attrName)}();
        }
        return $data;
    }

    protected function getPrimaryValue(): mixed
    {
        foreach ($this->attributes as $attr => $field) {
            $col = is_array($field) ? $field[0] : $field;
            if ($col === $this->primary) {
                return $this->$attr;
            }
        }
        return null;
    }

    protected function saveField(string $col, mixed $value): void
    {
        (new QueryBuilder($this->table, null, $this->primary))
            ->update([$col => $value])
            ->where($this->primary, $this->getPrimaryValue())
            ->run();
    }
}
