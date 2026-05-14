# Trader Settings — Copy Trade Bot

**Sister doc to:** COPY_TRADE.md, ARCHITECTURE.md, CONTENT_OPERATIONS.md
**Audience:** 
**Purpose:** Complete specification of the per-trader and global configuration surface for the copy trade bot. Every knob, what it does, what's possible on Polymarket, what's v1 vs v2, and how the UI should present it.

This doc is the source of truth for the trader settings panel. The Pydantic schema in `copytrade/contracts/trader_config.py` MUST match this doc exactly. If a contradiction is found, fix the code to match the doc and notify Josh.

---

## 1. Scope & validation summary

Everything in this doc has been validated against Polymarket's public capabilities:

| Feature | Possible? | v1 / v2 | Notes |
|---|---|---|---|
| Follow buys / sells | Yes | v1 | Standard polling of user activity endpoint |
| Sell-side reaction modes | Yes | v1 | Mirror / fade / counter — choose one |
| Buy-side reaction modes | Yes | v1 | Mirror / counter — choose one |
| Side filter (yes/no/both) | Yes | v1 | Filter on trader's action, not bot's position |
| Auto-Merge (YES+NO → $1) | Yes, mechanism exists | v2 | Real opportunity but rare and competitive at $1 sizing. Specify, don't oversell. |
| Price Match Mode (limit orders) | Yes | v2 | Polymarket has a CLOB, supports limit orders with timeout |
| Retries on transient failures | Yes | v1 | Distinguish transient (retry) from real (skip) failures |
| Slippage warning + block | Yes | v1 | "Warn and block" in v1; "warn and reduce size" in v2 |
| Buy/sell presets (manual UI) | Yes | v1 | UI affordance for manual intervention, not copy logic |
| Ladder buys at extreme prices | Yes (Mechanism A) | v2 | Resting limit orders at deep prices. Cosmetic at $100 total but good for content. |
| Confidence-based dislocation entry | Yes (Mechanism B) | Not in copy bot | Belongs in the lab as its own strategy, not here |

---

## 2. Global defaults vs per-trader overrides

The bot has two configuration scopes:

**Global defaults** (`/etc/copytrade/defaults.yaml`) — apply to all traders unless overridden.

**Per-trader overrides** (`/etc/copytrade/traders/<wallet>.yaml`) — override any global default. Unspecified fields fall through to global.

UI presents these as one merged view per trader, with visual indicators showing which fields are using the default and which are overridden.

---

## 3. Reaction modes (per trader)

Reaction modes define what the bot does when a followed trader makes a trade. Two independent settings: one for what they buy, one for what they sell.

### 3.1 Buy-side reaction

When the followed trader **buys**, the bot can:

| Value | Behavior |
|---|---|
| `off` | Bot does nothing on their buys |
| `mirror` | Bot buys the same market, same outcome, same side |
| `counter` | Bot buys the opposite outcome (they buy YES → bot buys NO) |

Default: `mirror`

**Validator rule:** exactly one value. The UI is a single-select (radio buttons or dropdown), not checkboxes.

### 3.2 Sell-side reaction

When the followed trader **sells**, the bot can:

| Value | Behavior |
|---|---|
| `off` | Bot does nothing on their sells |
| `mirror` | Bot sells its position in the same market (proportional to their exit — see §3.4) |
| `fade_buy` | Bot buys the same outcome they're selling (fade their exit, "buy the dip") |
| `counter` | Bot buys the opposite outcome (they sell YES → bot buys NO) |

Default: `mirror`

**Validator rule:** exactly one value.

### 3.3 Side filter

Independent of reaction modes, the bot can be told to only react to trader actions on a specific outcome:

| Value | Behavior |
|---|---|
| `both` | React to trades on either YES or NO outcomes |
| `yes_only` | Only react when the trader trades YES |
| `no_only` | Only react when the trader trades NO |

Default: `both`

**Interaction with counter mode:** the filter applies to the *trader's action*, not the bot's resulting position. If `side_filter: yes_only` and `buy_reaction: counter`, the bot only reacts when they buy YES, and the bot's response is to buy NO. If they buy NO, the bot skips entirely (filter says ignore NO actions). This is the clean semantic — filter first, react second.

### 3.4 Sell sizing (when reaction = mirror)

When `sell_reaction: mirror` and the trader sells, the bot exits **proportional to their exit**, not their absolute size.

Example: bot holds 10 shares from copying their earlier entries. Trader had 100 shares; they sell 40 (40% of position). Bot sells 4 shares (40% of its 10).

If the trader sells 100% of their position, the bot sells 100% of its copied position in that market.

**Edge case:** if the bot has no position when a mirror sell fires, skip with reason `no_position_to_sell`. Do not go short via inverse buys (per Josh's prior decision).

### 3.5 Sell-when-no-position (when reaction = fade_buy or counter)

If `sell_reaction: fade_buy` or `counter` and the trader sells, the bot generates a BUY decision. No prior position required — these modes generate new positions from sell signals.

This is intentional. `fade_buy` and `counter` are entry signals derived from exit events; they're not exits themselves.

---

## 4. Sizing (per trader)

### 4.1 Per-trade sizing mode

| Value | Behavior |
|---|---|
| `fixed_usd` | Every copied trade is `usd_per_trade` USDC. Default. |
| `fixed_fraction` | Every copied trade is `fraction_of_allocation` × current per-trader allocation. v2. |
| `proportional_to_trader` | Bot's size scales with their size, capped. v2. |

v1 ships with `fixed_usd` only. Default `usd_per_trade: 1.00`. Minimum 1 USDC (Polymarket minimum trade size).

### 4.2 Skip threshold for trader's size

If the trader's trade is *smaller* than `usd_per_trade`, the bot still copies at the bot's fixed size (per Josh's prior decision — bot size is governed by its own rule, not theirs).

Optional override: `skip_if_trader_size_under_usd` (default `null` = no skip). If set, the bot skips when the trader trades less than this amount. Useful for filtering out their accidental small trades.

---

## 5. Latency & drift filters (per trader)

The bot skips trades that arrive too late or where the price has moved too much. **Skip the trade if ANY of these three conditions are met:**

### 5.1 Latency filter

```yaml
max_latency_seconds: 5
```

Skip if more than N seconds have passed between the trader's fill timestamp and the bot's decision time. Default 5.

### 5.2 Percentage drift filter

```yaml
max_price_drift_pct: 3
```

Skip if the current best price (ask for buys, bid for sells) is more than N% away from the trader's fill price. Default 3.

### 5.3 Absolute cents drift filter

```yaml
max_drift_absolute_cents: 3
```

Skip if the current best price is more than N cents away from the trader's fill price, regardless of percentage. Default 3.

**Why both percentage and absolute:** at a fill price of $0.05, a 3% drift is 0.15¢ — meaningless. At a fill price of $0.95, a 3¢ drift is only 3.2% — also meaningful. Belt and suspenders.

### 5.4 Skip logging

Every skip is logged with the reason (`latency` / `pct_drift` / `abs_drift` / `no_position_to_sell` / `risk_cap_hit` / etc.). Skip rates are themselves a metric. The dashboard surfaces a "skip reason breakdown" panel per trader.

---

## 6. Market filtering (per trader)

Before reacting to any trade, the bot checks the market itself against filters.

### 6.1 Category filter

```yaml
include_categories: [all]      # or [sports, weather, politics, crypto, ...]
exclude_categories: []
```

Default `include_categories: [all]`. Polymarket category labels are inconsistent; the bot uses official labels when present, falls back to keyword inference. Misclassifications are filed as bugs, not blockers.

### 6.2 Volume filter

```yaml
min_24h_volume_usd: 1000
```

Skip markets with less than N USD of 24-hour volume. Default $1000. Prevents copying into illiquid markets where slippage is unpredictable.

### 6.3 Resolution proximity filter

```yaml
exclude_resolution_pending: true
min_hours_to_resolution: 2
```

Skip markets within N hours of resolution. Default 2 hours. The worst scenario for a copy bot is the trader selling out as a market settles, the bot copies the entry-on-sell, the market resolves before the bot can exit, and the bot is stuck holding the losing side. Hard skip.

### 6.4 Explicit allow/deny

```yaml
exclude_market_slugs: []
include_market_slugs_only: []  # if non-empty, ONLY trade these markets
```

`include_market_slugs_only` is for surgical experiments — "only follow this trader on these specific markets."

---

## 7. Risk caps (per trader, layered on top of global)

Even if filters and reactions say "trade," risk caps can block. **All caps fail-closed.**

### 7.1 Per-trader caps

```yaml
max_total_exposure_usd: 50          # max bot exposure across all positions opened from this trader
max_position_per_market_usd: 5      # max single-market exposure from this trader
max_trades_per_hour: 10             # rate limit per trader
```

Defaults shown. The per-trader `max_total_exposure_usd` of $50 forces at least 2 traders to fully utilize the $100 bot.

### 7.2 Global caps (apply across all traders)

These live in `/etc/copytrade/defaults.yaml`, not per-trader:

```yaml
total_allocation_usd: 100
per_market_total_cap_usd: 5         # across ALL traders combined, max in any one market
daily_loss_limit_usd: 20
per_trade_size_cap_usd: 5           # hard ceiling, rejects misconfigured sizing
```

When any cap is hit, the relevant scope pauses. Per-trader cap → trader pauses. Global cap → bot pauses. Daily loss limit → bot pauses 24 hours.

---

## 8. Execution settings (per trader)

### 8.1 Order type (v1 vs v2)

```yaml
order_type: market                  # v1 only option
# order_type: price_match           # v2
# order_type: ladder                # v2 (see §11)
```

v1 ships with market orders only.

### 8.2 Slippage tolerance and behavior

```yaml
slippage_tolerance_pct: 2.0
slippage_behavior: block            # v1: block | warn (v2: reduce_size)
```

- `block`: if expected fill exceeds best price by more than `slippage_tolerance_pct`, reject the trade. Log with reason.
- `warn`: log a warning but proceed with the trade. Useful for backtesting or when you trust the trader's signal more than market depth.
- `reduce_size` (v2): adapt the trade size downward to fit available depth at acceptable slippage. Most sophisticated; deferred.

Default `block`.

### 8.3 Retries

```yaml
max_retries: 3
retry_backoff_seconds: 1
```

Retries apply to **transient failures only**:
- Network blip / timeout
- Polymarket rate-limit (429)
- "Insufficient balance" when another tenant beat the bot to the wallet
- "Nonce too low" or similar transaction-ordering issues

Retries do NOT apply to:
- Price moved beyond drift filter (the trade is stale, retrying won't fix it)
- Slippage tolerance exceeded (the book is thin, retrying makes it worse)
- Market resolved or closed during the attempt
- Risk cap hit (caps are intentional, not retry-able)

Default 3, range 0–5. Setting 0 in UI means "use the global default."

---

## 9. Pause and unwind (per trader)

Three independent operations the operator can issue, exposed via CLI and UI:

### 9.1 Pause

`copytrade pause <wallet>` — stops reacting to this trader's new trades. Existing copied positions remain open. No order cancellations. Toggle in UI.

### 9.2 Unwind

`copytrade unwind <wallet>` — closes all open positions that were originally opened by copying this trader, at current market prices. **Confirmation required in both CLI and UI.** Logs every closing trade with reason `manual_unwind`.

### 9.3 Pause + unwind

`copytrade stop <wallet> --unwind` — combines both. Removes the trader from active rotation and exits all positions.

### 9.4 Remove

UI-only operation. Removes the trader from the followed list entirely. Requires `unwind` first or explicit confirmation that you accept leaving open positions orphaned.

---

## 10. Manual override controls (UI presets)

Separate from the copy-bot reaction logic. These are for **manual intervention** outside the bot's automatic behavior — e.g., you see a copied position going wrong and want to trim it, or you want to enter a market the bot isn't covering.

### 10.1 Buy presets

```yaml
buy_presets:
  - { label: "P1", usd: 1.00 }
  - { label: "P2", usd: 5.00 }
  - { label: "P3", usd: 10.00 }
  - { label: "P4", usd: 25.00 }
```

UI displays 4 buy buttons with these amounts on any position card. Tapping a button submits a market buy at that size, through the same execution engine (subject to all the same caps).

Configurable per-user (not per-trader). Minimum 1 USDC (Polymarket minimum).

### 10.2 Sell presets

```yaml
sell_presets:
  - { label: "S1", pct: 25 }
  - { label: "S2", pct: 50 }
  - { label: "S3", pct: 100 }
```

Sell presets are percentage-based, not USD-based. Tapping "S2" sells 50% of the current position. More natural than dollar amounts for exits.

### 10.3 Audit

Manual trades via presets are logged with `triggered_by: manual_preset` and the operator identity. They count against all global caps (total allocation, daily loss limit, per-market cap). They do NOT count against per-trader caps because they're not associated with a specific copied trader.

---

## 11. Extreme Trade — Ladder Buys (v2)

The "buy at rock-bottom pricing in case of dislocation" feature. Mechanism A from the validation pass: passive resting limit orders at deep price levels.

### 11.1 What it does

When enabled for a trader, in addition to normal reactive copying, the bot maintains a **ladder of resting limit buy orders** on markets where that trader has demonstrated strong conviction (multiple buys on the same side, large recent position).

The ladder consists of N orders spread across price levels below the current best ask, each at a configurable size. If a flash crash, fat-finger sell, or temporary liquidity withdrawal causes the price to gap down, one or more ladder orders fill at deep discount.

### 11.2 Conviction trigger

Ladder buys only attach to a market when the trader has demonstrated conviction. Default criteria (configurable):

```yaml
ladder:
  enabled: false                    # off by default
  conviction_required:
    min_trader_buys_same_side: 3    # must have bought same side 3+ times
    min_trader_buy_total_usd: 100   # total of those buys ≥ $100
    within_hours: 48                # within last 48 hours
  ladder_config:
    num_orders: 5
    price_levels_pct_below_market: [10, 20, 35, 50, 70]
    size_per_order_usd: 1.00
    max_total_ladder_usd: 5.00
    refresh_minutes: 30             # cancel + repost every N minutes to track market drift
    expires_at_resolution_hours: 6  # cancel all ladder orders within 6h of resolution
```

### 11.3 Capital accounting

Ladder orders count against `max_total_exposure_usd` for the trader as **reserved capital**, not realized exposure. If the ladder is sized $5 and the trader cap is $50, the bot has $45 of available reactive capacity.

### 11.4 What this is and isn't (honest framing)

**At $100 total allocation, this feature is mostly cosmetic.** A typical ladder fill might net $2–10 of profit on a $1 order if a rare flash crash occurs. It's:

- A **content asset** — when one fills, it's visually exciting and tells a story on camera
- A **proof of concept** for when allocations grow
- An **edge case captured** in the bot's repertoire for later scaling

It is NOT:
- A reliable source of return
- A justification for spending many days of engineering vs. core features
- Something to overpromise in episodes — frame it as "let's see if this ever fills"

### 11.5 What this is NOT (and where it goes instead)

Mechanism B from the validation pass — **confidence-based dislocation entry**, where the bot detects sudden price drops on markets where it has a model of the outcome — is a **separate strategy in the lab**, not a copy-bot feature. It belongs in `lab/strategies/dislocation_entry/` with its own SPEC.md, episode treatment, and edge thesis. Do not implement it inside the copy bot.

---

## 12. Auto-Merge (v2)

When the bot holds complementary YES + NO positions in the same market, and the sum of their cost basis is less than $1.00 minus fees, merging produces guaranteed profit.

### 12.1 Mechanism (validated)

Polymarket supports merging 1 YES share + 1 NO share into $1 USDC. The on-chain operation is exposed via their CTF (Conditional Token Framework) contract.

The opportunity arises when the bot ends up holding both sides — e.g., because two followed traders disagreed, or because a single trader switched sides over time.

### 12.2 Config

```yaml
auto_merge:
  enabled: false                    # off in v1; on by default in v2
  min_profit_threshold_usd: 0.02    # only merge if expected profit ≥ 2¢ after fees
  check_frequency_seconds: 60       # check positions every minute
```

### 12.3 Honest framing

At $100 allocation and $1 trade sizes, auto-merge opportunities will be rare. Most YES+NO holdings will have cost bases summing to >$1 (because each side was bought at market, and the spreads add up). The feature is real but the volume of opportunities is small at this scale. Document accordingly.

### 12.4 Risk

Merge transactions cost gas on Polygon. At $1 trade sizes, the merge profit must exceed gas + the configured threshold. If gas is volatile, the threshold may need to widen. v2 implementation tracks gas costs and surfaces them in the dashboard.

---

## 13. Full per-trader YAML schema

This is what `/etc/copytrade/traders/<wallet>.yaml` looks like with everything specified. Fields can be omitted to inherit from defaults.

```yaml
# /etc/copytrade/traders/0xABC123.yaml

wallet: "0xABC123..."
nickname: "WhaleA"
enabled: true
capital_mode: paper                 # paper | live_small

# Reaction modes
buy_reaction: mirror                # off | mirror | counter
sell_reaction: mirror               # off | mirror | fade_buy | counter
side_filter: both                   # both | yes_only | no_only

# Sizing
sizing:
  mode: fixed_usd                   # v1: fixed_usd only
  usd_per_trade: 1.00
  skip_if_trader_size_under_usd: null

# Latency & drift
latency:
  max_latency_seconds: 5
  max_price_drift_pct: 3
  max_drift_absolute_cents: 3

# Market filters
market_filters:
  include_categories: [all]
  exclude_categories: []
  min_24h_volume_usd: 1000
  exclude_resolution_pending: true
  min_hours_to_resolution: 2
  exclude_market_slugs: []
  include_market_slugs_only: []

# Risk caps (per trader)
risk:
  max_total_exposure_usd: 50
  max_position_per_market_usd: 5
  max_trades_per_hour: 10

# Execution
execution:
  order_type: market                # v1: market only
  slippage_tolerance_pct: 2.0
  slippage_behavior: block          # block | warn
  max_retries: 3
  retry_backoff_seconds: 1

# v2 features (specify but disabled in v1)
ladder:
  enabled: false
  conviction_required:
    min_trader_buys_same_side: 3
    min_trader_buy_total_usd: 100
    within_hours: 48
  ladder_config:
    num_orders: 5
    price_levels_pct_below_market: [10, 20, 35, 50, 70]
    size_per_order_usd: 1.00
    max_total_ladder_usd: 5.00
    refresh_minutes: 30
    expires_at_resolution_hours: 6

auto_merge:
  enabled: false
  min_profit_threshold_usd: 0.02
  check_frequency_seconds: 60
```

---

## 14. Global defaults YAML schema

```yaml
# /etc/copytrade/defaults.yaml

bot:
  capital_mode: paper
  total_allocation_usd: 100
  daily_loss_limit_usd: 20
  trade_rate_limit_per_hour: 30

# These propagate to every trader unless they override
defaults:
  buy_reaction: mirror
  sell_reaction: mirror
  side_filter: both
  sizing:
    mode: fixed_usd
    usd_per_trade: 1.00
  latency:
    max_latency_seconds: 5
    max_price_drift_pct: 3
    max_drift_absolute_cents: 3
  market_filters:
    include_categories: [all]
    exclude_categories: []
    min_24h_volume_usd: 1000
    exclude_resolution_pending: true
    min_hours_to_resolution: 2
  risk:
    max_total_exposure_usd: 50
    max_position_per_market_usd: 5
    max_trades_per_hour: 10
  execution:
    order_type: market
    slippage_tolerance_pct: 2.0
    slippage_behavior: block
    max_retries: 3
    retry_backoff_seconds: 1

# Global hard caps (cannot be overridden per-trader, enforced by execution engine)
global_risk:
  per_market_total_cap_usd: 5       # max combined exposure across ALL traders in one market
  per_trade_size_cap_usd: 5          # rejection threshold for misconfigured sizing

# UI presets for manual intervention (not part of copy logic)
buy_presets:
  - { label: "P1", usd: 1.00 }
  - { label: "P2", usd: 5.00 }
  - { label: "P3", usd: 10.00 }
  - { label: "P4", usd: 25.00 }

sell_presets:
  - { label: "S1", pct: 25 }
  - { label: "S2", pct: 50 }
  - { label: "S3", pct: 100 }
```

---

## 15. UI requirements for the trader settings panel

The UI agent owns this panel. Required behavior:

### 15.1 Merged view per trader

Show the effective configuration after merging defaults + overrides. Fields using the default render in a muted style with a "(default)" tag. Fields explicitly overridden render in normal style with a "reset to default" affordance.

### 15.2 Validators

The UI must enforce all mutual-exclusion rules and ranges **before submission**. Server validates again on submit. Examples:

- `buy_reaction` must be exactly one of `off | mirror | counter`
- `usd_per_trade` ≥ 1.00 (Polymarket minimum)
- `max_total_exposure_usd` ≤ `bot.total_allocation_usd`
- `max_position_per_market_usd` ≤ `max_total_exposure_usd`
- `slippage_tolerance_pct` between 0.1 and 20.0
- `max_retries` between 0 and 5
- `max_latency_seconds` between 1 and 60
- All per-market caps and per-trade caps validated against `global_risk` hard ceilings

### 15.3 Capital mode promotion flow

Changing a trader from `paper` to `live_small` requires:

1. Confirmation dialog showing the trader's recent paper PnL (last 30 days), trade count, win rate
2. Acknowledgment text: "I understand this will use real funds, capped at $X"
3. Allocation amount input (defaults to per-trader max)
4. Final confirm button

No keyboard shortcut to promote. No "remember my choice." Friction is intentional.

### 15.4 Read-only fields

Global hard caps (`global_risk.*`, `bot.total_allocation_usd`, `bot.daily_loss_limit_usd`) are read-only in the UI. Changing them requires editing `/etc/copytrade/defaults.yaml` directly via SSH. This is intentional friction; these are the trader's safety net.

### 15.5 Live diff preview

Before submitting changes, show a diff between current config and new config. List of what's changing in human-readable form ("Buy reaction: mirror → counter", "Per-trader cap: $50 → $30").

### 15.6 Audit log

Every config change writes to `/var/log/copytrade/config_changes.log` with timestamp, operator identity, diff, and reason (optional text field in UI).

---

## 16. Implementation checklist for Claude Code

When implementing this doc:

- [ ] Define the full Pydantic schema in `copytrade/contracts/trader_config.py`. Schema must validate everything in §15.2.
- [ ] Implement the global+per-trader merge logic. Test with several scenarios: all-default trader, fully-overridden trader, partial overrides.
- [ ] Implement the reaction mode enum and the dispatch logic in the Reaction Engine. Mirror / fade_buy / counter behaviors must be unit-tested with mocked trader events.
- [ ] Implement the three-condition skip logic in §5 (latency + pct drift + abs drift). Skip reasons must be logged.
- [ ] Implement market filtering in §6 with category fallback inference.
- [ ] Implement risk gating in §7. Caps fail-closed. Multiple layers (per-trader and global) both checked.
- [ ] Implement retry distinction in §8.3 — transient vs real failures. Test with mocked errors.
- [ ] Implement pause/unwind operations in §9 with confirmation flows.
- [ ] Implement buy/sell presets in §10 as UI affordances calling the same execution engine.
- [ ] **v1 stops here.**
- [ ] (v2) Implement ladder buys per §11. Honest framing in UI: this feature is opportunistic and rare.
- [ ] (v2) Implement auto-merge per §12. Track gas costs.
- [ ] (v2) Implement price-match order type per validation pass §2.

---

## 17. Open questions for future

- **Confidence-based dislocation entry (Mechanism B from validation):** belongs in the lab as its own strategy. Out of scope for this doc, but worth noting it shares data dependencies (trader-derived conviction signals) with the copy bot. Could share the conviction-detection module.
- **Cross-trader signal blending:** if 3 followed traders all buy the same market within 1 hour, should the bot size up? Out of scope for v1. Specify in a future doc if pursued.
- **Trader scoring → automatic config tuning:** v2's scoring pipeline (per COPY_TRADE.md §7) could recommend per-trader settings based on observed behavior. E.g., "this trader's average trade is $500, set `skip_if_trader_size_under_usd: 50` to filter out their accidents." Future work.
- **Multi-venue copy** (copy trades on Kalshi when the same market exists): requires venue abstraction. Out of scope; revisit in v3+.

---

## 18. Glossary

- **Reaction mode:** what the bot does when the followed trader trades (mirror / fade / counter / off)
- **Side filter:** which trader-actions the bot pays attention to (yes / no / both)
- **Skip:** a trader trade the bot decided not to copy. Always logged with reason.
- **Conviction:** the threshold of trader behavior that activates v2 ladder buys
- **Ladder:** a set of resting limit buy orders spread across deep price levels
- **Auto-merge:** combining held YES + NO positions back into USDC for risk-free profit
- **Preset:** a UI button for manual one-tap trade sizing (separate from copy logic)
- **Effective config:** merged view of global defaults + per-trader overrides for one trader
