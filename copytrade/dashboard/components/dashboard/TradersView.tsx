"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { traders } from "@/lib/mock-data"

export function TradersView() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {traders.map((trader) => (
          <Card key={trader.wallet} className={!trader.enabled ? "opacity-60" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{trader.nickname}</CardTitle>
                <CardDescription className="text-xs font-mono truncate w-32" title={trader.wallet}>
                  {trader.wallet.substring(0, 6)}...{trader.wallet.substring(trader.wallet.length - 4)}
                </CardDescription>
              </div>
              <Badge variant={trader.enabled ? "default" : "secondary"}>
                {trader.enabled ? "Active" : "Disabled"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium uppercase">{trader.capitalMode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Size per trade:</span>
                  <span className="font-medium">${trader.sizing.usdPerTrade.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Exposure:</span>
                  <span className="font-medium">${trader.risk.maxTotalExposureUsd.toFixed(2)}</span>
                </div>

                <div className="pt-2 border-t mt-2">
                  <p className="text-xs font-semibold mb-1 text-muted-foreground">Reactions:</p>
                  <div className="flex flex-wrap gap-1">
                    {trader.followModes.followBuys && <Badge variant="outline" className="text-[10px]">Follow Buys</Badge>}
                    {trader.followModes.counterBuys && <Badge variant="outline" className="text-[10px] bg-red-50">Counter Buys</Badge>}
                    {trader.followModes.followSells && <Badge variant="outline" className="text-[10px]">Follow Sells</Badge>}
                  </div>
                </div>

                <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PnL Contrib:</span>
                      <span className={`font-medium ${trader.performance.pnlContribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trader.performance.pnlContribution >= 0 ? '+' : ''}${trader.performance.pnlContribution.toFixed(2)}
                      </span>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
