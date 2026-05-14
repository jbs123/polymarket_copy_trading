# Project Status — Polymarket Copy Trading Bot

_Last updated: 2026-05-14_

## TL;DR

The bot is **running and paper trades are landing correctly**. PnL is real (computed from Polymarket midpoints). Risk caps are enforced. Six wallets being watched. Open work item: websocket migration for sub-second latency (see `WEBSOCKET_PLAN.md`).

---

## What's Running Right Now

| Component | State | Notes |
|---|---|---|
| `polymarket_copier/copier.py` | Running, PID 2567154 | Started 2026-05-13 22:02 local. Polls every 5s, paper mode. |
| Next.js dashboard | Running on `http://localhost:3000` | Started 2026-05-12 (long-lived). Polls `/api/stats` every 5s. |
| Active wallets | **6 enabled** | bonereaper, 3 user-supplied, JetFadil, bozo-1 |
| Paper trades fired (since last reset) | First few landed ✅ | Verified: `allocatedUsd=$15`, `totalPnl=-$1.68` |

**To restart the bot:**
```bash
cd /home/joshua/Documents/GitHub/polymarket_copy_trading/polymarket_copier
pkill -f "python3 copier.py"
nohup bash -c "source venv/bin/activate && python3 copier.py" > copier.log 2>&1 &
disown
```

---

## What We Fixed This Session

### 1. Latency cap was the wrong floor — bot wasn't trading at all
- **Symptom:** 100% of attempted trades skipped with `Latency exceeded (8.7s+ > 5.0s)`.
- **Root cause:** `max_latency = 5.0` was hardcoded in `copier.py`, and the Polymarket Data API has a publication delay (~8s floor).
- **Fix:** `copier.py:244` now reads `globalSettings.maxLatencySec` from `config.json`. Bumped default to 60s.
- **Real fix later:** websocket / on-chain listener — see `WEBSOCKET_PLAN.md`.

### 2. Sizing bug — `usdPerTrade=5` was treated as 5 shares, not $5
- **Symptom:** Trade notional varied wildly with price (5 shares at $0.47 = $2.35, at $0.95 = $4.75).
- **Fix:** `copier.py:285-293` — `bot_size = trade_usd / price` so committed USDC is exactly `usdPerTrade`. Old data unaffected (just inconsistent intent).

### 3. Risk caps from README were not enforced anywhere
- **Symptom:** Bot had committed $186 of paper notional with a documented $100 ceiling.
- **Fix:** Added `_get_exposure()` helper + 4 cap checks in `copy_trade()`:
  - Single-trade max ($5)
  - Per-market cap ($5)
  - Per-trader cap (from `risk.maxTotalExposureUsd`)
  - Total bot cap (from `globalSettings.totalBotExposureCap`)
- **Skipped:** Daily loss limit ($20) — needs realized + unrealized PnL tracking. TODO comment in code.

### 4. Schema extension — capture market metadata at ingest
- Added `condition_id`, `outcome`, `slug`, `title` columns to `target_trades`.
- `insert_target_trade()` and `fetch_target_trades()` updated to populate them from the data-api response (which already returned this — we'd been discarding it).
- Migration is idempotent (runs in `init_db()` via `PRAGMA table_info` check).

### 5. Dashboard "Allocated Balance" was wrong
- **Was:** `SUM(bot_size)` — summed shares, labeled as USD.
- **Now:** `SUM(bot_size * bot_price)` signed by side. Real USDC committed.
- File: `copytrade/dashboard/app/api/stats/route.ts:25-35`.
- Bonus: "Remaining" display clamped to 0 in `OverviewView.tsx:50`.

### 6. Dashboard PnL was hardcoded to $0
- **Was:** `totalPnl = 0.00; dailyPnl = 0.00;` literally hardcoded.
- **Now:** For each open position, fetch token's current price via `https://clob.polymarket.com/markets/{conditionId}` and compute `(price * netShares) - costBasis`.
- Shared helper: `copytrade/dashboard/lib/polymarket.ts` (in-memory cache, 15s TTL, dedupes inflight requests).
- Skips positions with `condition_id IS NULL` (pre-schema rows).

### 7. Dashboard "outcome: yes" was hardcoded
- **Was:** `outcome: 'yes'` on every position regardless of which token was bought.
- **Now:** Uses stored `outcome` column ("Yes"/"No"/"Up"/"Down"/etc). Falls back to `"unknown"` for old rows.
- File: `copytrade/dashboard/app/api/positions/route.ts`.

### 8. `timeHeld: "-3h"` rendering bug
- SQLite stored naive UTC strings; JS was parsing them as local → negative diff.
- Fix: append `Z` and parse as UTC. Floor at 0.

### 9. Killed a duplicate copier process
- Two instances were racing (started 11:07 and 13:38 local). Now exactly one runs.

### 10. Paper-mode data reset
- Old `orders_paper.db`, `bot_logs_paper.csv`, `target_trades_paper.csv` backed up as `*.bak_20260513_220205`.
- Fresh DB created with full new schema from the start.

---

## Configuration State

### `config.json` (current)

- **maxLatencySec:** 60 (was 5)
- **totalBotExposureCap:** 500 (was 100, raised for scalper activity)
- **Per-market cap:** 5 (in code, README default)
- **Single-trade max:** 5 (in code, README default)

### Watched wallets (6 enabled)

| Nickname | Wallet | Source | Activity |
|---|---|---|---|
| bonereaper | `0xeebde7a0…3e6eba30` | Original | 5-min BTC up/down. Currently idle. |
| `0x2a2c…9bc1` | `0x2a2c53bd…3dfb9bc1` | User added | UK politics. Moderate cadence. |
| `0xa5ea…d96a` | `0xa5ea13a8…56bd96a` | User added | Esports. |
| `0x9f2f…2ca8` | `0x9f2fe025…702d2ca8` | User added | Premier League (mostly resolved). |
| **JetFadil** | `0xe0229e10…7bd6603` | Auto-suggested scalper | BTC 5-min. Fills every ~5s. |
| **bozo-1** | `0x8ef6a1cc…a23563ee` | Auto-suggested scalper | BTC 5-min. Fills every ~5s. |

---

## Known Limitations / Caveats

- **Per-market cap interaction with scalpers.** JetFadil and bozo-1 fire many fills per market within seconds. The $5 per-market cap means we take 1 fill per market and skip the rest. Most SKIPPED rows in current logs are `Per-market cap` — intended behavior, but noisy.
- **PnL is unrealized-only.** No realized PnL from sells (the trader hasn't sold yet on these short markets — they resolve to 0/1). Once a market resolves, the held-token price reflects the resolution, so PnL is correct even for resolved markets.
- **Daily loss limit not enforced.** TODO comment in `copy_trade()`. Needs realized + unrealized tracking.
- **Latency floor ~10-60s for steady state** because of REST polling + API publication delay. Sub-second requires the websocket migration.
- **Two Python `DeprecationWarning`s** in `copier.py` for `datetime.utcnow()` / `utcfromtimestamp()` — non-blocking, fix when convenient.
- **Old positions display `outcome: unknown`** — rows inserted before the schema change have NULL outcome. Not an active concern since paper DB was reset; only relevant if you restore from `.bak_*`.
- **PnL/midpoint cache is per-Next.js-process.** A second tab on the dashboard doesn't share the cache. Fine for solo use.

---

## Open Plans (Not Yet Implemented)

### Sub-second latency — Polygon on-chain listener
- Full plan in **`WEBSOCKET_PLAN.md`** (root of repo).
- TL;DR: build `polymarket_copier/onchain_listener.py` that subscribes to Polymarket exchange contracts' fill events on Polygon, decodes them, and pushes trade dicts onto an `asyncio.Queue` consumed by the existing `copy_trade()`.
- Estimated effort: **4–6 hours**.
- Why not the Polymarket CLOB websocket: the `market` channel's `last_trade_price` event does NOT include `maker_address`, so we can't filter by trader. Documented in `WEBSOCKET_PLAN.md`.
- Status: planned, not started. Next-session topic.

### Daily loss limit
- Per README: $20 → 24h pause.
- Depends on full PnL tracking maturing first.

---

## Key Files (Quick Reference)

| Path | Role |
|---|---|
| `polymarket_copier/copier.py` | The bot. Single Python file. |
| `polymarket_copier/.env` | Wallet key, paper-trade flag. |
| `config.json` | Watched wallets, global settings. Re-read every 5s by bot. |
| `orders_paper.db` | SQLite — `target_trades` + `bot_logs`. |
| `bot_logs_paper.csv` | Action log (`PAPER_TRADE` / `SKIPPED` / `EXECUTED` / `ERROR`). |
| `target_trades_paper.csv` | Mirror of `target_trades` table. |
| `copytrade/dashboard/app/api/stats/route.ts` | Allocated, PnL, recent activity. |
| `copytrade/dashboard/app/api/positions/route.ts` | Open positions w/ live token prices. |
| `copytrade/dashboard/app/api/config/route.ts` | GET/POST `config.json`. |
| `copytrade/dashboard/lib/polymarket.ts` | Shared market-fetch helper w/ 15s cache. |
| `FIX_PLAN.md` | Plan that drove this session's work (kept for reference). |
| `WEBSOCKET_PLAN.md` | Next-up work for sub-second latency. |
| `*.bak_20260513_220205` | Pre-reset paper data archive. |

---

## Verification Commands

```bash
# Is the bot alive?
ps -ef | grep '[c]opier.py'

# Latest bot activity:
tail -10 bot_logs_paper.csv

# Action tally:
awk -F',' 'NR>1 {print $3}' bot_logs_paper.csv | sort | uniq -c

# Real-time stats:
curl -s http://localhost:3000/api/stats | python3 -m json.tool

# Open positions:
curl -s http://localhost:3000/api/positions | python3 -m json.tool

# Tail the bot log:
tail -f polymarket_copier/copier.log
```
