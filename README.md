# Card Vault ⚾

Baseball card collection PWA with a free multi-layer online data stack.

**Live:** https://italian1superman.github.io/card-vault/

## Online data (free + efficient)

| Layer | Source | Cost |
|-------|--------|------|
| Device cache | IndexedDB `net` store | Free — catalog 14d, prices 3d |
| Players | Embedded MLB register + MLB Stats API + TheSportsDB | Free |
| Images / autocomplete / PSA pop | CardSight free endpoints | Free (not billed) |
| Catalog + market prices + photo ID | CardSight | 750 calls/mo free |
| Verify | eBay sold / TCDB / PriceCharting links | Free |

Catalog adds store a `csId` so later pricing uses bulk ID calls (accurate, 1 call ≤100 cards). Use **⋯ → Refresh stale prices** for cards with prices older than 3 days.

## Seamless save (same phone)

Cards auto-save in `localStorage`; photos in IndexedDB. Add to Home Screen once.

## Off-phone backup

⋯ → Backup + photos → private GitHub / iCloud → Restore on a new device.
