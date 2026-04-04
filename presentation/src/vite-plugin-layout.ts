import type { Plugin } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export default function layoutPlugin(): Plugin {
  let dataDir: string

  return {
    name: 'layout-editor',
    configureServer(server) {
      dataDir = resolve(server.config.root, 'src/data')

      // Generic save endpoint – writes to positions.json or overrides.json
      // Body: { file?: "positions"|"overrides", key: string, data: any }
      server.middlewares.use('/__layout/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const { file, key, data } = JSON.parse(body)
            const target = file || 'positions'
            const filePath = resolve(dataDir, `${target}.json`)
            console.log('[layout-editor] Writing to:', filePath)
            const current = JSON.parse(readFileSync(filePath, 'utf-8'))
            current[key] = data
            writeFileSync(filePath, JSON.stringify(current, null, 2) + '\n')
            console.log('[layout-editor] Written successfully. Keys:', Object.keys(current))
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: filePath }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
      })
    },
  }
}
