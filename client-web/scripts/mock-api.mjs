/* P0 视觉走查用 mock API：仅覆盖登录/会话/状态/版本四个端点（node scripts/mock-api.mjs） */
import { createServer } from 'node:http'

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const ok = (res, data) => json(res, 200, { code: 0, message: 'ok', data, timestamp: new Date().toISOString() })
const USER = { id: 'u1', username: 'demo', displayName: '演示用户', role: 'admin' }
const TOKENS = () => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  user: USER,
})

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/api/version') {
    json(res, 200, {
      version: '0.9.9-mock',
      capabilities: ['androidEmbedV1', 'mobileItemResultsV1'],
      latestVersion: null,
      checkedAt: new Date().toISOString(),
      error: null,
    })
    return
  }
  if (path === '/api/v1/auth/login' || path === '/api/v1/auth/register') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => ok(res, TOKENS()))
    return
  }
  if (path === '/api/v1/auth/refresh') {
    ok(res, TOKENS())
    return
  }
  if (path === '/api/v1/auth/me') {
    ok(res, USER)
    return
  }
  if (path === '/api/v1/status/summary') {
    ok(res, { status: 1, label: '正常', message: '全部组件健康（mock）', checkedAt: new Date().toISOString() })
    return
  }
  json(res, 404, { code: 404, message: `接口不存在: ${path}`, data: null, timestamp: new Date().toISOString() })
}).listen(5858, () => console.log('mock api on :5858'))
