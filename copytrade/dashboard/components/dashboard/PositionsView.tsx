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

export function PositionsView() {
  const [positions, setPositions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch('/api/positions')
        const data = await res.json()
        setPositions(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchPositions()
    const interval = setInterval(fetchPositions, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <div className="text-slate-400 p-8 flex justify-center animate-pulse">Loading open positions...</div>
  }

  return (
    <Card className="glass-panel border-transparent animate-in fade-in zoom-in-95">
      <CardHeader>
        <CardTitle className="text-white drop-shadow-sm">Open Positions</CardTitle>
        <CardDescription className="text-slate-400">Currently held positions copied from traders.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-white/10 bg-white/[0.02]">
          <Table>
            <TableHeader className="bg-black/20 hover:bg-black/20">
              <TableRow className="border-b border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-300 font-semibold">Asset ID</TableHead>
                <TableHead className="text-slate-300 font-semibold">Trader</TableHead>
                <TableHead className="text-slate-300 font-semibold">Outcome</TableHead>
                <TableHead className="text-right text-slate-300 font-semibold">Shares</TableHead>
                <TableHead className="text-right text-slate-300 font-semibold">Avg Price</TableHead>
                <TableHead className="text-right text-slate-300 font-semibold">Value (USD)</TableHead>
                <TableHead className="text-right text-slate-300 font-semibold">Unrealized PnL</TableHead>
                <TableHead className="text-right text-slate-300 font-semibold">Time Held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">No open positions detected.</TableCell>
                </TableRow>
              ) : positions.map((pos) => (
                <TableRow key={pos.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors duration-200">
                  <TableCell className="font-medium max-w-[250px] truncate text-slate-200" title={pos.marketSlug}>
                    {pos.marketSlug}
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-xs">{pos.trader}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-none font-bold uppercase ${pos.outcome === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {pos.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-300">{pos.sizeShares.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-slate-300">${pos.avgPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold text-white">${pos.valueUsd.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-bold drop-shadow-sm ${pos.unrealizedPnl >= 0 ? 'text-slate-500' : 'text-slate-500'}`}>
                    ${pos.unrealizedPnl.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">{pos.timeHeld}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
