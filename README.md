# Polymarket Copy Trading Bot

A Python script that you can run 24/7 to copy trades of specific Polymarket wallets.

## Setup

1. Create a virtual environment and install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r polymarket_copier/requirements.txt
```

2. Configure environment variables in a `.env` file (see `polymarket_copier/.env.example`):
- `PRIVATE_KEY`: Your wallet private key
- `POLYGON_RPC_URL`: RPC URL for Polygon network
- `HOST`: Polymarket CLOB host URL (e.g., `https://clob.polymarket.com/` for mainnet)
- `CHAIN_ID`: 137 for mainnet
- `TARGET_WALLETS`: Comma-separated list of wallet addresses to copy
- `PAPER_TRADE`: `true` or `false`
- `FIXED_TRADE_SIZE`: Optional. Set a fixed size to use for all copied trades instead of proportional.

3. Run the bot:
```bash
python3 polymarket_copier/copier.py
```
