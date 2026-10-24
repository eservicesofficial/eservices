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
  category: string
  categoryId: string
  price: number
  quantity: number
  description: string
  imageUrl: string
}

function parseItemsCSV(csvText: string): { rows: ParsedRow[]; errors: string[] } {
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

  // Validate required headers
  const nameIdx = headerMap['name']
  if (nameIdx === undefined) {
    errors.push('CSV must have a "Name" column')
    return { rows: [], errors }
  }

  const categoryIdx = headerMap['category'] ?? -1
  const categoryIdIdx = headerMap['category id'] ?? headerMap['categoryid'] ?? headerMap['category_id'] ?? -1
  const priceIdx = headerMap['price'] ?? -1
  const quantityIdx = headerMap['quantity'] ?? -1
  const descriptionIdx = headerMap['description'] ?? -1
  const imageUrlIdx = headerMap['image url'] ?? headerMap['image'] ?? headerMap['imageurl'] ?? -1

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const name = fields[nameIdx] || ''
    if (!name) continue // skip empty rows

    rows.push({
      name,
      category: categoryIdx >= 0 ? (fields[categoryIdx] || '') : '',
      categoryId: categoryIdIdx >= 0 ? (fields[categoryIdIdx] || '') : '',
      price: priceIdx >= 0 ? parseFloat(fields[priceIdx]) || 0 : 0,
      quantity: quantityIdx >= 0 ? parseInt(fields[quantityIdx]) || 0 : 0,
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
        // Support JSON array format: [{name, category, categoryId, price, quantity, description, imageUrl}]
        let created = 0
        let skipped = 0

        for (const item of body) {
          if (!item.name) {
            skipped++
            continue
          }

          // Resolve category
          let categoryId: string | null = item.categoryId || null
          let categoryName = item.category || 'Uncategorized'

          if (!categoryId && categoryName && categoryName !== 'Uncategorized') {
            const existingCat = await db.category.findFirst({
              where: { unitCode: session.unitCode, name: categoryName },
            })
            if (existingCat) {
              categoryId = existingCat.id
            } else {
              const newCat = await db.category.create({
                data: { name: categoryName, unitCode: session.unitCode },
              })
              categoryId = newCat.id
            }
          }

          await db.item.create({
            data: {
              name: String(item.name).trim(),
              category: categoryName,
              categoryId,
              price: Number(item.price) || 0,
              quantity: Number(item.quantity) || 0,
              description: String(item.description || '').trim(),
              image: item.imageUrl || item.image || '',
              unitCode: session.unitCode,
            },
          })
          created++
        }

        await logAction(
          session.unitCode, session.userId, session.name, session.role,
          'IMPORT_ITEMS', `${created} items imported`, { created, skipped, format: 'json' }, request
        )

        return NextResponse.json({ created, skipped, total: body.length })
      } else {
        return NextResponse.json({ error: 'Invalid import data. Send CSV text or JSON array.' }, { status: 400 })
      }
    }

    // Parse CSV
    const { rows, errors: parseErrors } = parseItemsCSV(csvText)

    if (parseErrors.length > 0) {
      return NextResponse.json({ error: parseErrors.join('; ') }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Get existing categories for this unit (to map category names → IDs)
    const existingCategories = await db.category.findMany({
      where: { unitCode: session.unitCode },
      select: { id: true, name: true },
    })
    const categoryByNameMap = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]))
    const categoryByIdMap = new Map(existingCategories.map((c) => [c.id, c.id]))

    let created = 0
    let skipped = 0
    let updated = 0
    const newCategories: string[] = []

    // Get existing items to check for duplicates (by name + category)
    const existingItems = await db.item.findMany({
      where: { unitCode: session.unitCode },
      select: { id: true, name: true, categoryId: true },
    })
    const existingItemKeys = new Set(
      existingItems.map((i) => `${i.name.toLowerCase()}||${i.categoryId || ''}`)
    )

    for (const row of rows) {
      if (!row.name) {
        skipped++
        continue
      }

      // Resolve category - prefer Category ID if it exists in our DB
      let categoryId: string | null = null
      let categoryName = row.category || 'Uncategorized'

      // Step 1: Try to match by Category ID from CSV
      if (row.categoryId) {
        const matchedById = categoryByIdMap.get(row.categoryId)
        if (matchedById) {
          categoryId = matchedById
        }
      }

      // Step 2: If no match by ID, try to match by category name
      if (!categoryId && categoryName && categoryName !== 'Uncategorized') {
        const matchedByName = categoryByNameMap.get(categoryName.toLowerCase())
        if (matchedByName) {
          categoryId = matchedByName
        } else {
          // Auto-create category
          const newCat = await db.category.create({
            data: { name: categoryName, unitCode: session.unitCode },
          })
          categoryByNameMap.set(categoryName.toLowerCase(), newCat.id)
          categoryByIdMap.set(newCat.id, newCat.id)
          categoryId = newCat.id
          newCategories.push(categoryName)
        }
      }

      // Check for duplicate item (same name + same category)
      const itemKey = `${row.name.toLowerCase()}||${categoryId || ''}`
      if (existingItemKeys.has(itemKey)) {
        // Update existing item instead of creating duplicate
        const existingItem = existingItems.find(
          (i) => `${i.name.toLowerCase()}||${i.categoryId || ''}` === itemKey
        )
        if (existingItem) {
          await db.item.update({
            where: { id: existingItem.id },
            data: {
              price: row.price,
              quantity: row.quantity,
              description: row.description,
              image: row.imageUrl,
              category: categoryName,
              categoryId,
            },
          })
          updated++
          continue
        }
      }

      await db.item.create({
        data: {
          name: row.name,
          category: categoryName,
          categoryId,
          price: row.price,
          quantity: row.quantity,
          description: row.description,
          image: row.imageUrl,
          unitCode: session.unitCode,
        },
      })
      existingItemKeys.add(itemKey)
      created++
    }

    await logAction(
      session.unitCode, session.userId, session.name, session.role,
      'IMPORT_ITEMS', `${created} items imported, ${updated} updated from CSV`, { created, updated, skipped, newCategories: newCategories.length }, request
    )

    return NextResponse.json({
      created,
      updated,
      skipped,
      total: rows.length,
      newCategories: newCategories.length,
    })
  } catch (error) {
    console.error('Error importing items:', error)
    return NextResponse.json({ error: 'Failed to import items' }, { status: 500 })
  }
}
