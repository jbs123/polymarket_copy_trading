"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AddTraderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (trader: any) => void;
}

export function AddTraderDialog({ isOpen, onClose, onAdd }: AddTraderDialogProps) {
  const [wallet, setWallet] = useState("")
  const [nickname, setNickname] = useState("")
  const [usdPerTrade, setUsdPerTrade] = useState("5.00")
  const [maxTotalExposure, setMaxTotalExposure] = useState("50.00")

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet || !nickname) return;
    
    const newTrader = {
      wallet,
      nickname,
      enabled: true,
      capitalMode: "paper",
      followModes: {
        followBuys: true,
        counterBuys: false,
        followSells: true,
        buyOnSells: false,
        counterSells: false
      },
      copySide: "both",
      sizing: { usdPerTrade: parseFloat(usdPerTrade) || 5.00 },
      risk: { maxTotalExposureUsd: parseFloat(maxTotalExposure) || 50.00 },
      performance: {
        pnlContribution: 0.00,
        tradesCopied: 0
      }
    };
    
    onAdd(newTrader);
    setWallet("");
    setNickname("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#030712] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden glass-panel">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Add Target Wallet</h2>
          <p className="text-sm text-slate-400 mt-1">Configure a new trader to follow automatically.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Wallet Address (0x...)</label>
            <input 
              required
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              placeholder="0x1234567890abcdef..."
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Nickname</label>
            <input 
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              placeholder="e.g. WhaleA"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Size per Trade ($)</label>
              <input 
                type="number"
                step="0.1"
                required
                value={usdPerTrade}
                onChange={(e) => setUsdPerTrade(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Max Exposure ($)</label>
              <input 
                type="number"
                step="1"
                required
                value={maxTotalExposure}
                onChange={(e) => setMaxTotalExposure(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white">
              Cancel
            </Button>
            <Button type="submit" className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              Start Following
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
