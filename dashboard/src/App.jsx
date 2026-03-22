import { useState, useEffect } from 'react'

function App() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [secret, setSecret] = useState(localStorage.getItem('api_secret') || '')

  const fetchStats = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/admin/stats', {
        headers: { 'x-api-secret': secret }
      })
      if (res.status === 401) throw new Error('Invalid Secret or Locked')
      if (!res.ok) throw new Error(`Server Error: ${res.status}`)
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (err) {
      console.error("Fetch error:", err)
      setError(err.message === 'Failed to fetch' ? 'Connection Refused: Check if Bot is running at 127.0.0.1:3000' : err.message)
    }
  }

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000)
    fetchStats()
    return () => clearInterval(interval)
  }, [secret])

  const saveSecret = (e) => {
    setSecret(e.target.value)
    localStorage.setItem('api_secret', e.target.value)
  }

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Nexus Command Center</h1>
          <p className="text-slate-400">Industry-Grade Autonomous Management</p>
        </div>
        <div className="flex gap-4">
          <input
            type="password"
            placeholder="API Secret"
            value={secret}
            onChange={saveSecret}
            className="glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ring-blue-500 w-48"
          />
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-8 flex items-center gap-3">
          <span>⚠️</span> {error}
        </div>
      )}

      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Status Card */}
          <div className="glass p-6 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Bot Status</p>
            <h2 className="text-2xl font-bold mb-2">{stats.tag}</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
              <span className="text-sm text-green-500">Operational</span>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Infrastructure</p>
            <h2 className="text-3xl font-bold mb-1">{stats.guilds}</h2>
            <p className="text-sm text-slate-500">Active Guilds • {stats.ping}ms Ping</p>
          </div>

          <div className="glass p-6 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Raid Status</p>
            <h2 className={`text-2xl font-bold mb-2 ${stats.raid.active ? 'text-orange-500' : ''}`}>
              {stats.raid.active ? 'ACTIVE 🔥' : 'Idle'}
            </h2>
            <p className="text-sm text-slate-500">{stats.raid.links} Links Sent Today</p>
          </div>

          <div className="glass p-6 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Security</p>
            <h2 className="text-3xl font-bold mb-1">{stats.moderation.strikes}</h2>
            <p className="text-sm text-slate-500">Recent Strikes • {stats.moderation.blocked} Muted</p>
          </div>

          {/* Detailed Info */}
          <div className="col-span-1 md:col-span-2 glass p-8 rounded-3xl mt-4">
            <h3 className="text-xl font-bold mb-6">System Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                <span>Uptime</span>
                <span className="font-mono text-blue-400">{Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                <span>Watchlist Tokens</span>
                <span className="font-mono text-purple-400">{stats.watchlist} Items</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p>Connecting to Nexus API...</p>
        </div>
      )}

      <footer className="mt-20 text-center opacity-30 text-sm">
        Nexus Command Center v2.0 • 100% Autonomous • Pure Degen Intelligence
      </footer>
    </div>
  )
}

export default App
