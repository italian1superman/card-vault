# Card Vault ⚾

Baseball card collection PWA.

**Live:** https://italian1superman.github.io/card-vault/

## Seamless save (same phone) — already built

| | |
|--|--|
| **Where** | On **this device**, in the browser/app storage for Card Vault |
| **Cards & prices** | `localStorage` key `cardVault.v2` |
| **Photos** | IndexedDB database `cardVaultImgs` |
| **How** | Every edit calls `save()` immediately. Opening the page calls `load()` — no login, no upload |

**Do this once:** Safari → Share → **Add to Home Screen**, then always open that icon.

That is the seamless path. Your collection is waiting whenever you open the app on that phone.

### What is *not* automatic

- A **different phone**, **Chrome vs Safari**, or **Private tab** = empty vault (different / wiped storage)
- **GitHub Pages** hosts the app code only — it does **not** store your cards
- iOS may clear site data for rarely used *browser tabs*; the Home Screen app is much safer

### Off-phone copy (optional safety net)

⋯ → **Backup + photos** → JSON file → private GitHub / iCloud → ⋯ → Restore on a new device.

Cross-device *auto* sync (open anywhere, same collection) needs a cloud account — say if you want that next.
