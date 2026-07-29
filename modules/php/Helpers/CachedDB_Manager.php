<?php
declare(strict_types=1);

namespace Bga\Games\WarOfTheToads\Helpers;

/**
 * DB_Manager plus a per-request read cache.
 *
 * A single BGA request typically reads the same table many times (state args,
 * ability resolution, notifications, getAllDatas). This loads it once.
 *
 * ── Keeping the cache honest ──────────────────────────────────────────────────
 *
 * The cache lives only for the current request, so it can never go stale across
 * turns — but it can within one. There are two safe ways to write, and one
 * unsafe one:
 *
 *  1. **Through the Models** (preferred). `$card->setLocation(LOCATION_HAND)` or
 *     `Cards::getHand($pId)->update('location', LOCATION_DISCARD)` mutates the
 *     very object the cache is holding and persists the column. Nothing to
 *     invalidate — the cache is correct by construction.
 *
 *  2. **Through create()/update()/remove()** below. These change row identity or
 *     bypass the Models, so they drop the cache themselves.
 *
 *  3. **Raw `self::DB()->…->run()` in a custom Manager method.** This writes
 *     behind the cache's back and CANNOT be detected here. Either express it as
 *     (1), or call `static::invalidate()` immediately after.
 *
 * Prefer (1). A bulk `update()` on a Collection costs one UPDATE per row, but
 * per-row writes are the norm on BGA anyway and the correctness is free.
 */
abstract class CachedDB_Manager extends DB_Manager
{
    /** Keyed by subclass name; each entry is a Collection of all rows. */
    private static array $cache = [];

    public static function fetchIfNeeded(): void
    {
        if (!array_key_exists(static::class, self::$cache)) {
            self::$cache[static::class] = static::DB()->get();
        }
    }

    public static function invalidate(): void
    {
        unset(self::$cache[static::class]);
    }

    public static function getAll(): Collection
    {
        static::fetchIfNeeded();
        return self::$cache[static::class];
    }

    public static function get(int $id): mixed
    {
        return static::getAll()->toAssoc()[(string) $id] ?? null;
    }

    public static function getMany(array $ids): Collection
    {
        $all = static::getAll()->toAssoc();
        $result = [];
        foreach ($ids as $id) {
            $key = (string) $id;
            if (isset($all[$key])) {
                $result[$key] = $all[$key];
            }
        }
        return new Collection($result);
    }

    // ── WRITES ────────────────────────────────────────────────────────────────
    // The inherited implementations issue SQL directly, so each drops the cache
    // rather than leaving a stale Collection behind. See the note on the class.

    public static function create(array $data): int
    {
        $id = parent::create($data);
        static::invalidate();
        return $id;
    }

    public static function update(int $id, array $data): void
    {
        parent::update($id, $data);
        static::invalidate();
    }

    public static function remove(int $id): void
    {
        parent::remove($id);
        static::invalidate();
    }
}
