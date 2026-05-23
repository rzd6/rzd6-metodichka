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
    CREATE TABLE IF NOT EXISTS bug_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_nickname TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      sender_secondary_role TEXT,
      sender_position TEXT NOT NULL,
      from_section TEXT NOT NULL,
      message TEXT NOT NULL,
      sender_avatar TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  // Add columns if they don't exist (for existing tables)
  await db.query(`
    ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS sender_avatar TEXT;
    ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS sender_secondary_role TEXT;
  `).catch(() => {})
}

// GET /api/bug-reports — list all bug reports (management only, enforced client-side)
export async function GET() {
  try {
    await ensureTable()
    const db = getPool()
    const result = await db.query(
      "SELECT * FROM bug_reports ORDER BY created_at DESC"
    )
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/bug-reports — submit a new bug report
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()
    const { sender_nickname, sender_role, sender_secondary_role, sender_position, from_section, message, sender_avatar } = body

    if (!sender_nickname || !sender_role || !sender_position || !from_section || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO bug_reports (sender_nickname, sender_role, sender_secondary_role, sender_position, from_section, message, sender_avatar)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sender_nickname, sender_role, sender_secondary_role || null, sender_position, from_section, message, sender_avatar || null]
    )

    return NextResponse.json({ data: result.rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/bug-reports?id=X — delete a bug report
export async function DELETE(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    await db.query("DELETE FROM bug_reports WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
