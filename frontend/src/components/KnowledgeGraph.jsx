import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Network,
  Play,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Search,
  BookOpen,
  LayoutGrid,
  FileText,
  Terminal,
  Star,
  Download,
  Info,
  List,
  ChevronRight,
  Code
} from 'lucide-react'

export default function KnowledgeGraph() {
  const [cypherQuery, setCypherQuery] = useState('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100')
  const [activeTab, setActiveTab] = useState('graph') // 'graph' | 'table' | 'text' | 'code'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [showZoomTip, setShowZoomTip] = useState(true)

  // Zoom scale
  const [zoomScale, setZoomScale] = useState(1)
  const [draggedNode, setDraggedNode] = useState(null)

  const host = `http://${window.location.hostname}:8082`
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
  const svgRef = useRef(null)

  const fetchGraph = async (queryToRun) => {
    setLoading(true)
    setErrorMsg('')
    setSelectedNode(null)
    try {
      const res = await axios.post(`${host}/graph/query`, { query: queryToRun }, { headers })
      const rawNodes = res.data.nodes || []
      const rawLinks = res.data.links || []

      // Arrange nodes in circle layout with center anchor
      const width = 800
      const height = 500
      const arrangedNodes = layoutNodes(rawNodes, rawLinks, width, height)

      setGraphData({ nodes: arrangedNodes, links: rawLinks })
    } catch (e) {
      console.error(e)
      setErrorMsg(e.response?.data?.detail || 'Error executing Cypher query. Verify Neo4j connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph(cypherQuery)
  }, [])

  const handleRunQuery = (e) => {
    e.preventDefault()
    if (!cypherQuery.trim() || loading) return
    fetchGraph(cypherQuery.trim())
  }

  // Geometric hub & spoke layout calculation
  const layoutNodes = (nodes, links, width, height) => {
    if (nodes.length === 0) return []

    const centerX = width / 2
    const centerY = height / 2

    // Calculate node connections (degrees) to find the hub/center anchor
    const degrees = {}
    nodes.forEach(n => { degrees[n.id] = 0 })
    links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      if (degrees[src] !== undefined) degrees[src]++
      if (degrees[tgt] !== undefined) degrees[tgt]++
    })

    // Find the node with the highest degree, prioritizing Documents
    let centerNodeId = nodes[0].id
    let maxVal = -1
    nodes.forEach(n => {
      let val = degrees[n.id] || 0
      if (n.label === 'Document') val += 100 // strong priority for Document nodes in center
      if (val > maxVal) {
        maxVal = val
        centerNodeId = n.id
      }
    })

    // Layout other nodes around center
    const outerNodes = nodes.filter(n => n.id !== centerNodeId)
    const arranged = nodes.map(node => {
      if (node.id === centerNodeId) {
        return { ...node, x: centerX, y: centerY }
      }
      
      const outerIndex = outerNodes.findIndex(o => o.id === node.id)
      const angle = (outerIndex / outerNodes.length) * 2 * Math.PI
      const radius = 170 + (outerIndex % 2 === 0 ? 0 : 35) // alternating radii to prevent node overlap
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      }
    })

    return arranged
  }

  // Drag handlers
  const handleMouseDown = (node, e) => {
    e.stopPropagation()
    setDraggedNode(node.id)
    setSelectedNode(node)
  }

  const handleMouseMove = (e) => {
    if (!draggedNode) return
    const rect = svgRef.current.getBoundingClientRect()
    // Account for zoom scale when translating mouse coordinate delta
    const x = (e.clientX - rect.left) / zoomScale
    const y = (e.clientY - rect.top) / zoomScale
    
    setGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === draggedNode ? { ...n, x, y } : n)
    }))
  }

  const handleMouseUp = () => {
    setDraggedNode(null)
  }

  const handleZoom = (direction) => {
    if (direction === 'in') {
      setZoomScale(prev => Math.min(prev + 0.15, 2.5))
    } else if (direction === 'out') {
      setZoomScale(prev => Math.max(prev - 0.15, 0.45))
    } else {
      setZoomScale(1)
    }
  }

  // Calculate Node Label and Link Type statistics for the right panel
  const getNodeLabelStats = () => {
    const stats = {}
    graphData.nodes.forEach(n => {
      stats[n.label] = (stats[n.label] || 0) + 1
    })
    return stats
  }

  const getLinkLabelStats = () => {
    const stats = {}
    graphData.links.forEach(l => {
      stats[l.label] = (stats[l.label] || 0) + 1
    })
    return stats
  }

  const nodeStats = getNodeLabelStats()
  const linkStats = getLinkLabelStats()

  // Node Color Mapping
  const getNodeColor = (label) => {
    switch (label) {
      case 'Document': return '#f08030' // Orange
      case 'Entity': return '#a040b0' // Purple
      case 'Customer': return '#3a86f0' // Blue
      case 'Vendor': return '#10b981' // Green
      case 'Part': return '#e11d48' // Red
      default: return '#7289da'
    }
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Neo4j Knowledge Graph Sandbox</h1>
        <p className="text-gray-400 mt-1">Execute query sandboxes, view triplets, and traverse synced graph entities</p>
      </div>

      {/* Top Query Editor Console */}
      <form onSubmit={handleRunQuery} className="flex bg-[#141420] border border-white/10 rounded-xl overflow-hidden p-2 items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 pl-3 font-mono text-emerald-400 font-bold shrink-0 text-sm">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>neo4j$</span>
        </div>
        <input
          type="text"
          value={cypherQuery}
          onChange={(e) => setCypherQuery(e.target.value)}
          className="flex-1 bg-transparent border-0 text-sm font-mono focus:ring-0 focus:outline-none text-gray-200 outline-none"
          placeholder="MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="p-2 bg-[#7289da] hover:bg-[#6378bd] text-white rounded-lg transition-all flex items-center justify-center"
            title="Execute Cypher Query"
          >
            <Play className="w-4 h-4 fill-white" />
          </button>
          <button type="button" className="p-2 text-gray-400 hover:text-white rounded-lg transition-all hover:bg-white/5">
            <Star className="w-4 h-4" />
          </button>
          <button type="button" className="p-2 text-gray-400 hover:text-white rounded-lg transition-all hover:bg-white/5">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex bg-[#141420]/30 border border-white/5 rounded-2xl overflow-hidden min-h-0 relative glass-card">
        
        {/* Left Visual Tab Toolbar */}
        <div className="w-16 bg-[#141420] border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('graph')}
            className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
              activeTab === 'graph' ? 'bg-[#7289da]/15 text-[#7289da] border border-[#7289da]/20' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <Network className="w-5 h-5 mb-0.5" />
            Graph
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
              activeTab === 'table' ? 'bg-[#7289da]/15 text-[#7289da] border border-[#7289da]/20' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <List className="w-5 h-5 mb-0.5" />
            Table
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
              activeTab === 'text' ? 'bg-[#7289da]/15 text-[#7289da] border border-[#7289da]/20' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <FileText className="w-5 h-5 mb-0.5" />
            Text
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
              activeTab === 'code' ? 'bg-[#7289da]/15 text-[#7289da] border border-[#7289da]/20' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <Code className="w-5 h-5 mb-0.5" />
            Code
          </button>
        </div>

        {/* Central Display Area */}
        <div className="flex-1 min-w-0 flex flex-col relative bg-[#0a0a0f]/50 select-none">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#7289da]" />
              <span className="text-sm font-semibold tracking-wider uppercase text-gray-500">Querying Graph DB...</span>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No matching graph entities returned. Try running another Cypher query.
            </div>
          ) : (
            <>
              {/* SVG Visual Graph Tab */}
              {activeTab === 'graph' && (
                <div className="flex-1 w-full h-full relative overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                  <svg
                    ref={svgRef}
                    className="w-full h-full cursor-grab active:cursor-grabbing"
                    viewBox="0 0 800 500"
                    style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center', transition: draggedNode ? 'none' : 'transform 0.15s ease' }}
                  >
                    {/* SVG arrow markers definition */}
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563" />
                      </marker>
                    </defs>

                    {/* Triplet Links */}
                    {graphData.links.map((link, idx) => {
                      const sourceNode = graphData.nodes.find(n => n.id === link.source)
                      const targetNode = graphData.nodes.find(n => n.id === link.target)

                      if (!sourceNode || !targetNode) return null

                      const midX = (sourceNode.x + targetNode.x) / 2
                      const midY = (sourceNode.y + targetNode.y) / 2
                      const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x) * (180 / Math.PI)

                      return (
                        <g key={idx}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke="#374151"
                            strokeWidth="2"
                            markerEnd="url(#arrow)"
                          />
                          {/* Relationship labels */}
                          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
                            <rect x="-35" y="-8" width="70" height="14" rx="3" fill="#141420" stroke="#1f2937" strokeWidth="1" />
                            <text
                              textAnchor="middle"
                              dy="2.5"
                              fill="#9ca3af"
                              fontSize="8"
                              fontWeight="bold"
                              className="pointer-events-none uppercase font-mono tracking-wider"
                            >
                              {link.label.length > 10 ? link.label.substring(0, 8) + '..' : link.label}
                            </text>
                          </g>
                        </g>
                      )
                    })}

                    {/* Graph Nodes */}
                    {graphData.nodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id
                      const nodeColor = getNodeColor(node.label)

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseDown={(e) => handleMouseDown(node, e)}
                          className="cursor-pointer group"
                        >
                          <circle
                            r="22"
                            fill={nodeColor}
                            stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.08)'}
                            strokeWidth={isSelected ? '2.5' : '1'}
                            className="transition-all duration-200 group-hover:scale-110"
                          />
                          <text
                            textAnchor="middle"
                            dy="4"
                            fill="#ffffff"
                            fontSize="8"
                            fontWeight="bold"
                            className="select-none pointer-events-none"
                          >
                            {node.name.length > 8 ? node.name.substring(0, 6) + '..' : node.name}
                          </text>
                        </g>
                      )
                    })}
                  </svg>

                  {/* Zoom Dialog Overlay Helper */}
                  {showZoomTip && (
                    <div className="absolute bottom-6 left-6 p-4 bg-[#141420] border border-white/10 rounded-xl max-w-xs flex flex-col gap-2 shadow-2xl animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-[#7289da] shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-300">
                          Use the right sidebar buttons to zoom and fit. Drag nodes to customize spatial layout.
                        </span>
                      </div>
                      <button
                        onClick={() => setShowZoomTip(false)}
                        className="text-[10px] text-gray-500 hover:text-white font-bold self-end uppercase"
                      >
                        Don't show again
                      </button>
                    </div>
                  )}

                  {/* Bottom Right Zoom Control Sidebar Panel */}
                  <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                    <button
                      onClick={() => handleZoom('in')}
                      className="p-2.5 bg-[#141420] border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg shadow-lg hover:text-white transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleZoom('out')}
                      className="p-2.5 bg-[#141420] border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg shadow-lg hover:text-white transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleZoom('reset')}
                      className="p-2.5 bg-[#141420] border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg shadow-lg hover:text-white transition-all"
                      title="Fit Canvas"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Table Tab Display */}
              {activeTab === 'table' && (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                  {/* Nodes Table */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Matching Nodes</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-[#141420]">
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Node ID</th>
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Label</th>
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Properties Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {graphData.nodes.map(node => (
                            <tr key={node.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2.5 px-4 font-mono text-gray-500">{node.id}</td>
                              <td className="py-2.5 px-4">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                  node.label === 'Document' ? 'bg-[#f08030]/15 text-[#f08030]' : 'bg-[#a040b0]/15 text-[#a040b0]'
                                }`}>
                                  {node.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-medium text-white">{node.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Links Table */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Matching Connections</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-[#141420]">
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Source ID</th>
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Target ID</th>
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Relationship Type</th>
                            <th className="py-2.5 px-4 font-semibold text-gray-400">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {graphData.links.map((link, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2.5 px-4 font-mono text-gray-500">{link.source}</td>
                              <td className="py-2.5 px-4 font-mono text-gray-500">{link.target}</td>
                              <td className="py-2.5 px-4 text-white uppercase font-semibold">{link.label}</td>
                              <td className="py-2.5 px-4 text-emerald-400 font-bold">{link.confidence}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Text Tab (Raw JSON output) */}
              {activeTab === 'text' && (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-xs text-gray-300">
                  <pre className="p-4 bg-white/5 border border-white/5 rounded-xl whitespace-pre-wrap leading-relaxed select-text">
                    {JSON.stringify(graphData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Code Tab (Schema & tips) */}
              {activeTab === 'code' && (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                  <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                      <Code className="w-4 h-4 text-[#7289da]" />
                      Cypher Query Cheat Sheet
                    </h3>
                    <ul className="space-y-3 text-xs leading-relaxed text-gray-400">
                      <li>
                        <strong className="text-white block mb-0.5">1. Fetch Entire Triplet Graph</strong>
                        <code className="text-emerald-400 bg-white/5 px-2 py-0.5 rounded font-mono">MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100</code>
                      </li>
                      <li>
                        <strong className="text-white block mb-0.5">2. Find Supplier Entities Only</strong>
                        <code className="text-emerald-400 bg-white/5 px-2 py-0.5 rounded font-mono">MATCH (n:Entity) WHERE n.name CONTAINS "supplier" RETURN n LIMIT 10</code>
                      </li>
                      <li>
                        <strong className="text-white block mb-0.5">3. Inspect Document Connections</strong>
                        <code className="text-emerald-400 bg-white/5 px-2 py-0.5 rounded font-mono">MATCH (d:Document)-[r]-(e) RETURN d, r, e LIMIT 20</code>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Info Overview Sidebar Panel */}
        <div className="w-80 bg-[#141420] border-l border-white/5 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#141420]/50 shrink-0">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Overview</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar min-h-0">
            
            {/* Selected Node Properties */}
            {selectedNode ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3 animate-fadeIn">
                <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Inspector</span>
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedNode.name}</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                    selectedNode.label === 'Document' ? 'bg-[#f08030]/15 text-[#f08030]' : 'bg-[#a040b0]/15 text-[#a040b0]'
                  }`}>
                    {selectedNode.label}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/5 text-[11px] space-y-1.5">
                  <div>
                    <span className="text-gray-500 block">Element Node ID</span>
                    <span className="text-gray-300 font-mono break-all">{selectedNode.id}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/5 border-dashed rounded-xl text-center text-xs text-gray-500">
                Click a node circle in the visualizer canvas to inspect properties
              </div>
            )}

            {/* Node Labels pill groups */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Node Labels</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center p-2 bg-white/5 border border-white/5 rounded-lg text-xs">
                  <span className="font-semibold text-gray-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#505868]"></span>
                    *
                  </span>
                  <span className="font-bold text-gray-500 font-mono">({graphData.nodes.length})</span>
                </div>
                {Object.entries(nodeStats).map(([label, count]) => (
                  <div key={label} className="flex justify-between items-center p-2 bg-white/5 border border-white/5 rounded-lg text-xs">
                    <span className="font-semibold text-gray-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getNodeColor(label) }}></span>
                      {label}
                    </span>
                    <span className="font-bold text-white font-mono">({count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationship type badges */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Relationship Types</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center p-2 bg-white/5 border border-white/5 rounded-lg text-xs">
                  <span className="font-semibold text-gray-400 flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-1 bg-[#505868]"></span>
                    *
                  </span>
                  <span className="font-bold text-gray-500 font-mono">({graphData.links.length})</span>
                </div>
                {Object.entries(linkStats).map(([label, count]) => (
                  <div key={label} className="flex justify-between items-center p-2 bg-white/5 border border-white/5 rounded-lg text-xs">
                    <span className="font-semibold text-gray-400 uppercase font-mono flex items-center gap-1.5 text-[10px]">
                      <span className="inline-block w-2.5 h-0.5 bg-gray-500"></span>
                      {label}
                    </span>
                    <span className="font-bold text-white font-mono">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#141420]/50 border-t border-white/5 text-[11px] text-gray-500 font-medium shrink-0">
            Displaying {graphData.nodes.length} nodes, {graphData.links.length} relationships.
          </div>
        </div>
      </div>
    </div>
  )
}
