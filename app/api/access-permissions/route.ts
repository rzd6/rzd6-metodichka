import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import {
  getDefaultSectionPermissions,
  type SectionPermissionsMap,
} from "@/data/access-permissions"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

const SETTINGS_KEY = "section_permissions"

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

export async function GET() {
  try {
    await ensureTable()
    const db = getPool()
    const res = await db.query("SELECT value FROM app_settings WHERE key = $1", [SETTINGS_KEY])
    if (!res.rows[0]?.value) {
      return NextResponse.json({ permissions: getDefaultSectionPermissions() })
    }
    const parsed = JSON.parse(res.rows[0].value) as SectionPermissionsMap
    return NextResponse.json({ permissions: { ...getDefaultSectionPermissions(), ...parsed } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { permissions: getDefaultSectionPermissions(), error: message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()
    const permissions = body.permissions as SectionPermissionsMap
    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json({ error: "permissions required" }, { status: 400 })
    }

    await db.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [SETTINGS_KEY, JSON.stringify(permissions)]
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
