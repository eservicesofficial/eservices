import { NextResponse } from 'next/server'

// Simple GET handler to bypass Next.js dynamic route handling
const http = require('http')

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOSTNAME || '0.0.0.0'

const server = http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)

  res.writeHead(200, { 'Content-Type': 'application/json' })

  if (req.url.includes('/api/folio/customers')) {
    try {
      // Simple query without Prisma - just read the DB directly
      const fs = require('fs')
      const Database = require('better-sqlite3')()
      const db = new Database('/home/z/my-project/db/custom.db', { file: true, journal_mode: 'wal' })
      
      const count = db.prepare('SELECT COUNT(*) as c FROM Customer').get()
      const rows = db.exec(count).get()
      console.log('Customer count:', rows?.[0]?.c || 0)
      
      res.end(JSON.stringify({ customers: rows, total: rows?.[0]?.c || 0 }))
      db.close()
    } catch (e) {
      console.error('DB Error:', e.message)
      res.end(JSON.stringify({ error: e.message }))
    }
  } else {
    res.end(JSON.stringify({ message: 'Not found' }))
  }
})

server.listen(PORT, HOST)
console.log(`Listening on ${HOST}:${PORT}`)