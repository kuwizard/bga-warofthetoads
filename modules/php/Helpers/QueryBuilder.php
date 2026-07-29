<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Helpers;

use Bga\GameFramework\Table;

/**
 * Fluent SQL builder used by every Manager. Never instantiate it directly —
 * go through `Manager::DB()`, which wires the table name, primary key and cast.
 *
 * All DB entry points on `Bga\GameFramework\Table` are `final public static`,
 * so calling them statically here is correct and does not trip the PHP 8.4
 * static-call-to-instance-method warning.
 *
 * Every value goes through `quoteValue()`, which escapes strings via the
 * framework — do not interpolate player-supplied values into SQL anywhere else.
 */
class QueryBuilder
{
    private ?string $dmlSql = null;
    private string $whereClause = '';
    private string $orderByClause = '';
    private string $limitClause = '';
    private bool $nextIsOr = false;
    private ?array $selectColumns = null;

    public function __construct(
        private readonly string $table,
        private readonly mixed $cast = null,
        private readonly ?string $primary = null,
    ) {}

    // ── INSERT ────────────────────────────────────────────────────────────────

    /** Returns the id of the inserted row. */
    public function insert(array $fields): int
    {
        $this->multipleInsert(array_keys($fields))->values([array_values($fields)]);
        return Table::DbGetLastId();
    }

    public function multipleInsert(array $fields): self
    {
        $keys = implode('`, `', array_values($fields));
        $this->dmlSql = "INSERT INTO `{$this->table}` (`{$keys}`) VALUES";
        return $this;
    }

    /**
     * Runs the pending multipleInsert() with the given rows.
     *
     * @return int[] ids of the inserted rows, in the order they were passed.
     *               Derived from LAST_INSERT_ID() + offset, which is only valid
     *               for AUTO_INCREMENT primaries — rows inserted with explicit
     *               ids (e.g. the `player` table) should ignore the return value.
     */
    public function values(array $rows): array
    {
        $vals = [];
        foreach ($rows as $row) {
            $parts = array_map([self::class, 'quoteValue'], $row);
            $vals[] = '(' . implode(', ', $parts) . ')';
        }
        Table::DbQuery($this->dmlSql . ' ' . implode(', ', $vals));
        $firstId = Table::DbGetLastId();

        return array_map(fn($i) => $firstId + $i, array_keys($rows));
    }

    // ── UPDATE / DELETE ───────────────────────────────────────────────────────

    public function update(array $fields): self
    {
        $sets = [];
        foreach ($fields as $col => $val) {
            $sets[] = "`$col` = " . self::quoteValue($val);
        }
        $this->dmlSql = "UPDATE `{$this->table}` SET " . implode(', ', $sets);
        return $this;
    }

    /** SQL-level atomic increment: UPDATE tbl SET col = col + n */
    public function inc(array $fields): self
    {
        $sets = [];
        foreach ($fields as $col => $amount) {
            $sets[] = "`$col` = `$col` + " . (int) $amount;
        }
        $this->dmlSql = "UPDATE `{$this->table}` SET " . implode(', ', $sets);
        return $this;
    }

    public function delete(): self
    {
        $this->dmlSql = "DELETE FROM `{$this->table}`";
        return $this;
    }

    public function deleteSingle(): self
    {
        $this->delete();
        $this->limitClause = ' LIMIT 1';
        return $this;
    }

    /** Executes the pending UPDATE / DELETE. Returns the affected row count. */
    public function run(mixed $id = null): int
    {
        if ($id !== null) {
            $this->where($id);
        }

        Table::DbQuery($this->dmlSql . $this->whereClause . $this->orderByClause . $this->limitClause);
        return Table::DbAffectedRow();
    }

    // ── SELECT ────────────────────────────────────────────────────────────────

    public function select(array $columns): self
    {
        $this->selectColumns = $columns;
        return $this;
    }

    public function get(): Collection
    {
        $rows = Table::getObjectListFromDB($this->buildSelect());

        $result = [];
        foreach ($rows as $row) {
            $pk = $row['_pk'] ?? null;
            unset($row['_pk']);
            $item = is_callable($this->cast) ? ($this->cast)($row) : $row;
            if ($pk !== null) {
                $result[$pk] = $item;
            } else {
                $result[] = $item;
            }
        }

        return new Collection($result);
    }

    public function getSingle(): mixed
    {
        $this->limitClause = ' LIMIT 1';
        return $this->get()->first();
    }

    // ── AGGREGATES ────────────────────────────────────────────────────────────

    public function count(?string $field = null): int
    {
        return $this->aggregate('COUNT', $field);
    }

    public function min(string $field): int
    {
        return $this->aggregate('MIN', $field);
    }

    public function max(string $field): int
    {
        return $this->aggregate('MAX', $field);
    }

    // ── WHERE ─────────────────────────────────────────────────────────────────

    /**
     * where($id)                → `primary` = $id
     * where('col', $val)        → `col` = $val
     * where('col', 'op', $val)  → `col` op $val
     */
    public function where(mixed ...$args): self
    {
        $this->nextIsOr = false;
        return $this->appendWhere($args);
    }

    public function orWhere(mixed ...$args): self
    {
        $this->nextIsOr = true;
        return $this->appendWhere($args);
    }

    public function whereIn(string $col, array $values): self
    {
        $escaped = implode(', ', array_map([self::class, 'quoteValue'], $values));
        $this->startWhere();
        $this->whereClause .= "`$col` IN ($escaped)";
        return $this;
    }

    public function whereNotIn(string $col, array $values): self
    {
        $escaped = implode(', ', array_map([self::class, 'quoteValue'], $values));
        $this->startWhere();
        $this->whereClause .= "`$col` NOT IN ($escaped)";
        return $this;
    }

    public function whereNull(string $col): self
    {
        $this->startWhere();
        $this->whereClause .= "`$col` IS NULL";
        return $this;
    }

    /** Convenience for the near-universal `player_id` column. */
    public function wherePlayer(int $playerId): self
    {
        return $this->where('player_id', $playerId);
    }

    // ── MODIFIERS ─────────────────────────────────────────────────────────────

    public function orderBy(string $col, string $dir = 'ASC'): self
    {
        $dir = strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';
        if ($this->orderByClause === '') {
            $this->orderByClause = " ORDER BY `$col` $dir";
        } else {
            $this->orderByClause .= ", `$col` $dir";
        }
        return $this;
    }

    public function limit(int $limit, ?int $offset = null): self
    {
        $this->limitClause = " LIMIT $limit" . ($offset !== null ? " OFFSET $offset" : '');
        return $this;
    }

    // ── PRIVATE ───────────────────────────────────────────────────────────────

    private function buildSelect(): string
    {
        if ($this->selectColumns !== null) {
            $cols = implode(', ', array_map(fn($c) => "`$c`", $this->selectColumns));
        } elseif ($this->primary !== null) {
            // `_pk` becomes the Collection key; get() strips it before casting.
            $cols = "*, `{$this->primary}` AS `_pk`";
        } else {
            $cols = '*';
        }
        return "SELECT $cols FROM `{$this->table}`"
            . $this->whereClause
            . $this->orderByClause
            . $this->limitClause;
    }

    private function aggregate(string $func, ?string $field): int
    {
        $col = $field === null ? '*' : "`$field`";
        $sql = "SELECT $func($col) FROM `{$this->table}`" . $this->whereClause;
        return (int) Table::getUniqueValueFromDB($sql);
    }

    private function startWhere(): void
    {
        if ($this->whereClause === '') {
            $this->whereClause = ' WHERE ';
        } else {
            $this->whereClause .= $this->nextIsOr ? ' OR ' : ' AND ';
        }
    }

    private function appendWhere(array $args): self
    {
        $this->startWhere();
        $n = count($args);
        if ($n === 1) {
            $this->whereClause .= "`{$this->primary}` = " . self::quoteValue($args[0]);
        } elseif ($n === 2) {
            $this->whereClause .= '`' . $args[0] . '` = ' . self::quoteValue($args[1]);
        } elseif ($n === 3) {
            $this->whereClause .= '`' . $args[0] . '` ' . $args[1] . ' ' . self::quoteValue($args[2]);
        }
        return $this;
    }

    private static function quoteValue(mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }
        return "'" . Table::escapeStringForDB((string) $value) . "'";
    }
}
