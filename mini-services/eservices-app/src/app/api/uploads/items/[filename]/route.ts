import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // No auth required — images are public assets served via <img> tags
    // which cannot send Authorization headers
    const { filename } = await params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Look for the file in multiple locations
    const possiblePaths = [
      join(process.cwd(), 'public', 'uploads', 'items', filename),
      join(process.cwd(), '.next', 'standalone', 'public', 'uploads', 'items', filename),
      join(process.cwd(), 'uploads', 'items', filename),
    ];

    for (const filePath of possiblePaths) {
      if (existsSync(filePath)) {
        const fileStat = await stat(filePath);
        const buffer = await readFile(filePath);

        // Determine content type based on extension
        const ext = filename.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
        };
        const contentType = contentTypes[ext || ''] || 'application/octet-stream';

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(fileStat.size),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (error) {
    console.error('Error serving upload:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
