import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Cpu, Database, Network, HardDrive, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Connect to local ports exposed on Mac (redirected from remote) or direct
      const host = `http://${window.location.hostname}:8082`
      const headers = { Authorization: "Bearer dummy-token" } // If JWT is set, else handle credentials
      
      const [telRes, healthRes] = await Promise.all([
        axios.get(`${host}/monitoring/telemetry`),
        axios.get(`${host}/monitoring/health`)
      ])
      setTelemetry(telRes.data)
      setHealth(healthRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">System telemetry</h1>
          <p className="text-gray-400 mt-1">Real-time resource performance and status metrics</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {telemetry && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU Card */}
          <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-[#7289da]/10 flex items-center justify-center text-[#7289da]">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPU Load</p>
              <h3 className="text-2xl font-bold text-white mt-1">{telemetry.cpu_usage}%</h3>
            </div>
          </div>

          {/* RAM Card */}
          <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-[#43b581]/10 flex items-center justify-center text-[#43b581]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">RAM Usage</p>
              <h3 className="text-2xl font-bold text-white mt-1">{telemetry.ram_usage}%</h3>
            </div>
          </div>

          {/* Disk Card */}
          <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disk Storage</p>
              <h3 className="text-2xl font-bold text-white mt-1">{telemetry.disk_usage}%</h3>
            </div>
          </div>

          {/* GPU Card */}
          <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GPU VRAM</p>
              <h3 className="text-2xl font-bold text-white mt-1">{telemetry.gpu?.vram_usage || 0}%</h3>
            </div>
          </div>
        </div>
      )}

      {/* Connection States */}
      {health && (
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-6">Database Connectivity Handshakes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(health.services).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="capitalize text-sm text-gray-400 font-medium">{key}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  val === 'connected' ? 'bg-[#43b581]/15 text-[#43b581]' : 'bg-red-500/15 text-red-400'
                }`}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
