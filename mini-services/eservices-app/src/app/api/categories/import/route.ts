import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

// Parse a CSV line respecting quoted fields (handles commas inside quotes)
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

interface ParsedRow {
  name: string
  description: string
  imageUrl: string
}

function parseCategoriesCSV(csvText: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  const errors: string[] = []

  if (lines.length === 0) {
    errors.push('CSV file is empty')
    return { rows: [], errors }
  }

  // Parse header
  const headerFields = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const headerMap: Record<string, number> = {}
  headerFields.forEach((h, i) => {
    headerMap[h] = i
  })

  const nameIdx = headerMap['name']
  if (nameIdx === undefined) {
    errors.push('CSV must have a "Name" column')
    return { rows: [], errors }
  }

  const descriptionIdx = headerMap['description'] ?? -1
  const imageUrlIdx = headerMap['image url'] ?? headerMap['image'] ?? headerMap['imageurl'] ?? -1
  // Skip "Item Count" column if present (it's an export-only field)

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const name = fields[nameIdx] || ''
    if (!name) continue // skip empty rows

    rows.push({
      name,
      description: descriptionIdx >= 0 ? (fields[descriptionIdx] || '') : '',
      imageUrl: imageUrlIdx >= 0 ? (fields[imageUrlIdx] || '') : '',
    })
  }

  return { rows, errors }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'inventory', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    let csvText: string

    if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
      csvText = await request.text()
    } else {
      const body = await request.json()
      if (typeof body === 'string') {
        csvText = body
      } else if (body.csv) {
        csvText = body.csv
      } else if (Array.isArray(body)) {
        // Support JSON array format: [{name, description, image}]
        let created = 0
        let updated = 0
        let skipped = 0

        for (const cat of body) {
          if (!cat.name) {
            skipped++
            continue
          }

          const existing = await db.category.findFirst({
            where: { unitCode: session.unitCode, name: cat.name },
          })
          if (existing) {
            // Update existing category
            await db.category.update({
              where: { id: existing.id },
              data: {
                description: String(cat.description || '').trim(),
                image: cat.image || '',
              },
            })
            updated++
            continue
          }

          await db.category.create({
            data: {
              name: String(cat.name).trim(),
              description: String(cat.description || '').trim(),
              image: cat.image || '',
              unitCode: session.unitCode,
            },
          })
          created++
        }

        await logAction(
          session.unitCode, session.userId, session.name, session.role,
          'IMPORT_CATEGORIES', `${created} categories imported, ${updated} updated`, { created, updated, skipped, format: 'json' }, request
        )

        return NextResponse.json({ created, updated, skipped, total: body.length })
      } else {
        return NextResponse.json({ error: 'Invalid import data. Send CSV text or JSON array.' }, { status: 400 })
      }
    }

    // Parse CSV
    const { rows, errors: parseErrors } = parseCategoriesCSV(csvText)

    if (parseErrors.length > 0) {
      return NextResponse.json({ error: parseErrors.join('; ') }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Get existing categories to handle updates
    const existingCategories = await db.category.findMany({
      where: { unitCode: session.unitCode },
      select: { id: true, name: true },
    })
    const existingNames = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]))

    let created = 0
    let updated = 0
    let skipped = 0

    for (const row of rows) {
      if (!row.name) {
        skipped++
        continue
      }

      const existingId = existingNames.get(row.name.toLowerCase())
      if (existingId) {
        // Update existing category (preserve description and image)
        await db.category.update({
          where: { id: existingId },
          data: {
            description: row.description,
            image: row.imageUrl,
          },
        })
        updated++
      } else {
        // Create new category
        const newCat = await db.category.create({
          data: {
            name: row.name,
            description: row.description,
            image: row.imageUrl,
            unitCode: session.unitCode,
          },
        })
        existingNames.set(row.name.toLowerCase(), newCat.id)
        created++
      }
    }

    await logAction(
      session.unitCode, session.userId, session.name, session.role,
      'IMPORT_CATEGORIES', `${created} categories created, ${updated} updated from CSV`, { created, updated, skipped }, request
    )

    return NextResponse.json({
      created,
      updated,
      skipped,
      total: rows.length,
    })
  } catch (error) {
    console.error('Error importing categories:', error)
    return NextResponse.json({ error: 'Failed to import categories' }, { status: 500 })
  }
}
