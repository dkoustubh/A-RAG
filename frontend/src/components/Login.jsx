import React, { useState } from 'react'
import axios from 'axios'
import { Sparkles, Mail, Lock, User, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Profile Setup State (for first-time password set)
  const [setupRequired, setSetupRequired] = useState(false)
  const [setupToken, setSetupToken] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const host = `http://${window.location.hostname}:8082`

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('username', email.trim()) // OAuth2 expects username key
      formData.append('password', password)

      const res = await axios.post(`${host}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      if (res.data.status === 'setup_required') {
        setSetupToken(res.data.access_token)
        setSetupRequired(true)
      } else {
        localStorage.setItem('token', res.data.access_token)
        localStorage.setItem('role', res.data.role)
        localStorage.setItem('username', res.data.username || 'User')
        localStorage.setItem('email', email.trim())
        onLoginSuccess(res.data)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(err.response?.data?.detail || 'Authentication failed. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupSubmit = async (e) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim()) {
      setErrorMsg('All fields are required.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await axios.post(
        `${host}/auth/setup-profile`,
        { username: newUsername.trim(), password: newPassword },
        { headers: { Authorization: `Bearer ${setupToken}` } }
      )

      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('email', email.trim())
      onLoginSuccess(res.data)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.response?.data?.detail || 'Profile setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f16] px-4 font-sans select-none relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#7289da]/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <div className="w-full max-w-md bg-[#141420]/80 border border-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative z-10 glass-card transition-all duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7289da] to-[#8a9dec] flex items-center justify-center shadow-lg shadow-[#7289da]/25 mb-4 animate-pulse">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">A-RAG Intelligence</h2>
          <p className="text-gray-400 text-xs mt-1 text-center font-medium">
            {setupRequired ? 'Complete your account profile activation' : 'Sign in to access your secure cognitive space'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-300 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {!setupRequired ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="koustubh.deodhar@ats-group.in"
                  required
                  className="w-full bg-[#0a0a0f] border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="ats123*"
                  required
                  className="w-full bg-[#0a0a0f] border border-white/5 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-all"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-4 bg-[#7289da] hover:bg-[#6378bd] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#7289da]/25 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Enter Platform'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetupSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Choose Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="koustubh"
                  required
                  className="w-full bg-[#0a0a0f] border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0a0a0f] border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0a0a0f] border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7289da]/60 transition-all font-semibold outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up profile...
                </>
              ) : (
                'Save Profile & Enter'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
