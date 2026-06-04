import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  Network,
  Layers,
  FileText,
  AlertCircle,
  Plus,
  Paperclip,
  X,
  Globe,
  CheckCircle2,
  Loader2
} from 'lucide-react'

export default function GroundedChat() {
  const [sessions, setSessions] = useState([
    {
      id: 'session-default',
      name: 'New Grounded Chat',
      messages: []
    }
  ])
  const [activeSessionId, setActiveSessionId] = useState('session-default')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [expandedIndex, setExpandedIndex] = useState(null)

  // Attachment states
  const [attachedFile, setAttachedFile] = useState(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [attachedDocId, setAttachedDocId] = useState(null)
  const [queryScope, setQueryScope] = useState('document') // 'document' | 'global'

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const host = `http://${window.location.hostname}:8082`
  const headers = { Authorization: "Bearer dummy-token" }

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession.messages, loading])

  const createNewSession = () => {
    const newId = `session-${Date.now()}`
    setSessions(prev => [
      {
        id: newId,
        name: 'New Grounded Chat',
        messages: []
      },
      ...prev
    ])
    setActiveSessionId(newId)
    setExpandedIndex(null)
    detachFile()
  }

  const handleSuggestionClick = (queryText) => {
    sendQuery(queryText)
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputValue.trim() || loading || attachmentUploading) return
    sendQuery(inputValue.trim())
    setInputValue('')
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const selected = e.target.files[0]
    if (!selected) return

    setAttachedFile(selected)
    setAttachmentUploading(true)
    setAttachedDocId(null)
    setQueryScope('document')

    const formData = new FormData()
    formData.append("file", selected)

    try {
      const res = await axios.post(`${host}/upload/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": "Bearer dummy-token"
        }
      })
      setAttachedDocId(res.data.document_id)
    } catch (err) {
      console.error(err)
      alert("Attachment upload/indexing failed. Ensure backend and workers are running.")
      detachFile()
    } finally {
      setAttachmentUploading(false)
    }
  }

  const detachFile = () => {
    setAttachedFile(null)
    setAttachedDocId(null)
    setAttachmentUploading(false)
    setQueryScope('global')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendQuery = async (queryText) => {
    setLoading(true)
    
    // Add user message immediately
    const userMessage = { 
      sender: 'user', 
      text: queryText,
      scope: attachedFile && queryScope === 'document' ? attachedFile.name : null
    }
    
    // Update current session's messages
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedMsgs = [...s.messages, userMessage]
        // Rename session if it's the first message
        const updatedName = s.name === 'New Grounded Chat' 
          ? (queryText.length > 25 ? queryText.substring(0, 25) + '...' : queryText)
          : s.name
        return { ...s, name: updatedName, messages: updatedMsgs }
      }
      return s
    }))

    try {
      const payload = {
        query: queryText,
        document_id: (attachedFile && queryScope === 'document') ? attachedDocId : null
      }

      const res = await axios.post(`${host}/search/query`, payload, { headers })
      
      const botMessage = {
        sender: 'bot',
        text: res.data.answer,
        scope: attachedFile && queryScope === 'document' ? attachedFile.name : null,
        meta: {
          confidence: res.data.confidence,
          sources: res.data.sources || [],
          graphNodesUsed: res.data.graph_nodes_used || [],
          factCount: res.data.fact_count || 0,
          graphCount: res.data.graph_count || 0
        }
      }

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, botMessage] }
        }
        return s
      }))
    } catch (e) {
      console.error(e)
      const errorMessage = {
        sender: 'bot',
        text: 'Error contacting retrieval query engine. Make sure the backend is active.',
        isError: true
      }
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] }
        }
        return s
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const toggleAccordion = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx)
  }

  const suggestions = [
    { text: "What is the vendor name?", desc: "Lookup vendor relations" },
    { text: "How many RFQs exist in database?", desc: "Query relational Postgres" },
    { text: "List recent documents", desc: "Scan files registry" },
    { text: "Are there any BOM items?", desc: "Check part list evidence" }
  ]

  // Detect routing engines utilized based on backend response contents
  const getEnginesUsed = (meta) => {
    const engines = []
    if (!meta) return engines

    const sourcesStr = JSON.stringify(meta.sources).toLowerCase()
    
    if (sourcesStr.includes('postgres') || meta.factCount > 0) {
      engines.push({ name: 'PostgreSQL Fact Store', color: 'text-sky-400 bg-sky-500/10 border border-sky-500/20' })
    }
    if (sourcesStr.includes('neo4j') || meta.graphCount > 0 || meta.graphNodesUsed.length > 0) {
      engines.push({ name: 'Neo4j Graph Database', color: 'text-purple-400 bg-purple-500/10 border border-purple-500/20' })
    }
    if (sourcesStr.includes('qdrant')) {
      engines.push({ name: 'Qdrant Vector DB', color: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' })
    }
    if (sourcesStr.includes('query') && engines.length === 0) {
      engines.push({ name: 'SQL Query Engine', color: 'text-orange-400 bg-orange-500/10 border border-orange-500/20' })
    }
    
    // Fallback if empty but has sources
    if (engines.length === 0 && meta.sources.length > 0) {
      engines.push({ name: 'RAG Retriever', color: 'text-gray-400 bg-gray-500/10 border border-gray-500/20' })
    }
    return engines
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-8">
      {/* Sessions History Sidebar */}
      <div className="w-80 flex flex-col bg-[#141420] border border-white/5 rounded-2xl overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#7289da]" />
            Chat History
          </span>
          <button
            onClick={createNewSession}
            className="p-1.5 bg-[#7289da]/10 hover:bg-[#7289da]/20 text-[#7289da] rounded-lg transition-all border border-[#7289da]/20 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => {
                setActiveSessionId(session.id)
                setExpandedIndex(null)
              }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border text-sm flex items-center gap-3 ${
                session.id === activeSessionId
                  ? 'bg-[#7289da]/10 border-[#7289da]/30 text-white font-medium'
                  : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare className={`w-4 h-4 shrink-0 ${session.id === activeSessionId ? 'text-[#7289da]' : 'text-gray-500'}`} />
              <span className="truncate flex-1">{session.name}</span>
              {session.messages.length > 0 && (
                <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                  {session.messages.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-[#0f0f16]/30 border border-white/5 rounded-2xl overflow-hidden relative glass-card">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#141420]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7289da]/10 border border-[#7289da]/20 flex items-center justify-center text-[#7289da]">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Grounded Chat Console</h2>
              <p className="text-xs text-gray-400">Ask questions grounded on facts, database schemas & knowledge graphs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#43b581] animate-pulse"></span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">vLLM Active</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center max-w-xl mx-auto text-center space-y-8">
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7289da] to-[#8a9dec] flex items-center justify-center mx-auto shadow-lg shadow-[#7289da]/25">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
                <h3 className="text-2xl font-extrabold text-white tracking-tight mt-4">Ask Grounded Intelligence</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A-RAG queries structured Postgres tables, Neo4j entities, isolated facts, and vector semantic spaces before passing context to Gemma for final response generation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(s.text)}
                    className="p-4 bg-[#141420] border border-white/5 rounded-2xl hover:border-[#7289da]/40 hover:bg-[#7289da]/5 text-left transition-all group duration-200"
                  >
                    <p className="text-sm font-semibold text-white group-hover:text-[#7289da] transition-all">{s.text}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeSession.messages.map((msg, idx) => {
                const isUser = msg.sender === 'user'
                const enginesUsed = getEnginesUsed(msg.meta)

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Bot Icon */}
                    {!isUser && (
                      <div className="w-9 h-9 rounded-lg bg-[#43b581]/15 border border-[#43b581]/20 flex items-center justify-center text-[#43b581] shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                    )}

                    {/* Chat Bubble Container */}
                    <div className={`max-w-[80%] rounded-2xl p-5 border shadow-sm ${
                      isUser
                        ? 'bg-[#7289da]/10 border-[#7289da]/25 text-white rounded-tr-none'
                        : msg.isError
                          ? 'bg-red-500/10 border-red-500/20 text-red-300 rounded-tl-none'
                          : 'bg-[#141420]/60 border-white/5 text-gray-100 rounded-tl-none'
                    }`}>
                      {/* Scoped Document Indicator */}
                      {msg.scope && (
                        <div className="flex items-center gap-1 text-[10px] text-[#7289da] font-semibold mb-2 bg-[#7289da]/10 px-2 py-0.5 rounded-md w-fit border border-[#7289da]/20">
                          <FileText className="w-3 h-3" />
                          <span>Scoped: {msg.scope}</span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap select-text font-sans">
                        {msg.text}
                      </div>

                      {/* Bot Message Metadata and Explainability Panel */}
                      {!isUser && !msg.isError && msg.meta && (
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                          {/* Engine tags and actions row */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-1.5">
                              {enginesUsed.map((eng, eIdx) => (
                                <span key={eIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eng.color}`}>
                                  {eng.name}
                                </span>
                              ))}
                              {msg.meta.confidence && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  parseInt(msg.meta.confidence) >= 80 
                                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                    : 'text-orange-400 bg-orange-500/10 border border-orange-500/20'
                                }`}>
                                  Confidence: {msg.meta.confidence}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(msg.text, idx)}
                                className="p-1 text-gray-500 hover:text-white rounded transition-all hover:bg-white/5"
                                title="Copy answer"
                              >
                                {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => toggleAccordion(idx)}
                                className="p-1 text-gray-500 hover:text-white rounded transition-all hover:bg-white/5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                              >
                                {expandedIndex === idx ? (
                                  <>
                                    Hide trace
                                    <ChevronUp className="w-4 h-4" />
                                  </>
                                ) : (
                                  <>
                                    Show trace
                                    <ChevronDown className="w-4 h-4" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Accordion content */}
                          {expandedIndex === idx && (
                            <div className="p-4 bg-[#0a0a0f]/50 border border-white/5 rounded-xl space-y-4 animate-fadeIn">
                              {/* Traversal Logs */}
                              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3">
                                <div>
                                  <span className="text-[10px] font-semibold text-gray-500 block uppercase tracking-wider">Postgres Facts Found</span>
                                  <span className="text-sm font-bold text-white">{msg.meta.factCount}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-semibold text-gray-500 block uppercase tracking-wider">Graph Relations Synced</span>
                                  <span className="text-sm font-bold text-white">{msg.meta.graphCount}</span>
                                </div>
                              </div>

                              {/* Knowledge Graph Nodes */}
                              {msg.meta.graphNodesUsed && msg.meta.graphNodesUsed.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                                    <Network className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Traversed Entity Nodes</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.meta.graphNodesUsed.map((node, nIdx) => (
                                      <span key={nIdx} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold">
                                        {node}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Reference Sources */}
                              {msg.meta.sources && msg.meta.sources.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Source Passages References</span>
                                  </div>
                                  <ul className="space-y-1">
                                    {msg.meta.sources.map((source, sIdx) => (
                                      <li key={sIdx} className="text-xs text-gray-400 flex items-start gap-2">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5"></span>
                                        <span className="flex-1 font-mono text-[10px] break-all">{source}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User Icon */}
                    {isUser && (
                      <div className="w-9 h-9 rounded-lg bg-[#7289da]/15 border border-[#7289da]/20 flex items-center justify-center text-[#7289da] shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Pulsing skeleton during retrieval and generation */}
              {loading && (
                <div className="flex items-start gap-4 justify-start">
                  <div className="w-9 h-9 rounded-lg bg-[#43b581]/15 border border-[#43b581]/20 flex items-center justify-center text-[#43b581] shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl p-5 border border-white/5 bg-[#141420]/40 rounded-tl-none w-[360px] space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#7289da] animate-ping"></span>
                      <span className="text-[11px] font-bold text-[#7289da] uppercase tracking-wider animate-pulse">Retrieving facts & reasoning...</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-white/5 rounded w-full animate-pulse"></div>
                      <div className="h-3 bg-white/5 rounded w-5/6 animate-pulse"></div>
                      <div className="h-3 bg-white/5 rounded w-2/3 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Form Box */}
        <div className="p-4 border-t border-white/5 bg-[#141420]/30 space-y-3">
          
          {/* File attachment preview chip & scope toggle */}
          {attachedFile && (
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#7289da]/10 border border-[#7289da]/20 rounded-xl text-[#7289da]">
                  {attachmentUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{attachedFile.name}</p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                    {attachmentUploading ? (
                      <span>Uploading & parsing document...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#43b581]" />
                        <span className="text-[#43b581] font-bold">Indexed & Search Ready (ID: {attachedDocId})</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Scope Toggles */}
              {!attachmentUploading && attachedDocId && (
                <div className="flex items-center gap-1.5 p-1 bg-[#0a0a0f] rounded-xl border border-white/5 self-end md:self-auto">
                  <button
                    onClick={() => setQueryScope('document')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      queryScope === 'document'
                        ? 'bg-[#7289da]/15 border-[#7289da]/30 text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ask in this file
                  </button>
                  <button
                    onClick={() => setQueryScope('global')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      queryScope === 'global'
                        ? 'bg-[#7289da]/15 border-[#7289da]/30 text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Ask global
                  </button>
                </div>
              )}

              {/* Delete button */}
              <button
                onClick={detachFile}
                className="p-1.5 hover:bg-white/5 text-gray-500 hover:text-white rounded-lg transition-all self-end md:self-auto"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.pptx"
          />

          <form onSubmit={handleSend} className="flex gap-3 items-end max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-2.5 hover:border-white/15 focus-within:border-[#7289da]/60 transition-all duration-200">
            {/* Attachment Trigger Button */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={loading || attachmentUploading}
              className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all self-end disabled:opacity-50"
              title="Attach document to chat"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                attachedFile && queryScope === 'document'
                  ? `Ask a question about ${attachedFile.name}...`
                  : "Ask questions about parts, vendors, timelines, or RFQs..."
              }
              className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 text-sm placeholder-gray-500 text-gray-100 max-h-36 min-h-[2.5rem] p-2.5 resize-none focus:outline-none scrollbar-thin outline-none"
              style={{ fieldSizing: 'content' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading || attachmentUploading}
              className="p-3 bg-[#7289da] text-white rounded-xl hover:bg-[#6378bd] transition-all disabled:opacity-50 disabled:hover:bg-[#7289da] self-end"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-gray-600 text-center mt-2 font-medium">
            Fact Grounded System. Answers are generated by local Gemma models and verified by multi-stage retrievers.
          </p>
        </div>
      </div>
    </div>
  )
}
