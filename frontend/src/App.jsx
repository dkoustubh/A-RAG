import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import GroundedChat from './components/GroundedChat'
import Upload from './components/Upload'
import Documents from './components/Documents'
import KnowledgeGraph from './components/KnowledgeGraph'
import Administration from './components/Administration'
import Login from './components/Login'
import {
  LayoutGrid,
  MessageSquare,
  UploadCloud,
  FolderClosed,
  Network,
  Settings,
  Sun,
  Moon,
  Database,
  User as UserIcon,
  LogOut,
  Sparkles
} from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [darkMode, setDarkMode] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const host = `http://${window.location.hostname}:8082`

  const verifySessionToken = async (token) => {
    try {
      const res = await axios.get(`${host}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCurrentUser(res.data)
      setIsAuthenticated(true)
    } catch (e) {
      console.error("Session token validation failed", e)
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('username')
      setIsAuthenticated(false)
    } finally {
      setLoadingUser(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      verifySessionToken(token)
    } else {
      setIsAuthenticated(false)
      setLoadingUser(false)
    }
  }, [])

  const handleLoginSuccess = (data) => {
    verifySessionToken(data.access_token)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

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

  // Filter tabs based on RBAC permissions
  const filteredTabs = tabs.filter(tab => {
    if (tab.id === 'neo4j' || tab.id === 'admin') {
      return currentUser && currentUser.role === 'admin'
    }
    return true
  })

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f16]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#7289da]/10 flex items-center justify-center text-[#7289da] animate-spin">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Securing Workspace...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  const tokenProgressPct = currentUser ? Math.min(100, (currentUser.tokens_used_today / currentUser.daily_token_quota) * 100) : 0

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${darkMode ? 'bg-[#0f0f16] text-gray-100' : 'light-theme bg-[#f8f9fa] text-gray-800'}`}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#141420] border-r border-white/5 flex flex-col justify-between py-6 px-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 px-3 mb-8">
            <span className="text-2xl">🧬</span>
            <span className="text-xl font-bold tracking-tight text-[#7289da]">A-RAG Platform</span>
          </div>
          <nav className="space-y-1">
            {filteredTabs.map((tab) => {
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
          {/* User Profile Card */}
          {currentUser && (
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#7289da]/10 border border-[#7289da]/20 flex items-center justify-center text-[#7289da] shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{currentUser.username || 'User'}</p>
                  <p className="text-[9px] uppercase font-bold text-[#7289da] tracking-wider">{currentUser.role}</p>
                </div>
              </div>

              {/* Token Quota Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                  <span>Tokens Used</span>
                  <span>{Math.round(tokenProgressPct)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      tokenProgressPct >= 90 ? 'bg-red-500' : tokenProgressPct >= 70 ? 'bg-orange-500' : 'bg-[#43b581]'
                    }`}
                    style={{ width: `${tokenProgressPct}%` }}
                  ></div>
                </div>
                <div className="text-[9px] text-gray-500 text-right font-mono">
                  {currentUser.tokens_used_today.toLocaleString()} / {currentUser.daily_token_quota.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Theme switcher & Logout block */}
          <div className="flex flex-col gap-3 px-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Theme</span>
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
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <div className="px-3 text-[10px] text-gray-600 text-center font-medium">
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
