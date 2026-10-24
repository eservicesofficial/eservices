// Simple API proxy - bypasses Prisma connection pool issues
const http = require('http')

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOSTNAME || '0.0.0.0'

const server = http.createServer((req, res) => {
  // Log requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)

  // Proxy to Next.js standalone server
  const proxyReq = http.request(
    `http://${HOST}:${PORT}${req.url}`,
    { ...req, headers: req.headers, agent: false },
    (proxyRes) => {
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (err) => {
    console.error(`[PROXY ERROR] ${err.message}`)
    if (!res.headersSent) res.end('{"error":"Proxy Error: ' + err.message}')
  })

  // Handle ECONNRESET from standalone server (happens during restart)
  proxyReq.on('close', () => {
    console.log('[PROXY] Connection closed by standalone server')
  })

  res.on('close', () => {
    proxyReq.destroy()
  })

  setTimeout(() => console.log('[PROXY] No requests in 5s - health check'), 5000)
  console.log(`[PROXY] Listening on ${HOST}:${PORT}`)
})

server.listen(PORT, HOST)