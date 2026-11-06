import type {
  AuthRequest,
  ChatMode,
  ChatResponse,
  ConfirmRequest,
  RecordResponse,
  TokenResponse,
} from './types'

const BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

export function register(body: AuthRequest) {
  return request<TokenResponse>('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function login(body: AuthRequest) {
  return request<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function createRecord(token: string, content: string) {
  return request<RecordResponse>('/api/v1/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, modality: 'text' }),
  })
}

export function queryRecords(token: string, q: string) {
  return request<RecordResponse[]>(`/api/v1/records?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function sendChat(token: string, message: string, mode: ChatMode = 'auto') {
  return request<ChatResponse>('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, mode }),
  })
}

export function confirmRecord(token: string, id: number, payload: ConfirmRequest) {
  return request<RecordResponse>(`/api/v1/records/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}
