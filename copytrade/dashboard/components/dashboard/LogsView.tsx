"use client"

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
import { tradeLogs, skipLogs } from "@/lib/mock-data"

export function LogsView() {
  return (
    <div className="space-y-8">
      {/* Trade Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Execution Log</CardTitle>
          <CardDescription>History of all attempted orders and their outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Req Size</TableHead>
                <TableHead className="text-right">Fill Size</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeLogs.map((log) => (
                <TableRow key={log.orderId}>
                  <TableCell className="whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                  </TableCell>
                  <TableCell>{log.trader}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.marketSlug}>
                    {log.marketSlug}
                  </TableCell>
                  <TableCell>
                    <span className={`uppercase font-medium text-xs ${log.action === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                      {log.action} {log.outcome}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">${log.sizeUsdRequested.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${log.sizeUsdFilled.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{log.latencyMs}ms</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                        <Badge variant={log.status === 'filled' ? 'default' : 'destructive'} className="text-[10px]">
                        {log.status}
                        </Badge>
                        {log.errorMsg && <span className="text-[10px] text-destructive truncate max-w-[150px]" title={log.errorMsg}>{log.errorMsg}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Skip Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Skip Log</CardTitle>
          <CardDescription>Traders&apos; activities that the bot evaluated but decided not to copy.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Their Trade</TableHead>
                <TableHead>Skip Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skipLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                  </TableCell>
                  <TableCell>{log.trader}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.marketSlug}>
                    {log.marketSlug}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.traderTrade.action.toUpperCase()} {log.traderTrade.outcome.toUpperCase()} ({log.traderTrade.size} shares)
                  </TableCell>
                  <TableCell className="font-medium text-amber-600 text-sm">
                    {log.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
