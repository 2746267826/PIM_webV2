import { apiGet, apiPost } from './client'
import type { AuthResponse, UserInfo } from './types'

export interface RegisterPayload {
  username: string
  email: string
  password: string
  displayName?: string
}

export const authApi = {
  /** 登录（用户名或邮箱 + 密码；匿名端点） */
  login: (username: string, password: string) =>
    apiPost<AuthResponse>('/api/v1/auth/login', { username, password }, { auth: false }),

  /** 注册即登录（匿名端点；首个用户自动成为 admin） */
  register: (payload: RegisterPayload) =>
    apiPost<AuthResponse>('/api/v1/auth/register', payload, { auth: false }),

  /** 当前用户（页面刷新后恢复会话） */
  me: () => apiGet<UserInfo>('/api/v1/auth/me'),
}
