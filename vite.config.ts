import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend-ka aad siisay ma bixiyo CORS header, sidaas darteed dev-server-ku wuu ka
      // gudbinayaa (proxy) si browser-ku uusan u xannibmin.
      '/WeatherForecast': {
        target: 'https://webappa-gxdadkd0e6gdgkb0.canadacentral-01.azurewebsites.net',
        changeOrigin: true,
      },
    },
  },
})
