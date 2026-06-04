import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Cpu,
  Database,
  Network,
  HardDrive,
  RefreshCw,
  User as UserIcon,
  Sparkles,
  Coins,
  FileText
} from 'lucide-react'

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState(null)
  const [health, setHealth] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const host = `http://${window.location.hostname}:8082`

  const fetchData = async () => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      
      const [telRes, healthRes, meRes] = await Promise.all([
        axios.get(`${host}/monitoring/telemetry`, { headers }),
        axios.get(`${host}/monitoring/health`, { headers }),
        axios.get(`${host}/auth/me`, { headers })
      ])
      
      setTelemetry(telRes.data)
      setHealth(healthRes.data)
      setProfile(meRes.data)
    } catch (e) {
      console.error('Error fetching dashboard telemetry', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const tokenProgressPct = profile ? Math.min(100, (profile.tokens_used_today / profile.daily_token_quota) * 100) : 0

  return (
    <div className="space-y-8 select-none font-sans">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-tr from-[#7289da]/10 to-transparent p-6 rounded-3xl border border-[#7289da]/10 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">👋</span>
            <h1 className="text-2xl font-black text-white">Welcome back, {profile?.username || 'Cognitive User'}</h1>
          </div>
          <p className="text-gray-400 text-xs font-semibold">Your isolated workspace is secure. All operations are bounded by RBAC permissions.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-wider self-start md:self-auto relative z-10"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
        <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-[#7289da]/5 rounded-full blur-3xl pointer-events-none z-0"></div>
      </div>

      {/* Profile & Governance Row */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Token Governance Tracker Card */}
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#7289da] animate-pulse" />
                Cognitive Daily Token Allocation
              </span>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Quota Limits</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">Total Consumption</span>
                <span className="text-white">{Math.round(tokenProgressPct)}% ({profile.tokens_used_today.toLocaleString()} tokens)</span>
              </div>
              <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tokenProgressPct >= 90 ? 'bg-red-500' : tokenProgressPct >= 70 ? 'bg-orange-500' : 'bg-[#43b581]'
                  }`}
                  style={{ width: `${tokenProgressPct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono font-semibold pt-1">
                <span>Reset cycle: Daily (at midnight)</span>
                <span>Limit: {profile.daily_token_quota.toLocaleString()} Tokens</span>
              </div>
            </div>
          </div>

          {/* User Profile Overview */}
          <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#7289da]/10 border border-[#7289da]/20 flex items-center justify-center text-[#7289da]">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white truncate">{profile.email}</h4>
                <p className="text-[10px] text-[#7289da] font-bold uppercase tracking-wider mt-0.5">{profile.role} Access</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider pt-4 border-t border-white/5 mt-4">
              <span>Security Team:</span>
              <span className="text-emerald-400 font-bold">{profile.team_id ? `Team ID: ${profile.team_id}` : 'Personal Workspace'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Metrics */}
      {telemetry && (
        <div className="space-y-6">
          <h2 className="text-base font-bold text-white">System Resource Telemetry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CPU Card */}
            <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-[#7289da]/10 flex items-center justify-center text-[#7289da]">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">CPU Load</p>
                <h3 className="text-2xl font-bold text-white mt-1">{telemetry.cpu_usage}%</h3>
              </div>
            </div>

            {/* RAM Card */}
            <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-[#43b581]/10 flex items-center justify-center text-[#43b581]">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">RAM Usage</p>
                <h3 className="text-2xl font-bold text-white mt-1">{telemetry.ram_usage}%</h3>
              </div>
            </div>

            {/* Disk Card */}
            <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disk Storage</p>
                <h3 className="text-2xl font-bold text-white mt-1">{telemetry.disk_usage}%</h3>
              </div>
            </div>

            {/* GPU Card */}
            <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">GPU VRAM</p>
                <h3 className="text-2xl font-bold text-white mt-1">{telemetry.gpu?.vram_usage || 0}%</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Handshakes */}
      {health && (
        <div className="glass-card rounded-2xl p-8 border border-white/5">
          <h2 className="text-sm font-bold text-white mb-6">Secure Database Connectivity Handshakes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(health.services).map(([key, val]) => {
              const sizeInBytes = health.sizes ? health.sizes[key] : null
              return (
                <div key={key} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="capitalize text-xs text-gray-400 font-bold">{key}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      val === 'connected' ? 'bg-[#43b581]/15 text-[#43b581]' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {val}
                    </span>
                  </div>
                  {sizeInBytes !== null && (
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[10px] text-gray-500">
                      <span>Disk Allocation</span>
                      <span className="text-white font-mono font-bold">{formatBytesToGB(sizeInBytes)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function formatBytesToGB(bytes) {
  if (!bytes) return '0.00 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb < 0.01) {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }
  return `${gb.toFixed(3)} GB`
}
