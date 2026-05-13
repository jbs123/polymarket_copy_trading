import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewView } from "@/components/dashboard/OverviewView"
import { TradersView } from "@/components/dashboard/TradersView"
import { PositionsView } from "@/components/dashboard/PositionsView"
import { LogsView } from "@/components/dashboard/LogsView"
import { ConfigEditor } from "@/components/dashboard/ConfigEditor"

export default function Home() {
  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h2 className="text-lg font-semibold tracking-tight">Copy Trade Bot</h2>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="traders">Followed Traders</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <OverviewView />
          </TabsContent>
          <TabsContent value="traders" className="space-y-4">
            <TradersView />
          </TabsContent>
          <TabsContent value="positions" className="space-y-4">
            <PositionsView />
          </TabsContent>
          <TabsContent value="logs" className="space-y-4">
            <LogsView />
          </TabsContent>
           <TabsContent value="config" className="space-y-4">
            <ConfigEditor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
