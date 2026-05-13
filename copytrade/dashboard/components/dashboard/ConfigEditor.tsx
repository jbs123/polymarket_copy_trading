"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { botStatus } from "@/lib/mock-data"
import { AlertCircle } from "lucide-react"

export function ConfigEditor() {
  return (
    <div className="space-y-6 max-w-4xl">

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-amber-800">Configuration Editor (Read-Only Preview)</h4>
          <p className="text-xs text-amber-700 mt-1">
            This UI is currently displaying a read-only preview of `/etc/copytrade/config.yaml`.
            In the full implementation, changes here will write back to the Jetson via API.
          </p>
        </div>
      </div>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Bot-wide configuration and capital mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border rounded-md p-4 bg-muted/20">
              <label className="text-sm font-medium leading-none">Capital Mode</label>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant={botStatus.capitalMode === 'paper' ? 'secondary' : 'default'} className="uppercase">
                  {botStatus.capitalMode}
                </Badge>
                <Button variant="outline" size="sm" className="h-7 text-xs ml-auto">
                  Promote to Live
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Requires confirmation dialog.</p>
            </div>

            <div className="space-y-2 border rounded-md p-4 bg-muted/20">
               <label className="text-sm font-medium leading-none">Global Sizing Default</label>
               <div className="flex items-center mt-2">
                 <span className="text-sm mr-2">$</span>
                 <input type="number" disabled value="1.00" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors opacity-50 cursor-not-allowed" />
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Limits (Read Only per spec) */}
      <Card>
        <CardHeader>
          <CardTitle>Hard Risk Limits</CardTitle>
          <CardDescription>These are enforced at the engine level. Modifying requires SSH access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Bot Exposure Cap</span>
              <span className="font-medium">$100.00</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Per-Trader Exposure Cap</span>
              <span className="font-medium">$50.00</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Per-Market Exposure Cap</span>
              <span className="font-medium">$5.00</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Single-Trade Max Size</span>
              <span className="font-medium">$5.00</span>
            </div>
             <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Daily Loss Limit</span>
              <span className="font-medium">$20.00</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Default Filters</CardTitle>
          <CardDescription>Global latency and drift constraints.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Max Latency (sec)</label>
                <input type="number" disabled value="5" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm opacity-50 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Max Price Drift (%)</label>
                <input type="number" disabled value="3" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm opacity-50 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Slippage Tolerance (%)</label>
                <input type="number" disabled value="2.0" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm opacity-50 cursor-not-allowed" />
              </div>
           </div>
        </CardContent>
        <CardFooter>
          <Button disabled>Save Settings</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
