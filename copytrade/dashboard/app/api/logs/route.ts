import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

import fs from 'fs';

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
    
    // Fetch target trades (Strategy)
    const targetTrades = db.prepare(`
      SELECT * FROM target_trades 
      ORDER BY timestamp DESC 
      LIMIT 100
    `).all();

    // Fetch bot logs (Actions)
    const botLogs = db.prepare(`
      SELECT * FROM bot_logs 
      ORDER BY timestamp DESC 
      LIMIT 100
    `).all();

    db.close();

    return NextResponse.json({
      targetTrades,
      botLogs
    });
  } catch (error) {
    console.error('Failed to read orders.db:', error);
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}
