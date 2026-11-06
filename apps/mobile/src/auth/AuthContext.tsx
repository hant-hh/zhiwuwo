import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '@/api/client'
import { clearSession, readSession, saveSession } from './token'
import type { Session } from './token'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

interface AuthContextValue {
  status: AuthStatus
  token: string | null
  username: string | null
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let alive = true
    void readSession().then((stored) => {
      if (!alive) return
      setSession(stored)
      setStatus(stored ? 'signedIn' : 'signedOut')
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null)
      setStatus('signedOut')
      void clearSession()
    })
    return () => setUnauthorizedHandler(undefined)
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await api.login({ username: username.trim(), password })
    const next: Session = { token: res.access_token, username: username.trim() }
    await saveSession(next)
    setSession(next)
    setStatus('signedIn')
  }, [])

  const signUp = useCallback(async (username: string, password: string) => {
    const res = await api.register({ username: username.trim(), password })
    const next: Session = { token: res.access_token, username: username.trim() }
    await saveSession(next)
    setSession(next)
    setStatus('signedIn')
  }, [])

  const signOut = useCallback(async () => {
    await clearSession()
    setSession(null)
    setStatus('signedOut')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token: session?.token ?? null,
      username: session?.username ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [status, session, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}
