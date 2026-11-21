import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Demo sitesi API'yi aynı kökenden okur (gerçek sitede CDN/ters vekil); yerelde customer-api'ye yönlendirilir. /__dev yalnız site seçici içindir.
export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, process.cwd(), '').API_TARGET
  return {
    plugins: [react()],
    server: {
      port: 5310,
      strictPort: true,
      proxy: target ? { '/api': { target }, '/__dev': { target } } : undefined,
    },
    preview: { port: 5310, strictPort: true },
  }
})
