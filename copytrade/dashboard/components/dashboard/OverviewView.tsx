"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Activity, ShieldAlert, Wallet, TrendingUp } from "lucide-react"

export function OverviewView() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        const data = await res.json()
        setStats(data)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading || !stats) {
    return <div className="text-slate-400 p-8 flex justify-center animate-pulse">Loading live dashboard stats...</div>
  }

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel glass-card-hover border-transparent relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-300">Allocated Balance</CardTitle>
            <div className="p-2 bg-cyan-500/10 rounded-full border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Wallet className="h-4 w-4 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-white drop-shadow-sm">${stats.allocatedUsd.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-2 flex items-center">
              Remaining: <span className="ml-1 text-white">${Math.max(0, stats.initialAllocation - stats.allocatedUsd).toFixed(2)}</span>
              <Badge variant={stats.capitalMode === 'paper' ? 'secondary' : 'default'} className={`ml-2 uppercase text-[10px] border hover:bg-white/20 ${stats.capitalMode === 'paper' ? 'bg-white/10 text-white border-white/20' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>{stats.capitalMode}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-card-hover border-transparent relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-300">Total PnL</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full border border-purple-500/20 shadow-[0_0_10px_rgba(139,92,246,0.2)]">
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className={`text-3xl font-bold drop-shadow-sm ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Daily: <span className={stats.dailyPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{stats.dailyPnl >= 0 ? '+' : ''}${stats.dailyPnl.toFixed(2)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-card-hover border-transparent relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-300">System Health</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={stats.vpnStatus === 'healthy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}>
                VPN: {stats.vpnStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-3" suppressHydrationWarning>
              Last heartbeat: {new Date(stats.lastUpdated).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-card-hover border-transparent relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-300">Kill Switch</CardTitle>
            <div className="p-2 bg-rose-500/10 rounded-full border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
             <div className="flex items-center space-x-2 mt-1">
                <Badge className={stats.killSwitchActive ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold px-3 py-1 animate-pulse' : 'bg-white/10 text-white border-white/20'}>
                  {stats.killSwitchActive ? 'ACTIVE (PAUSED)' : 'INACTIVE (RUNNING)'}
                </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Chart */}
        <Card className="col-span-4 glass-panel border-transparent">
          <CardHeader>
            <CardTitle className="text-white">Performance Overview</CardTitle>
            <CardDescription className="text-slate-400">Bot allocation over time</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.pnlHistory} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => value} stroke="#94a3b8" fontSize={12} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} domain={['dataMin - 5', 'dataMax + 5']} stroke="#94a3b8" fontSize={12} dx={-10} />
                  <Tooltip 
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Balance']}
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#06b6d4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#06b6d4" 
                    strokeWidth={3} 
                    dot={false} 
                    activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }} 
                    style={{ filter: 'drop-shadow(0px 4px 8px rgba(6,182,212,0.3))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Mini-feed */}
        <Card className="col-span-3 glass-panel border-transparent">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-slate-400">Latest trade execution attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pr-2 overflow-y-auto max-h-[320px] custom-scrollbar">
              {stats.recentActivity.length === 0 ? (
                 <div className="text-slate-500 text-sm py-4 text-center">No recent bot activity.</div>
              ) : stats.recentActivity.map((log: any, i: number) => (
                <div key={log.id} className={`flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-200 animate-in fade-in slide-in-from-right-4`} style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-none text-slate-200 truncate max-w-[180px]" title={log.reason}>
                      {log.action} <span className="text-emerald-400">{log.bot_size > 0 ? `$${log.bot_size}` : ''}</span>
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">
                      {log.target_trade_id.substring(0, 10)}...
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <Badge variant="outline" className={`text-[10px] h-5 mb-1.5 border-none font-semibold ${log.action === 'EXECUTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {log.action}
                    </Badge>
                    <p className="text-xs text-slate-500 font-mono" suppressHydrationWarning>
                      {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
