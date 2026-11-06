import type {
  AuthRequest,
  ChatMode,
  ChatResponse,
  ConfirmRequest,
  HealthResponse,
  ParserStatus,
  RecordResponse,
  RegisterRequest,
  TokenResponse,
} from './types'

/** 统一的网络/HTTP 错误，UI 层可用 status 区分「断网」「登录过期」「参数错误」。 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

export interface ApiClientOptions {
  /** 例如 https://zhiwuwo.com:18443，尾斜杠会被去掉；非标准端口需显式写出 */
  baseUrl: string
  /** 由各端注入 token 读取方式：Web 读内存/localStorage，App 读 SecureStore */
  getToken?: () => string | null | Promise<string | null>
  /** 便于测试注入，默认使用全局 fetch */
  fetchImpl?: typeof fetch
  /** 401 统一回调（App 用它触发登出） */
  onUnauthorized?: (error: ApiError) => void
}

export interface ApiClient {
  readonly baseUrl: string
  register(body: RegisterRequest): Promise<TokenResponse>
  login(body: AuthRequest): Promise<TokenResponse>
  sendChat(message: string, mode?: ChatMode): Promise<ChatResponse>
  listRecords(q?: string): Promise<RecordResponse[]>
  createRecord(content: string, modality?: string): Promise<RecordResponse>
  confirmRecord(id: number, patch: ConfirmRequest): Promise<RecordResponse>
  parserStatus(): Promise<ParserStatus>
  health(): Promise<HealthResponse>
}

function detailFromBody(status: number, raw: string): string {
  if (!raw) return `请求失败（HTTP ${status}）`
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return raw.slice(0, 200)
  }
  if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
    const detail = (parsed as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            return String((item as { msg: unknown }).msg)
          }
          return String(item)
        })
        .filter(Boolean)
      if (parts.length > 0) return parts.join('；')
    }
  }
  return raw.slice(0, 200)
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/+$/, '')
  const doFetch: typeof fetch =
    options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = (await options.getToken?.()) ?? null
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    }
    if (token) headers.Authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await doFetch(`${base}${path}`, { ...init, headers })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new ApiError(0, `连不上服务器，请检查网络或地址（${message}）`)
    }

    const raw = await response.text()
    if (!response.ok) {
      const error = new ApiError(response.status, detailFromBody(response.status, raw))
      if (error.isUnauthorized) options.onUnauthorized?.(error)
      throw error
    }
    if (!raw) return undefined as T
    return JSON.parse(raw) as T
  }

  function json(body: unknown): string {
    return JSON.stringify(body)
  }

  return {
    baseUrl: base,

    register(body) {
      return request<TokenResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: json(body),
      })
    },

    login(body) {
      return request<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: json(body),
      })
    },

    async sendChat(message, mode: ChatMode = 'auto') {
      const res = await request<ChatResponse>('/api/v1/chat', {
        method: 'POST',
        body: json({ message, mode }),
      })
      return {
        ...res,
        answer: res.answer ?? '',
        record: res.record ?? null,
        records: res.records ?? [],
      }
    },

    listRecords(q) {
      const query = q ? `?q=${encodeURIComponent(q)}` : ''
      return request<RecordResponse[]>(`/api/v1/records${query}`)
    },

    createRecord(content, modality = 'text') {
      return request<RecordResponse>('/api/v1/records', {
        method: 'POST',
        body: json({ content, modality }),
      })
    },

    confirmRecord(id, patch) {
      return request<RecordResponse>(`/api/v1/records/${id}/confirm`, {
        method: 'POST',
        body: json(patch),
      })
    },

    parserStatus() {
      return request<ParserStatus>('/api/v1/parser/status')
    },

    health() {
      return request<HealthResponse>('/health')
    },
  }
}
