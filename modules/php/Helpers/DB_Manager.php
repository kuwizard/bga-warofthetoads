<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Helpers;

/**
 * Base for the one-Manager-per-table rule: every custom table gets a Manager,
 * and all SQL for that table goes through it. Nothing outside a Manager should
 * ever touch `DbQuery` directly.
 *
 * Prefer extending {@see CachedDB_Manager} — it adds per-request caching and
 * has the same API.
 */
abstract class DB_Manager
{
    protected static string $table;
    protected static string $primary = 'id';

    /** Override to turn raw DB rows into typed Model objects. */
    protected static function cast(array $row): mixed
    {
        return $row;
    }

    public static function DB(): QueryBuilder
    {
        return new QueryBuilder(static::$table, fn($row) => static::cast($row), static::$primary);
    }

    public static function get(int $id): mixed
    {
        return static::DB()->where($id)->getSingle();
    }

    public static function getAll(): Collection
    {
        return static::DB()->get();
    }

    public static function create(array $data): int
    {
        return static::DB()->insert($data);
    }

    public static function update(int $id, array $data): void
    {
        static::DB()->update($data)->where($id)->run();
    }

    public static function remove(int $id): void
    {
        static::DB()->delete()->where($id)->run();
    }
}
