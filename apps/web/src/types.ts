export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface AuthRequest {
  username: string
  password: string
}

export interface RecordResponse {
  id: number
  item: string | null
  location: string | null
  placed_at: string | null
  note: string | null
  confidence: number
  confirmed: boolean
  needs_confirm: boolean
}

export interface ConfirmRequest {
  item?: string | null
  location?: string | null
  placed_at?: string | null
  note?: string | null
}

export type ChatMode = 'auto' | 'record' | 'query'

export interface ChatResponse {
  type: 'record' | 'query' | 'unknown'
  intent: string
  answer: string
  record: RecordResponse | null
  records: RecordResponse[]
}
