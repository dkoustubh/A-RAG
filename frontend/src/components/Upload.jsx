import React, { useState, useEffect } from 'react'
import axios from 'axios'
import PipelineTree from './PipelineTree'
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docId, setDocId] = useState(null)
  const [stages, setStages] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  const host = `http://${window.location.hostname}:8082`

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setDocId(null)
    setStages(null)
    setErrorMsg("")
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setErrorMsg("")
    const formData = new FormData()
    formData.append("file", file)
    
    try {
      const res = await axios.post(`${host}/upload/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": "Bearer dummy-token"
        }
      })
      setDocId(res.data.document_id)
      pollStatus(res.data.document_id)
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || "Upload failed. Verify backend connectivity.")
    } finally {
      setUploading(false)
    }
  }

  const pollStatus = (id) => {
    const check = async () => {
      try {
        const res = await axios.get(`${host}/pipeline/status/${id}`)
        setStages(res.data.stages)
        if (res.data.stages.intelligence === 'completed' || res.data.stages.intelligence === 'failed') {
          clearInterval(interval)
        }
      } catch (e) {
        console.error(e)
      }
    }
    const interval = setInterval(check, 1500)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Ingestion Console</h1>
        <p className="text-gray-400 mt-1">Upload and monitor document processing pipelines in real time</p>
      </div>

      <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center border-dashed border-2 border-white/10 hover:border-white/20 transition-all">
        <UploadCloud className="w-12 h-12 text-[#7289da] mb-4" />
        <label className="cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold transition-all">
          Select File
          <input type="file" className="hidden" onChange={handleFileChange} />
        </label>
        {file && <p className="text-xs text-gray-400 mt-3">Selected: {file.name}</p>}
        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-6 px-6 py-2.5 bg-[#7289da] hover:bg-[#6378bd] text-white text-sm font-bold rounded-lg shadow-lg shadow-[#7289da]/10 transition-all"
          >
            {uploading ? 'Ingesting...' : 'Start Ingestion'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {stages && (
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-lg font-bold text-white mb-6">Real-Time Ingestion Pipeline Tree</h2>
          <PipelineTree stages={stages} />
        </div>
      )}
    </div>
  )
}
