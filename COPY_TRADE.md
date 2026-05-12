# Copy Trade Bot — Requirements & Build Spec

**Repo:** `copytrade` (separate from `lab` and `weatherbot`)
**Sister docs:** ARCHITECTURE.md, CONTENT_OPERATIONS.md
**Audience:** Multiple AI agents working in parallel — UI agent, backend agent, data agent, etc. Each agent owns specific components defined in §2.
**Status:** v1 spec. v2 features explicitly deferred and called out.

---

## 1. Purpose

A bot that copies the trades of selected Polymarket traders, with configurable reaction modes, fixed sizing, and hard risk caps. Initially follows traders Josh manually selects from Polymarket's leaderboard. Later (Phase 2 / v2) extends to automated trader discovery via a scoring pipeline.

Goal: grow an initial $100 allocation by following provably-skilled traders.

Constraints (in priority order):
1. **Must not interfere with production weatherbot** (the Jetson's primary purpose) or the lab. See ARCHITECTURE.md §6.
2. **Hard $100 cap on real exposure.** No automatic cap increases.
3. **Honest content material.** Every trade and outcome is logged in a form that can be filmed and published.

---

## 2. System overview & agent ownership

Five logical components. Each can be owned by a separate AI agent working in parallel against a shared contract. **The contracts are the only shared surface.** Agents must not touch each other's internals.

| # | Component | Owner agent | Lives on | Talks to |
|---|---|---|---|---|
| 1 | **Data Collector** (trader + market data ingestion) | Data agent | Jetson | Polymarket public API |
| 2 | **Reaction Engine** (modes, sizing, filters) | Backend agent | Jetson | Data Collector (read), Execution Engine (write) |
| 3 | **Execution Engine** (FROZEN — order routing, risk, kill switch) | Backend agent | Jetson | Polymarket trading API |
| 4 | **Trader Scoring Pipeline** (v2 — analyzes downloaded trader data) | Data/ML agent | Workstation (not Jetson) | Data Collector output |
| 5 | **Dashboard + Config UI** | UI agent | Workstation | Reads NAS replicas + posts config |

**Shared contracts** in `copytrade/contracts/` (Pydantic schemas). All agents read these; no agent modifies them without coordination.

```
┌─────────────────────────────────────────────────────────────────┐
│                          JETSON                                  │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Data Collector   │───►│ Reaction Engine  │                   │
│  │  (ct-recorder)   │    │   (ct-engine)    │                   │
│  └──────────────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│      tape/                  ┌──────────────────┐                │
│      trader_events/         │ Execution Engine │                │
│           │                 │   (FROZEN)       │                │
│           │                 └──────────────────┘                │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            ▼ nightly rsync
   ┌─────────────────┐
   │ Synology NAS    │
   └────────┬────────┘
            │
            ▼ read
   ┌─────────────────────────────────────┐
   │  Workstation                        │
   │  • Trader Scoring Pipeline (v2)     │
   │  • Dashboard + Config UI            │
   └─────────────────────────────────────┘
```

---

## 3. Hard rules (non-negotiable)

These are enforced in code, not by convention. The Reaction Engine cannot bypass them. The UI cannot disable them. Only Josh, manually editing config files, can change them.

### 3.1 Capital caps (v1)

- **Total bot exposure ceiling:** $100 USDC
- **Per-trader exposure ceiling:** $50 USDC (forces minimum diversification across 2+ traders)
- **Per-market exposure ceiling:** $5 USDC
- **Per-trade sizing:** $1 USDC (fixed, default)
- **Daily loss limit:** $20. If exceeded, bot pauses for 24 hours and alerts.
- **Single-trade max:** $5 (in case someone misconfigures sizing). Hard rejection above this.

The bot tracks `copytrade_allocated_usd` internally. Starts at $100. Adjusts with PnL. **Never spends beyond it**, regardless of wallet balance (which is shared across tenants).

### 3.2 Wallet coexistence

Shared funded Polymarket wallet across weatherbot + lab + copy bot. The bot is "blind" to the other tenants' allocations and only tracks its own. Wallet should be funded with a buffer beyond the sum of all tenant allocations (see ARCHITECTURE.md §6.5).

If the wallet rejects a trade due to insufficient balance (another tenant got there first), the bot retries up to 3 times with 1-second backoff. After 3 failures, the trade is logged-and-skipped — not retried indefinitely.

### 3.3 Process isolation

- User `copytrade`. Own venv. Docker container `ct-engine` and `ct-recorder`.
- systemd units with hard CPU/memory caps (`CPUQuota=20%`, `MemoryMax=1G` per service, tune empirically).
- Logs `/var/log/copytrade/`. Config `/etc/copytrade/`. State `/var/lib/copytrade/`.
- **Verify before deploy:** copy bot uninstall leaves weatherbot and lab running.

### 3.4 Shared VPN flag

Reads `/var/run/vpn-status` written by the shared `vpn-monitor.service`. If VPN is degraded, bot pauses all new trades (existing positions remain). Does not unwind on VPN drop — that's a manual decision.

### 3.5 Capital-mode promotion

Like the lab, the copy bot has capital modes:
- `paper`: simulated trades, no real money. Default for any new follower config.
- `live_small`: real money, capped at the rules in §3.1.
- `live_full`: deferred to v3 or beyond; not in scope.

Promotion is manual config edit only. No AI can promote.

---

## 4. Component spec — Data Collector

**Owner:** Data agent
**Runtime:** Jetson, `ct-recorder` container, polling
**Output:** parquet files on Jetson SSD, rsynced to NAS nightly

### 4.1 What it records

**Trader event stream (`trader_events/YYYY/MM/DD.parquet`):**
| field | type | notes |
|---|---|---|
| timestamp | datetime | when bot detected the trade |
| trader_timestamp | datetime | when Polymarket says trade happened |
| trader_wallet | string | 0x address |
| market_id | string | Polymarket market ID |
| market_slug | string | for human readability |
| outcome | enum | `yes` / `no` |
| side | enum | `buy` / `sell` |
| price | float | their fill price, 0–1 |
| size_usd | float | their trade size |
| trade_id | string | Polymarket trade hash, for dedup |
| event_type | enum | `trade` / `partial_fill` / `merge` / `split` / `resolution_exit` |

`event_type` matters. Resolution exits are not strategic sells and should not trigger copy behavior.

**Followed-trader portfolio snapshots (`trader_portfolios/YYYY/MM/DD.parquet`):**
| field | type | notes |
|---|---|---|
| timestamp | datetime | snapshot time |
| trader_wallet | string | 0x address |
| total_usd_value | float | their portfolio mark-to-market |
| open_positions | json | list of {market_id, outcome, size, avg_price} |

Snapshot every 6 hours per followed trader. Powers per-trader exposure tracking and (later) Phase 2 scoring.

**Market context (`market_context/YYYY/MM/DD.parquet`):**
| field | type | notes |
|---|---|---|
| timestamp | datetime | snapshot time |
| market_id | string |  |
| best_bid | float | current best bid on yes |
| best_ask | float | current best ask on yes |
| spread | float |  |
| volume_24h_usd | float |  |
| category | string | inferred or labeled |

Snapshot for every market where a followed trader has a position OR has traded in the last 7 days. This is the price-drift comparison source. Snapshot every 30 seconds for active markets, every 5 minutes for less active.

### 4.2 Polling strategy (v1)

- **Trader trades:** poll Polymarket's user activity endpoint every 2 seconds per followed trader. Detect new trades by `trade_id` (dedup). Target latency: 2–4 seconds from their trade to detection. Compatible with the 5-second `max_latency_seconds` budget.
- **Trader portfolios:** poll every 6 hours per followed trader.
- **Market context:** poll every 30s for active markets, 5min for less active.

### 4.3 Websocket upgrade (v1.5, fast follow)

After v1 is stable (~2 weeks of operation), add Polymarket websocket subscription as the primary trade-detection channel. Polling stays as fallback for missed events. Target latency drops to <1 second.

Worth a content note: the latency reduction itself is a great episode — "polling vs websocket on a copy bot, what's the difference in PnL?"

### 4.4 Trader universe

**Active follow list** (`config/followed_traders.yaml`, see §6) — traders the bot is actively watching for trades.

**Wider universe** — the bot also passively downloads trade histories for the top ~200 traders on Polymarket's public leaderboard, refreshed weekly. This data is for v2's scoring pipeline. Stored in `trader_histories/wallet=0xABC.../` partitioned by trader.

Wider-universe collection is rate-limit-aware. If Polymarket throttles, it backs off and resumes; active-follow polling has priority.

### 4.5 Rate limits

Polymarket's public API has rate limits. The Data Collector must:
- Self-throttle to stay under documented limits
- Detect 429 responses and exponential-backoff
- Never share a connection pool with the lab's recorder or weatherbot's API client
- Alert (Discord webhook) if sustained throttling lasts >5 minutes

### 4.6 Storage

- Local Jetson: `/var/lib/copytrade/data/` — last 90 days hot
- Nightly rsync to NAS at 03:30 (after lab's 03:00 rsync to spread I/O)
- S3 cold archive via existing NAS job

Estimated rate: ~500 MB/month per followed trader (active polling + portfolio snapshots), ~2 GB/month for the wider 200-trader universe. ~30 GB/year total. Plan accordingly.

### 4.7 Schema contracts

All schemas in `copytrade/contracts/` as Pydantic models. The Data Collector writes; the Reaction Engine and Scoring Pipeline read. The Reaction Engine should never inspect raw Polymarket JSON — only typed objects.

---

## 5. Component spec — Reaction Engine

**Owner:** Backend agent
**Runtime:** Jetson, `ct-engine` container
**Input:** trader event stream from Data Collector
**Output:** `Decision` objects to Execution Engine

### 5.1 Reaction modes (the nine, formalized)

Per-trader configuration. Mutually exclusive groups enforced by config validator:

**Group A — Buy-side reaction (pick one):**
- `follow_buys: true` — when trader buys, bot buys same market/side
- `counter_buys: true` — when trader buys, bot buys the opposite outcome
- (Off) — bot does not react to their buys

**Group B — Sell-side reaction (pick one):**
- `follow_sells: true` — when trader sells, bot sells its position in that market
- `buy_on_sells: true` — when trader sells, bot BUYS the same side (fade the exit)
- `counter_sells: true` — when trader sells, bot buys the opposite outcome
- (Off) — bot does not react to their sells

**Side filter:**
- `copy_side: yes | no | both` — only copy trades on a specific outcome side, or both. Independent of buy/sell reaction modes.

**Sell-when-no-position rule (per Josh's answer):**
If a sell-reaction fires but the bot has no position to sell, **skip**. Do not go short via inverse buys.

**Sell sizing rule (per Josh's answer):**
On `follow_sells`, sell proportional to the trader's exit. If they exit 50% of their position, the bot exits 50% of its copied position in that market.

### 5.2 Sizing

v1: **fixed `usd_per_trade`, default $1.00.** Configurable per-trader (override) and globally (default).

On buys: bot orders `usd_per_trade` worth of shares at current market or filter-permitted price.

If the trader's trade is smaller than `usd_per_trade` (e.g., they put $0.30, bot would put $1), still copy. The bot's size is governed by its own rule, not theirs.

### 5.3 Latency + drift filters

Per-trader and global, with per-trader overrides:

```yaml
latency:
  max_latency_seconds: 5
  max_price_drift_pct: 3
  max_drift_absolute_cents: 3
```

Skip the copy if **any** of:
- More than `max_latency_seconds` since trader's fill timestamp
- Current best ask/bid more than `max_price_drift_pct` away from their fill
- Current best ask/bid more than `max_drift_absolute_cents` away from their fill

Log every skip with the reason. Skip rates are themselves a metric — too high = the bot is uncompetitive, too low = filters are too loose.

### 5.4 Market filtering

Per-trader market filter:

```yaml
market_filters:
  include_categories: [all]  # or [sports, weather, politics, crypto]
  exclude_categories: []
  min_24h_volume_usd: 1000
  exclude_market_slugs: []
  exclude_resolution_pending: true  # skip markets within N hours of resolution
  min_hours_to_resolution: 2
```

Category classification is best-effort (Polymarket's labels are inconsistent). Bot uses Polymarket's official category when present; for unlabeled markets, falls back to keyword inference. Misclassifications get filed as bugs; do not block deploy on perfect classification.

### 5.5 Risk gating (engine-side, in addition to execution-side hard caps)

Before generating a `Decision`, the Reaction Engine checks:
- Per-trader exposure cap (`max_total_exposure_usd`)
- Per-market exposure cap (across all traders)
- Total bot exposure cap
- Daily loss limit
- Trade count rate limits (max 30 trades/hour as a safety brake)

If a gate would be exceeded, the trade is **skipped**, not partially sized. Logged with reason.

### 5.6 Trade event semantics

The engine reacts only to `event_type in {trade, partial_fill}`. Specifically ignores:
- `resolution_exit` — not strategic
- `split`, `merge` — Polymarket's auto-merge mechanics, not the trader's decision

Partial fills from the trader are treated as a single trade event, deduped by `trade_id`.

### 5.7 Auto-merge (DEFERRED to v2)

Auto-merge is out of scope for v1. The bot will hold both sides if reaction modes drive it there, without attempting risk-free arb. v2 adds a separate auto-merge module that watches the bot's own positions and merges opportunistically.

### 5.8 Price Match Mode (DEFERRED to v2)

v1 uses market orders with slippage warnings (see §6.5 on Execution Engine). v2 adds limit orders with time-limit and market-fallback.

### 5.9 Pause/Unwind operations

Two distinct operations exposed via CLI and UI:

- `copytrade pause <trader_wallet>` — stop reacting to that trader's new trades. Existing copied positions remain.
- `copytrade unwind <trader_wallet>` — close all positions opened from copying this trader. Confirmation required.
- `copytrade kill` — global pause + cancel open orders. Existing positions remain. Manual unwind required separately.

---

## 6. Component spec — Execution Engine (FROZEN)

**Owner:** Backend agent (initial implementation only)
**Runtime:** Jetson, inside `ct-engine` container
**Modification rule:** Once implemented, edits require explicit Josh approval. AIs cannot modify post-v1.

### 6.1 Interface

Receives `Decision` objects from the Reaction Engine. Returns `OrderResult` (filled, partially filled, rejected, error).

```python
class CopyTradeDecision(BaseModel):
    market_id: str
    outcome: Literal["yes", "no"]
    action: Literal["buy", "sell"]
    size_usd: float
    price_limit: float | None  # None = market order (v1 default)
    triggered_by_trader: str
    triggered_by_trade_id: str
    reaction_mode: str  # for audit
    reasoning: str
```

### 6.2 Hard risk caps (enforced regardless of what Reaction Engine says)

- Single-trade size ≤ $5
- Per-market exposure ≤ $5
- Per-trader exposure ≤ $50
- Total bot exposure ≤ $100
- Daily loss ≤ $20 (then auto-pause 24h)

These are duplicate of §3.1 by design. The Reaction Engine should also enforce them, but the Execution Engine is the last line of defense. **Both layers fail-closed.**

### 6.3 Order routing (v1)

- Market orders only.
- Slippage warning: if expected fill price exceeds best ask/bid by more than `slippage_tolerance_pct` (default 2%), **reject** the trade. Log with reason. (v1 is fail-closed on slippage; v2 may add a "warn and proceed" mode.)
- Retries on transient failures: 3 retries, 1-second backoff (per Josh's preference, default of 3).

### 6.4 Logging

Every order attempt is logged to SQLite at `/var/lib/copytrade/orders.db`. Every order, every retry, every rejection. Schema:

```
order_id, timestamp, triggered_by_trader, triggered_by_trade_id,
reaction_mode, market_id, outcome, action, size_usd_requested,
size_usd_filled, price_requested, price_filled, latency_ms,
trader_price, price_drift_pct, status, error_msg
```

This log is the content asset. Every episode about the copy bot uses this. It must be complete, accurate, and queryable.

### 6.5 Kill switch

`copytrade kill` halts copy bot only. Does not touch weatherbot or lab.

Auto-fires on:
- VPN flag down
- Daily loss limit hit
- 5+ consecutive order errors (suggests API/auth problem)
- Manual invocation

---

## 7. Component spec — Trader Scoring Pipeline (v2)

**Owner:** Data/ML agent
**Runtime:** Workstation (not Jetson)
**Status:** v2 — deferred until ≥30 days of trader history data has accumulated
**Input:** `trader_histories/` parquet data from Data Collector
**Output:** scored trader leaderboard, written to `reports/trader_scores_YYYYMMDD.json`

### 7.1 Scoring metrics (v2)

Per trader, compute:

- **Time-weighted mark-to-market PnL** (not resolution PnL) over trailing 30/90/180 days
- **Sharpe-like ratio:** mean return / std dev of returns, computed on time-weighted returns
- **Trade count:** min threshold (e.g., 50 trades) to qualify as ranked
- **Activity recency:** must have traded in last 30 days
- **Win rate at non-trivial confidence:** % of trades entered at price 0.20–0.80 that resolved favorably (filters out tape-stacking at 0.95+)
- **Market diversity:** Herfindahl index across markets (penalize all-eggs-in-one-event)
- **Backtest-of-copying:** simulated PnL of having copied them with fixed $1 sizing, 5s latency, and the configured filters. This is the headline metric.

### 7.2 Output

Ranked JSON with all metrics per trader. Human reviews; human promotes traders into the active-follow list. **The pipeline ranks; the human follows.** No auto-follow.

### 7.3 Episode content

The scoring pipeline output is itself an episode: "I scored every top Polymarket trader. Here are the actually-good ones." See CONTENT_OPERATIONS.md.

---

## 8. Component spec — Dashboard + Config UI

**Owner:** UI agent
**Runtime:** Workstation, Next.js + React + Tailwind + shadcn/ui
**Status:** Functional in v1; styled with brand kit when brand lands

### 8.1 Live views

- **Bot status:** current allocated balance, daily PnL, open positions, VPN state, kill switch state, last 10 trades
- **Per-trader view:** their recent trades, the bot's copied trades next to them, latency histogram, skip-reason breakdown, PnL contribution from this trader
- **Position table:** all open copied positions, P&L, time held, originating trader, originating trade
- **Trade log:** searchable/filterable view of `orders.db` (every order attempt, success or failure)
- **Skip log:** every trade the bot declined to copy, with reason (latency, drift, exposure cap, etc.)

### 8.2 Config UI

Web-based editor for `/etc/copytrade/`:

- **Followed traders list:** add wallet, set nickname, set reaction modes, set per-trader caps, enable/disable
- **Global defaults:** sizing, latency, drift thresholds
- **Risk caps:** displayed read-only; changing them requires SSH access to the Jetson (intentional friction)
- **Capital mode toggle:** paper / live_small. Promotion requires confirmation dialog with allocation amount.

Changes write back to the YAML configs on the Jetson via a signed API call (auth via local network + shared secret in v1; OAuth/SSO in v2 if hosted externally).

### 8.3 Read path

UI reads from NAS replicas (the workstation's NFS/SMB mount). For "live" data not yet rsynced, UI talks to a small read-only API exposed by the Jetson (`copytrade-api.service`, port-restricted to local network only).

### 8.4 Shared with the lab dashboard

The copy bot's dashboard can live in the same Next.js app as the lab dashboard, or as a separate route at minimum. Sharing the component library (shadcn/ui, charts) is encouraged. The visual identity is shared.

---

## 9. Config schema (full)

`/etc/copytrade/config.yaml`:

```yaml
bot:
  capital_mode: paper           # paper | live_small
  total_allocation_usd: 100
  daily_loss_limit_usd: 20
  trade_rate_limit_per_hour: 30

defaults:
  sizing:
    usd_per_trade: 1.00
  latency:
    max_latency_seconds: 5
    max_price_drift_pct: 3
    max_drift_absolute_cents: 3
  execution:
    slippage_tolerance_pct: 2.0
    max_retries: 3
    retry_backoff_seconds: 1
  market_filters:
    include_categories: [all]
    exclude_categories: []
    min_24h_volume_usd: 1000
    exclude_resolution_pending: true
    min_hours_to_resolution: 2

risk:
  max_position_per_market_usd: 5
  max_total_exposure_usd: 100
  per_trade_size_cap_usd: 5

traders:
  - wallet: "0xABC..."
    nickname: "WhaleA"
    enabled: true
    capital_mode: paper
    follow_modes:
      follow_buys: true
      counter_buys: false
      follow_sells: true
      buy_on_sells: false
      counter_sells: false
    copy_side: both
    sizing:
      usd_per_trade: 1.00
    market_filters:
      include_categories: [all]
      exclude_categories: []
      min_24h_volume_usd: 1000
    risk:
      max_total_exposure_usd: 50
    latency:
      max_latency_seconds: 5
      max_price_drift_pct: 3
      max_drift_absolute_cents: 3
```

Per-trader values override defaults. Validator rejects mutually-exclusive reaction-mode combinations (e.g., `follow_buys` and `counter_buys` both true).

---

## 10. Build sequence

### Week 1 — Foundations (parallel-safe; UI, backend, data agents can all start)
- Bootstrap `copytrade` repo
- Contracts package (`copytrade/contracts/`) — shared schemas, agreed before any agent writes implementation
- Docker images for ct-recorder and ct-engine
- systemd units with resource caps
- Data Collector: trader event polling (2-trader pilot), trader portfolio snapshots, market context snapshots
- **Tick latency test:** measure weatherbot impact with copy bot recorder running. No regression >10ms.
- **Uninstall test:** verify copytrade uninstall leaves weatherbot and lab running.
- UI agent: scaffolds Next.js app, builds read-only dashboard against fixture data
- Backend agent: scaffolds Reaction Engine + Execution Engine stubs against contracts

### Week 2 — End-to-end paper trading
- Reaction Engine: implement all reaction modes (per §5.1), latency/drift filters, market filters, risk gating
- Execution Engine: implement order router (market orders only), hard caps, slippage warning, retries, logging
- Wire to live Data Collector
- **Run end-to-end in paper mode** with 1 manually-selected trader for 7+ days
- UI: connect dashboard to live data, build config editor
- Verify all skip reasons are logged correctly; verify allocation tracking is exact

### Week 3 — Live small
- Enable `live_small` capital mode for 1 trader
- Manual review of every trade for first 48 hours
- Add second trader after 1 week of stable single-trader operation
- Forward-test for 2 weeks before adjusting any caps
- Episode 5 or 6 of the show: "I built a copy bot — does it work?"

### Week 4+ — v1.5 polish
- Add websocket subscription (fall back to polling)
- Tune resource caps based on observed Jetson load
- Add per-category market filters
- Begin downloading wider trader universe (top 200) for v2 scoring data

### Month 2+ — v2 features (each is a sprint)
- Auto-merge module
- Price Match Mode (limit orders with time-limited fallback)
- Trader Scoring Pipeline (separate workstation tool)
- Multi-venue support (Kalshi) — much larger scope; defer

---

## 11. Episode integration

This bot supports a multi-episode content arc on the show. See CONTENT_OPERATIONS.md for the full series treatment. Quick map:

- **Ep ~5:** "I built a copy bot for Polymarket — does it work?" (launch episode, first 30 days of paper + live_small)
- **Ep ~9:** "Polling vs websocket — does latency actually matter?" (v1.5 upgrade as content)
- **Ep ~12:** "I downloaded every top Polymarket trader and ranked them" (v2 scoring pipeline reveal)
- **Ep ~14:** "60 days of copy trading: who's actually worth copying?" (the scoring vs real outcomes)
- **Ep ~20:** "I let the bot pick its own traders" (Phase 2 auto-following with human approval gate)

Every episode shows the orders.db trade log on screen. Public trader addresses shown without editorializing performance (see CONTENT_OPERATIONS.md §4.5).

---

## 12. Open questions / future-self notes

- **Multi-venue (Kalshi).** Out of scope for v1. Will require generalizing the contracts (currently Polymarket-shaped) and adding a venue abstraction layer. Probably 2-4 weeks when prioritized.
- **What happens when a followed trader stops trading.** Bot keeps watching but takes no action. After 30 days of inactivity, dashboard flags the trader as "dormant." Manual decision to remove.
- **What happens when a followed trader has a public meltdown / blow-up.** This will happen. The bot's exposure caps protect capital. The content treatment is: document it honestly, including the cap-protection mechanism in action.
- **Disagreement between followed traders** (one buys, one sells the same market within minutes). Each trade is evaluated independently against its own trader's config and the global exposure caps. Net effect: bot may end up holding both sides, which is fine — auto-merge will eventually clean up (v2).
- **Auto-merge math (for v2):** If bot holds YES at avg_price_yes and NO at avg_price_no in the same market, and (avg_price_yes + avg_price_no) < $1.00 minus fees, merging guarantees profit. Trigger threshold should be configurable.
- **Anti-detection.** Out of scope. The bot makes no attempt to disguise that it's copy-trading. Anyone watching the wallet can see what it does. Acceptable for v1.

---

## 13. Agent ownership recap

Quick reference for the agents working in parallel:

| Agent | Files / dirs they own | Touches |
|---|---|---|
| **Data agent** | `copytrade/data/`, `copytrade/scripts/jetson/ct-recorder.service` | Polymarket public API, writes parquet |
| **Backend agent** | `copytrade/engine/`, `copytrade/execution/`, `copytrade/scripts/jetson/ct-engine.service` | Reads contracts + parquet, talks to Polymarket trading API |
| **UI agent** | `copytrade/dashboard/`, `copytrade/api/` (read-only) | Reads NAS + Jetson read-API |
| **Scoring agent (v2)** | `copytrade/scoring/`, runs on workstation | Reads `trader_histories/` parquet |
| **DevOps / integration (Josh + Claude Code)** | `copytrade/docker/`, `copytrade/scripts/`, systemd, rsync | All deployments |

**Shared, no agent owns alone:**
- `copytrade/contracts/` — Pydantic schemas. Changes require coordination.
- `copytrade/config/` — YAML defaults. Changes require coordination.
- `ARCHITECTURE.md`, `COPY_TRADE.md`, `CONTENT_OPERATIONS.md` — Josh approves changes.

---

## 14. Glossary

- **Followed trader:** a Polymarket wallet the bot is configured to copy
- **Wider universe:** top ~200 traders whose history the bot passively downloads for v2 scoring
- **Reaction mode:** how the bot reacts to a trader's trade (follow / counter / fade / off)
- **Skip:** a trader trade the bot decided not to copy (logged with reason)
- **Capital mode:** `paper` / `live_small` (v1), `live_full` deferred
- **Allocation:** the bot's tracked budget. Starts at $100. Adjusts with PnL. Capped.
- **Buffer:** extra USDC in the shared wallet beyond the sum of all tenant allocations, preventing accidental concurrency failures
