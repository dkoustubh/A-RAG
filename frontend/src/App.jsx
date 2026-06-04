import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import GroundedChat from './components/GroundedChat'
import Upload from './components/Upload'
import Documents from './components/Documents'
import KnowledgeGraph from './components/KnowledgeGraph'
import Administration from './components/Administration'
import { LayoutGrid, MessageSquare, UploadCloud, FolderClosed, Network, Settings, Sun, Moon, Database } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [darkMode, setDarkMode] = useState(true)

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'chat':
        return <GroundedChat />
      case 'upload':
        return <Upload />
      case 'documents':
        return <Documents />
      case 'graph':
        return <KnowledgeGraph />
      case 'neo4j':
        return (
          <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Neo4j Browser</h1>
                <p className="text-gray-400 text-sm mt-1">Interactive graph database console — run Cypher queries and explore relationships</p>
              </div>
              <a
                href={`http://${window.location.hostname}:7474`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/10 transition-all text-gray-300"
              >
                Open in new tab ↗
              </a>
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 glass-card">
              <iframe
                src={`http://${window.location.hostname}:7474/browser/`}
                className="w-full h-full border-0"
                title="Neo4j Browser"
              />
            </div>
          </div>
        )
      case 'admin':
        return <Administration />
      default:
        return <Dashboard />
    }
  }

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutGrid },
    { id: 'chat', name: 'Grounded Chat', icon: MessageSquare },
    { id: 'upload', name: 'Ingestion Console', icon: UploadCloud },
    { id: 'documents', name: 'Document Explorer', icon: FolderClosed },
    { id: 'graph', name: 'Knowledge Graph', icon: Network },
    { id: 'neo4j', name: 'Neo4j Browser', icon: Database },
    { id: 'admin', name: 'Administration', icon: Settings },
  ]

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${darkMode ? 'bg-[#0f0f16] text-gray-100' : 'light-theme bg-[#f8f9fa] text-gray-800'}`}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#141420] border-r border-white/5 flex flex-col justify-between py-6 px-4">
        <div>
          <div className="flex items-center gap-3 px-3 mb-8">
            <span className="text-2xl">🧬</span>
            <span className="text-xl font-bold tracking-tight text-[#7289da]">A-RAG Platform</span>
          </div>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#7289da] text-white shadow-lg shadow-[#7289da]/10'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="border-t border-white/5 pt-4 space-y-4">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs font-semibold text-gray-400">Theme</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0f] border border-white/10 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-orange-400" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#7289da]" />
                  Dark
                </>
              )}
            </button>
          </div>
          <div className="px-3 text-xs text-gray-500">
            Status: Operational | v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0a0a0f] p-8">
        {renderContent()}
      </main>
    </div>
  )
}
