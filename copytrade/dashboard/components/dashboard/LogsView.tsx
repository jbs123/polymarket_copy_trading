"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LogsView() {
  const [targetTrades, setTargetTrades] = useState<any[]>([])
  const [botLogs, setBotLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/logs')
        const data = await res.json()
        setTargetTrades(data.targetTrades || [])
        setBotLogs(data.botLogs || [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchLogs()
    // Poll every 5 seconds
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <div className="text-slate-400 p-8 flex justify-center animate-pulse">Loading live strategy logs...</div>
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95">
      {/* Target Trades (Strategy) */}
      <Card className="glass-panel border-transparent">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-sm flex items-center gap-2">
            Target Wallet Strategy
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">LIVE</Badge>
          </CardTitle>
          <CardDescription className="text-slate-400">Raw feed of every trade executed by the followed wallets.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10 bg-white/[0.02] max-h-[400px] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-black/20 hover:bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="border-b border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold">Time</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Wallet</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Asset ID</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Action</TableHead>
                  <TableHead className="text-right text-slate-300 font-semibold">Price</TableHead>
                  <TableHead className="text-right text-slate-300 font-semibold">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targetTrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">No trades detected yet. Waiting for targets to trade...</TableCell>
                  </TableRow>
                ) : targetTrades.map((log) => (
                  <TableRow key={log.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors duration-200">
                    <TableCell className="whitespace-nowrap text-slate-500 font-mono" suppressHydrationWarning>
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-xs">{log.wallet.substring(0,6)}...{log.wallet.substring(log.wallet.length-4)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-200" title={log.asset_id}>
                      {log.asset_id}
                    </TableCell>
                    <TableCell>
                      <span className={`uppercase font-bold text-xs drop-shadow-sm ${log.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {log.side}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">${log.price.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-semibold text-white">{log.size.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bot Logs */}
      <Card className="glass-panel border-transparent">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-sm">Bot Actions</CardTitle>
          <CardDescription className="text-slate-400">Record of simulated paper trades and executions based on target strategy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10 bg-white/[0.02] max-h-[300px] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-black/20 hover:bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="border-b border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold">Time</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Target Trade ID</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Action</TableHead>
                  <TableHead className="text-right text-slate-300 font-semibold">Bot Price</TableHead>
                  <TableHead className="text-right text-slate-300 font-semibold">Bot Size</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">No bot actions taken yet.</TableCell>
                  </TableRow>
                ) : botLogs.map((log) => (
                  <TableRow key={log.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors duration-200">
                    <TableCell className="whitespace-nowrap text-slate-500 font-mono" suppressHydrationWarning>
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-xs">{log.target_trade_id.substring(0,8)}...</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-bold border-none ${
                        log.action === 'EXECUTED' ? 'bg-emerald-500/20 text-emerald-400' : 
                        log.action === 'PAPER_TRADE' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">${log.bot_price.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-semibold text-white">{log.bot_size.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-slate-400 truncate max-w-[200px]" title={log.reason}>
                      {log.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
