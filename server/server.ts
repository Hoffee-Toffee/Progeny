import express from 'express'
import * as Path from 'node:path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs'

// Get the directory name of the current module file
const __dirname = dirname(fileURLToPath(import.meta.url))

import dotenv from 'dotenv'
dotenv.config()

const server = express()

server.use(express.json({ limit: '50mb' }))
server.use(express.urlencoded({ extended: true, limit: '50mb' }))

if (process.env.NODE_ENV === 'production') {
  server.use(express.static(Path.resolve('public')))
  server.use('/assets', express.static(Path.resolve(__dirname, 'assets')))

  server.get('*', (req, res) => {
    const index = fs.readFileSync(
      Path.resolve(__dirname, 'index.html'),
      'utf-8',
    )

    res.contentType('text/html')
    res.send(index)
  })
}

export default server
