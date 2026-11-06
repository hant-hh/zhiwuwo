import { createApiClient } from '@zhiwuwo/shared'
import { currentToken } from '@/auth/token'
import { API_BASE_URL } from '@/config'

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | undefined

/** AuthProvider 注册 401 回调；API client 不直接依赖 React。 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: currentToken,
  onUnauthorized: () => unauthorizedHandler?.(),
})

export { API_BASE_URL }
