import React from 'react'
import { FileUp, Database, FileSearch, HelpCircle, Share2, Layers } from 'lucide-react'

export default function PipelineTree({ stages }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
      case 'processing': return 'border-amber-500 text-amber-400 bg-amber-500/5 animate-pulse'
      case 'failed': return 'border-red-500 text-red-400 bg-red-500/5'
      default: return 'border-white/10 text-gray-500 bg-white/5'
    }
  }

  const nodes = [
    { id: 'storage', name: 'MinIO Storage', icon: Database, stage: 'storage' },
    { id: 'extraction', name: 'Docling Extraction', icon: FileSearch, stage: 'extraction' },
    { id: 'knowledge', name: 'GLiNER Entities', icon: HelpCircle, stage: 'knowledge' },
    { id: 'graph', name: 'Neo4j Graph Sync', icon: Share2, stage: 'graph' },
    { id: 'search', name: 'Qdrant Embeddings', icon: Layers, stage: 'search' },
    { id: 'intelligence', name: 'Facts Consolidation', icon: HelpCircle, stage: 'intelligence' }
  ]

  return (
    <div className="flex flex-col items-center py-8">
      {/* Root Node */}
      <div className="flex flex-col items-center">
        <div className="w-56 p-4 rounded-xl border border-[#7289da] text-[#7289da] bg-[#7289da]/5 flex items-center gap-3">
          <FileUp className="w-5 h-5" />
          <div className="text-left">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Input Node</h4>
            <p className="text-sm font-bold">Document Uploaded</p>
          </div>
        </div>
        <div className="w-0.5 h-8 bg-white/10"></div>
      </div>

      {/* Children Tree Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 relative max-w-4xl">
        {nodes.map((node) => {
          const Icon = node.icon
          const status = stages[node.stage] || 'pending'
          return (
            <div key={node.id} className="flex flex-col items-center">
              <div className={`w-56 p-4 rounded-xl border ${getStatusColor(status)} flex items-center gap-3 transition-all duration-300`}>
                <Icon className="w-5 h-5" />
                <div className="text-left">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{node.stage} stage</h4>
                  <p className="text-sm font-bold">{node.name}</p>
                  <span className="text-[10px] font-bold uppercase mt-1 block">{status}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
