import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 开发环境将 /api 代理到 PIM API。
// 默认走测试 API（pim.example.com:15860）；本地起后端时改回 http://localhost:5858。
// 也可不依赖代理：在应用内「设置 → 服务器」填写 API 地址（跨域需后端 CORS 白名单放行）。
const API_TARGET = process.env.PIM_API_TARGET ?? 'https://pim.example.com:15860'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    /*
     * 端口 5173 落进 Windows 保留区间 5141–5240（见 netsh excludedportrange），
     * 绑定会 EACCES；该区间内 5174/5175… 同样不可用，故自动递增也救不回来。
     * 改用未保留的 3000，strictPort 固定以免静默漂移；需要时用 PIM_DEV_PORT 覆盖。
     */
    port: Number(process.env.PIM_DEV_PORT ?? 3000),
    strictPort: true,
    /*
     * 显式绑定 127.0.0.1：Vite 默认只监听 ::1（IPv6），
     * 导致 http://127.0.0.1:3000 及部分工具连不上。
     */
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false, // 测试 API 使用自签/非常规证书
      },
    },
  },
})

