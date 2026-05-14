# Real-Time Trade Detection — Implementation Plan

## TL;DR

**Goal:** drop per-trade detection latency from ~10–60s (current REST polling floor) to ~1–3s so paper / live copies can fire within `maxLatencySec`.

**Recommended path:** **Polygon on-chain log subscription** to the Polymarket Exchange contracts, filtered by the target trader's wallet address. Estimated effort: **4–6 hours** of focused work.

**Not viable:** the Polymarket CLOB `market` websocket channel — see "Correction to prior recommendation" below.

---

## Correction to prior recommendation

In an earlier discussion I proposed subscribing to the Polymarket CLOB `market` websocket and filtering events by `maker_address == target_wallet`. **This does not work.** Per the official docs ([wss-overview](https://docs.polymarket.com/developers/CLOB/websocket/wss-overview)):

- The `market` channel emits `last_trade_price` events with fields `asset_id`, `event_type`, `fee_rate_bps`, `market`, `price`, `side`, `size`, `timestamp`. **No `maker_address` or `taker_address` is included.**
- The `user` channel requires authentication and only emits trades for the authenticated wallet. Useless for copy-trading other wallets.
- The `RTDS` channel streams crypto prices, equity prices, and platform comments — not order activity.

Because Polymarket does not expose per-wallet trade events on any public websocket, the only real-time route is to read the raw fills off Polygon directly.

---

## Recommended approach: Polygon on-chain log listener

### How it works

1. Open a WSS connection to a Polygon node (Alchemy / Infura / QuickNode all have free tiers sufficient for one wallet).
2. Subscribe to logs filtered by:
   - **Contract address** — the Polymarket exchange contracts (there are two — see "Contract addresses to verify" below).
   - **Event topic** — the `OrderFilled` (or equivalent matched/filled) event signature.
   - **Indexed topics** — if `maker` is indexed, filter at the node level by the target wallet address; otherwise filter client-side.
3. Decode each matching log into the same trade dict shape currently produced by `fetch_target_trades` (`id`, `asset_id`, `side`, `price`, `size`, `timestamp`, `copied_from_wallet`).
4. Hand the trade to the existing `copy_trade()` pipeline — no changes needed downstream.

### Why this beats the alternatives

| Approach | Real-time? | Per-wallet filter? | Effort | Verdict |
|---|---|---|---|---|
| REST polling (today) | No, ~10–60s floor | Yes (`?user=`) | Already shipped | Floor is too high |
| CLOB `market` ws | Yes (<1s) | **No `maker_address` in events** | Medium | **Blocked by API** |
| CLOB `user` ws | Yes (<1s) | Only own wallet | Low | Wrong wallet |
| Polygon log subscription | Yes (~1–3s, bounded by block time) | Yes (event topic filter) | **4–6 hours** | **Recommended** |

Latency on Polygon: blocks are ~2s, and most RPC providers emit log subscriptions within a few hundred ms of block inclusion. Realistic end-to-end detection latency: **1–3 seconds**.

---

## Implementation plan

### New file: `polymarket_copier/onchain_listener.py`

A small async module with one responsibility: subscribe to Polygon, decode fills, push normalized trade dicts onto an `asyncio.Queue`. Everything else in `copier.py` stays the same.

```
OnchainListener
  __init__(rpc_wss_url, exchange_addresses, target_wallets, output_queue)
  run()                  # main loop: connect, subscribe, reconnect on drop
  _subscribe()           # send eth_subscribe for logs filter
  _handle_log(log_obj)   # decode -> normalized trade dict -> queue.put
  _decode_fill(log_obj)  # ABI decode, compute price/side
```

### Wire-up in `copier.py`

Replace `await self.fetch_target_trades()` polling with a queue consumer:

```python
# in PolymarketCopier.__init__
self.trade_queue: asyncio.Queue = asyncio.Queue()

# in run_loop
listener = OnchainListener(
    rpc_wss_url=os.getenv("POLYGON_WSS_URL"),
    exchange_addresses=[CTF_EXCHANGE, NEG_RISK_EXCHANGE],
    target_wallets=self.proxy_wallets,
    output_queue=self.trade_queue,
)
asyncio.create_task(listener.run())

while True:
    trade = await self.trade_queue.get()
    await self.copy_trade(trade)
```

`load_config()` still gets called on a slow tick (every 30s) so wallet list changes from the dashboard propagate. The listener exposes `update_wallets()` to refresh its in-memory filter set without dropping the subscription.

### Dependencies to add to `requirements.txt`

- `web3` — Polygon RPC client and ABI decoding
- `websockets` — already present, used for raw subscription if not using `web3` async

`web3.AsyncWeb3` with a `WebsocketProvider` covers both. Single dependency add.

### Environment additions to `.env`

```
POLYGON_WSS_URL=wss://polygon-mainnet.g.alchemy.com/v2/<your-key>
```

Free Alchemy tier supports the volume for a single wallet by a wide margin.

---

## Effort breakdown

| Task | Estimate |
|---|---|
| Confirm exchange contract addresses + fill event ABI on Polygonscan | 30 min |
| Stand up Alchemy account, verify WSS log subscription works with a curl/test script | 30 min |
| Write `OnchainListener` — connect, subscribe, reconnect, decode | 90 min |
| Convert decoded fill → trade dict (price = USDC amount / token amount; side = which token did maker give) | 60 min |
| Wire into `copier.py`, remove REST polling loop (keep REST as a fallback / seed) | 45 min |
| Manual end-to-end test in paper mode: wait for a real fill on the watched wallet, confirm it lands in `bot_logs_paper.csv` with `PAPER_TRADE` action | 30–60 min |
| Buffer for surprises (event signature mismatch, neg-risk contract differences, decoding edge cases) | 60 min |
| **Total** | **~4–6 hours** |

---

## Contract addresses to verify

Polymarket runs two exchange contracts on Polygon (chain 137):

1. **CTF Exchange** — the original conditional-token exchange (binary YES/NO markets).
2. **Neg Risk Exchange** — the newer negative-risk exchange used for multi-outcome markets.

Both need to be in the subscription filter. Look them up on Polygonscan before coding; do not hard-code from memory. Verify each:

- Contract address
- Exact event name and signature (likely `OrderFilled(bytes32 orderHash, address maker, address taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)` — confirm against the live ABI)
- Whether `maker` is an indexed topic (changes how you filter at the RPC level)

---

## Decoding a fill into a trade dict

The on-chain log shows raw token amounts; the existing pipeline expects `side`, `price`, `size`. Mapping logic:

- `asset_id` = the outcome token side of the fill (not the USDC side). Polymarket uses USDC as `makerAssetId == 0` (or the USDC token). Whichever side of the fill is non-USDC is the outcome token.
- `side` (from the maker's perspective):
  - If maker gave outcome tokens and received USDC → `SELL`
  - If maker gave USDC and received outcome tokens → `BUY`
- `size` = outcome-token amount, normalized by token decimals (Polymarket outcome tokens are 6-decimal, same as USDC — verify).
- `price` = USDC amount / outcome-token amount.
- `id` = transaction hash + log index (must be unique per fill; a single tx can produce multiple fills).
- `timestamp` = block timestamp from the log's block.

Keep `seen_trades` dedupe — websocket reconnects can replay recent logs.

---

## Risks & open questions

- **Event signature confirmation.** I'm asserting the event is named `OrderFilled` from general Solidity convention; the actual contract may emit `OrdersMatched`, `Fill`, or per-side events. **Must verify on Polygonscan before writing decoder.** This is the single biggest source of "the plan slipped from 5h to 12h" risk.
- **Neg Risk Exchange differences.** The neg-risk contract may use a different event shape than the CTF exchange. Budget for two decoders or a polymorphic one.
- **Maker vs taker ambiguity.** A "trade" by the target wallet could be them as either maker or taker. The REST API at `data-api.polymarket.com/trades?user=X` lists trades where `X` is on either side. Filter logic must check both `maker == target` and `taker == target` and report the side from the target's perspective.
- **Reorg handling.** Polygon reorgs are rare but non-zero on the chain tip. For paper trading this doesn't matter — for live, you'd want to wait 1–2 confirmations before submitting a copy order, which adds ~2–4s back. For now: don't worry about it in paper mode.
- **RPC rate limits.** Free Alchemy tier has CU caps. A single wallet subscription is well under the cap; if you ever scale to dozens of watched wallets, revisit.
- **First-trade-in-new-market is no longer a problem.** Unlike the original (broken) websocket plan, this approach catches every fill regardless of market — there's no per-market subscription to manage.

---

## Rollout plan

1. **Build behind a flag.** Add `USE_ONCHAIN_LISTENER=true` in `.env`. When false, fall back to the existing REST poller. This lets you A/B compare detection latency directly.
2. **Run both side-by-side for 24h in paper mode.** REST poller logs to `bot_logs_paper.csv` with action `SKIPPED (latency)`; on-chain listener logs `PAPER_TRADE`. Compare to confirm the on-chain version is catching the same trades but earlier.
3. **Once parity is confirmed, remove the REST poller.** Keep one REST call at startup to seed `seen_trades` so the first websocket event isn't a duplicate of an old trade.
4. **Tighten `maxLatencySec` back down.** Once on-chain is live you should comfortably run with `maxLatencySec=5` again.

---

## Out of scope for this plan

- Switching from `py_clob_client` order placement to direct on-chain order submission. Order **placement** stays on the CLOB REST API (that's a separate, much larger refactor and isn't needed for the latency problem). On-chain is only for **detecting** the target trader's fills.
- Multi-trader scaling beyond ~10 wallets. Current design subscribes to all logs from the exchange contracts and filters client-side; that's fine for a small wallet list but would want a more targeted topic filter at scale.
- Dashboard surfacing of "live websocket connected" status. Useful, but cosmetic — add after the core works.
