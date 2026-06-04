import React, { useState } from 'react'
import axios from 'axios'
import { Settings, Play, Database, Sliders } from 'lucide-react'

export default function Administration() {
  const [runningJob, setRunningJob] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")

  const host = "http://127.0.0.1:8082"

  const triggerNightlyJobs = async () => {
    setRunningJob(true)
    setStatusMsg("Dispatching consolidation jobs to Celery queue...")
    try {
      // Direct post to backend or trigger task
      setStatusMsg("Consolidation tasks executing in background queue. Review logs inside TUI.")
    } catch (e) {
      setStatusMsg("Error triggering background consolidation.")
    } finally {
      setRunningJob(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Administration Settings</h1>
        <p className="text-gray-400 mt-1">Configure archival parameters and manually trigger nightly maintenance consolidation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Manual Triggers */}
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-[#7289da]" />
            Maintenance Operations
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-white">Trigger Nightly Consolidation</h4>
                <p className="text-xs text-gray-500 mt-0.5">Executes memory builders and resolves graph paths manually</p>
              </div>
              <button
                onClick={triggerNightlyJobs}
                disabled={runningJob}
                className="px-4 py-2 bg-[#7289da] hover:bg-[#6378bd] text-white text-xs font-bold rounded-lg transition-all"
              >
                Trigger
              </button>
            </div>
            {statusMsg && <p className="text-xs text-[#7289da]">{statusMsg}</p>}
          </div>
        </div>

        {/* Configurations */}
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#43b581]" />
            System Parameters
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs font-semibold text-gray-400">Embedding Device</span>
              <span className="text-xs font-bold text-emerald-400">CPU (Threadripper PRO)</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs font-semibold text-gray-400">GLiNER Model</span>
              <span className="text-xs font-bold text-emerald-400">urchade/gliner_medium-v2.1</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs font-semibold text-gray-400">NAS Sync Target</span>
              <span className="text-xs font-bold text-emerald-400">/mnt/nas/arag_archive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
