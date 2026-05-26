import { useState } from 'react'
import { supabase } from './supabase'

const T = {
  bg: '#0A0A0A', card: '#111111', border: '#222222', text: '#FAFAFA',
  textMuted: '#6B6B6B', positive: '#10B981',
  positiveMuted: 'rgba(16, 185, 129, 0.08)', negative: '#F43F5E',
  negativeMuted: 'rgba(244, 63, 94, 0.08)', inputBg: '#161616', inputBorder: '#2A2A2A',
}

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      if (error) { setError(error.message) } else { setMessage('Account created! Check your email to confirm, then log in.'); setMode('login') }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 16px', fontSize: 15, color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, outline: 'none' }
  const lbl = { display: 'block', fontSize: 12, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 10 }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif", padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textMuted, margin: '0 0 12px' }}>Personal Finance</p>
          <h1 style={{ fontSize: 44, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em' }}>Dashboard</h1>
          <p style={{ fontSize: 15, color: T.textMuted, margin: '12px 0 0' }}>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</p>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 36 }}>
          <div style={{ display: 'flex', background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 12, padding: 4, marginBottom: 28 }}>
            {['login', 'signup'].map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); setMessage(null) }}
                style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 10, border: 'none', cursor: 'pointer', background: mode === m ? T.positive : 'transparent', color: mode === m ? '#0A0A0A' : T.textMuted }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Full Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inp} />
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
            </div>
            {error && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, background: T.negativeMuted, border: '1px solid rgba(244,63,94,0.2)', color: T.negative }}>{error}</div>}
            {message && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, background: T.positiveMuted, border: '1px solid rgba(16,185,129,0.2)', color: T.positive }}>{message}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', fontSize: 15, fontWeight: 600, color: '#0A0A0A', background: T.positive, border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, marginTop: 24 }}>Your data is private and encrypted.</p>
      </div>
    </div>
  )
}
