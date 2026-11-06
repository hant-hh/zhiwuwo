import { useState } from 'react'
import { login, register } from '../api'
import type { TokenResponse } from '../types'

export default function AuthView({ onAuth }: { onAuth: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    try {
      const res: TokenResponse =
        mode === 'login'
          ? await login({ username, password })
          : await register({ username, password })
      onAuth(res.access_token)
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="auth">
      <h1>置物窝</h1>
      <p className="subtitle">登录后开始记录与查找物品</p>
      <div className="tabs" style={{ justifyContent: 'center' }}>
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
          type="button"
        >
          登录
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
          type="button"
        >
          注册
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">{mode === 'login' ? '登录' : '注册'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
