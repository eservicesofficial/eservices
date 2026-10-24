'use client'

import * as React from 'react'

export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          padding: 24,
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>404</h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>Page not found</p>
        </div>
      </body>
    </html>
  )
}
