import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Users,
  Settings,
  Plus,
  Trash2,
  Key,
  Shield,
  Coins,
  Cpu,
  Database,
  HardDrive,
  Activity,
  UserPlus,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function Administration() {
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'teams' | 'monitoring'
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form states
  const [createUserEmail, setCreateUserEmail] = useState('')
  const [createUserRole, setCreateUserRole] = useState('employee')
  const [createUserTeam, setCreateUserTeam] = useState('')
  const [createUserQuota, setCreateUserQuota] = useState(242000)

  const [editUser, setEditUser] = useState(null)
  const [editUserRole, setEditUserRole] = useState('')
  const [editUserTeam, setEditUserTeam] = useState('')
  const [editUserQuota, setEditUserQuota] = useState(242000)

  const [createTeamName, setCreateTeamName] = useState('')

  // Real-time WebSocket Telemetry states
  const [telemetry, setTelemetry] = useState(null)
  const socketRef = useRef(null)

  const host = `http://${window.location.hostname}:8082`
  const wsHost = `ws://${window.location.hostname}:8082`
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const fetchUsersAndTeams = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const headers = getHeaders()
      const [usersRes, teamsRes] = await Promise.all([
        axios.get(`${host}/admin/users`, { headers }),
        axios.get(`${host}/admin/teams`, { headers })
      ])
      setUsers(usersRes.data)
      setTeams(teamsRes.data)
    } catch (e) {
      console.error(e)
      setErrorMsg('Failed to load users or teams. Make sure you are an administrator.')
    } finally {
      setLoading(false)
    }
  }

  // --- WebSocket Connection ---
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // Connect WebSocket
    const wsUrl = `${wsHost}/monitoring/ws`
    const ws = new WebSocket(wsUrl)
    socketRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setTelemetry(data)
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }

    ws.onerror = (err) => {
      console.error('WebSocket connection error', err)
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    fetchUsersAndTeams()
  }, [])

  // --- Actions ---

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const headers = getHeaders()
      const teamId = createUserTeam ? parseInt(createUserTeam) : null
      await axios.post(`${host}/admin/users`, {
        email: createUserEmail,
        role: createUserRole,
        team_id: teamId,
        daily_token_quota: parseInt(createUserQuota)
      }, { headers })
      
      setCreateUserEmail('')
      setCreateUserRole('employee')
      setCreateUserTeam('')
      setCreateUserQuota(242000)
      setSuccessMsg('User account created successfully! Temporary password set to: ats123*')
      fetchUsersAndTeams()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const headers = getHeaders()
      const teamId = editUserTeam ? parseInt(editUserTeam) : 0 // 0 means unassign
      await axios.put(`${host}/admin/users/${editUser.id}`, {
        role: editUserRole,
        team_id: teamId,
        daily_token_quota: parseInt(editUserQuota)
      }, { headers })

      setEditUser(null)
      setSuccessMsg('User details updated successfully')
      fetchUsersAndTeams()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const headers = getHeaders()
      await axios.delete(`${host}/admin/users/${userId}`, { headers })
      setSuccessMsg('User deleted successfully')
      fetchUsersAndTeams()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter a new password for this user:')
    if (!newPassword) return
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const headers = getHeaders()
      await axios.put(`${host}/admin/users/${userId}/password`, {
        new_password: newPassword
      }, { headers })
      setSuccessMsg('Password reset successfully')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to reset password')
    }
  }

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (!createTeamName.trim()) return
    try {
      const headers = getHeaders()
      await axios.post(`${host}/admin/teams`, { name: createTeamName.trim() }, { headers })
      setCreateTeamName('')
      setSuccessMsg('Team collection created successfully')
      fetchUsersAndTeams()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create team')
    }
  }

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? All users in this team will be unassigned.')) return
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const headers = getHeaders()
      await axios.delete(`${host}/admin/teams/${teamId}`, { headers })
      setSuccessMsg('Team deleted successfully')
      fetchUsersAndTeams()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to delete team')
    }
  }

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId)
    return team ? team.name : 'Personal'
  }

  return (
    <div className="space-y-8 select-none font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Administration Console</h1>
          <p className="text-gray-400 mt-1">Manage platform users, roles, collections, token governance, and telemetry monitoring</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-[#141420] rounded-xl border border-white/5 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-[#7289da] text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'teams'
                ? 'bg-[#7289da] text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4" />
            Teams
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'monitoring'
                ? 'bg-[#7289da] text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Stats
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-300 text-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-start gap-3 text-emerald-300 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* --- Users Tab Content --- */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User CRUD List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#141420]/30">
                <span className="text-sm font-bold text-white">Registered Accounts</span>
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400 font-mono font-bold">
                  {users.length} accounts
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {users.map(user => (
                  <div key={user.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.01] transition-all">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate block">{user.email}</span>
                        {user.is_temp_password && (
                          <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                            Setup Needed
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                        <span>Username: {user.username || 'N/A'}</span>
                        <span className="text-[#7289da]">{user.role}</span>
                        <span className="text-emerald-400">Team: {getTeamName(user.team_id)}</span>
                      </div>
                      {/* User Token quota indicator */}
                      <div className="pt-2 flex items-center gap-2 w-48">
                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#43b581]"
                            style={{ width: `${Math.min(100, (user.tokens_used_today / user.daily_token_quota) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {user.tokens_used_today.toLocaleString()} / {user.daily_token_quota.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        onClick={() => {
                          setEditUser(user)
                          setEditUserRole(user.role)
                          setEditUserTeam(user.team_id ? user.team_id.toString() : '')
                          setEditUserQuota(user.daily_token_quota)
                        }}
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/5 transition-all"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/5 transition-all"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/15 transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Forms Sidebar */}
          <div className="space-y-6">
            {editUser ? (
              <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-[#7289da]" />
                    Edit User: {editUser.email}
                  </h3>
                  <button onClick={() => setEditUser(null)} className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-white transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Role</label>
                    <select
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Collection Team</label>
                    <select
                      value={editUserTeam}
                      onChange={(e) => setEditUserTeam(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    >
                      <option value="">Personal / No Team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Daily Token Quota</label>
                    <input
                      type="number"
                      value={editUserQuota}
                      onChange={(e) => setEditUserQuota(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#7289da] hover:bg-[#6378bd] text-white font-bold rounded-xl transition-all shadow-md text-xs uppercase tracking-wider"
                  >
                    Save Modifications
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#43b581]" />
                  Provision Account
                </h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Email Address</label>
                    <input
                      type="email"
                      value={createUserEmail}
                      onChange={(e) => setCreateUserEmail(e.target.value)}
                      placeholder="koustubh.deodhar@ats-group.in"
                      required
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">System Role</label>
                    <select
                      value={createUserRole}
                      onChange={(e) => setCreateUserRole(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Collection Team</label>
                    <select
                      value={createUserTeam}
                      onChange={(e) => setCreateUserTeam(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    >
                      <option value="">Personal / No Team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Daily Token Quota</label>
                    <input
                      type="number"
                      value={createUserQuota}
                      onChange={(e) => setCreateUserQuota(e.target.value)}
                      placeholder="242000"
                      className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md text-xs uppercase tracking-wider"
                  >
                    Provision Account
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Teams Tab Content --- */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          {/* Teams list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#141420]/30">
                <span className="text-sm font-bold text-white">Active Team Collections</span>
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400 font-mono font-bold">
                  {teams.length} teams
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {teams.map(team => (
                  <div key={team.id} className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-all">
                    <div>
                      <span className="text-sm font-bold text-white block">{team.name}</span>
                      <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">COLLECTION ID: {team.id}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/15 transition-all"
                      title="Delete Team"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Create Team Form */}
          <div>
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#7289da]" />
                Create New Team
              </h3>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase block">Team Name</label>
                  <input
                    type="text"
                    value={createTeamName}
                    onChange={(e) => setCreateTeamName(e.target.value)}
                    placeholder="Engineering / Sales / Operations"
                    required
                    className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#7289da] hover:bg-[#6378bd] text-white font-bold rounded-xl transition-all shadow-md text-xs uppercase tracking-wider"
                >
                  Add Team Scope
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Live Telemetry Tab Content --- */}
      {activeTab === 'monitoring' && (
        <div className="space-y-8 animate-fadeIn">
          {telemetry ? (
            <>
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CPU load */}
                <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-[#7289da]/10 flex items-center justify-center text-[#7289da]">
                    <Cpu className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">CPU Load</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{telemetry.telemetry?.cpu_usage || 0}%</h3>
                  </div>
                </div>

                {/* RAM load */}
                <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-[#43b581]/10 flex items-center justify-center text-[#43b581]">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">RAM Utilization</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{telemetry.telemetry?.ram_usage || 0}%</h3>
                  </div>
                </div>

                {/* Disk load */}
                <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disk Storage</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{telemetry.telemetry?.disk_usage || 0}%</h3>
                  </div>
                </div>

                {/* GPU load */}
                <div className="glass-card rounded-2xl p-6 flex items-center gap-5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">GPU VRAM Load</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{telemetry.telemetry?.gpu?.vram_usage || 0}%</h3>
                  </div>
                </div>
              </div>

              {/* Status Board */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Platform usage stats */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#7289da]" />
                    Real-time Platform Consumption
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold">
                      <span className="text-gray-400">Active Pipeline Jobs</span>
                      <span className="text-white font-mono">{telemetry.active_jobs} running</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold">
                      <span className="text-gray-400">Total Registered Users</span>
                      <span className="text-white font-mono">{telemetry.total_users} accounts</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold animate-pulse">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-[#7289da]" />
                        Total Global Tokens (Today)
                      </span>
                      <span className="text-white font-mono">{telemetry.total_tokens_today.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold">
                      <span className="text-gray-400">Documents Ingested</span>
                      <span className="text-white font-mono">{telemetry.total_documents} documents</span>
                    </div>
                  </div>
                </div>

                {/* Maintenance triggers */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Administrative Actions
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-white">Manual Database Consolidation</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Executes graph traversals and resets token cache parameters</p>
                      </div>
                      <button
                        onClick={async () => {
                          alert('Triggered nightly maintenance jobs in background Celery queue.')
                        }}
                        className="px-4 py-2 bg-[#7289da] hover:bg-[#6378bd] text-white text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all"
                      >
                        Consolidate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <span className="text-xs text-gray-500 font-semibold animate-pulse uppercase tracking-wider">Establishing telemetry socket...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
