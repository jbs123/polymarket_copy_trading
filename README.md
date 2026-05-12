# Polymarket Copy Trading Bot 🤖📈

This repository houses a comprehensive, automated copy-trading system built for Polymarket. It is designed to autonomously track and mirror the trades of top-performing wallets on the Polymarket prediction market platform.

## 🌟 What are we building?

We are building a multi-component system that:
1.  **Monitors** specific "followed" trader wallets on Polymarket in real-time.
2.  **Analyzes** their trades against configurable risk limits, latency thresholds, and reaction modes (e.g., follow buys, counter sells).
3.  **Executes** mirrored trades automatically using our own funded wallet, adhering to strict exposure caps.
4.  **Visualizes** performance, system health, and trade history via a Next.js dashboard.

The system is designed to operate 24/7 on a Jetson device, with a clear separation of concerns between data ingestion, trade decision-making, order execution, and UI presentation.

## 🤔 Why are we building this?

This project serves two primary purposes:

1.  **Alpha Generation:** The core thesis is that by identifying and systematically following provably skilled traders (the "smart money" on the Polymarket leaderboard), we can generate a positive ROI on an initial capital allocation ($100 starting test).
2.  **Content Creation (The Real Goal):** This bot is the engine for an ongoing YouTube content series. Every trade, every bug, every win, and every loss is logged and designed to be transparently shared.
    *   *Ep 5: "I built a copy bot for Polymarket — does it work?"*
    *   *Ep 9: "Polling vs websocket — does latency actually matter?"*
    *   *Ep 12: "I downloaded every top Polymarket trader and ranked them."*

To support the content, honesty and observability are paramount. The bot uses hard risk caps (so we don't blow up the account silently), and logs every single skipped trade and execution attempt for on-screen analysis.

## 🏗️ Architecture Overview

The system is composed of several independent agents/components, connected by shared data contracts (Pydantic schemas) and file-based state.

*   **Data Collector (`ct-recorder`):** Polls the Polymarket API (and later, websockets) to ingest trader events, portfolio snapshots, and market context. It saves data locally as Parquet files.
*   **Reaction Engine (`ct-engine`):** Consumes the data stream, applies the "Nine Reaction Modes" (e.g., `follow_buys`, `counter_sells`), checks latency/drift filters, and enforces risk gating. It outputs `Decision` objects.
*   **Execution Engine:** Receives `Decision` objects, applies final hard risk caps (e.g., $5 max per trade, $20 daily loss limit), and routes market orders to Polymarket. It logs everything to `orders.db`.
*   **Dashboard UI (`copytrade/dashboard`):** A Next.js web application that reads the state (bot status, open positions, trade logs) and provides a visual interface for tracking performance (paper vs. live) and adjusting configurations.
*   **Trader Scoring Pipeline (v2):** A future component that will analyze the wider universe of downloaded trader histories to algorithmically rank and suggest new traders to follow.

## 🚀 Getting Started

### Prerequisites
*   Node.js (for the Dashboard)
*   Python 3.10+ (for the Backend/Copier)
*   A funded Polymarket wallet (Polygon network)

### 1. Dashboard UI (Frontend)

The dashboard is built with Next.js, Tailwind CSS, and shadcn/ui.

```bash
cd copytrade/dashboard
npm install
npm run dev
```
Navigate to `http://localhost:3000` to view the UI. Currently, the UI uses mock data fixtures while the backend API is being finalized.

### 2. Trade Copier (Backend)

*Note: Backend integration is ongoing.*

The core Python copier requires environment variables to connect to Polymarket.

1.  Create a `.env` file in the root directory:
    ```env
    PRIVATE_KEY=your_wallet_private_key
    POLYGON_RPC_URL=your_polygon_rpc_url
    HOST=https://clob.polymarket.com
    CHAIN_ID=137
    TARGET_WALLETS=0xTraderWallet1,0xTraderWallet2
    PAPER_TRADE=true
    FIXED_TRADE_SIZE=1.00
    ```
2.  Set up the Python environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r polymarket_copier/requirements.txt
    ```
3.  Run the copier:
    ```bash
    python3 polymarket_copier/copier.py
    ```

## 🛡️ Risk Management & Rules

This bot is designed with "fail-closed" safety mechanisms.
*   **Total Bot Exposure Ceiling:** $100 USDC.
*   **Per-Trader Exposure Ceiling:** $50 USDC.
*   **Per-Market Exposure Ceiling:** $5 USDC.
*   **Daily Loss Limit:** $20. If exceeded, the bot automatically pauses for 24 hours.
*   **Single-Trade Max:** $5. Any generated decision above this is hard-rejected.

These rules are non-negotiable and are enforced in the Execution Engine code. The UI cannot override them.

## 📁 Repository Structure

*   `COPY_TRADE.md`: The original requirements and build specification document.
*   `copytrade/dashboard/`: The Next.js frontend application.
*   `polymarket_copier/`: The core Python trading logic (WIP integration).

## 🤝 Contributing

This is a multi-agent project. If you are an AI agent working on this repo:
1.  **Read `COPY_TRADE.md`:** It is the source of truth for the system design.
2.  **Respect Agent Boundaries:** Only modify the components assigned to your role (UI, Backend, Data, etc.).
3.  **Contracts are Sacred:** Do not alter shared schemas (`copytrade/contracts/`) without coordinating.
4.  **Verify Everything:** Ensure UI changes compile and run without hydration errors. Ensure Python code is tested against the risk caps.
