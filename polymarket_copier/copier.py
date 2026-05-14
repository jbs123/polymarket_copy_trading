import os
import json
import asyncio
import logging
import traceback
import sqlite3
import csv
from datetime import datetime
from typing import List, Dict, Any, Set
import requests
from dotenv import load_dotenv

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType, PartialCreateOrderOptions, TradeParams

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PolymarketCopier")

class DatabaseManager:
    def __init__(self, base_dir, paper_trade=True):
        suffix = "_paper" if paper_trade else "_live"
        self.db_path = os.path.join(base_dir, f"orders{suffix}.db")
        self.target_csv_path = os.path.join(base_dir, f"target_trades{suffix}.csv")
        self.bot_csv_path = os.path.join(base_dir, f"bot_logs{suffix}.csv")
        self.init_db()
        self.init_csv()

    def init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS target_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trade_id TEXT UNIQUE,
                    wallet TEXT,
                    asset_id TEXT,
                    side TEXT,
                    price REAL,
                    size REAL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    condition_id TEXT,
                    outcome TEXT,
                    slug TEXT,
                    title TEXT
                )
            ''')
            # Idempotent migration for pre-existing DBs missing the new columns.
            existing_cols = {row[1] for row in cursor.execute('PRAGMA table_info(target_trades)').fetchall()}
            for col in ('condition_id', 'outcome', 'slug', 'title'):
                if col not in existing_cols:
                    cursor.execute(f'ALTER TABLE target_trades ADD COLUMN {col} TEXT')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS bot_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_trade_id TEXT,
                    action TEXT,
                    reason TEXT,
                    bot_price REAL,
                    bot_size REAL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()

    def init_csv(self):
        if not os.path.exists(self.target_csv_path):
            with open(self.target_csv_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'trade_id', 'wallet', 'asset_id', 'side', 'price', 'size'])
        
        if not os.path.exists(self.bot_csv_path):
            with open(self.bot_csv_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'target_trade_id', 'action', 'reason', 'bot_price', 'bot_size'])

    def insert_target_trade(self, trade_id, wallet, asset_id, side, price, size,
                            condition_id=None, outcome=None, slug=None, title=None):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR IGNORE INTO target_trades
                        (trade_id, wallet, asset_id, side, price, size, condition_id, outcome, slug, title)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (trade_id, wallet, asset_id, side, price, size, condition_id, outcome, slug, title))

                # Check if row was actually inserted (not ignored) before writing to CSV
                if cursor.rowcount > 0:
                    with open(self.target_csv_path, 'a', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow([datetime.utcnow().isoformat(), trade_id, wallet, asset_id, side, price, size])

                conn.commit()
        except Exception as e:
            logger.error(f"DB Error inserting target trade: {e}")

    def insert_bot_log(self, target_trade_id, action, reason="", bot_price=0.0, bot_size=0.0):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO bot_logs (target_trade_id, action, reason, bot_price, bot_size)
                    VALUES (?, ?, ?, ?, ?)
                ''', (target_trade_id, action, reason, bot_price, bot_size))
                
                with open(self.bot_csv_path, 'a', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow([datetime.utcnow().isoformat(), target_trade_id, action, reason, bot_price, bot_size])
                    
                conn.commit()
        except Exception as e:
            logger.error(f"DB Error inserting bot log: {e}")

class PolymarketCopier:
    def __init__(self, private_key: str, chain_id: int = 137, host: str = "https://clob.polymarket.com",
                 paper_trade: bool = True, config_path: str = "config.json",
                 api_key: str = None, api_secret: str = None, api_passphrase: str = None):
        self.host = host
        self.chain_id = chain_id
        self.paper_trade = paper_trade
        self.config_path = config_path
        self.proxy_wallets = []
        self.trader_configs = {} # Store sizing and settings per trader
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.db = DatabaseManager(base_dir, self.paper_trade)
        
        # Initialize client
        self.client = ClobClient(host=host, chain_id=chain_id, key=private_key)

        try:
            if api_key and api_secret and api_passphrase:
                from py_clob_client.clob_types import ApiCreds
                self.creds = ApiCreds(api_key=api_key, api_secret=api_secret, api_passphrase=api_passphrase)
                self.client.set_api_creds(self.creds)
                logger.info("Successfully initialized ClobClient with explicit API credentials")
            else:
                # Create or derive API credentials
                self.creds = self.client.create_or_derive_api_creds()
                self.client.set_api_creds(self.creds)
                logger.info("Successfully initialized ClobClient and derived API credentials")
        except Exception as e:
            logger.error(f"Failed to initialize ClobClient. Using dummy creds if paper trading: {e}")
            if not self.paper_trade:
                raise

        self.seen_trades: Set[str] = set()
        self.initialized = False
        self.global_settings: Dict[str, Any] = {}

        # Load initial config
        self.load_config()

    def load_config(self):
        """Load trader configurations from config.json"""
        if not os.path.exists(self.config_path):
            logger.warning(f"Config file {self.config_path} not found.")
            return

        try:
            with open(self.config_path, 'r') as f:
                config_data = json.load(f)

            traders = config_data.get('traders', [])
            new_proxy_wallets = []
            new_trader_configs = {}

            for trader in traders:
                if trader.get('enabled', False):
                    wallet = trader.get('wallet', '').lower()
                    if wallet:
                        new_proxy_wallets.append(wallet)
                        new_trader_configs[wallet] = trader

            # Check for changes
            if set(new_proxy_wallets) != set(self.proxy_wallets):
                logger.info(f"Loaded config: Watching {len(new_proxy_wallets)} enabled wallets.")

            self.proxy_wallets = new_proxy_wallets
            self.trader_configs = new_trader_configs
            self.global_settings = config_data.get('globalSettings', {})

        except Exception as e:
            logger.error(f"Error loading config.json: {e}")

    def _get_exposure(self, wallet: str = None, asset_id: str = None) -> float:
        """Net USDC committed across PAPER_TRADE/EXECUTED rows (buys - sells), optionally filtered."""
        clauses = ["b.action IN ('EXECUTED', 'PAPER_TRADE')"]
        params: List[Any] = []
        if wallet is not None:
            clauses.append("LOWER(t.wallet) = ?")
            params.append(wallet.lower())
        if asset_id is not None:
            clauses.append("t.asset_id = ?")
            params.append(asset_id)
        where = " AND ".join(clauses)
        sql = f"""
            SELECT COALESCE(SUM(
                CASE WHEN t.side = 'BUY'  THEN  b.bot_size * b.bot_price
                     WHEN t.side = 'SELL' THEN -b.bot_size * b.bot_price
                     ELSE 0 END
            ), 0)
            FROM bot_logs b
            JOIN target_trades t ON b.target_trade_id = t.trade_id
            WHERE {where}
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                cur = conn.cursor()
                cur.execute(sql, params)
                (val,) = cur.fetchone()
                return float(val or 0.0)
        except Exception as e:
            logger.error(f"_get_exposure error: {e}")
            return 0.0

    async def fetch_target_trades(self) -> List[Dict[Any, Any]]:
        """Fetch recent trades for the configured proxy wallets using Polymarket Data API"""
        new_trades = []
        for wallet in self.proxy_wallets:
            try:
                # Get the latest trades for the maker address from Data API
                url = f"https://data-api.polymarket.com/trades?user={wallet}&limit=10"
                
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, requests.get, url)
                
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch trades for {wallet}: {response.status_code}")
                    continue
                    
                trades = response.json()

                if not isinstance(trades, list):
                    logger.warning(f"Unexpected trades response format for wallet {wallet}: {type(trades)}")
                    continue

                for api_trade in trades:
                    trade_id = api_trade.get('transactionHash')
                    if trade_id and trade_id not in self.seen_trades:
                        self.seen_trades.add(trade_id)
                        
                        # Normalize data API format to our internal format
                        trade = {
                            'id': trade_id,
                            'copied_from_wallet': wallet,
                            'asset_id': api_trade.get('asset', ''),
                            'side': api_trade.get('side', ''),
                            'price': float(api_trade.get('price', 0)),
                            'size': float(api_trade.get('size', 0)),
                            'timestamp': api_trade.get('timestamp'),
                            'condition_id': api_trade.get('conditionId'),
                            'outcome': api_trade.get('outcome'),
                            'slug': api_trade.get('slug'),
                            'title': api_trade.get('title'),
                        }

                        # Log to database
                        self.db.insert_target_trade(
                            trade['id'],
                            trade['copied_from_wallet'],
                            trade['asset_id'],
                            trade['side'],
                            trade['price'],
                            trade['size'],
                            condition_id=trade['condition_id'],
                            outcome=trade['outcome'],
                            slug=trade['slug'],
                            title=trade['title'],
                        )
                        
                        # Only add to new_trades if we're not just seeding the seen_trades cache
                        if self.initialized:
                            new_trades.append(trade)
            except Exception as e:
                logger.error(f"Error fetching trades for {wallet}: {e}")

        return new_trades

    async def copy_trade(self, trade: Dict[Any, Any]):
        """Copy a trade based on configured strategy"""
        trade_id = trade.get('id', '')
        wallet = trade.get('copied_from_wallet', '').lower()
        asset_id = trade.get('asset_id')
        price = float(trade.get('price', 0))
        size = float(trade.get('size', 0))
        side_str = trade.get('side', '').upper()
        
        # 1. Latency Filter
        timestamp_str = trade.get('timestamp')
        if timestamp_str:
            try:
                # Convert from seconds using utcfromtimestamp to match utcnow
                trade_time = datetime.utcfromtimestamp(int(timestamp_str))
                latency = (datetime.utcnow() - trade_time).total_seconds()
                max_latency = float(self.global_settings.get('maxLatencySec', 60))
                if latency > max_latency:
                    self.db.insert_bot_log(trade_id, "SKIPPED", f"Latency exceeded ({latency:.1f}s > {max_latency}s)")
                    return
            except Exception as e:
                logger.warning(f"Could not parse timestamp {timestamp_str}: {e}")

        trader_config = self.trader_configs.get(wallet, {})
        follow_modes = trader_config.get('followModes', {})
        sizing_config = trader_config.get('sizing', {})
        
        # 2. Reaction Engine
        bot_action = None
        if side_str == 'BUY':
            if follow_modes.get('followBuys'):
                bot_action = 'BUY'
            elif follow_modes.get('counterBuys'):
                self.db.insert_bot_log(trade_id, "SKIPPED", "Counter buy not yet supported (needs market resolution)")
                return
            else:
                self.db.insert_bot_log(trade_id, "SKIPPED", "Buy ignored by config")
                return
        elif side_str == 'SELL':
            if follow_modes.get('followSells'):
                bot_action = 'SELL'
            elif follow_modes.get('buyOnSells'):
                bot_action = 'BUY'
            elif follow_modes.get('counterSells'):
                self.db.insert_bot_log(trade_id, "SKIPPED", "Counter sell not yet supported")
                return
            else:
                self.db.insert_bot_log(trade_id, "SKIPPED", "Sell ignored by config")
                return
        else:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Unknown side {side_str}")
            return
            
        # 3. Sizing Engine — compute share count from a USD target.
        if price <= 0:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Invalid price {price}")
            return

        sizing_mode = sizing_config.get('mode', 'fixed_usd')
        if sizing_mode == 'proportional_to_trader':
            fraction = float(sizing_config.get('fraction_of_trader', 1.0))
            bot_size = size * fraction
            trade_usd = bot_size * price
        else:
            trade_usd = float(sizing_config.get('usdPerTrade', 1.0))
            bot_size = trade_usd / price

        # Polymarket minimum order is $1 of notional.
        if trade_usd < 1.0:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Trade notional ${trade_usd:.2f} below $1 minimum")
            return

        # 4. Risk caps (README contract — fail-closed before any execution/log).
        single_trade_max = float(self.global_settings.get('singleTradeMaxUsd', 5))
        per_market_cap   = float(self.global_settings.get('perMarketCapUsd', 5))
        per_trader_cap   = float(trader_config.get('risk', {}).get('maxTotalExposureUsd', 50))
        total_bot_cap    = float(self.global_settings.get('totalBotExposureCap', 100))

        if trade_usd > single_trade_max:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Single-trade cap (${trade_usd:.2f} > ${single_trade_max})")
            return

        market_exposure = self._get_exposure(asset_id=asset_id)
        if market_exposure + trade_usd > per_market_cap:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Per-market cap (${market_exposure:.2f}+${trade_usd:.2f} > ${per_market_cap})")
            return

        trader_exposure = self._get_exposure(wallet=wallet)
        if trader_exposure + trade_usd > per_trader_cap:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Per-trader cap (${trader_exposure:.2f}+${trade_usd:.2f} > ${per_trader_cap})")
            return

        total_exposure = self._get_exposure()
        if total_exposure + trade_usd > total_bot_cap:
            self.db.insert_bot_log(trade_id, "SKIPPED", f"Total bot cap (${total_exposure:.2f}+${trade_usd:.2f} > ${total_bot_cap})")
            return

        # TODO: daily loss limit ($20) — requires realized + unrealized PnL tracking.

        # 5. Execution or Simulation
        if self.paper_trade:
            logger.info(f"[PAPER TRADE] {wallet} {side_str} {size} -> Bot {bot_action} {bot_size} of {asset_id}")
            self.db.insert_bot_log(trade_id, "PAPER_TRADE", f"{bot_action} {bot_size} shares", price, bot_size)
            return

        try:
            if not all([asset_id, price, bot_size, bot_action]):
                logger.warning(f"Incomplete derived trade data: {trade}")
                self.db.insert_bot_log(trade_id, "ERROR", "Incomplete trade data")
                return

            logger.info(f"Copying trade from {wallet}: Bot {bot_action} {bot_size} of {asset_id} at {price}")

            # Prepare order args
            order_args = OrderArgs(
                token_id=asset_id,
                price=price,
                size=bot_size,
                side=bot_action
            )

            # Post order
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, self.client.create_and_post_order, order_args)
            logger.info(f"Order posted: {resp}")
            self.db.insert_bot_log(trade_id, "EXECUTED", "Order posted successfully", price, bot_size)
        except Exception as e:
            logger.error(f"Error copying trade: {e}")
            self.db.insert_bot_log(trade_id, "ERROR", str(e))
            traceback.print_exc()

    async def run_loop(self, poll_interval_seconds: int = 5):
        """Run the copy trading loop 24/7"""
        logger.info(f"Starting copy trading loop. Polling every {poll_interval_seconds}s. Paper trade: {self.paper_trade}")

        # Seed cache with historical trades to avoid copying them
        logger.info("Initializing cache with historical trades to avoid immediate execution...")
        await self.fetch_target_trades()
        self.initialized = True
        logger.info("Cache initialized. Now listening for new trades.")

        while True:
            try:
                # Reload config every tick to pick up UI changes
                self.load_config()
                
                if self.proxy_wallets:
                    new_trades = await self.fetch_target_trades()
                    for trade in new_trades:
                        await self.copy_trade(trade)
            except Exception as e:
                logger.error(f"Error in main loop: {e}")

            await asyncio.sleep(poll_interval_seconds)

def main():
    load_dotenv()

    # Load configuration from environment
    private_key = os.getenv("PRIVATE_KEY", "").strip()
    # Check if key is empty or clearly a placeholder (like 'your_wallet_private_key')
    if not private_key or not private_key.startswith("0x") or len(private_key) < 64:
        logger.warning("PRIVATE_KEY not valid or not set. Using a dummy key for testing/paper trading only.")
        private_key = "0x" + "0" * 64

    chain_id = int(os.getenv("CHAIN_ID", "137"))
    host = os.getenv("HOST", "https://clob.polymarket.com")
    paper_trade = os.getenv("PAPER_TRADE", "true").lower() == "true"
    
    api_key = os.getenv("API_KEY", "").strip()
    api_secret = os.getenv("API_SECRET", "").strip()
    api_passphrase = os.getenv("API_PASSPHRASE", "").strip()
    
    # Path to config.json
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")

    copier = PolymarketCopier(
        private_key=private_key,
        chain_id=chain_id,
        host=host,
        paper_trade=paper_trade,
        config_path=config_path,
        api_key=api_key if api_key else None,
        api_secret=api_secret if api_secret else None,
        api_passphrase=api_passphrase if api_passphrase else None
    )

    asyncio.run(copier.run_loop())

if __name__ == "__main__":
    main()
