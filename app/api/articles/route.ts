import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL_NON_POOLING,
    })
  }
  return pool
}

async function ensureTable() {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_published BOOLEAN NOT NULL DEFAULT true,
      author_name TEXT DEFAULT '',
      author_id TEXT DEFAULT '',
      category TEXT DEFAULT NULL,
      allowed_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
      image_url TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  // Ensure columns exist for older tables
  await db.query(`
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT '';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id TEXT DEFAULT '';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT[] DEFAULT ARRAY[]::TEXT[];
  `).catch(() => {})
}

// GET /api/articles — returns all published articles
export async function GET() {
  try {
    await ensureTable()
    const db = getPool()
    const result = await db.query(
      "SELECT * FROM articles WHERE is_published = true ORDER BY created_at DESC"
    )
    return NextResponse.json({ data: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 })
  }
}

// POST /api/articles — create or update article (called from rzd-website-section)
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()
    const { action, article, id, updates } = body

    if (action === "create") {
      const a = article as any
      const result = await db.query(
        `INSERT INTO articles
           (title, content, is_published, author_name, author_id, category, allowed_roles, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          a.title,
          a.content ?? "",
          a.is_published ?? true,
          a.author_name ?? "",
          a.author_id ?? "",
          a.category ?? null,
          a.allowed_roles ?? [],
          a.image_url ?? [],
        ]
      )
      return NextResponse.json({ data: result.rows[0] })
    }

    if (action === "update") {
      const u = updates as Record<string, any>
      const fields = Object.keys(u)
      if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ")
      const values = [id, ...fields.map((f) => u[f])]
      const result = await db.query(
        `UPDATE articles SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        values
      )
      return NextResponse.json({ data: result.rows[0] ?? null })
    }

    if (action === "delete") {
      await db.query("DELETE FROM articles WHERE id = $1", [id])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 })
  }
}
