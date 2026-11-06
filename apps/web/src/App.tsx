import { useEffect, useState } from 'react'
import AuthView from './components/AuthView'
import ChatView from './components/ChatView'

const TOKEN_KEY = 'zhiwuwo_token'

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }, [token])

  return (
    <div className="app">
      {token ? <ChatView token={token} /> : <AuthView onAuth={setToken} />}
    </div>
  )
}
