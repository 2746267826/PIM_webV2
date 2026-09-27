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
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false, // 测试 API 使用自签/非常规证书
      },
    },
  },
})

