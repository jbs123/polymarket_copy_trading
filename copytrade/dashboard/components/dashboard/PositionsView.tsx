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
import { openPositions } from "@/lib/mock-data"

export function PositionsView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Positions</CardTitle>
        <CardDescription>Currently held positions copied from traders.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Trader</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead className="text-right">Unrealized PnL</TableHead>
              <TableHead className="text-right">Time Held</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openPositions.map((pos) => (
              <TableRow key={pos.id}>
                <TableCell className="font-medium max-w-[250px] truncate" title={pos.marketSlug}>
                  {pos.marketSlug}
                </TableCell>
                <TableCell>{pos.trader}</TableCell>
                <TableCell>
                  <Badge variant={pos.outcome === 'yes' ? 'default' : 'secondary'} className="uppercase">
                    {pos.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{pos.sizeShares.toFixed(2)}</TableCell>
                <TableCell className="text-right">${pos.avgPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right">${pos.valueUsd.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-medium ${pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{pos.timeHeld}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
