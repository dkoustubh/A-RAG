import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Network, ArrowRight } from 'lucide-react'

export default function KnowledgeGraph() {
  const [data, setData] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)

  const host = "http://127.0.0.1:8082"

  const fetchGraph = async () => {
    try {
      const res = await axios.get(`${host}/graph/data`)
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Knowledge Graph</h1>
        <p className="text-gray-400 mt-1">Traverse and explore relationships stored in the Neo4j graph database</p>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading graph relationships...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Node Summary */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-[#7289da]" />
              Graph Nodes Registry ({data.nodes?.length || 0})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
              {data.nodes?.map((node) => (
                <div key={node.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm font-semibold text-white">{node.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#7289da]/15 text-[#7289da] uppercase tracking-wider">
                    {node.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Path Relationships */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white">Active Synced Connections ({data.links?.length || 0})</h3>
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
              {data.links?.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-emerald-400">{getNodeNameById(data.nodes, link.source)}</span>
                    <span className="flex flex-col items-center px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {link.label}
                      <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-[#7289da]" />
                    </span>
                    <span className="text-purple-400">{getNodeNameById(data.nodes, link.target)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-500 block">Confidence</span>
                    <span className="text-xs font-bold text-emerald-400">{link.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getNodeNameById(nodes, id) {
  const node = nodes.find(n => n.id === id)
  return node ? node.name : `Node-${id}`
}
