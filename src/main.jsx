import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import App from './App'
import Auth from './Auth'
import './index.css'

function Root() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#6B6B6B', fontSize: 13 }}>
        Loading...
      </div>
    )
  }

  return session ? <App session={session} /> : <Auth />
}

createRoot(document.getElementById('root')).render(<Root />)
