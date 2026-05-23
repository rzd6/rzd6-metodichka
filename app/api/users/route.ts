import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { notifyUsersChanged } from "./stream/route"

// Disable self-signed cert check for Supabase direct connection
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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      position TEXT NOT NULL,
      rank INTEGER NOT NULL DEFAULT 1,
      avatar TEXT DEFAULT '/avatars/cdud.png',
      vk_id TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_avatar TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_role TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS report_tag TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
  `)
}

// GET /api/users                 — get all users
// GET /api/users?username=X      — get by username
// GET /api/users?username=X&password=Y — authenticate
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username")
    const password = searchParams.get("password")

    if (username && password) {
      const res = await db.query(
        "SELECT * FROM users WHERE username = $1 AND password = $2 LIMIT 1",
        [username, password]
      )
      return NextResponse.json({ data: res.rows[0] ?? null })
    }

    if (username) {
      const res = await db.query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username])
      return NextResponse.json({ data: res.rows[0] ?? null })
    }

    const vkId = searchParams.get("vk_id")
    if (vkId) {
      const res = await db.query("SELECT * FROM users WHERE vk_id = $1 LIMIT 1", [vkId])
      return NextResponse.json({ data: res.rows[0] ?? null })
    }

    const res = await db.query("SELECT * FROM users ORDER BY created_at ASC")
    return NextResponse.json({ data: res.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/users — insert user
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()
    const { username, password, full_name, position, rank, avatar, vk_id } = body

    const res = await db.query(
      `INSERT INTO users (username, password, full_name, position, rank, avatar, vk_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (username) DO NOTHING
       RETURNING *`,
      [username, password, full_name, position, rank, avatar, vk_id ?? null]
    )
    notifyUsersChanged()
    return NextResponse.json({ data: res.rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/users — update user by id
export async function PATCH(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()
    const { id, ...updates } = body

    const fields = Object.keys(updates)
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ")
    const values = [id, ...fields.map((f) => updates[f])]

    const res = await db.query(
      `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    )
    notifyUsersChanged()
    return NextResponse.json({ data: res.rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/users — delete user by id or username
export async function DELETE(req: NextRequest) {
  try {
    await ensureTable()
    const db = getPool()
    const body = await req.json()

    if (body.id) {
      await db.query("DELETE FROM users WHERE id = $1", [body.id])
    } else if (body.username) {
      await db.query("DELETE FROM users WHERE username = $1", [body.username])
    } else {
      return NextResponse.json({ error: "id or username required" }, { status: 400 })
    }

    notifyUsersChanged()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
