import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getTokenPrice } from '@/lib/polymarket';

let isPaperTrade = true;
try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '../../polymarket_copier/.env'), 'utf8');
  if (envContent.includes('PAPER_TRADE=false')) {
    isPaperTrade = false;
  }
} catch (e) {
  console.log("Could not read .env file, defaulting to paper trade.");
}

const suffix = isPaperTrade ? '_paper' : '_live';
const DB_PATH = path.join(process.cwd(), `../../orders${suffix}.db`);

type Row = {
  asset_id: string;
  condition_id: string | null;
  outcome: string | null;
  title: string | null;
  slug: string | null;
  wallet: string;
  net_shares: number;
  cost_basis: number;
  last_ts: string;
};

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const rows = db.prepare(`
      SELECT
        t.asset_id     AS asset_id,
        t.condition_id AS condition_id,
        t.outcome      AS outcome,
        t.title        AS title,
        t.slug         AS slug,
        t.wallet       AS wallet,
        SUM(CASE WHEN t.side = 'BUY' THEN b.bot_size ELSE -b.bot_size END)              AS net_shares,
        SUM(CASE WHEN t.side = 'BUY' THEN b.bot_size * b.bot_price ELSE -b.bot_size * b.bot_price END) AS cost_basis,
        MAX(b.timestamp) AS last_ts
      FROM bot_logs b
      JOIN target_trades t ON b.target_trade_id = t.trade_id
      WHERE b.action IN ('EXECUTED', 'PAPER_TRADE')
      GROUP BY t.asset_id, t.wallet
      HAVING net_shares > 0.001
      ORDER BY last_ts DESC
    `).all() as Row[];

    db.close();

    const now = Date.now();
    const enriched = await Promise.all(rows.map(async (r, i) => {
      const currentPrice = r.condition_id
        ? await getTokenPrice(r.condition_id, r.asset_id)
        : null;
      const avgPrice = r.net_shares > 0 ? r.cost_basis / r.net_shares : 0;
      const valueUsd = currentPrice != null ? currentPrice * r.net_shares : r.cost_basis;
      const unrealizedPnl = currentPrice != null ? valueUsd - r.cost_basis : 0;

      // SQLite stores naive UTC strings ("2026-05-13 20:54:45"). Append 'Z' so JS
      // parses it as UTC instead of local time, otherwise diff goes negative.
      const tsUtc = r.last_ts.includes('T') ? r.last_ts : r.last_ts.replace(' ', 'T') + 'Z';
      const heldDate = new Date(tsUtc).getTime();
      const diffHours = Math.max(0, Math.floor((now - heldDate) / (1000 * 60 * 60)));
      let timeStr = `${diffHours}h`;
      if (diffHours > 24) timeStr = `${Math.floor(diffHours / 24)}d`;
      if (diffHours === 0) timeStr = '<1h';

      return {
        id: `pos_${i}`,
        marketSlug: r.slug || r.asset_id,
        marketTitle: r.title || r.asset_id,
        trader: r.wallet.substring(0, 6) + '...' + r.wallet.substring(r.wallet.length - 4),
        outcome: (r.outcome ?? 'unknown').toLowerCase(),
        sizeShares: r.net_shares,
        avgPrice,
        currentPrice,
        valueUsd,
        unrealizedPnl,
        costBasis: r.cost_basis,
        timeHeld: timeStr,
      };
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    return NextResponse.json([]);
  }
}
