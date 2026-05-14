// Polymarket market metadata fetcher with short-lived in-memory cache.
// Used by stats + positions API routes to compute current token prices for PnL
// and to surface market title/outcome without hammering the upstream API.

type Token = { token_id: string; outcome: string; price: number; winner?: boolean };
type Market = { closed: boolean; accepting_orders: boolean; tokens: Token[] };

const TTL_MS = 15_000;
const cache = new Map<string, { fetchedAt: number; market: Market | null }>();
const inflight = new Map<string, Promise<Market | null>>();

async function fetchMarket(conditionId: string): Promise<Market | null> {
  try {
    const res = await fetch(`https://clob.polymarket.com/markets/${conditionId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Market;
  } catch {
    return null;
  }
}

export async function getMarket(conditionId: string): Promise<Market | null> {
  if (!conditionId) return null;
  const now = Date.now();
  const hit = cache.get(conditionId);
  if (hit && now - hit.fetchedAt < TTL_MS) return hit.market;

  let pending = inflight.get(conditionId);
  if (!pending) {
    pending = fetchMarket(conditionId).finally(() => inflight.delete(conditionId));
    inflight.set(conditionId, pending);
  }
  const market = await pending;
  cache.set(conditionId, { fetchedAt: now, market });
  return market;
}

export async function getTokenPrice(conditionId: string, assetId: string): Promise<number | null> {
  const m = await getMarket(conditionId);
  if (!m) return null;
  const tok = m.tokens?.find(t => t.token_id === assetId);
  return tok ? Number(tok.price) : null;
}
