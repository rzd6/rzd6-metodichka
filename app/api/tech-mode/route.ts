import { NextResponse } from "next/server"
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
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

const KEY = "tech_mode"

export async function GET() {
  try {
    await ensureTable()
    const db = getPool()
    const res = await db.query("SELECT value FROM app_settings WHERE key = $1", [KEY])
    const enabled = res.rows[0]?.value === "true"
    return NextResponse.json({ enabled })
  } catch (err: any) {
    return NextResponse.json({ enabled: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable()
    const db = getPool()
    const { enabled } = await req.json()
    const value = enabled ? "true" : "false"

    await db.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [KEY, value]
    )

    return NextResponse.json({ success: true, enabled: !!enabled })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
