# Card Vault ⚾

Baseball card collection PWA — catalog propagate, CardSight pricing, photo ID, Excel import/export.

**Live app:** https://italian1superman.github.io/card-vault/

## Open on iPhone

1. Open the live URL in **Safari** (not Chrome).
2. Tap **Share** → **Add to Home Screen**.
3. Open the **Card Vault** icon.

## How search works

- Header search / Explore: type a player → baseball catalog cards appear (CardSight).
- Add card → type player name → live strip of matching cards to tap into Have / Want.
- Sport is locked to **Baseball**.

## Where is my data?

| What | Where |
|------|--------|
| App (code/UI) | GitHub Pages / hub — shared by everyone |
| **Your cards + values** | **Only on your device** (`localStorage`) |
| **Your photos** | **Only on your device** (IndexedDB) |

**GitHub Pages is not a database.** It hosts the app shell. Your collection never uploads there automatically.

### Off-phone backup (recommended)

1. In the app: **⋯ → Backup + photos** → downloads a JSON file.
2. Store that file somewhere durable:
   - **Private GitHub repo** (best free sync): create `card-vault-backup` (private), upload the JSON via github.com
   - **iCloud Drive / Files** on iPhone
   - Email it to yourself
3. New phone / wipe: open Card Vault → **⋯ → Restore / import** that JSON.

Do **not** commit backups into the public `card-vault` app repo if it has real collection values.

## Desktop

Open the Pages URL in any browser. Use **⋯ → Backup** often.
