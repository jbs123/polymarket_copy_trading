import os
import json
import asyncio
import logging
import traceback
from typing import List, Dict, Any, Set
from dotenv import load_dotenv

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType, PartialCreateOrderOptions, TradeParams

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PolymarketCopier")

class PolymarketCopier:
    def __init__(self, private_key: str, chain_id: int = 137, host: str = "https://clob.polymarket.com",
                 proxy_wallets: List[str] = None, paper_trade: bool = True, fixed_trade_size: float = None):
        self.host = host
        self.chain_id = chain_id
        self.paper_trade = paper_trade
        self.fixed_trade_size = fixed_trade_size
        self.proxy_wallets = [w.lower() for w in proxy_wallets] if proxy_wallets else []

        # Initialize client
        self.client = ClobClient(host=host, chain_id=chain_id, key=private_key)

        try:
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

    async def fetch_target_trades(self) -> List[Dict[Any, Any]]:
        """Fetch recent trades for the configured proxy wallets"""
        new_trades = []
        for wallet in self.proxy_wallets:
            try:
                # Get the latest trades for the maker address
                params = TradeParams(maker_address=wallet)

                # In asyncio, we should use run_in_executor for synchronous blocking calls
                loop = asyncio.get_event_loop()
                trades_response = await loop.run_in_executor(None, self.client.get_trades, params)

                # Check response format and extract trades
                trades = trades_response.get('data', []) if isinstance(trades_response, dict) else trades_response

                if not isinstance(trades, list):
                    logger.warning(f"Unexpected trades response format for wallet {wallet}: {type(trades)}")
                    continue

                for trade in trades:
                    trade_id = trade.get('id')
                    if trade_id and trade_id not in self.seen_trades:
                        self.seen_trades.add(trade_id)
                        # Only add to new_trades if we're not just seeding the seen_trades cache
                        if self.initialized:
                            new_trades.append(trade)
            except Exception as e:
                logger.error(f"Error fetching trades for {wallet}: {e}")

        return new_trades

    async def copy_trade(self, trade: Dict[Any, Any]):
        """Copy a trade"""
        if self.paper_trade:
            logger.info(f"[PAPER TRADE] Would copy trade: {trade}")
            return

        try:
            # Extract relevant info from trade
            asset_id = trade.get('asset_id')
            price = float(trade.get('price', 0))
            # Use original trade size or fixed configured size
            size = self.fixed_trade_size if self.fixed_trade_size else float(trade.get('size', 0))
            side_str = trade.get('side', '').upper()

            if not all([asset_id, price, size, side_str]):
                logger.warning(f"Incomplete trade data: {trade}")
                return

            logger.info(f"Copying trade: {side_str} {size} of {asset_id} at {price}")

            # Prepare order args
            order_args = OrderArgs(
                token_id=asset_id,
                price=price,
                size=size,
                side=side_str
            )

            # Post order
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, self.client.create_and_post_order, order_args)
            logger.info(f"Order posted: {resp}")
        except Exception as e:
            logger.error(f"Error copying trade: {e}")
            traceback.print_exc()

    async def run_loop(self, poll_interval_seconds: int = 5):
        """Run the copy trading loop 24/7"""
        logger.info(f"Starting copy trading loop. Polling every {poll_interval_seconds}s. Paper trade: {self.paper_trade}")
        logger.info(f"Watching wallets: {self.proxy_wallets}")

        # Seed cache with historical trades to avoid copying them
        logger.info("Initializing cache with historical trades to avoid immediate execution...")
        await self.fetch_target_trades()
        self.initialized = True
        logger.info("Cache initialized. Now listening for new trades.")

        while True:
            try:
                new_trades = await self.fetch_target_trades()
                for trade in new_trades:
                    await self.copy_trade(trade)
            except Exception as e:
                logger.error(f"Error in main loop: {e}")

            await asyncio.sleep(poll_interval_seconds)

def main():
    load_dotenv()

    # Load configuration from environment
    private_key = os.getenv("PRIVATE_KEY")
    if not private_key:
        logger.warning("PRIVATE_KEY not set. Using a dummy key for testing/paper trading only.")
        private_key = "0x" + "0" * 64

    chain_id = int(os.getenv("CHAIN_ID", "137"))
    host = os.getenv("HOST", "https://clob.polymarket.com")

    # Load comma-separated list of target wallets
    target_wallets_str = os.getenv("TARGET_WALLETS", "")
    target_wallets = [w.strip() for w in target_wallets_str.split(",")] if target_wallets_str else []

    paper_trade = os.getenv("PAPER_TRADE", "true").lower() == "true"
    fixed_trade_size = os.getenv("FIXED_TRADE_SIZE")
    fixed_trade_size = float(fixed_trade_size) if fixed_trade_size else None

    copier = PolymarketCopier(
        private_key=private_key,
        chain_id=chain_id,
        host=host,
        proxy_wallets=target_wallets,
        paper_trade=paper_trade,
        fixed_trade_size=fixed_trade_size
    )

    asyncio.run(copier.run_loop())

if __name__ == "__main__":
    main()
