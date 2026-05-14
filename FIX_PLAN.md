# Implementation Plan — Tasks 1–4 (PnL, Allocated, YES/NO, Risk Caps)

## Pre-flight (do first, ~5 min)

Verify Polymarket's metadata + price endpoints work with one of the real asset_ids in `orders_paper.db`. Initial spike returned `"No orderbook exists"` for one token id and `[]` from gamma — could be a resolved market or wrong endpoint. Need to confirm before writing code that depends on these.

**Endpoints to validate:**
- `GET https://clob.polymarket.com/midpoint?token_id=<id>` → `{"mid": "0.xx"}`
- `GET https://gamma-api.polymarket.com/markets?clob_token_ids=<id>` → market with `outcomes` + `clobTokenIds`
- Alt: `GET https://clob.polymarket.com/markets/<condition_id>` if gamma doesn't work

If both endpoints fail, fallback is to fetch the market once via the trader's REST trade response (which includes a `market` field) and cache the YES/NO mapping there. **Decision point — stop and re-plan if endpoints don't work.**

---

## Task 1 — Compute real PnL

**Files:**
- `copytrade/dashboard/app/api/stats/route.ts`
- `copytrade/dashboard/app/api/positions/route.ts` (shared helper)

**Approach:**
1. Replace hardcoded `dailyPnl = 0` and `totalPnl = 0` in `stats/route.ts:44-45`.
2. Compute net position per asset_id from `bot_logs` joined to `target_trades`:
   - `netShares = SUM(buys.bot_size) - SUM(sells.bot_size)`
   - `costBasis = SUM(buys.bot_size * buys.bot_price) - SUM(sells.bot_size * sells.bot_price)`
3. For each open position (netShares > 0), fetch midpoint from CLOB midpoint endpoint.
4. `unrealizedPnl = (midprice * netShares) - costBasis`
5. `totalPnl = sum across all open positions` (skip realized PnL for v1 — paper data has no sells yet anyway).
6. `dailyPnl` = same calc but only counting positions opened today (cost basis from today's buys).

**Caching:** stats endpoint refreshes every 5s. Cache midprices for 15s in-memory at module level to avoid hammering Polymarket on every dashboard tick.

**Estimate:** 60–90 min including the endpoint spike and caching.

---

## Task 2 — Fix "Allocated Balance"

**File:** `copytrade/dashboard/app/api/stats/route.ts:25-31`

**Current:**
```sql
SELECT SUM(bot_size) FROM bot_logs WHERE action IN ('EXECUTED', 'PAPER_TRADE')
```
This sums shares and labels them as USD. Wrong.

**Replace with:**
```sql
SELECT
  SUM(CASE WHEN t.side = 'BUY'  THEN b.bot_size * b.bot_price ELSE 0 END)
  - SUM(CASE WHEN t.side = 'SELL' THEN b.bot_size * b.bot_price ELSE 0 END) AS allocated_usd
FROM bot_logs b
JOIN target_trades t ON b.target_trade_id = t.trade_id
WHERE b.action IN ('EXECUTED', 'PAPER_TRADE')
```

This gives USDC actually committed to net-long positions (buys − sells, priced at entry).

Also fix `OverviewView.tsx:50` "Remaining" math — currently displays `initialAllocation - allocatedUsd` which goes negative; should clamp at 0 or just hide.

**Estimate:** 15 min.

---

## Task 3 — Fix hardcoded `outcome: 'yes'`

**File:** `copytrade/dashboard/app/api/positions/route.ts:55`

**Approach:**
1. For each open position's `asset_id`, look up the market via gamma API (or equivalent — confirmed in pre-flight).
2. The market response includes `clobTokenIds: [tokenA, tokenB]` and `outcomes: ["Yes", "No"]` in matching order.
3. Find the index of our `asset_id` in `clobTokenIds`, return the matching `outcomes[index]`.
4. Cache the mapping in-memory by asset_id (markets don't change outcome labels; cache forever for the process lifetime).

**Estimate:** 30 min. Bumps to 45–60 min if gamma endpoint shape requires lookups via condition_id intermediate step.

---

## Task 4 — Wire up risk caps in `copier.py`

**File:** `polymarket_copier/copier.py`, inside `copy_trade()` after sizing, before the paper/live branch.

**Sub-task 4a — fix the sizing bug (prerequisite):**

Currently `copier.py:289-290`:
```python
fixed_usd_size = sizing_config.get('usdPerTrade', 1.0)
bot_size = float(fixed_usd_size)  # treats USD value as share count
```

Replace with:
```python
target_usd = float(sizing_config.get('usdPerTrade', 1.0))
if price <= 0:
    self.db.insert_bot_log(trade_id, "SKIPPED", "Invalid price")
    return
bot_size = target_usd / price  # actual shares to buy for target USD
trade_usd = target_usd
```

This means future trades commit exactly `$5` of USDC at the trader's price, in whatever share count that buys. Historical data unaffected.

**Sub-task 4b — add risk caps:**

Add a helper `_get_current_exposure()` that queries `orders_paper.db`:
```python
def _get_exposure(self, wallet: str | None = None, asset_id: str | None = None) -> float:
    # Returns net USDC committed (buys - sells) optionally filtered by wallet or asset_id
    ...
```

Then in `copy_trade()` after computing `trade_usd`, before logging the PAPER_TRADE:

```python
# Hard caps from README + globalSettings
SINGLE_TRADE_MAX = 5.0
PER_MARKET_CAP   = 5.0
PER_TRADER_CAP   = float(trader_config.get('risk', {}).get('maxTotalExposureUsd', 50))
TOTAL_BOT_CAP    = float(self.global_settings.get('totalBotExposureCap', 100))

if trade_usd > SINGLE_TRADE_MAX:
    self.db.insert_bot_log(trade_id, "SKIPPED", f"Single-trade cap (${trade_usd:.2f} > ${SINGLE_TRADE_MAX})")
    return

market_exposure = self._get_exposure(asset_id=asset_id)
if market_exposure + trade_usd > PER_MARKET_CAP:
    self.db.insert_bot_log(trade_id, "SKIPPED", f"Per-market cap (${market_exposure:.2f} + ${trade_usd:.2f} > ${PER_MARKET_CAP})")
    return

trader_exposure = self._get_exposure(wallet=wallet)
if trader_exposure + trade_usd > PER_TRADER_CAP:
    self.db.insert_bot_log(trade_id, "SKIPPED", f"Per-trader cap (${trader_exposure:.2f} + ${trade_usd:.2f} > ${PER_TRADER_CAP})")
    return

total_exposure = self._get_exposure()
if total_exposure + trade_usd > TOTAL_BOT_CAP:
    self.db.insert_bot_log(trade_id, "SKIPPED", f"Total bot cap (${total_exposure:.2f} + ${trade_usd:.2f} > ${TOTAL_BOT_CAP})")
    return
```

**Skipped from README:** the $20 daily loss limit requires real PnL tracking with realized + unrealized. That depends on Task 1 + future sell handling. Note as TODO comment in code; revisit after Task 1 is solid.

**Estimate:** 60 min including the helper, sizing fix, caps, and one manual test cycle.

---

## Total estimate and order

| Step | Task | Time |
|---|---|---|
| 0 | Endpoint pre-flight spike | 5–15 min |
| 1 | Stop bot (one-line) | 1 min |
| 2 | Task 4a — sizing bug fix | 10 min |
| 3 | Task 4b — risk caps | 50 min |
| 4 | Task 2 — Allocated balance SQL | 15 min |
| 5 | Task 3 — YES/NO via gamma | 30–60 min |
| 6 | Task 1 — PnL with midpoint cache | 60–90 min |
| 7 | Restart bot, verify in dashboard | 10 min |
| | **Total** | **~3–4 hours** |

Order is intentional: bot-side changes (4a, 4b) come first because they need the bot stopped. Dashboard changes (1, 2, 3) only need the Next.js dev server reload, no bot restart. Hardest endpoint-dependent task (1) goes last so a failure there doesn't block the cleaner wins.

---

## Things I will NOT do unless you ask

- Touch the websocket/on-chain plan (Task 5 — separate discussion).
- Add daily-loss-limit pause (depends on Task 1 maturing first).
- Refactor `usdPerTrade` field name in `config.json` schema (would break the dashboard config editor; rename later in a coordinated pass).
- Touch `live` mode logic — all changes verified in paper mode only.

---

## Decision points where I'll stop and ask

1. After pre-flight: if midpoint or gamma endpoints don't return what we need, stop and re-plan Task 1 and Task 3.
2. After Task 4 (bot changes): confirm the bot restarts cleanly and starts logging `SKIPPED — cap` entries before moving to dashboard work.
3. Before Task 1 implementation: confirm caching strategy is acceptable (15s in-memory cache vs. no cache vs. Redis-style).
