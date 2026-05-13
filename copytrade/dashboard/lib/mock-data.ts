export const botStatus = {
  capitalMode: "paper",
  allocatedUsd: 114.50,
  initialAllocation: 100,
  dailyPnl: 3.25,
  totalPnl: 14.50,
  vpnStatus: "healthy",
  killSwitchActive: false,
  lastUpdated: new Date().toISOString(),
};

export const pnlHistory = [
  { date: "2024-05-01", value: 100 },
  { date: "2024-05-02", value: 98.50 },
  { date: "2024-05-03", value: 101.20 },
  { date: "2024-05-04", value: 105.00 },
  { date: "2024-05-05", value: 103.80 },
  { date: "2024-05-06", value: 106.50 },
  { date: "2024-05-07", value: 110.00 },
  { date: "2024-05-08", value: 109.20 },
  { date: "2024-05-09", value: 112.50 },
  { date: "2024-05-10", value: 111.00 },
  { date: "2024-05-11", value: 114.50 },
];

export const traders = [
  {
    wallet: "0xABC1234567890abcdef1234567890ABCDEF12345",
    nickname: "WhaleA",
    enabled: true,
    capitalMode: "paper",
    followModes: {
      followBuys: true,
      counterBuys: false,
      followSells: true,
      buyOnSells: false,
      counterSells: false,
    },
    copySide: "both",
    sizing: { usdPerTrade: 1.00 },
    risk: { maxTotalExposureUsd: 50 },
    performance: {
      pnlContribution: 12.50,
      tradesCopied: 45,
    }
  },
  {
    wallet: "0xDEF0987654321fedcba0987654321FEDCBA09876",
    nickname: "SmartMoneyB",
    enabled: true,
    capitalMode: "paper",
    followModes: {
      followBuys: true,
      counterBuys: false,
      followSells: true,
      buyOnSells: false,
      counterSells: false,
    },
    copySide: "yes",
    sizing: { usdPerTrade: 2.00 },
    risk: { maxTotalExposureUsd: 50 },
    performance: {
      pnlContribution: 2.00,
      tradesCopied: 12,
    }
  },
  {
    wallet: "0x1234567890ABCDEF1234567890abcdef12345678",
    nickname: "DegenC",
    enabled: false,
    capitalMode: "paper",
    followModes: {
      followBuys: false,
      counterBuys: true,
      followSells: false,
      buyOnSells: false,
      counterSells: false,
    },
    copySide: "both",
    sizing: { usdPerTrade: 1.00 },
    risk: { maxTotalExposureUsd: 20 },
    performance: {
      pnlContribution: -5.50,
      tradesCopied: 18,
    }
  }
];

export const openPositions = [
  {
    id: "pos_1",
    marketId: "market_abc",
    marketSlug: "will-bitcoin-hit-100k-in-2024",
    outcome: "yes",
    sizeShares: 5.5,
    avgPrice: 0.45,
    currentPrice: 0.52,
    valueUsd: 2.86,
    unrealizedPnl: 0.38,
    trader: "WhaleA",
    timeHeld: "14d"
  },
  {
    id: "pos_2",
    marketId: "market_def",
    marketSlug: "fed-rate-cut-june",
    outcome: "no",
    sizeShares: 10,
    avgPrice: 0.20,
    currentPrice: 0.15,
    valueUsd: 1.50,
    unrealizedPnl: -0.50,
    trader: "SmartMoneyB",
    timeHeld: "5d"
  },
  {
    id: "pos_3",
    marketId: "market_ghi",
    marketSlug: "eth-etf-approval-may",
    outcome: "yes",
    sizeShares: 2.2,
    avgPrice: 0.85,
    currentPrice: 0.90,
    valueUsd: 1.98,
    unrealizedPnl: 0.11,
    trader: "WhaleA",
    timeHeld: "2d"
  }
];

export const tradeLogs = [
  {
    orderId: "ord_101",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    trader: "WhaleA",
    marketSlug: "eth-etf-approval-may",
    action: "buy",
    outcome: "yes",
    sizeUsdRequested: 1.00,
    sizeUsdFilled: 1.00,
    priceFilled: 0.90,
    latencyMs: 1250,
    status: "filled"
  },
  {
    orderId: "ord_100",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    trader: "SmartMoneyB",
    marketSlug: "fed-rate-cut-june",
    action: "buy",
    outcome: "no",
    sizeUsdRequested: 2.00,
    sizeUsdFilled: 2.00,
    priceFilled: 0.15,
    latencyMs: 800,
    status: "filled"
  },
  {
    orderId: "ord_099",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    trader: "WhaleA",
    marketSlug: "will-bitcoin-hit-100k-in-2024",
    action: "sell",
    outcome: "yes",
    sizeUsdRequested: 0.50,
    sizeUsdFilled: 0.50,
    priceFilled: 0.51,
    latencyMs: 1500,
    status: "filled"
  },
  {
    orderId: "ord_098",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    trader: "WhaleA",
    marketSlug: "unknown-market",
    action: "buy",
    outcome: "yes",
    sizeUsdRequested: 1.00,
    sizeUsdFilled: 0,
    priceFilled: 0,
    latencyMs: 2200,
    status: "rejected",
    errorMsg: "Slippage tolerance exceeded"
  }
];

export const skipLogs = [
  {
    id: "skip_1",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    trader: "WhaleA",
    marketSlug: "nba-finals-winner",
    reason: "Latency exceeded (6.2s > 5s)",
    traderTrade: { action: "buy", outcome: "yes", size: 50 }
  },
  {
    id: "skip_2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    trader: "SmartMoneyB",
    marketSlug: "presidential-election-2024",
    reason: "Market category excluded (politics)",
    traderTrade: { action: "buy", outcome: "no", size: 100 }
  },
  {
    id: "skip_3",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    trader: "WhaleA",
    marketSlug: "will-bitcoin-hit-100k-in-2024",
    reason: "Per-market exposure cap reached ($5.00)",
    traderTrade: { action: "buy", outcome: "yes", size: 25 }
  }
];
