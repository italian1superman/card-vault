# Card Vault ⚾

**Live:** https://italian1superman.github.io/card-vault/

## Public data on GitHub

| File | What |
|------|------|
| `data/mlb-career.json` | MLB career hitting/pitching (~2k recent/legend players) |
| App UI | GitHub Pages |

Your **card collection** stays on your phone. **⋯ → Backup** exports a local JSON.

## Card photos

There are millions of baseball cards — they are **not** stored as image files in this repo (that would be terabytes).

Instead, every card that appears in Find / Sets / your vault loads its picture **on demand** from CardSight’s free image API, then caches it on the phone (IndexedDB). In a set checklist, use **🖼 All photos** to cache the whole set.

## MLB stats

⋯ → **MLB stats** / Import loads career lines from `data/mlb-career.json`, with live MLB API fallback.
