# `Data/` — static game content

One PHP class per card / tile / character / location, holding the **rules text of
that component and nothing else**. This is the third leg of the architecture,
alongside `Managers/` and `Models/`:

| Folder | Holds | Lifetime |
|---|---|---|
| `Managers/` | all SQL for one table | — |
| `Models/` | one **row** of that table, typed | changes during the game |
| `Data/` | one **component definition** | fixed for the whole game |

A `Models\Card` is "card #14, owned by player 234, in their hand". A
`Data\Cards\Blacksmith` is "the Blacksmith costs 2 wood and lets you draw a
card" — the same object for every game ever played.

## Why the split

Card abilities are the part of a board game that grows without bound. Kept in
Managers or state classes they become a `switch` with ninety branches; kept here
each card is a small class you can read on its own, and adding a card touches
exactly one new file.

## Shape

Group by category in subfolders once there is more than a handful:

```
Data/
  Cards/
    Blacksmith.php
    Marketplace.php
  Characters/
    Captain.php
```

Give the category an abstract base declaring the hooks the engine calls
(`onPlay()`, `getCost()`, `isPlayable()`, …), have each component override only
what it changes, and expose a static registry — usually `id => class-string` —
that a Manager's `cast()` can look up to turn a DB row into the right subclass.

## Rules

- **Stateless.** Never store per-game data on a `Data/` class; that belongs in a
  Model or a global. These are shared definitions, not instances.
- **`clienttranslate()` on every rules string**, including ability descriptions
  that are only ever passed as notification args.
- **No SQL.** Read through Managers like everything else.
- **Ids are permanent.** They end up in saved games and replays; renumbering
  breaks games in progress.
