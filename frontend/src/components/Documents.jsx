import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FolderClosed, Table, HelpCircle, Calendar, Trash2 } from 'lucide-react'

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(false)

  const host = "http://127.0.0.1:8082"

  const fetchDocs = async () => {
    try {
      const res = await axios.get(`${host}/documents/`)
      setDocs(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchDetails = async (id) => {
    setLoading(true)
    try {
      const res = await axios.get(`${host}/documents/${id}`)
      setSelectedDoc(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const deleteDoc = async (id) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return
    try {
      await axios.delete(`${host}/documents/${id}`)
      setSelectedDoc(null)
      fetchDocs()
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  return (
    <div className="space-y-8 flex flex-col md:flex-row gap-8">
      {/* Document Sidebar List */}
      <div className="w-full md:w-80 space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">Ingested Library</h2>
        <div className="space-y-2">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => fetchDetails(doc.id)}
              className="w-full text-left p-4 bg-[#141420] border border-white/5 rounded-xl hover:border-[#7289da]/30 hover:bg-[#7289da]/5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <FolderClosed className="w-5 h-5 text-[#7289da]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-white">{doc.location.split('/').pop()}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 capitalize">{doc.file_type} | {doc.industry}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Details View */}
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-400">Loading details...</div>
        ) : selectedDoc ? (
          <div className="glass-card rounded-2xl p-8 space-y-8">
            <div className="flex justify-between items-start border-b border-white/5 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedDoc.location.split('/').pop()}</h2>
                <p className="text-sm text-gray-400 mt-1 capitalize">Domain class: {selectedDoc.industry}</p>
              </div>
              <button
                onClick={() => deleteDoc(selectedDoc.id)}
                className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Extracted Tables */}
            {selectedDoc.tables?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Table className="w-5 h-5 text-emerald-400" />
                  Extracted Tables
                </h3>
                {selectedDoc.tables.map((table, index) => (
                  <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-white mb-2">{table.title}</h4>
                    <p className="text-xs text-gray-400 mb-3">{table.caption}</p>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          {table.headers?.map((h, i) => (
                            <th key={i} className="py-2 px-3 font-semibold text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5 last:border-0">
                          {table.headers?.map((h, i) => (
                            <td key={i} className="py-2.5 px-3 text-gray-300">...</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted Facts */}
            {selectedDoc.facts?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#7289da]" />
                  Fact Store Triplets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDoc.facts.map((fact, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                      <div className="text-xs">
                        <span className="text-emerald-400 font-bold">{fact.subject}</span>
                        <span className="text-gray-400 mx-2 uppercase font-medium">{fact.predicate}</span>
                        <span className="text-purple-400 font-bold">{fact.object}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                        {intPercent(fact.confidence)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Events */}
            {selectedDoc.timeline_events?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Timeline Milestones
                </h3>
                <div className="relative border-l border-white/10 pl-6 space-y-6">
                  {selectedDoc.timeline_events.map((event, index) => (
                    <div key={index} className="relative">
                      <div className="absolute -left-[31px] w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                      <p className="text-xs font-bold text-orange-400">{event.date?.split('T')[0]}</p>
                      <p className="text-sm text-gray-300 mt-1">{event.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center items-center h-64 text-gray-500 border border-dashed border-white/5 rounded-2xl">
            Select a document to inspect details
          </div>
        )}
      </div>
    </div>
  )
}

function intPercent(val) {
  return int(val * 100)
}

function int(val) {
  return Math.floor(val)
}
