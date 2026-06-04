import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import Upload from './components/Upload'
import Documents from './components/Documents'
import KnowledgeGraph from './components/KnowledgeGraph'
import Administration from './components/Administration'
import { LayoutGrid, UploadCloud, FolderClosed, Network, Settings } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'upload':
        return <Upload />
      case 'documents':
        return <Documents />
      case 'graph':
        return <KnowledgeGraph />
      case 'admin':
        return <Administration />
      default:
        return <Dashboard />
    }
  }

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutGrid },
    { id: 'upload', name: 'Ingestion Console', icon: UploadCloud },
    { id: 'documents', name: 'Document Explorer', icon: FolderClosed },
    { id: 'graph', name: 'Knowledge Graph', icon: Network },
    { id: 'admin', name: 'Administration', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-[#0f0f16] text-gray-100 overflow-hidden font-sans">
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
        <div className="px-3 text-xs text-gray-500 border-t border-white/5 pt-4">
          Status: Operational | v1.0.0
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0a0a0f] p-8">
        {renderContent()}
      </main>
    </div>
  )
}
