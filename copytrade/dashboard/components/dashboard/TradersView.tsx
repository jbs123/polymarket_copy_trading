"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Power } from "lucide-react"
import { AddTraderDialog } from "./AddTraderDialog"

export function TradersView() {
  const [config, setConfig] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      setConfig(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const saveConfig = async (newConfig: any) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      })
      setConfig(newConfig)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddTrader = (trader: any) => {
    if (!config) return
    const newConfig = {
      ...config,
      traders: [...(config.traders || []), trader]
    }
    saveConfig(newConfig)
  }

  const toggleTrader = (wallet: string) => {
    if (!config) return
    const newConfig = {
      ...config,
      traders: config.traders.map((t: any) => 
        t.wallet === wallet ? { ...t, enabled: !t.enabled } : t
      )
    }
    saveConfig(newConfig)
  }

  if (isLoading) {
    return <div className="text-slate-400 p-8 flex justify-center animate-pulse">Loading traders configuration...</div>
  }

  const traders = config?.traders || []

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white drop-shadow-md">Target Wallets</h3>
        <Button onClick={() => setIsAddModalOpen(true)} className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          <Plus className="mr-2 h-4 w-4" /> Add Trader
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {traders.map((trader: any, i: number) => (
          <Card key={trader.wallet} className={`glass-panel border-transparent glass-card-hover group relative overflow-hidden animate-in fade-in zoom-in-95 ${!trader.enabled ? "opacity-75 grayscale-[30%]" : ""}`} style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 border-b border-white/10 mx-6 px-0 pt-6">
              <div className="space-y-1">
                <CardTitle className="text-lg text-white drop-shadow-sm flex items-center gap-2">
                  {trader.nickname}
                </CardTitle>
                <CardDescription className="text-xs font-mono text-slate-400 truncate w-32" title={trader.wallet}>
                  {trader.wallet.substring(0, 6)}...{trader.wallet.substring(trader.wallet.length - 4)}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className={`border-none font-semibold ${trader.enabled ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-white/10 text-slate-400"}`}>
                  {trader.enabled ? "ACTIVE" : "DISABLED"}
                </Badge>
                <button onClick={() => toggleTrader(trader.wallet)} className={`p-1.5 rounded-full transition-colors ${trader.enabled ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`} title={trader.enabled ? "Disable Copying" : "Enable Copying"}>
                  <Power className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Capital Mode:</span>
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-white uppercase text-[10px]">{trader.capitalMode}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Trade Size:</span>
                  <span className="font-semibold text-white">${trader.sizing.usdPerTrade.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Max Exposure:</span>
                  <span className="font-semibold text-white">${trader.risk.maxTotalExposureUsd.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-white/10 mt-3">
                  <p className="text-xs font-medium mb-2 text-slate-400">Reaction Modes:</p>
                  <div className="flex flex-wrap gap-2">
                    {trader.followModes.followBuys && <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Follow Buys</Badge>}
                    {trader.followModes.counterBuys && <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">Counter Buys</Badge>}
                    {trader.followModes.followSells && <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Follow Sells</Badge>}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 mt-3 bg-white/[0.02] -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-400 font-medium">PnL Contribution:</span>
                      <span className={`text-lg font-bold drop-shadow-sm ${trader.performance.pnlContribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trader.performance.pnlContribution >= 0 ? '+' : ''}${trader.performance.pnlContribution.toFixed(2)}
                      </span>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <AddTraderDialog isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddTrader} />
    </div>
  )
}
