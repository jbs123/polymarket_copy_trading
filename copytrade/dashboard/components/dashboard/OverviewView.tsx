"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { botStatus, pnlHistory, tradeLogs } from "@/lib/mock-data"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Activity, ShieldAlert, Wallet, TrendingUp } from "lucide-react"

export function OverviewView() {
  return (
    <div className="space-y-4">
      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${botStatus.allocatedUsd.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center">
              Mode: <Badge variant={botStatus.capitalMode === 'paper' ? 'secondary' : 'default'} className="ml-1 uppercase text-[10px]">{botStatus.capitalMode}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${botStatus.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {botStatus.totalPnl >= 0 ? '+' : ''}${botStatus.totalPnl.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Daily: {botStatus.dailyPnl >= 0 ? '+' : ''}${botStatus.dailyPnl.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={botStatus.vpnStatus === 'healthy' ? 'default' : 'destructive'}>
                VPN: {botStatus.vpnStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2" suppressHydrationWarning>
              Last updated: {new Date(botStatus.lastUpdated).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kill Switch</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="flex items-center space-x-2">
                <Badge variant={botStatus.killSwitchActive ? 'destructive' : 'secondary'} className="text-sm">
                  {botStatus.killSwitchActive ? 'ACTIVE (PAUSED)' : 'INACTIVE (RUNNING)'}
                </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Bot allocation over time</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlHistory} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => value.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Balance']} />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Mini-feed */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest trade execution attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tradeLogs.slice(0, 4).map(log => (
                <div key={log.orderId} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none truncate max-w-[200px]" title={log.marketSlug}>
                      {log.action.toUpperCase()} {log.outcome.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {log.marketSlug}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <Badge variant={log.status === 'filled' ? 'default' : 'destructive'} className="text-[10px] h-4 mb-1">
                      {log.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
