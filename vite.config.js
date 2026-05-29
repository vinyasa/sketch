import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/sketch/',
  plugins: [
    react(),
    {
      name: 'watch-user-manual',
      configureServer(server) {
        const manualPath = path.resolve('docs/user_manual.md')
        const normManual = manualPath.replace(/\\/g, '/').toLowerCase()
        server.watcher.add(manualPath)
        server.watcher.on('change', (file) => {
          const normFile = path.resolve(file).replace(/\\/g, '/').toLowerCase()
          if (normFile === normManual) {
            console.log(`[watch-user-manual] Change detected in user_manual.md. Invalidating module cache and reloading...`)
            const mods = [
              server.moduleGraph.getModuleById(manualPath),
              server.moduleGraph.getModuleById(`${manualPath}?raw`)
            ]
            mods.forEach(mod => {
              if (mod) {
                server.moduleGraph.invalidateModule(mod)
              }
            })
            server.ws.send({
              type: 'full-reload'
            })
          }
        })
      }
    }
  ],
  server: {
    watch: {
      ignored: ['!**/docs/**']
    }
  }
})
