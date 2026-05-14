import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getTokenPrice } from '@/lib/polymarket';

// Try to parse PAPER_TRADE from polymarket_copier/.env
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

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    // Net USDC committed: BUY notional minus SELL notional, joined to side.
    const allocationResult = db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN t.side = 'BUY'  THEN  b.bot_size * b.bot_price
             WHEN t.side = 'SELL' THEN -b.bot_size * b.bot_price
             ELSE 0 END
      ), 0) AS total_allocated
      FROM bot_logs b
      JOIN target_trades t ON b.target_trade_id = t.trade_id
      WHERE b.action IN ('EXECUTED', 'PAPER_TRADE')
    `).get() as { total_allocated: number | null };

    const allocatedUsd = allocationResult?.total_allocated || 0;

    // Fetch the 5 most recent bot activities
    const recentActivity = db.prepare(`
      SELECT * FROM bot_logs
      ORDER BY timestamp DESC
      LIMIT 5
    `).all();

    // Open positions used for PnL — same shape as positions route, but we only need
    // condition_id, asset_id, net_shares, cost_basis, and a today/all flag for dailyPnl.
    type PnlRow = {
      asset_id: string;
      condition_id: string | null;
      net_shares: number;
      cost_basis: number;
      net_shares_today: number;
      cost_basis_today: number;
    };
    const todayIso = new Date().toISOString().slice(0, 10);
    const pnlRows = db.prepare(`
      SELECT
        t.asset_id     AS asset_id,
        t.condition_id AS condition_id,
        SUM(CASE WHEN t.side = 'BUY' THEN b.bot_size ELSE -b.bot_size END) AS net_shares,
        SUM(CASE WHEN t.side = 'BUY' THEN b.bot_size * b.bot_price ELSE -b.bot_size * b.bot_price END) AS cost_basis,
        SUM(CASE WHEN DATE(b.timestamp) = DATE(?) THEN
              (CASE WHEN t.side = 'BUY' THEN b.bot_size ELSE -b.bot_size END)
            ELSE 0 END) AS net_shares_today,
        SUM(CASE WHEN DATE(b.timestamp) = DATE(?) THEN
              (CASE WHEN t.side = 'BUY' THEN b.bot_size * b.bot_price ELSE -b.bot_size * b.bot_price END)
            ELSE 0 END) AS cost_basis_today
      FROM bot_logs b
      JOIN target_trades t ON b.target_trade_id = t.trade_id
      WHERE b.action IN ('EXECUTED', 'PAPER_TRADE')
        AND t.condition_id IS NOT NULL
      GROUP BY t.asset_id
      HAVING net_shares > 0.001
    `).all(todayIso, todayIso) as PnlRow[];

    db.close();

    let totalPnl = 0;
    let dailyPnl = 0;
    await Promise.all(pnlRows.map(async (r) => {
      const price = r.condition_id ? await getTokenPrice(r.condition_id, r.asset_id) : null;
      if (price == null) return;
      totalPnl += price * r.net_shares - r.cost_basis;
      if (r.net_shares_today > 0.001) {
        dailyPnl += price * r.net_shares_today - r.cost_basis_today;
      }
    }));

    const initialAllocation = 100;

    return NextResponse.json({
      capitalMode: isPaperTrade ? 'paper' : 'live',
      allocatedUsd,
      initialAllocation,
      dailyPnl,
      totalPnl,
      vpnStatus: 'healthy',
      killSwitchActive: false,
      lastUpdated: new Date().toISOString(),
      recentActivity,
      pnlHistory: [
        { date: "Day 1", value: initialAllocation },
        { date: "Current", value: initialAllocation + totalPnl }
      ]
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    // If DB doesn't exist yet, return defaults
    return NextResponse.json({
      capitalMode: isPaperTrade ? 'paper' : 'live',
      allocatedUsd: 0,
      initialAllocation: 100,
      dailyPnl: 0,
      totalPnl: 0,
      vpnStatus: 'healthy',
      killSwitchActive: false,
      lastUpdated: new Date().toISOString(),
      recentActivity: [],
      pnlHistory: [
        { date: "Day 1", value: 100 },
        { date: "Current", value: 100 }
      ]
    });
  }
}
