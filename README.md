# Card Vault ⚾

Baseball card collection PWA.

**Live:** https://italian1superman.github.io/card-vault/

## Data

| Layer | Source |
|-------|--------|
| Player names | Embedded MLB register (offline) |
| Career stats | [MLB Stats API](https://statsapi.mlb.com) — Import from ⋯ or each card sheet |
| Catalog / prices / photos | CardSight (750 catalog calls/mo; images free) |
| Collection backup | This phone + optional **GitHub vault** push/pull |

## GitHub vault

1. Create a **private** repo (e.g. `card-vault-data`).
2. Create a fine-grained PAT with Contents read/write on that repo.
3. In Card Vault: **⋯ → GitHub vault → Configure** → Push.

Your cards, MLB stats, and prices sync as `vault/collection.json`. Photos are optional (file size).

## Local save

Cards auto-save in `localStorage`; photos in IndexedDB. Add to Home Screen on your phone.
