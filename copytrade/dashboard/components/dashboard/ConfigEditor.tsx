"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { botStatus } from "@/lib/mock-data"
import { AlertCircle } from "lucide-react"

export function ConfigEditor() {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in zoom-in-95">


      {/* Global Settings */}
      <Card className="glass-panel border-transparent">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-sm">Global Settings</CardTitle>
          <CardDescription className="text-slate-400">Bot-wide configuration and capital mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border border-white/10 rounded-md p-4 bg-white/[0.02]">
              <label className="text-sm font-semibold text-slate-300 leading-none">Capital Mode</label>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className={`border-none font-bold uppercase ${botStatus.capitalMode === 'paper' ? 'bg-white/10 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {botStatus.capitalMode}
                </Badge>
                <Button variant="outline" size="sm" className="h-7 text-xs ml-auto border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                  Promote to Live
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Requires confirmation dialog.</p>
            </div>

            <div className="space-y-2 border border-white/10 rounded-md p-4 bg-white/[0.02]">
               <label className="text-sm font-semibold text-slate-300 leading-none">Global Sizing Default</label>
               <div className="flex items-center mt-2">
                 <span className="text-sm mr-2 text-slate-400">$</span>
                 <input type="number" disabled value="1.00" className="flex h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors opacity-50 cursor-not-allowed text-white" />
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Limits (Read Only per spec) */}
      <Card className="glass-panel border-transparent">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-sm">Hard Risk Limits</CardTitle>
          <CardDescription className="text-slate-400">These are enforced at the engine level. Modifying requires SSH access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm bg-white/[0.02] p-4 rounded-md border border-white/10">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Total Bot Exposure Cap</span>
              <span className="font-semibold text-white">$100.00</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Per-Trader Exposure Cap</span>
              <span className="font-semibold text-white">$50.00</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Per-Market Exposure Cap</span>
              <span className="font-semibold text-white">$5.00</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Single-Trade Max Size</span>
              <span className="font-semibold text-white">$5.00</span>
            </div>
             <div className="flex justify-between py-2 border-b border-transparent">
              <span className="text-slate-400">Daily Loss Limit</span>
              <span className="font-semibold text-rose-400 drop-shadow-sm">$20.00</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Filters */}
      <Card className="glass-panel border-transparent">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-sm">Default Filters</CardTitle>
          <CardDescription className="text-slate-400">Global latency and drift constraints.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Max Latency (sec)</label>
                <input type="number" disabled value="5" className="flex h-8 w-full rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-50 cursor-not-allowed text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Max Price Drift (%)</label>
                <input type="number" disabled value="3" className="flex h-8 w-full rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-50 cursor-not-allowed text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Slippage Tolerance (%)</label>
                <input type="number" disabled value="2.0" className="flex h-8 w-full rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-50 cursor-not-allowed text-white" />
              </div>
           </div>
        </CardContent>
        <CardFooter>
          <Button disabled className="bg-cyan-500/50 text-white cursor-not-allowed border-transparent">Save Settings</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
