import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'zhiwuwo.access_token'
const USERNAME_KEY = 'zhiwuwo.username'

export interface Session {
  token: string
  username: string
}

/** 进程内缓存：API client 的 getToken 必须是同步可读的。 */
let cached: Session | null = null

export function currentToken(): string | null {
  return cached?.token ?? null
}

export async function readSession(): Promise<Session | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    const username = await SecureStore.getItemAsync(USERNAME_KEY)
    cached = token ? { token, username: username ?? '' } : null
  } catch {
    cached = null
  }
  return cached
}

export async function saveSession(session: Session): Promise<void> {
  cached = session
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, session.token)
    await SecureStore.setItemAsync(USERNAME_KEY, session.username)
  } catch {
    // 无锁屏密码的模拟器/设备可能无法写 Keychain：内存会话仍可用，重启后需重新登录。
  }
}

export async function clearSession(): Promise<void> {
  cached = null
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(USERNAME_KEY)
  } catch {
    // 忽略存储不可用的情况，避免登出卡住。
  }
}
