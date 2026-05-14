import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewView } from "@/components/dashboard/OverviewView"
import { TradersView } from "@/components/dashboard/TradersView"
import { PositionsView } from "@/components/dashboard/PositionsView"
import { LogsView } from "@/components/dashboard/LogsView"
import { ConfigEditor } from "@/components/dashboard/ConfigEditor"
import { ShieldCheck } from "lucide-react"

export default function Home() {
  return (
    <div className="flex-col md:flex min-h-screen">
      <div className="glass-header">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-2">
            <div className="bg-cyan-500/20 p-2 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
              Money Maker <span className="text-gradient">Copying Machine</span>
            </h2>
          </div>
        </div>
      </div>
      
      <div className="flex-1 space-y-6 p-8 pt-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Command Center</h2>
            <p className="text-slate-400 mt-1">Autonomous copy trading engine via Polymarket.</p>
          </div>
        </div>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass-panel border-none bg-black/40 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 transition-all">Overview</TabsTrigger>
            <TabsTrigger value="traders" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 transition-all">Followed Traders</TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 transition-all">Positions</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 transition-all">Logs</TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 transition-all">Configuration</TabsTrigger>
          </TabsList>
          
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <TabsContent value="overview" className="space-y-4 m-0">
              <OverviewView />
            </TabsContent>
            <TabsContent value="traders" className="space-y-4 m-0">
              <TradersView />
            </TabsContent>
            <TabsContent value="positions" className="space-y-4 m-0">
              <PositionsView />
            </TabsContent>
            <TabsContent value="logs" className="space-y-4 m-0">
              <LogsView />
            </TabsContent>
            <TabsContent value="config" className="space-y-4 m-0">
              <ConfigEditor />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
