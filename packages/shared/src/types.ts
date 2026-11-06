/**
 * 与 packages/api-schema/openapi.json 对应的手写类型（唯一事实源是 OpenAPI）。
 * 这里只用纯 TypeScript，不引入 React / DOM / React Native，Web 与 App 均可复用。
 */

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface AuthRequest {
  username: string
  password: string
}

export interface RegisterRequest extends AuthRequest {
  nickname?: string | null
}

export interface RecordCreate {
  content: string
  modality?: string
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

export interface ChatRequest {
  message: string
  mode?: ChatMode
}

export type ChatType = 'record' | 'query' | 'unknown'

export interface ChatResponse {
  type: ChatType
  intent: string
  answer: string
  /** OpenAPI 中非必填：缺省时客户端统一补成 null / [] */
  record?: RecordResponse | null
  records?: RecordResponse[]
}

export interface ParserStatus {
  configured_backend: string
  active_backend: string
  model: string
  api_key_configured: boolean
  consent: boolean
  fallback: string
}

export interface HealthResponse {
  status?: string
  [key: string]: unknown
}
